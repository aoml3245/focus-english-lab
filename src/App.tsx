import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { AudioPrompt, ArrowIcon, Brand, Recorder, Timer } from './components'
import { buildFullPracticeSet, buildSectionPractice, CONTEXT_TOPIC_COUNT, countBySection, PRACTICE_ITEMS, SECTION_META } from './data'
import { displayAnswer, getSessionStats, isCorrect } from './review'
import { finishSession, loadActive, loadExcludedItemIds, loadHistory, saveActive, setSessionRandomEligibility } from './storage'
import { getVoiceProfile, playTTS, prepareExamTTS, stopTTS } from './tts'
import type { Answer, BaseItem, PracticeMode, SavedSession, Section } from './types'

const Vocabulary = lazy(() => import('./Vocabulary'))
const VoiceSettings = lazy(() => import('./VoiceSettings'))
const ReadingAssistant = lazy(() => import('./ReadingAssistant'))
const WritingCoach = lazy(() => import('./WritingCoach'))
const History = lazy(() => import('./History'))
type Screen = 'home' | 'section-select' | 'intro' | 'test' | 'result' | 'vocabulary' | 'voice-settings' | 'history'
const ITEM_BY_ID = new Map(PRACTICE_ITEMS.map((item) => [item.id, item]))
const BANK_SIZE = PRACTICE_ITEMS.length.toLocaleString('en-US')
const PREFLIGHT_AUDIO_TEXT = 'The audio system is ready. You may begin the practice test.'

function savedSessionLabel(entry: SavedSession) {
  if (entry.mode === 'study') return '즉시 피드백 랜덤 세트'
  if (entry.mode === 'mock') return '실전 모의시험'
  const sections = [...new Set((entry.itemIds || []).map((id) => ITEM_BY_ID.get(id)?.section).filter((section): section is Section => Boolean(section)))]
  return sections.length > 1 ? '전체 모의시험' : sections[0] ? `${SECTION_META[sections[0]].label} 집중 연습` : '연습 세트'
}

