import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowIcon, Brand } from './components'
import { loadFavorites, requestVocabulary, type LearningEntry } from './learning'
import MasteryCourse from './MasteryCourse'
import { evaluateStudyAnswer, type StudyAnswerFeedback } from './studyGameCoach'
import { buildStudyQuestions, createMasteryProgress, isObjectiveAnswerCorrect, selectStudyEntries, type MasteryProgress, type StudyGame, type StudyQuestion } from './studyGamesEngine'

const LEVELS = ['All', 'B1', 'B2', 'C1', 'C2']
const SIZES = [10, 20, 30]
const MEMORIZATION_SIZE = 100
const DECK_PAGE_SIZE = 10
const MASTERY_STORAGE_KEY = 'focus-english-lab:mastery-course:v1'

type SavedMasteryCourse = { version: 1; deck: LearningEntry[]; progress: MasteryProgress | null; view: 'memorize' | 'mastery'; deckPage: number }

function loadSavedMasteryCourse(): SavedMasteryCourse | null {
  try {
    const saved = JSON.parse(localStorage.getItem(MASTERY_STORAGE_KEY) || 'null') as SavedMasteryCourse | null
    return saved?.version === 1 && Array.isArray(saved.deck) && saved.deck.length > 0 ? saved : null
  } catch { return null }
}

type Judgment = 'correct' | 'retry' | null

const taskCopy = (question: StudyQuestion) => {
  if (question.task === 'meaning') return { label: '영어 → 뜻', instruction: '이 단어의 뜻을 한국어로 적어 보세요.', prompt: question.entry.word }
  if (question.task === 'spelling') return { label: '뜻 → 영어', instruction: '뜻에 맞는 영어 단어를 적어 보세요.', prompt: question.entry.meaningKo }
  if (question.task === 'synonym') return { label: '동의어 선택', instruction: '가장 가까운 동의어를 고르세요.', prompt: question.entry.word }
  if (question.task === 'translation') return { label: '문장 해석', instruction: '문장의 의미를 자연스러운 한국어로 적어 보세요.', prompt: question.entry.example }
  return { label: '문장 영작', instruction: '한국어 문장을 자연스러운 영어로 표현해 보세요.', prompt: question.entry.translation }
}

