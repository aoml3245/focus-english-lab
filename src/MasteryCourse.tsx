import { useMemo, useState } from 'react'
import { ArrowIcon } from './components'
import type { LearningEntry } from './learning'
import { advanceMasteryProgress, buildMasteryOptions, maskMasterySentence, masteryMinimumAttempts, MASTERY_STAGES, normalizeSpelling, type MasteryProgress, type MasteryTask } from './studyGamesEngine'

type Props = {
  entries: LearningEntry[]
  progress: MasteryProgress
  onProgress: (progress: MasteryProgress) => void
  onAttempt?: (word: string, correct: boolean) => void
  onComplete?: (progress: MasteryProgress) => void
  onStudyAgain: () => void
  onNewCourse: () => void
  onExit: () => void
}

const taskText = (task: MasteryTask, entry: LearningEntry) => {
  if (task === 'meaning-recall') return { instruction: '영단어만 보고 뜻을 떠올리세요.', prompt: entry.word, placeholder: '뜻을 적거나 머릿속으로 떠올리세요' }
  if (task === 'spelling-recall') return { instruction: '뜻을 보고 영어 단어를 적으세요.', prompt: entry.meaningKo, placeholder: '영어 단어 입력' }
  if (task === 'cloze-choice') return { instruction: '문맥에 맞는 단어를 고르세요.', prompt: maskMasterySentence(entry), placeholder: '' }
  if (task === 'synonym-choice') return { instruction: '가장 가까운 동의어를 고르세요.', prompt: `${entry.word} · ${entry.meaningEn}`, placeholder: '' }
  return { instruction: '문맥을 보고 빈칸의 단어를 직접 적으세요.', prompt: maskMasterySentence(entry), placeholder: '빈칸에 들어갈 영어 단어' }
}

const expectedAnswer = (task: MasteryTask, entry: LearningEntry) => {
  if (task === 'meaning-recall') return entry.meaningKo
  if (task === 'synonym-choice') return entry.synonyms[0] || entry.meaningEn
  return entry.word
}