const newSession = (items: BaseItem[], mode: PracticeMode): SavedSession => {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), itemIds: items.map((item) => item.id), startedAt: now, updatedAt: now, itemIndex: 0, answers: {}, completed: false, mode, reviewedItemIds: [] }
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [items, setItems] = useState(PRACTICE_ITEMS)
  const [session, setSession] = useState<SavedSession | null>(loadActive)
  const [result, setResult] = useState<SavedSession | null>(null)
  const [poolMessage, setPoolMessage] = useState('')
  const [historySessionId, setHistorySessionId] = useState<string | null>(null)

  const begin = (selected: BaseItem[], mode: PracticeMode) => {
    if (!selected.length) { setPoolMessage('랜덤 후보 문항이 없습니다. 학습 기록에서 이전 문항을 다시 랜덤 후보에 포함해 주세요.'); setScreen('home'); return }
    setPoolMessage('')
    const next = newSession(selected, mode); setItems(selected); setSession(next); saveActive(next); setScreen('intro')
  }
  const resume = () => {
    if (!session) return
    const restored = session.itemIds?.map((id) => ITEM_BY_ID.get(id)).filter((item): item is BaseItem => Boolean(item)) || []
    if (restored.length === session.itemIds?.length && restored.length > 0) { setItems(restored); setScreen('intro') }
    else begin(buildFullPracticeSet(loadExcludedItemIds()), session.mode || 'mock')
  }
  const updateAnswer = (itemId: string, answer: Answer) => {
    setSession((current) => {
      if (!current) return current
      const next = { ...current, updatedAt: new Date().toISOString(), answers: { ...current.answers, [itemId]: answer } }
      saveActive(next); return next
    })
  }
  const finish = () => {
    if (!session) return
    const completed = finishSession(session); setResult(completed); setSession(null); setScreen('result')
  }

  const updateResultEligibility = (randomEligible: boolean) => {
    if (!result) return
    setSessionRandomEligibility(result.id, randomEligible)
    setResult({ ...result, randomEligible })
  }
  const openHistory = (sessionId: string | null = null) => { setHistorySessionId(sessionId); setScreen('history') }

  if (screen === 'home') return <Home session={session} poolMessage={poolMessage} onStudy={() => begin(buildFullPracticeSet(loadExcludedItemIds()), 'study')} onMock={() => begin(buildFullPracticeSet(loadExcludedItemIds()), 'mock')} onResume={resume} onSections={() => setScreen('section-select')} onVocabulary={() => setScreen('vocabulary')} onVoiceSettings={() => setScreen('voice-settings')} onHistory={openHistory} />
  if (screen === 'vocabulary') return <Suspense fallback={<div className="route-loading">단어장을 불러오는 중입니다…</div>}><Vocabulary onBack={() => setScreen('home')} /></Suspense>
  if (screen === 'voice-settings') return <Suspense fallback={<div className="route-loading">음성 설정을 불러오는 중입니다…</div>}><VoiceSettings onBack={() => setScreen('home')} /></Suspense>
  if (screen === 'history') return <Suspense fallback={<div className="route-loading">학습 기록을 불러오는 중입니다…</div>}><History initialSessionId={historySessionId} onBack={() => { setHistorySessionId(null); setScreen('home') }} /></Suspense>
  if (screen === 'section-select') return <SectionSelect onBack={() => setScreen('home')} onSelect={(section) => begin(buildSectionPractice(section, loadExcludedItemIds()), 'section')} />
  if (screen === 'intro') return <Intro items={items} mode={session?.mode || 'mock'} onBack={() => setScreen('home')} onStart={() => setScreen('test')} />
  if (screen === 'test' && session) return <Test items={items} session={session} setSession={setSession} onAnswer={updateAnswer} onFinish={finish} />
  if (screen === 'result' && result) return <Result items={items} session={result} onHome={() => setScreen('home')} onRetry={() => begin(items, result.mode || 'mock')} onRandomEligibilityChange={updateResultEligibility} />
  return null
}