export default function StudyGames({ onBack }: { onBack: () => void }) {
  const [savedCourse] = useState(loadSavedMasteryCourse)
  const [vocabulary, setVocabulary] = useState<LearningEntry[]>([])
  const [loadError, setLoadError] = useState('')
  const [game, setGame] = useState<StudyGame>('vocabulary')
  const [level, setLevel] = useState('B2')
  const [size, setSize] = useState(10)
  const [academicOnly, setAcademicOnly] = useState(true)
  const [savedOnly, setSavedOnly] = useState(false)
  const [questions, setQuestions] = useState<StudyQuestion[]>([])
  const [studyDeck, setStudyDeck] = useState<LearningEntry[]>(() => savedCourse?.deck || [])
  const [memorizing, setMemorizing] = useState(() => savedCourse?.view === 'memorize')
  const [mastery, setMastery] = useState<MasteryProgress | null>(() => savedCourse?.progress || null)
  const [deckPage, setDeckPage] = useState(() => savedCourse?.deckPage || 0)
  const [index, setIndex] = useState(0)
  const [response, setResponse] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [judgment, setJudgment] = useState<Judgment>(null)
  const [correct, setCorrect] = useState(0)
  const [evaluating, setEvaluating] = useState(false)
  const [feedback, setFeedback] = useState<StudyAnswerFeedback | null>(null)
  const [feedbackError, setFeedbackError] = useState('')
  const evaluationRequest = useRef(0)
  const favorites = useMemo(() => loadFavorites(), [])

  useEffect(() => {
    let active = true
    requestVocabulary().then((entries) => { if (active) setVocabulary(entries) }).catch((cause: unknown) => { if (active) setLoadError(cause instanceof Error ? cause.message : '단어 데이터를 불러오지 못했습니다.') })
    return () => { active = false; evaluationRequest.current += 1 }
  }, [])

  useEffect(() => {
    try {
      if (!studyDeck.length || (!memorizing && !mastery)) localStorage.removeItem(MASTERY_STORAGE_KEY)
      else localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify({ version: 1, deck: studyDeck, progress: mastery, view: mastery ? 'mastery' : 'memorize', deckPage } satisfies SavedMasteryCourse))
    } catch { /* storage can be disabled */ }
  }, [deckPage, mastery, memorizing, studyDeck])

  const available = useMemo(() => vocabulary.filter((entry) =>
    (level === 'All' || entry.cefr === level) &&
    (!academicOnly || Boolean(entry.academicCore)) &&
    (!savedOnly || favorites.has(entry.word)) &&
    (game === 'vocabulary' || entry.source === 'corpus'),
  ).length, [academicOnly, favorites, game, level, savedOnly, vocabulary])

  const resetAnswer = () => { evaluationRequest.current += 1; setResponse(''); setRevealed(false); setJudgment(null); setEvaluating(false); setFeedback(null); setFeedbackError('') }
  const start = () => {
    const next = buildStudyQuestions(vocabulary, game, size, { level, academicOnly, savedWords: savedOnly ? favorites : undefined })
    setStudyDeck([]); setMemorizing(false); setMastery(null); setQuestions(next); setIndex(0); setCorrect(0); resetAnswer()
  }
  const startMemorizing = () => {
    const deck = selectStudyEntries(vocabulary, MEMORIZATION_SIZE, { level, academicOnly, savedWords: savedOnly ? favorites : undefined })
    setStudyDeck(deck); setMemorizing(true); setMastery(null); setDeckPage(0); setQuestions([]); setIndex(0); setCorrect(0); resetAnswer()
  }
  const startMastery = () => { setMemorizing(false); setMastery(createMasteryProgress(studyDeck)); setDeckPage(0); setQuestions([]); resetAnswer() }
  const repeatDeckStudy = () => { setMastery(null); setMemorizing(true); setDeckPage(0); setQuestions([]); resetAnswer() }
  const restartSetup = () => { setStudyDeck([]); setMemorizing(false); setMastery(null); setDeckPage(0); setQuestions([]); setIndex(0); setCorrect(0); resetAnswer() }
  const question = questions[index]
  const finished = questions.length > 0 && index >= questions.length

  const reveal = (answer = response) => {
    if (!question) return
    setResponse(answer)
    setRevealed(true)
    const objective = isObjectiveAnswerCorrect(question, answer)
    if (objective !== null) {
      setJudgment(objective ? 'correct' : 'retry')
      if (objective) setCorrect((value) => value + 1)
    }
  }
  const judge = (next: Exclude<Judgment, null>) => {
    if (judgment === next) return
    if (judgment === 'correct') setCorrect((value) => Math.max(0, value - 1))
    if (next === 'correct') setCorrect((value) => value + 1)
    setJudgment(next)
  }
  const next = () => { setIndex((value) => value + 1); resetAnswer() }
  const evaluate = async () => {
    if (!question || !response.trim()) return
    const requestId = ++evaluationRequest.current
    setEvaluating(true); setFeedbackError('')
    try {
      const result = await evaluateStudyAnswer(question, response.trim())
      if (evaluationRequest.current === requestId) setFeedback(result)
    }
    catch (cause) { if (evaluationRequest.current === requestId) setFeedbackError(cause instanceof Error ? cause.message : '평가를 완료하지 못했습니다.') }
    finally { if (evaluationRequest.current === requestId) setEvaluating(false) }
  }

  return <div className="study-page">
    <header><Brand /><button className="text-button" onClick={onBack}><ArrowIcon direction="left" /> 홈으로</button></header>
    <main>
      {mastery ? <MasteryCourse entries={studyDeck} progress={mastery} onProgress={setMastery} onStudyAgain={repeatDeckStudy} onNewCourse={startMemorizing} onExit={restartSetup} /> : memorizing ? <MemorizationDeck entries={studyDeck} page={deckPage} onPage={setDeckPage} onStartMastery={startMastery} /> : !questions.length ? <>
        <section className="study-hero"><span>VOCABULARY LAB</span><h1>외우는 대신,<br />꺼내 쓰는 연습.</h1><p>29,976개 단어장에서 뜻과 동의어를 확인하고, 문제 문맥 문장으로 해석과 영작을 연습합니다. 답은 언제든 바로 볼 수 있습니다.</p></section>
        <section className="study-mode-grid" aria-label="학습 게임 선택">
          <button className={game === 'vocabulary' ? 'study-mode study-mode--active' : 'study-mode'} onClick={() => setGame('vocabulary')}><span>01</span><strong>단어 시험</strong><p>뜻 입력 · 동의어 선택 · 철자 회상</p></button>
          <button className={game === 'sentence' ? 'study-mode study-mode--active' : 'study-mode'} onClick={() => setGame('sentence')}><span>02</span><strong>문장 미니게임</strong><p>문장 해석 · 한국어를 영어로 영작</p></button>
        </section>
        <section className="study-setup">
          <div><h2>{game === 'vocabulary' ? '단어 시험 설정' : '문장 미니게임 설정'}</h2><p>{game === 'sentence' ? '문제은행에서 실제 사용된 문맥 예문만 출제합니다.' : '세 유형을 고르게 섞어 즉시 피드백합니다.'}</p></div>
          <div className="study-settings">
            <label><span>난이도</span><select value={level} onChange={(event) => setLevel(event.target.value)}>{LEVELS.map((value) => <option key={value} value={value}>{value === 'All' ? '전체' : value}</option>)}</select></label>
            <label><span>문항 수</span><select value={size} onChange={(event) => setSize(Number(event.target.value))}>{SIZES.map((value) => <option key={value} value={value}>{value}문항</option>)}</select></label>
            <button className={academicOnly ? 'study-toggle study-toggle--active' : 'study-toggle'} onClick={() => setAcademicOnly((value) => !value)}>학술 핵심</button>
            <button className={savedOnly ? 'study-toggle study-toggle--active' : 'study-toggle'} onClick={() => setSavedOnly((value) => !value)}>저장한 단어만</button>
          </div>
          <div className="study-start"><span>{vocabulary.length ? `${available.toLocaleString('en-US')}개 출제 가능` : loadError || '단어장을 불러오는 중입니다.'}</span><div className="study-start-actions">{game === 'vocabulary' && <button className="button button--secondary button--large" disabled={available < MEMORIZATION_SIZE} onClick={startMemorizing}>100단어 마스터리 시작</button>}<button className="button button--primary button--large" disabled={!available} onClick={start}>바로 게임 시작 <ArrowIcon /></button></div></div>
        </section>
      </> : finished ? <section className="study-finish"><span>SESSION COMPLETE</span><h1>{correct} / {questions.length}</h1><p>맞았다고 표시한 문항과 자동 채점 결과를 합산했습니다. 애매했던 답은 다시 풀면서 회상 간격을 좁혀 보세요.</p><div><button className="button button--secondary button--large" onClick={restartSetup}>설정 바꾸기</button><button className="button button--primary button--large" onClick={start}>새 문제 다시 풀기 <ArrowIcon /></button></div></section> : question && <StudyRound question={question} index={index} total={questions.length} response={response} setResponse={setResponse} revealed={revealed} judgment={judgment} correct={correct} feedback={feedback} feedbackError={feedbackError} evaluating={evaluating} onReveal={reveal} onJudge={judge} onNext={next} onEvaluate={evaluate} />}
    </main>
  </div>
}