export default function MasteryCourse({ entries, progress, onProgress, onAttempt, onComplete, onStudyAgain, onNewCourse, onExit }: Props) {
  const [response, setResponse] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [notice, setNotice] = useState('')
  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.word, entry])), [entries])
  const currentWord = progress.queue[progress.position]
  const entry = entryMap.get(currentWord) || entries[0]
  const stage = MASTERY_STAGES[progress.stageIndex]
  const choice = useMemo(() => stage && entry && (stage.task === 'cloze-choice' || stage.task === 'synonym-choice')
    ? buildMasteryOptions(entry, entries, stage.task)
    : null, [entries, entry, progress.cycle, progress.position, progress.retryRound, stage])
  const answer = entry && stage ? expectedAnswer(stage.task, entry) : ''
  const copy = entry && stage ? taskText(stage.task, entry) : null
  const exactMatch = normalizeSpelling(response) === normalizeSpelling(answer)
  const remaining = Math.max(0, progress.queue.length - progress.position)
  const minimum = masteryMinimumAttempts(entries.length)

  const reveal = (value = response) => {
    setResponse(value)
    setRevealed(true)
    setNotice('')
  }
  const judge = (correct: boolean) => {
    const result = advanceMasteryProgress(progress, correct, entries.map((item) => item.word))
    onAttempt?.(entry.word, correct)
    onProgress(result.progress)
    if (result.progress.complete) onComplete?.(result.progress)
    setResponse('')
    setRevealed(false)
    setNotice(result.transition)
  }

  if (progress.complete) return <section className="mastery-complete">
    <span>MASTERY COMPLETE</span>
    <h1>100개를<br />끝까지 통과했습니다.</h1>
    <p>최소 기준 {minimum.toLocaleString('en-US')}회에 오답 재학습을 더해 총 <strong>{progress.totalAttempts.toLocaleString('en-US')}회</strong> 회상했습니다.</p>
    <div><button className="button button--secondary button--large" onClick={onStudyAgain}>같은 100개 다시 훑기</button><button className="button button--primary button--large" onClick={onNewCourse}>새로운 100개 시작 <ArrowIcon /></button></div>
    <button className="text-button" onClick={onExit}>단어 시험 설정으로</button>
  </section>

  if (!entry || !stage || !copy) return null

  return <section className="mastery-course">
    <header className="mastery-course-head">
      <div><span>100-WORD MASTERY</span><h1>{stage.label}</h1><p>{stage.description} 틀린 단어는 현재 완주 안에서 0개가 될 때까지 다시 나옵니다.</p></div>
      <button className="text-button" onClick={onExit}>그만하기</button>
    </header>
    <div className="mastery-roadmap" aria-label="마스터리 단계">
      {MASTERY_STAGES.map((candidate, index) => <div key={candidate.task} className={index < progress.stageIndex ? 'mastery-step mastery-step--done' : index === progress.stageIndex ? 'mastery-step mastery-step--active' : 'mastery-step'}><span>{index < progress.stageIndex ? '✓' : index + 1}</span><strong>{candidate.label}</strong><small>{candidate.repetitions}완주</small></div>)}
    </div>
    <div className="mastery-stats">
      <div><span>현재 완주</span><strong>{progress.cycle} / {stage.repetitions}</strong></div>
      <div><span>현재 묶음 남음</span><strong>{remaining}</strong></div>
      <div><span>재학습 대기</span><strong>{progress.retryWords.length}</strong></div>
      <div><span>누적 회상</span><strong>{progress.totalAttempts.toLocaleString('en-US')}</strong></div>
    </div>
    {notice && <div className="mastery-notice" role="status">{notice}</div>}
    <article className="mastery-card">
      <div className="mastery-card-meta"><span>{stage.label} · {progress.cycle}/{stage.repetitions}완주 · 재도전 {progress.retryRound}차</span><strong>{progress.position + 1} / {progress.queue.length}</strong></div>
      <p>{copy.instruction}</p>
      <h2 className={stage.task.startsWith('cloze') ? 'mastery-prompt mastery-prompt--sentence' : 'mastery-prompt'}>{copy.prompt}</h2>
      {choice ? <div className="mastery-options">{choice.options.map((option) => <button key={option} disabled={revealed} className={revealed ? option === choice.answer ? 'mastery-option mastery-option--correct' : option === response ? 'mastery-option mastery-option--wrong' : 'mastery-option' : 'mastery-option'} onClick={() => reveal(option)}>{option}</button>)}</div> : <input key={`${stage.task}-${entry.word}-${progress.cycle}-${progress.retryRound}`} autoFocus className="mastery-input" value={response} disabled={revealed} onChange={(event) => setResponse(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') reveal() }} placeholder={copy.placeholder} />}
      {!revealed ? <div className="mastery-reveal"><button className="button button--primary button--large" onClick={() => reveal()}>{choice ? '선택하지 않고 답 보기' : '정답 확인'} <ArrowIcon /></button><small>처음에는 바로 확인해도 됩니다. 뒤 단계로 갈수록 직접 입력이 늘어납니다.</small></div> : <>
        <div className="mastery-answer" aria-live="polite"><span>정답</span><strong>{answer}</strong><p>{entry.meaningEn}</p>{response && <div><small>내 응답</small><p>{response}</p></div>}<blockquote>{entry.example}<small>{entry.translation}</small></blockquote></div>
        <div className="mastery-judgment"><div><span>직접 판정</span><strong>{response ? exactMatch ? '정확히 일치합니다.' : '뜻이나 철자가 충분히 맞는지 직접 결정하세요.' : '머릿속으로 떠올린 답을 기준으로 판단하세요.'}</strong></div><button onClick={() => judge(false)}>↺ 다시 볼게요</button><button className="mastery-correct" onClick={() => judge(true)}>✓ 맞았어요</button></div>
      </>}
    </article>
    <p className="mastery-save-note">진행 상태는 이 브라우저에 자동 저장됩니다. 홈으로 갔다 돌아와도 이어서 시작합니다.</p>
  </section>
}