function Home({ session, poolMessage, onStudy, onMock, onResume, onSections, onVocabulary, onVoiceSettings, onHistory }: { session: SavedSession | null; poolMessage: string; onStudy: () => void; onMock: () => void; onResume: () => void; onSections: () => void; onVocabulary: () => void; onVoiceSettings: () => void; onHistory: (sessionId?: string | null) => void }) {
  const history = loadHistory()
  return <div className="app-shell">
    <aside className="sidebar"><Brand /><nav><button className="nav-item nav-item--active">홈</button><button className="nav-item" onClick={onMock}>모의시험</button><button className="nav-item" onClick={onSections}>섹션 연습</button><button className="nav-item" onClick={onVocabulary}>단어장</button><button className="nav-item" onClick={onVoiceSettings}>음성 설정</button><button className="nav-item" onClick={() => onHistory()}>학습 기록</button></nav><div className="sidebar-note"><strong>안내</strong><p>모든 점수는 연습용 추정치이며 ETS 공식 점수가 아닙니다. 기록은 이 기기에만 저장됩니다.</p></div></aside>
    <main className="dashboard"><div className="dashboard-top"><div><h1>실전처럼, 매일 새 세트.</h1><p>{BANK_SIZE}개의 독창적인 문제은행에서 한 주제를 여러 맥락과 관점으로 연습합니다.</p><div className="actions"><button className="button button--primary button--large" onClick={onStudy}>랜덤 전체 세트 시작 <ArrowIcon /></button><button className="button button--secondary button--large" onClick={onMock}>실전 모의시험</button><button className="button button--secondary button--large" onClick={onSections}>섹션 연습</button><button className="button button--secondary button--large" onClick={onVocabulary}>단어장</button><button className="button button--secondary button--large" onClick={onVoiceSettings}>음성 설정</button></div><div className="mode-difference"><div><strong>⚡ 랜덤 전체 세트</strong><span>한 문제씩 풀고 즉시 정답과 해설을 확인합니다.</span></div><div><strong>⏱ 실전 모의시험</strong><span>시험이 끝날 때까지 정답을 보여주지 않습니다.</span></div></div></div><div className="mode-summary"><strong>연습 구성</strong><dl><dt>문제은행</dt><dd>{BANK_SIZE}문항</dd><dt>맥락 주제</dt><dd>{CONTEXT_TOPIC_COUNT}개 묶음</dd><dt>순서</dt><dd>R → L → W → S</dd><dt>저장</dt><dd>로컬 자동 저장</dd></dl></div></div>
      {session && <button className="resume-bar" onClick={onResume}><span><strong>진행 중인 세트가 있습니다</strong><small>{session.itemIndex + 1}번 문항부터 계속할 수 있습니다.</small></span><span>이어하기 <ArrowIcon /></span></button>}
      {poolMessage && <p className="notice notice--error">{poolMessage}</p>}
      <section><div className="section-heading"><h2>시험 순서 및 구성</h2><p>현재 시험은 아래 순서로 진행되며 예정된 휴식은 없습니다.</p></div><div className="sequence">{(Object.keys(SECTION_META) as Section[]).map((key, index) => <div className="sequence-step" key={key}><div><span className="step-number">{index + 1}</span><strong>{SECTION_META[key].label}</strong><em>{SECTION_META[key].minutes}분</em></div><p>{SECTION_META[key].tasks}</p></div>)}</div></section>
      <section className="recent"><div className="section-heading"><h2>최근 연습</h2><p>완료한 기록은 브라우저에만 보관됩니다.</p></div>{history.length === 0 ? <div className="empty"><strong>아직 완료한 세트가 없습니다.</strong><span>랜덤 세트를 풀면 결과가 여기에 표시됩니다.</span></div> : <div className="history-list">{history.slice(0, 5).map((entry) => { const answered = Object.keys(entry.answers).length; return <button className="history-row" key={entry.id} onClick={() => onHistory(entry.id)}><span><strong>{savedSessionLabel(entry)}</strong><small>{new Date(entry.startedAt).toLocaleString('ko-KR')}</small></span><span>{answered} / {entry.itemIds?.length || answered} 응답 · 해설 보기 <ArrowIcon /></span></button> })}</div>}</section>
    </main>
  </div>
}

function SectionSelect({ onBack, onSelect }: { onBack: () => void; onSelect: (section: Section) => void }) {
  const excludedIds = loadExcludedItemIds()
  return <div className="simple-page"><header><Brand /><button className="text-button" onClick={onBack}><ArrowIcon direction="left" /> 홈으로</button></header><main className="select-main"><h1>집중할 섹션을 고르세요.</h1><p>각 섹션의 랜덤 후보에서 유형과 난이도를 섞은 새 세트를 만듭니다. 학습 기록에서 제외한 문항은 후보 수에 포함되지 않습니다.</p><div className="section-list">{(Object.keys(SECTION_META) as Section[]).map((key, index) => <button key={key} disabled={countBySection(key, excludedIds) === 0} onClick={() => onSelect(key)}><span className="step-number">{index + 1}</span><span><strong>{SECTION_META[key].label}</strong><small>{SECTION_META[key].tasks}</small></span><em>랜덤 후보 {countBySection(key, excludedIds)}문항</em><ArrowIcon /></button>)}</div></main></div>
}