function MemorizationDeck({ entries, page, onPage, onStartMastery }: { entries: LearningEntry[]; page: number; onPage: (page: number) => void; onStartMastery: () => void }) {
  const pages = Math.max(1, Math.ceil(entries.length / DECK_PAGE_SIZE))
  const visible = entries.slice(page * DECK_PAGE_SIZE, (page + 1) * DECK_PAGE_SIZE)
  return <section className="memorization-deck">
    <div className="memorization-head"><div><span>MASTERY PREP</span><h1>{entries.length}개를 먼저 익혀보세요.</h1><p>10개씩 뜻·동의어·예문을 확인하세요. 이후 최소 1,100회 회상하는 5단계 코스가 시작됩니다.</p></div><strong>{page + 1} / {pages}</strong></div>
    <div className="memorization-progress"><i style={{ width: `${((page + 1) / pages) * 100}%` }} /></div>
    <div className="memorization-grid">{visible.map((entry, index) => <article key={entry.word}><span>{page * DECK_PAGE_SIZE + index + 1}</span><div><h2>{entry.word}</h2><small>{entry.partOfSpeech} · {entry.cefr}</small></div><strong>{entry.meaningKo}</strong><p>{entry.synonyms.slice(0, 3).join(' · ') || entry.meaningEn}</p><blockquote>{entry.example}<small>{entry.translation}</small></blockquote></article>)}</div>
    <div className="memorization-actions"><button className="button button--secondary button--large" disabled={page === 0} onClick={() => onPage(page - 1)}><ArrowIcon direction="left" /> 이전 10개</button>{page + 1 < pages ? <button className="button button--primary button--large" onClick={() => onPage(page + 1)}>다음 10개 <ArrowIcon /></button> : <button className="button button--primary button--large" onClick={onStartMastery}>5단계 마스터리 시작 <ArrowIcon /></button>}</div>
  </section>
}

