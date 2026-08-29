import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { ArrowIcon } from './components'
import { normalizeWord, savePersonalWord, type LearningEntry } from './learning'
import { advanceDailyWordBatch, attachPersonalMeaning, createDailyWordBatch, currentDailyTask, downloadPersonalVocabularyBackup, findVocabularyMatches, importPersonalVocabularyBackup, loadActiveDailyBatch, loadPersonalWordStats, markPersonalWordsMastered, parseDailyWordLines, recordPersonalWordAttempt, saveActiveDailyBatch, saveVocabularySession, type DailyWordBatch } from './personalVocabulary'
import { normalizeSpelling } from './studyGamesEngine'

type Props = {
  vocabulary: LearningEntry[]
  onLibraryChanged: () => void
}

const fallbackEntry = (word: string, meaningKo: string): LearningEntry => ({
  word,
  meaningKo,
  personalMeaningKo: meaningKo,
  meaningEn: '',
  partOfSpeech: 'word',
  cefr: '—',
  ipa: '',
  synonyms: [],
  example: `I am learning the word “${word}” today.`,
  translation: `오늘 “${word}”라는 단어를 학습하고 있습니다.`,
  frequency: 0,
  topics: ['내가 만든 단어장'],
  source: 'dictionary',
})

const offerBackup = (message: string) => {
  if (import.meta.env.PROD || import.meta.env.VITE_FIREBASE_PROJECT_ID) return
  window.setTimeout(() => {
    if (window.confirm(`${message}\n\n지금 개인 단어장과 학습 기록을 백업 파일로 저장할까요?`)) downloadPersonalVocabularyBackup()
  }, 0)
}