function Intro({ items, mode, onBack, onStart }: { items: BaseItem[]; mode: PracticeMode; onBack: () => void; onStart: () => void }) {
  const first = items[0]
  const isFull = new Set(items.map((item) => item.section)).size > 1
  const profile = getVoiceProfile()
  const [attempt, setAttempt] = useState(0)
  const [preparation, setPreparation] = useState<{ phase: 'preparing' | 'ready' | 'system' | 'fallback' | 'error'; message: string }>({ phase: 'preparing', message: '음성 준비를 시작합니다…' })
  const [preview, setPreview] = useState<'idle' | 'playing' | 'done' | 'error'>('idle')
  const firstExamAudio = items.find((item) => item.audioText)?.audioText || ''
  useEffect(() => {
    let active = true
    setPreparation({ phase: 'preparing', message: '음성 준비를 시작합니다…' })
    prepareExamTTS([PREFLIGHT_AUDIO_TEXT, firstExamAudio], profile.id, (message) => { if (active) setPreparation((current) => ({ ...current, message })) })
      .then((result) => {
        if (!active) return
        setPreparation({ phase: result.fallback ? 'fallback' : result.engine === 'system' ? 'system' : 'ready', message: result.fallback ? 'AI 엔진 대신 기기 영어 음성이 준비됐습니다.' : result.engine === 'system' ? '선택한 기기 영어 음성이 준비됐습니다. 첫 듣기 문항부터 바로 재생됩니다.' : `${result.voices}개 AI 화자와 첫 시험 음성이 미리 생성됐습니다.` })
      })
      .catch((error: unknown) => { if (active) setPreparation({ phase: 'error', message: error instanceof Error ? error.message : '음성 엔진을 준비하지 못했습니다.' }) })
    return () => { active = false; stopTTS() }
  }, [attempt, firstExamAudio, profile.id])
  const playCheck = async () => {
    setPreview('playing')
    try {
      const result = await playTTS(PREFLIGHT_AUDIO_TEXT, profile.id, () => undefined)
      if (result !== 'cancelled') setPreview('done')
    } catch { setPreview('error') }
  }
  const preparing = preparation.phase === 'preparing'
  const ready = preparation.phase === 'ready' || preparation.phase === 'system' || preparation.phase === 'fallback'
  const modeTitle = mode === 'study' ? '즉시 피드백 랜덤 세트' : mode === 'mock' ? '실전 모의시험' : `${SECTION_META[first.section].label} 집중 연습`
  return <div className="intro-screen"><header><Brand /><span>System check</span></header><main><div className="intro-copy"><span className="section-label">{isFull ? 'R · L · W · S' : SECTION_META[first.section].label}</span><h1>{modeTitle}</h1><p>{items.length}문항이 {BANK_SIZE}개 문제은행에서 새로 선택되었습니다. 모든 콘텐츠는 독창적인 연습 문항입니다.</p><ul>{mode === 'study' ? <><li>객관식 문항마다 답을 제출하면 즉시 정오답과 해설을 보여줍니다.</li><li>피드백을 확인하는 동안 타이머가 멈춥니다.</li></> : <li>정답과 해설은 전체 시험을 마친 뒤에 공개됩니다.</li>}<li>시험 시작 전에 선택한 TTS 엔진과 필요한 화자를 미리 준비합니다.</li><li>Listening에서는 이전 문항으로 돌아갈 수 없습니다.</li><li>Speaking 녹음을 위해 마이크 권한이 필요합니다.</li></ul></div><div className="system-panel"><h2>시작 전 확인</h2><div><span>학습 방식</span><strong>{mode === 'study' ? '문항별 즉시 채점' : '종료 후 채점'}</strong></div><div><span>선택 문항</span><strong>{items.length}</strong></div><div><span>오디오 출력</span><strong>{profile.shortLabel}</strong></div><div><span>마이크</span><strong>Speaking에서 요청</strong></div><div className={`preflight-status preflight-status--${preparation.phase}`} role="status" aria-live="polite"><span className={preparing ? 'audio-pulse audio-pulse--active' : 'audio-pulse'} /><span><strong>{preparing ? '음성 엔진 준비 중' : preparation.phase === 'ready' ? 'AI 음성 준비 완료' : preparation.phase === 'system' ? '기기 음성 준비 완료' : preparation.phase === 'fallback' ? '대체 음성 준비 완료' : '음성 준비 실패'}</strong><small>{preparation.message}</small></span></div>{ready && <button className="button button--secondary preflight-test" disabled={preview === 'playing'} onClick={playCheck}>{preview === 'playing' ? '테스트 음성 재생 중…' : preview === 'done' ? '테스트 다시 듣기' : preview === 'error' ? '음성 테스트 다시 시도' : '준비된 음성 테스트'}</button>}{preparation.phase === 'error' && <button className="button button--secondary preflight-test" onClick={() => setAttempt((value) => value + 1)}>음성 준비 다시 시도</button>}<button className="button button--primary button--large" disabled={!ready || preview === 'playing'} onClick={onStart}>{preparing ? '음성 준비 중…' : '시험 시작'} {!preparing && <ArrowIcon />}</button><button className="text-button" onClick={onBack}>나중에 하기</button></div></main></div>
}