function StudyRound({ question, index, total, response, setResponse, revealed, judgment, correct, feedback, feedbackError, evaluating, onReveal, onJudge, onNext, onEvaluate }: { question: StudyQuestion; index: number; total: number; response: string; setResponse: (value: string) => void; revealed: boolean; judgment: Judgment; correct: number; feedback: StudyAnswerFeedback | null; feedbackError: string; evaluating: boolean; onReveal: (answer?: string) => void; onJudge: (value: Exclude<Judgment, null>) => void; onNext: () => void; onEvaluate: () => void }) {
  const copy = taskCopy(question)
  const sentence = question.game === 'sentence'
  return <section className="study-round">
    <div className="study-progress"><div><i style={{ width: `${((index + 1) / total) * 100}%` }} /></div><span>{index + 1} / {total}</span><strong>{correct}개 정답</strong></div>
    <div className="study-round-head"><span>{copy.label} · {question.entry.cefr}</span><h1>{copy.instruction}</h1></div>
    <article className={sentence ? 'study-prompt study-prompt--sentence' : 'study-prompt'}><strong>{copy.prompt}</strong>{question.task !== 'spelling' && <small>{question.entry.partOfSpeech} · {question.entry.topics.slice(0, 2).join(' · ')}</small>}</article>
    {question.task === 'synonym' ? <div className="study-options">{question.options?.map((option) => <button key={option} disabled={revealed} className={revealed ? option === question.answer ? 'study-option study-option--correct' : option === response ? 'study-option study-option--wrong' : 'study-option' : 'study-option'} onClick={() => onReveal(option)}>{option}</button>)}</div> : sentence ? <textarea autoFocus value={response} disabled={revealed} onChange={(event) => setResponse(event.target.value)} placeholder={question.task === 'translation' ? '내 해석을 적어 보세요.' : '내 영작을 적어 보세요.'} /> : <input autoFocus className="study-answer-input" value={response} disabled={revealed} onChange={(event) => setResponse(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onReveal() }} placeholder={question.task === 'meaning' ? '한국어 뜻 입력' : '영어 단어 입력'} />}
    {!revealed ? <div className="study-round-actions"><button className="button button--primary button--large" onClick={() => onReveal()}>정답 확인</button><small>답을 쓰지 않아도 바로 확인할 수 있어요.</small></div> : <>
      <section className="study-answer" aria-live="polite"><span>정답 예시</span><strong>{question.answer}</strong>{question.game === 'vocabulary' && <p>{question.entry.meaningEn}</p>}{response && <div><small>내 답</small><p>{response}</p></div>}</section>
      {(question.task === 'meaning' || sentence) && <div className="study-self-grade"><span>내 답은 의미가 맞았나요?</span><button className={judgment === 'correct' ? 'active' : ''} onClick={() => onJudge('correct')}>✓ 맞았어요</button><button className={judgment === 'retry' ? 'active retry' : ''} onClick={() => onJudge('retry')}>↺ 다시 볼게요</button></div>}
      {sentence && response.trim() && <section className="study-ai"><div><span>선택 기능</span><strong>로컬 LLM에게 표현 평가 받기</strong><p>정답과 다른 자연스러운 표현도 의미·문법·어휘를 기준으로 평가합니다.</p></div><button className="button button--secondary" disabled={evaluating} onClick={onEvaluate}>{evaluating ? '평가 중…' : feedback ? '다시 평가' : 'LLM 평가 받기'}</button>{feedbackError && <p className="study-ai-error">{feedbackError}</p>}{feedback && <div className="study-ai-feedback"><strong>{feedback.score.toFixed(0)}점 <small>· {feedback.model}</small></strong><p>{feedback.verdictKo}</p><dl><dt>확인된 점</dt><dd>{feedback.goodPointKo}</dd><dt>다듬을 점</dt><dd>{feedback.correctionKo}</dd><dt>개선 예시</dt><dd>{feedback.improvedAnswer}</dd></dl></div>}</section>}
      <div className="study-next"><button className="button button--primary button--large" onClick={onNext}>{index + 1 === total ? '결과 보기' : '다음 문제'} <ArrowIcon /></button></div>
    </>}
  </section>
}