export default function PersonalVocabularyWorkspace({ vocabulary, onLibraryChanged }: Props) {
  const [input, setInput] = useState('')
  const deferredInput = useDeferredValue(input)
  const [selectedWords, setSelectedWords] = useState<Record<string, string>>({})
  const [batch, setBatch] = useState<DailyWordBatch | null>(loadActiveDailyBatch)
  const [training, setTraining] = useState(false)
  const [response, setResponse] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [meaningJudgment, setMeaningJudgment] = useState<boolean | null>(null)
  const [status, setStatus] = useState('')
  const [completed, setCompleted] = useState<{ words: number; attempts: number; incorrect: number } | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const parsed = useMemo(() => parseDailyWordLines(input), [input])
  const matchRows = useMemo(() => parseDailyWordLines(deferredInput).map((item) => ({ ...item, matches: findVocabularyMatches(item.word, vocabulary) })), [deferredInput, vocabulary])
  const task = batch ? currentDailyTask(batch) : null
  const stats = loadPersonalWordStats()
  const trackedWords = Object.keys(stats).length
  const totalIncorrect = Object.values(stats).reduce((sum, item) => sum + item.incorrect, 0)

  const saveInput = async () => {
    if (!parsed.length || batch) return
    setStatus('단어 정보를 확인하고 있습니다…')
    try {
      const entries = parsed.map(({ word, meaningKo }) => {
        const selectedWord = selectedWords[word] || word
        const local = vocabulary.find((entry) => normalizeWord(entry.word) === selectedWord)
        return local ? attachPersonalMeaning(local, meaningKo) : fallbackEntry(word, meaningKo)
      })
      const next = createDailyWordBatch(entries)
      saveActiveDailyBatch(next)
      setBatch(next)
      setInput('')
      setSelectedWords({})
      setStatus(`${entries.length}개 단어를 오늘 학습 대기에 저장했습니다.`)
      offerBackup('오늘 입력한 단어를 브라우저에 저장했습니다.')
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : '단어를 저장하지 못했습니다.')
    }
  }

  const reveal = () => {
    if (!task) return
    setRevealed(true)
    if (task.direction === 'spelling') setMeaningJudgment(normalizeSpelling(response) === normalizeSpelling(task.entry.word))
  }

  const submitJudgment = (correct: boolean) => {
    if (!batch || !task) return
    recordPersonalWordAttempt(task.entry.word, correct)
    const next = advanceDailyWordBatch(batch, correct)
    setResponse('')
    setRevealed(false)
    setMeaningJudgment(null)
    if (!next.complete) {
      saveActiveDailyBatch(next)
      setBatch(next)
      return
    }
    for (const entry of next.entries) savePersonalWord(entry)
    markPersonalWordsMastered(next.entries.map((entry) => entry.word))
    saveVocabularySession({
      id: next.id,
      kind: 'daily-intake',
      startedAt: next.createdAt,
      completedAt: new Date().toISOString(),
      wordCount: next.entries.length,
      attempts: next.totalAttempts,
      correct: next.entries.length * 2,
      incorrect: Math.max(0, next.totalAttempts - next.entries.length * 2),
    })
    saveActiveDailyBatch(null)
    setBatch(null)
    setTraining(false)
    setCompleted({ words: next.entries.length, attempts: next.totalAttempts, incorrect: Math.max(0, next.totalAttempts - next.entries.length * 2) })
    setStatus(`${next.entries.length}개를 모두 통과해 내 단어장에 넣었습니다.`)
    onLibraryChanged()
    offerBackup('오늘 단어 시험을 모두 통과했고, 시도 기록까지 저장했습니다.')
  }

  const importBackup = async (file: File | undefined) => {
    if (!file) return
    try {
      const result = importPersonalVocabularyBackup(await file.text())
      setBatch(loadActiveDailyBatch())
      setCompleted(null)
      setStatus(`${result.words}개 개인 단어와 ${result.sessions}개 학습 기록을 병합했습니다.`)
      onLibraryChanged()
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : '백업 파일을 가져오지 못했습니다.')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  if (training && batch && task) {
    const correct = meaningJudgment === true
    return <section className="daily-trainer" aria-label="오늘 단어 완전 암기 시험">
      <div className="daily-trainer__head"><div><span>TODAY'S INTAKE</span><h2>다 맞을 때까지 계속.</h2><p>틀린 방향만 다시 섞여 나옵니다. 두 방향이 모두 0개가 되면 내 단어장으로 옮겨집니다.</p></div><strong>{batch.position + 1} / {batch.queue.length}</strong></div>
      <div className="daily-trainer__stats"><span>입력 단어 {batch.entries.length}개</span><span>재도전 {batch.retryRound}차</span><span>누적 시도 {batch.totalAttempts}회</span></div>
      <article className="daily-trainer__card">
        <small>{task.direction === 'meaning' ? '영어 → 한국어 뜻' : '한국어 뜻 → 영어 철자'}</small>
        <h3>{task.direction === 'meaning' ? task.entry.word : task.entry.personalMeaningKo || task.entry.meaningKo}</h3>
        <input autoFocus value={response} disabled={revealed} onChange={(event) => setResponse(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') reveal() }} placeholder={task.direction === 'meaning' ? '한국어 뜻을 적어 보세요' : '영어 단어를 적어 보세요'} />
        {!revealed ? <button className="button button--primary button--large" onClick={reveal}>정답 확인 <ArrowIcon /></button> : <>
          <div className="daily-trainer__answer"><span>정답</span><strong>{task.direction === 'meaning' ? task.entry.personalMeaningKo || task.entry.meaningKo : task.entry.word}</strong>{task.direction === 'meaning' && task.entry.dictionaryMeaningKo && <p>기존 단어장 뜻: {task.entry.dictionaryMeaningKo}</p>}{response && <p>내 답: {response}</p>}</div>
          {task.direction === 'meaning' ? <div className="daily-trainer__judge"><span>뜻이 맞았나요?</span><button onClick={() => submitJudgment(false)}>↺ 다시 볼게요</button><button className="mastery-correct" onClick={() => submitJudgment(true)}>✓ 맞았어요</button></div> : <div className="daily-trainer__judge"><span>{correct ? '철자가 정확히 일치합니다.' : '철자가 달라서 다시 출제됩니다.'}</span><button className={correct ? 'mastery-correct' : ''} onClick={() => submitJudgment(correct)}>{correct ? '다음 문제' : '오답 저장하고 계속'} <ArrowIcon /></button></div>}
        </>}
      </article>
      <button className="text-button" onClick={() => setTraining(false)}>입력 화면으로 돌아가기</button>
    </section>
  }

  return <section className="personal-vocabulary" aria-label="내 단어장 관리">
    <div className="personal-vocabulary__head"><div><span>MY DAILY VOCABULARY</span><h2>오늘 외운 단어 넣기</h2><p>한 줄에 <code>영단어, 한국어 뜻</code> 형식으로 여러 개를 붙여넣으세요. 입력 묶음은 모두 맞힌 뒤에만 내 단어장으로 들어갑니다.</p></div><dl><div><dt>학습 기록 단어</dt><dd>{trackedWords}</dd></div><div><dt>누적 오답</dt><dd>{totalIncorrect}</dd></div></dl></div>
    {completed && <div className="personal-vocabulary__complete" role="status"><strong>{completed.words}개 단어 편입 완료</strong><span>{completed.attempts}회 시도 · 오답 {completed.incorrect}회까지 저장했습니다.</span></div>}
    {batch ? <div className="personal-vocabulary__pending"><div><span>진행 중인 입력 묶음</span><strong>{batch.entries.length}개 · {batch.totalAttempts}회 시도</strong><p>두 방향 시험을 모두 맞히면 자동으로 내 단어장에 편입됩니다.</p></div><button className="button button--primary button--large" onClick={() => setTraining(true)}>{batch.totalAttempts ? '이어 풀기' : '완전 암기 시험 시작'} <ArrowIcon /></button></div> : <div className="personal-vocabulary__input"><label><span>단어 여러 개 붙여넣기</span><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={'abandon, 버리다; 포기하다\ncoherent, 일관성 있는\nsubsequent, 그 다음의'} /></label>{matchRows.length > 0 && <section className="word-match-list" aria-label="기존 단어장 검색 결과">{matchRows.map((row) => <WordMatchRow key={row.word} word={row.word} meaningKo={row.meaningKo} matches={row.matches} selectedWord={selectedWords[row.word] || row.matches.find((match) => match.kind === 'exact')?.entry.word || row.word} onSelect={(selectedWord) => setSelectedWords((current) => ({ ...current, [row.word]: normalizeWord(selectedWord) }))} />)}</section>}<div><span>{parsed.length ? `${parsed.length}개 인식됨 · 기존 단어 후보를 확인해 주세요.` : '영단어와 뜻이 모두 있는 줄만 저장됩니다.'}</span><button className="button button--primary button--large" disabled={!parsed.length} onClick={saveInput}>오늘 단어 저장 <ArrowIcon /></button></div></div>}
    <div className="personal-vocabulary__backup"><div><strong>수동 백업 및 복원</strong><p>Firebase 동기화와 별도로 JSON 백업을 보관할 수 있습니다. iCloud Drive나 파일 앱을 이용해 다른 기기에서 가져오면 기존 기록과 안전하게 병합됩니다.</p></div><div><button className="button button--secondary" onClick={downloadPersonalVocabularyBackup}>내 단어장 내보내기</button><button className="button button--secondary" onClick={() => importRef.current?.click()}>내 단어장 가져오기</button><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => importBackup(event.target.files?.[0])} /></div></div>
    {status && <p className="personal-vocabulary__status" role="status">{status}</p>}
  </section>
}

function WordMatchRow({ word, meaningKo, matches, selectedWord, onSelect }: { word: string; meaningKo: string; matches: ReturnType<typeof findVocabularyMatches>; selectedWord: string; onSelect: (word: string) => void }) {
  const selectedMatch = matches.find((match) => normalizeWord(match.entry.word) === normalizeWord(selectedWord))
  return <article className="word-match-row">
    <div className="word-match-row__input"><span>내가 입력한 단어</span><strong>{word}</strong><p><small>내 뜻</small>{meaningKo}</p></div>
    <div className="word-match-row__results"><span>{matches.length ? '기존 단어장 후보' : '기존 단어장에 가까운 후보 없음'}</span>{matches.length ? <div>{matches.map((match) => {
      const selected = normalizeWord(match.entry.word) === normalizeWord(selectedWord)
      return <button type="button" key={match.entry.word} className={selected ? 'word-match-option word-match-option--selected' : 'word-match-option'} onClick={() => onSelect(match.entry.word)}><span>{match.kind === 'exact' ? '정확히 일치' : '비슷한 철자'}</span><strong>{match.entry.word}</strong><p><small>기존 뜻</small>{match.entry.meaningKo}</p>{selected && <em>이 단어로 연결됨</em>}</button>
    })}</div> : <p className="word-match-row__none">입력한 철자 그대로 새 단어로 저장합니다.</p>}</div>
    {selectedMatch && <div className="word-match-row__compare"><div><small>내 단어장 뜻</small><strong>{meaningKo}</strong></div><div><small>기존 단어장 뜻</small><strong>{selectedMatch.entry.meaningKo}</strong></div></div>}
  </article>
}