function Test({ items, session, setSession, onAnswer, onFinish }: { items: BaseItem[]; session: SavedSession; setSession: (s: SavedSession) => void; onAnswer: (id: string, answer: Answer) => void; onFinish: () => void }) {
  const [timeHidden, setTimeHidden] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [audioActive, setAudioActive] = useState(false)
  const [coachActive, setCoachActive] = useState(false)
  const index = Math.min(session.itemIndex, items.length - 1)
  const item = items[index]
  const currentAnswer = session.answers[item.id]
  const studyMode = session.mode === 'study'
  const feedbackEligible = studyMode && item.answer !== undefined
  const reviewed = feedbackEligible && Boolean(session.reviewedItemIds?.includes(item.id))
  const answered = currentAnswer !== undefined && (!Array.isArray(currentAnswer) || currentAnswer.length > 0) && (typeof currentAnswer !== 'string' || currentAnswer.trim().length > 0)
  const feedbackCorrect = reviewed && isCorrect(item, currentAnswer)
  const reviewedItems = new Set(session.reviewedItemIds || [])
  const correctSoFar = items.filter((candidate) => reviewedItems.has(candidate.id) && isCorrect(candidate, session.answers[candidate.id])).length
  const sectionItems = items.filter((candidate) => candidate.section === item.section)
  const localIndex = sectionItems.findIndex((candidate) => candidate.id === item.id)
  const navStart = Math.max(0, Math.min(localIndex - 5, sectionItems.length - 11))
  const visibleNavItems = sectionItems.slice(navStart, navStart + 11)
  const revealAnswer = useCallback(() => {
    if (!feedbackEligible || reviewed) return
    const updated = { ...session, reviewedItemIds: [...new Set([...(session.reviewedItemIds || []), item.id])], updatedAt: new Date().toISOString() }
    setSession(updated)
    saveActive(updated)
  }, [feedbackEligible, item.id, reviewed, session, setSession])
  const moveNext = useCallback(() => {
    if (index === items.length - 1) { onFinish(); return }
    const updated = { ...session, itemIndex: index + 1, updatedAt: new Date().toISOString() }
    setSession(updated)
    saveActive(updated)
  }, [index, items.length, onFinish, session, setSession])
  const primaryAction = feedbackEligible && !reviewed ? revealAnswer : moveNext
  const primaryLabel = feedbackEligible && !reviewed ? '정답 확인' : index === items.length - 1 ? 'Finish' : studyMode ? '다음 문제' : 'Next'
  const canBack = !studyMode && item.section !== 'listening' && index > 0 && items[index - 1].section === item.section && items[index - 1].module === item.module
  const back = () => { if (canBack) { const updated = { ...session, itemIndex: index - 1 }; setSession(updated); saveActive(updated) } }
  const assistantActive = (item.section === 'listening' && audioActive) || (item.section === 'writing' && coachActive)
  const timerPaused = assistantActive || reviewed
  const timerExpire = feedbackEligible && !reviewed ? revealAnswer : moveNext
  return <div className="test-screen"><header><Brand /><div className="test-tools">{studyMode && <span className="study-mode-badge">즉시 피드백</span>}<button onClick={() => setHelpOpen(true)}>Help</button><button onClick={() => setTimeHidden((value) => !value)}>{timeHidden ? 'Show Time' : 'Hide Time'}</button><span className="timer-wrap"><Timer key={item.id} seconds={item.timeSeconds} hidden={timeHidden} paused={timerPaused} onExpire={timerExpire} /></span></div></header><div className="test-subhead"><strong>{SECTION_META[item.section].label} — Module {item.module}</strong><div className="question-nav">{navStart > 0 && <b>…</b>}{visibleNavItems.map((candidate, i) => <span key={candidate.id} className={`${candidate.id === item.id ? 'current' : ''} ${session.answers[candidate.id] !== undefined ? 'answered' : ''}`}>{navStart + i + 1}</span>)}{navStart + visibleNavItems.length < sectionItems.length && <b>…</b>}</div><span>Question {localIndex + 1} of {sectionItems.length}</span></div><main className={`question-layout question-layout--${item.kind}`}><Question item={item} answer={currentAnswer} locked={reviewed} onAnswer={(answer) => onAnswer(item.id, answer)} onAudioState={item.section === 'listening' ? setAudioActive : undefined} onCoachState={item.section === 'writing' ? setCoachActive : undefined} /></main>{reviewed && <section className={`instant-feedback ${feedbackCorrect ? 'instant-feedback--correct' : 'instant-feedback--wrong'}`} role="status" aria-live="polite"><div className="instant-feedback__result"><span>{feedbackCorrect ? '✓ 정답이에요!' : '정답을 확인했어요'}</span><strong>{feedbackCorrect ? '좋아요, 이 감각 그대로 가세요.' : '괜찮아요. 지금 확인한 답이 더 오래 남습니다.'}</strong><small>현재까지 {correctSoFar}개 정답</small></div><dl><div><dt>내 답</dt><dd>{displayAnswer(item, currentAnswer)}</dd></div><div><dt>정답</dt><dd>{displayAnswer(item, item.answer)}</dd></div></dl><p>{item.explanation || '정답과 문맥을 함께 확인해 보세요.'}</p></section>}<footer><span>{item.context ? `${item.topic} · ${item.context}` : item.topic} · {item.difficulty}</span><div>{canBack && <button className="button button--secondary" onClick={back}><ArrowIcon direction="left" /> Back</button>}<button className="button button--primary" disabled={feedbackEligible && !reviewed && !answered} onClick={primaryAction}>{primaryLabel} <ArrowIcon /></button></div></footer>{helpOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setHelpOpen(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="help-title">시험 화면 도움말</h2><ul>{studyMode && <li>정답 확인을 누르면 바로 채점되며, 피드백을 읽는 동안 타이머가 멈춥니다.</li>}<li>{studyMode ? '즉시 피드백 모드는 한 방향으로 진행됩니다.' : '현재 모듈 안에서는 Back으로 이전 Reading/Writing/Speaking 문항을 확인할 수 있습니다.'}</li><li>Listening 문항은 답한 뒤 이전으로 돌아갈 수 없습니다.</li><li>Listening 오디오와 AI Writing 코칭을 기다리는 동안에는 타이머가 멈춥니다.</li><li>Hide Time은 타이머 표시만 숨기며 시간은 계속 흐릅니다.</li><li>응답은 이 브라우저에 자동 저장됩니다.</li></ul><button autoFocus className="button button--primary" onClick={() => setHelpOpen(false)}>Close</button></section></div>}</div>
}

function Question({ item, answer, locked = false, onAnswer, onAudioState, onCoachState }: { item: BaseItem; answer: Answer | undefined; locked?: boolean; onAnswer: (answer: Answer) => void; onAudioState?: (active: boolean) => void; onCoachState?: (active: boolean) => void }) {
  if (item.kind === 'complete-words') {
    const pieces = item.passage!.split(/(\w+___)/g)
    const values = Array.isArray(answer) ? answer : []
    let blank = -1
    return <div className="single-column"><div className="question-title"><span>{item.title}</span><ContextLabel item={item} /><h1>{item.instruction}</h1></div><div className="cloze-passage">{pieces.map((piece, i) => { if (!piece.endsWith('___')) return <span key={i}>{piece}</span>; blank += 1; const index = blank; return <label key={i}>{piece.slice(0, -3)}<input aria-label={`빈칸 ${index + 1}`} disabled={locked} value={values[index] || ''} onChange={(event) => { const next = [...values]; next[index] = event.target.value; onAnswer(next) }} /></label> })}</div></div>
  }
  if (item.kind === 'multiple-choice') return <SplitQuestion item={item} answer={answer} locked={locked} onAnswer={onAnswer} />
  if (item.kind === 'listen-choice') return <div className="single-column listening"><div className="question-title"><span>{item.title}</span><ContextLabel item={item} /><h1>{item.instruction}</h1></div><AudioPrompt text={item.audioText!} autoPlay onPlaybackChange={onAudioState} /><h2>{item.prompt || 'Choose the best response.'}</h2><Options options={item.options!} answer={answer} locked={locked} onAnswer={onAnswer} /></div>
  if (item.kind === 'sentence-build') {
    const chosen = Array.isArray(answer) ? answer : []
    const used = new Map<string, number>()
    for (const word of chosen) used.set(word, (used.get(word) || 0) + 1)
    const available = item.words!.filter((word) => {
      const remaining = used.get(word) || 0
      if (remaining === 0) return true
      used.set(word, remaining - 1)
      return false
    })
    const slotCount = String(item.answer || '').split('|').filter(Boolean).length
    return <div className="single-column"><div className="question-title"><span>{item.title}</span><ContextLabel item={item} /><h1>{item.instruction}</h1></div><p className="conversation">{item.prompt}</p><div className="sentence-target"><strong>{item.starter}</strong><div className="sentence-slots">{Array.from({ length: slotCount }, (_, index) => chosen[index] ? <button disabled={locked} onClick={() => onAnswer(chosen.filter((_, chosenIndex) => chosenIndex !== index))} key={`${chosen[index]}-${index}`}>{chosen[index]}</button> : <span aria-hidden="true" key={`empty-${index}`} />)}</div></div><div className="word-bank" aria-label="섞인 단어와 구">{available.map((word, index) => <button disabled={locked || chosen.length >= slotCount} onClick={() => onAnswer([...chosen, word])} key={`${word}-${index}`}>{word}</button>)}</div></div>
  }
  if (item.kind === 'email' || item.kind === 'discussion') {
    const text = typeof answer === 'string' ? answer : ''
    return <div className="writing-layout writing-layout--coach"><div><div className="question-title"><span>{item.title}</span><ContextLabel item={item} /><h1>{item.instruction}</h1></div><p className="writing-prompt">{item.prompt}</p>{item.passage && <pre className="student-posts">{item.passage}</pre>}</div><div className="editor"><div className="editor-meta"><strong>Your response</strong><span>{text.trim() ? text.trim().split(/\s+/).length : 0} words</span></div><textarea autoFocus value={text} onChange={(event) => onAnswer(event.target.value)} spellCheck={false} placeholder="Type your response here…" /></div><Suspense fallback={<aside className="writing-coach writing-coach--loading">AI 코치를 불러오는 중입니다…</aside>}><WritingCoach key={item.id} item={item} response={text} onApply={onAnswer} onBusyChange={onCoachState} /></Suspense></div>
  }
  return <div className="single-column speaking"><div className="question-title"><span>{item.title}</span><ContextLabel item={item} /><h1>{item.instruction}</h1></div><AudioPrompt text={item.audioText!} autoPlay /><div className="speaking-prompt">{item.kind === 'interview' ? item.audioText : 'Repeat the sentence you heard.'}</div><Recorder onRecorded={(duration) => onAnswer(duration)} /></div>
}

function ContextLabel({ item }: { item: BaseItem }) { return item.context ? <small className="context-label">{item.topic} · {item.context}</small> : null }

function SplitQuestion({ item, answer, locked, onAnswer }: { item: BaseItem; answer: Answer | undefined; locked: boolean; onAnswer: (a: Answer) => void }) {
  return <><article className="passage-pane"><h2>Read the passage.</h2><ContextLabel item={item} /><Suspense fallback={<p>{item.passage}</p>}><ReadingAssistant passage={item.passage!} topic={item.topic || '일반'} /></Suspense></article><section className="answer-pane"><h1>{item.prompt}</h1><Options options={item.options!} answer={answer} locked={locked} onAnswer={onAnswer} /></section></>
}

function Options({ options, answer, locked, onAnswer }: { options: string[]; answer: Answer | undefined; locked: boolean; onAnswer: (a: Answer) => void }) {
  return <div className="options">{options.map((option, index) => <label key={option} className={`${answer === index ? 'selected' : ''} ${locked ? 'locked' : ''}`}><input type="radio" name="answer" disabled={locked} checked={answer === index} onChange={() => onAnswer(index)} /><b>{String.fromCharCode(65 + index)}.</b><span>{option}</span></label>)}</div>
}

function Result({ items, session, onHome, onRetry, onRandomEligibilityChange }: { items: BaseItem[]; session: SavedSession; onHome: () => void; onRetry: () => void; onRandomEligibilityChange: (eligible: boolean) => void }) {
  const { objective, correct, mistakes, answered, practiceBand } = getSessionStats(items, session)
  const randomEligible = session.randomEligible !== false
  return <div className="result-page"><header><Brand /><span>Practice result</span></header><main><div className="result-lead"><p>세트를 완료했습니다.</p><h1>{practiceBand ? `${practiceBand.toFixed(1)} / 6.0` : `${answered} responses`}</h1><span>자동 채점 가능한 문항만 반영한 연습 추정치이며 ETS 공식 점수가 아닙니다.</span></div><div className="result-grid"><div><span>응답 완료</span><strong>{answered} / {items.length}</strong></div><div><span>자동 채점 문항</span><strong>{correct} / {objective.length}</strong></div><div><span>복습 필요</span><strong>{mistakes.length}문항</strong></div></div><section className="result-random-choice"><div><strong>이 시험의 문항을 랜덤 후보에 다시 넣을까요?</strong><p>제외해도 학습 기록과 답안·해설은 그대로 보존됩니다.</p></div><button className={randomEligible ? 'pool-toggle' : 'pool-toggle pool-toggle--excluded'} aria-pressed={!randomEligible} onClick={() => onRandomEligibilityChange(!randomEligible)}><span>{randomEligible ? '랜덤 후보에 포함 중' : '랜덤 후보에서 제외됨'}</span><small>{randomEligible ? '다시 출제될 수 있습니다.' : '이 문항들은 건너뜁니다.'}</small></button></section>{mistakes.length > 0 && <section className="review-section"><div className="section-heading"><h2>정답과 해설</h2><p>틀렸거나 건너뛴 자동 채점 문항을 확인하세요.</p></div><div className="review-list">{mistakes.map((item, index) => <article key={item.id}><div className="review-number">{index + 1}</div><div><span>{item.title} · {item.topic}{item.context ? ` · ${item.context}` : ''} · {item.difficulty}</span><h3>{item.prompt || item.instruction}</h3><dl><dt>내 답</dt><dd>{displayAnswer(item, session.answers[item.id])}</dd><dt>정답</dt><dd>{displayAnswer(item, item.answer)}</dd></dl><p>{item.explanation}</p></div></article>)}</div></section>}<div className="result-actions"><button className="button button--secondary button--large" onClick={onHome}>홈으로</button><button className="button button--primary button--large" onClick={onRetry}>같은 세트 다시 풀기 <ArrowIcon /></button></div></main></div>
}

export default App
