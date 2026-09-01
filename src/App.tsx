import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AudioPrompt, ArrowIcon, Brand, HOME_NAVIGATION_EVENT, Recorder, Timer } from './components'
import { CONTEXT_TOPIC_COUNT, countReadingScoredItems, SECTION_META } from './data'
import ExamData from './ExamData'
import { buildFullPracticeSetFrom, buildSectionPracticeFrom, buildTaskPracticeFrom, countBySectionFrom, getActiveExamPackInfo, getActivePracticeItems, getAvailablePracticeItems, getPracticeTaskTypesFrom } from './examPack'
import { displayAnswer, getSessionStats, isCorrect } from './review'
import { finishSession, loadActive, loadExcludedItemIds, loadHistory, saveActive, setSessionRandomEligibility } from './storage'
import { examSpeechMode, getVoiceProfile, hasLocalTtsServer, prepareExamTTS, stopAllTTS, stopTTS, subscribeExamTTSPrecache, type TTSProgressDetail } from './tts'
import type { Answer, BaseItem, PracticeMode, SavedSession, Section } from './types'
import { CLOUD_SYNC_CONFIGURED } from './cloudSync'

const Vocabulary = lazy(() => import('./Vocabulary'))
const StudyGames = lazy(() => import('./StudyGames'))
const VoiceSettings = lazy(() => import('./VoiceSettings'))
const Settings = lazy(() => import('./Settings'))
const ReadingAssistant = lazy(() => import('./ReadingAssistant'))
const WritingCoach = lazy(() => import('./WritingCoach'))
const History = lazy(() => import('./History'))
type Screen = 'home' | 'section-select' | 'task-select' | 'intro' | 'test' | 'result' | 'vocabulary' | 'study-games' | 'settings' | 'voice-settings' | 'history' | 'exam-data'
type AppNavigationState = { focusEnglishLab: true; screen: Screen; historySessionId?: string | null; resultId?: string | null; practiceSection?: Section | null }
const PRACTICE_ITEMS = getActivePracticeItems()
const ACTIVE_PACK = getActiveExamPackInfo()
const ITEM_BY_ID = new Map(getAvailablePracticeItems().map((item) => [item.id, item]))
const BANK_SIZE = PRACTICE_ITEMS.length.toLocaleString('en-US')

function savedSessionLabel(entry: SavedSession) {
  if (entry.practiceLabel) return entry.practiceLabel
  if (entry.mode === 'study') return '즉시 피드백 랜덤 세트'
  if (entry.mode === 'mock') return '실전 모의시험'
  const sections = [...new Set((entry.itemIds || []).map((id) => ITEM_BY_ID.get(id)?.section).filter((section): section is Section => Boolean(section)))]
  return sections.length > 1 ? '전체 모의시험' : sections[0] ? `${SECTION_META[sections[0]].label} 집중 연습` : '연습 세트'
}

const newSession = (items: BaseItem[], mode: PracticeMode, practiceLabel?: string): SavedSession => {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), itemIds: items.map((item) => item.id), startedAt: now, updatedAt: now, itemIndex: 0, answers: {}, completed: false, mode, reviewedItemIds: [], practiceLabel }
}

function isAppNavigationState(value: unknown): value is AppNavigationState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<AppNavigationState>
  return state.focusEnglishLab === true && typeof state.screen === 'string' && ['home', 'section-select', 'task-select', 'intro', 'test', 'result', 'vocabulary', 'study-games', 'settings', 'voice-settings', 'history', 'exam-data'].includes(state.screen)
}

function itemsForSession(entry: SavedSession | null) {
  if (!entry?.itemIds?.length) return []
  return entry.itemIds.map((id) => ITEM_BY_ID.get(id)).filter((item): item is BaseItem => Boolean(item))
}

function routeUrl(screen: Screen) {
  return `${window.location.pathname}${window.location.search}#/${screen}`
}

function App() {
  const debugScreen = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
    ? new URLSearchParams(window.location.search).get('debug-screen') as Screen | null
    : null
  const initialNavigation = isAppNavigationState(window.history.state) ? window.history.state : null
  const initialSession = loadActive()
  const initialResult = initialNavigation?.resultId ? loadHistory().find((entry) => entry.id === initialNavigation.resultId) || null : null
  const restoredScreen = initialNavigation?.screen === 'result' && !initialResult
    ? 'home'
    : (initialNavigation?.screen === 'intro' || initialNavigation?.screen === 'test') && !initialSession
      ? 'home'
      : initialNavigation?.screen || 'home'
  const initialScreen = debugScreen && ['home', 'vocabulary', 'settings', 'voice-settings', 'exam-data'].includes(debugScreen) ? debugScreen : restoredScreen
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [items, setItems] = useState<BaseItem[]>(() => itemsForSession(initialResult || initialSession).length ? itemsForSession(initialResult || initialSession) : PRACTICE_ITEMS)
  const [session, setSession] = useState<SavedSession | null>(initialSession)
  const [result, setResult] = useState<SavedSession | null>(initialResult)
  const [poolMessage, setPoolMessage] = useState('')
  const [historySessionId, setHistorySessionId] = useState<string | null>(initialNavigation?.historySessionId || null)
  const [practiceSection, setPracticeSection] = useState<Section | null>(initialNavigation?.practiceSection || null)

  const navigate = useCallback((nextScreen: Screen, options: { replace?: boolean; historySessionId?: string | null; resultId?: string | null; practiceSection?: Section | null } = {}) => {
    if (nextScreen !== 'intro' && nextScreen !== 'test') stopAllTTS()
    const nextState: AppNavigationState = { focusEnglishLab: true, screen: nextScreen, historySessionId: options.historySessionId || null, resultId: options.resultId || null, practiceSection: options.practiceSection || null }
    window.history[options.replace ? 'replaceState' : 'pushState'](nextState, '', routeUrl(nextScreen))
    setHistorySessionId(nextState.historySessionId || null)
    setPracticeSection(nextState.practiceSection || null)
    setScreen(nextScreen)
  }, [])

  const goBack = useCallback(() => {
    if (isAppNavigationState(window.history.state) && screen !== 'home') window.history.back()
    else navigate('home', { replace: true })
  }, [navigate, screen])

  useEffect(() => {
    if (!isAppNavigationState(window.history.state) || initialScreen !== window.history.state.screen) navigate(initialScreen, { replace: true, historySessionId, resultId: initialResult?.id, practiceSection })
    const onPopState = (event: PopStateEvent) => {
      if (!isAppNavigationState(event.state)) return
      const next = event.state
      if (next.screen !== 'intro' && next.screen !== 'test') stopAllTTS()
      if (next.screen === 'intro' || next.screen === 'test') {
        const active = loadActive()
        const restored = itemsForSession(active)
        if (!active || !active.itemIds?.length || restored.length !== active.itemIds.length) { navigate('home', { replace: true }); return }
        setSession(active)
        setItems(restored)
      }
      if (next.screen === 'result') {
        const saved = next.resultId ? loadHistory().find((entry) => entry.id === next.resultId) || null : null
        const restored = itemsForSession(saved)
        if (!saved || !saved.itemIds?.length || restored.length !== saved.itemIds.length) { navigate('home', { replace: true }); return }
        setResult(saved)
        setItems(restored)
      }
      setHistorySessionId(next.historySessionId || null)
      setPracticeSection(next.practiceSection || null)
      setScreen(next.screen)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [historySessionId, initialResult?.id, initialScreen, navigate])

  useEffect(() => {
    const onHome = () => { if (screen !== 'home') navigate('home') }
    window.addEventListener(HOME_NAVIGATION_EVENT, onHome)
    return () => window.removeEventListener(HOME_NAVIGATION_EVENT, onHome)
  }, [navigate, screen])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [screen])

  useEffect(() => {
    const stopAllAudio = () => stopAllTTS()
    const stopWhenHidden = () => { if (document.visibilityState === 'hidden') stopAllTTS() }
    window.addEventListener('pagehide', stopAllAudio)
    window.addEventListener('beforeunload', stopAllAudio)
    document.addEventListener('visibilitychange', stopWhenHidden)
    return () => {
      window.removeEventListener('pagehide', stopAllAudio)
      window.removeEventListener('beforeunload', stopAllAudio)
      document.removeEventListener('visibilitychange', stopWhenHidden)
      stopAllTTS()
    }
  }, [])

  const begin = (selected: BaseItem[], mode: PracticeMode, practiceLabel?: string) => {
    if (!selected.length) { setPoolMessage('랜덤 후보 문항이 없습니다. 학습 기록에서 이전 문항을 다시 랜덤 후보에 포함해 주세요.'); navigate('home'); return }
    setPoolMessage('')
    const next = newSession(selected, mode, practiceLabel); setItems(selected); setSession(next); saveActive(next); navigate('intro')
  }
  const resume = () => {
    if (!session) return
    const restored = session.itemIds?.map((id) => ITEM_BY_ID.get(id)).filter((item): item is BaseItem => Boolean(item)) || []
    if (restored.length === session.itemIds?.length && restored.length > 0) { setItems(restored); navigate('intro') }
    else begin(buildFullPracticeSetFrom(PRACTICE_ITEMS, loadExcludedItemIds()), session.mode || 'mock')
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
    const completed = finishSession(session); setResult(completed); setSession(null); navigate('result', { replace: true, resultId: completed.id })
  }

  const updateResultEligibility = (randomEligible: boolean) => {
    if (!result) return
    setSessionRandomEligibility(result.id, randomEligible)
    setResult({ ...result, randomEligible })
  }
  const openHistory = (sessionId: string | null = null) => navigate('history', { historySessionId: sessionId })

  if (screen === 'home') return <Home session={session} poolMessage={poolMessage} onStudy={() => begin(buildFullPracticeSetFrom(PRACTICE_ITEMS, loadExcludedItemIds()), 'study')} onMock={() => begin(buildFullPracticeSetFrom(PRACTICE_ITEMS, loadExcludedItemIds()), 'mock')} onResume={resume} onSections={() => navigate('section-select')} onVocabulary={() => navigate('vocabulary')} onStudyGames={() => navigate('study-games')} onSettings={() => navigate('settings')} onExamData={() => navigate('exam-data')} onHistory={openHistory} />
  if (screen === 'vocabulary') return <Suspense fallback={<div className="route-loading">단어장을 불러오는 중입니다…</div>}><Vocabulary onBack={goBack} /></Suspense>
  if (screen === 'study-games') return <Suspense fallback={<div className="route-loading">학습 게임을 준비하는 중입니다…</div>}><StudyGames onBack={goBack} /></Suspense>
  if (screen === 'settings') return <Suspense fallback={<div className="route-loading">설정을 불러오는 중입니다…</div>}><Settings onBack={goBack} onVoiceSettings={() => navigate('voice-settings')} onExamData={() => navigate('exam-data')} /></Suspense>
  if (screen === 'voice-settings') return <Suspense fallback={<div className="route-loading">음성 설정을 불러오는 중입니다…</div>}><VoiceSettings onBack={goBack} /></Suspense>
  if (screen === 'exam-data') return <ExamData onBack={goBack} onActivate={() => { window.history.replaceState({ focusEnglishLab: true, screen: 'home' } satisfies AppNavigationState, '', routeUrl('home')); window.location.reload() }} />
  if (screen === 'history') return <Suspense fallback={<div className="route-loading">학습 기록을 불러오는 중입니다…</div>}><History initialSessionId={historySessionId} onBack={goBack} /></Suspense>
  if (screen === 'section-select') return <SectionSelect onBack={goBack} onSelect={(section) => navigate('task-select', { practiceSection: section })} />
  if (screen === 'task-select') return practiceSection ? <TaskSelect section={practiceSection} onBack={goBack} onSelectAll={() => begin(buildSectionPracticeFrom(PRACTICE_ITEMS, practiceSection, loadExcludedItemIds()), 'section', `${SECTION_META[practiceSection].label} 전체 유형`)} onSelectTask={(taskTitle, taskLabel) => begin(buildTaskPracticeFrom(PRACTICE_ITEMS, practiceSection, taskTitle, loadExcludedItemIds()), 'section', `${SECTION_META[practiceSection].label} · ${taskLabel}`)} /> : <SectionSelect onBack={goBack} onSelect={(section) => navigate('task-select', { practiceSection: section })} />
  if (screen === 'intro') return <Intro items={items} mode={session?.mode || 'mock'} practiceLabel={session?.practiceLabel} onBack={goBack} onStart={() => navigate('test')} />
  if (screen === 'test' && session) return <Test items={items} session={session} setSession={setSession} onAnswer={updateAnswer} onFinish={finish} />
  if (screen === 'result' && result) return <Result items={items} session={result} onHome={() => navigate('home')} onRetry={() => begin(items, result.mode || 'mock', result.practiceLabel)} onRandomEligibilityChange={updateResultEligibility} />
  return null
}

function Home({ session, poolMessage, onStudy, onMock, onResume, onSections, onVocabulary, onStudyGames, onSettings, onExamData, onHistory }: { session: SavedSession | null; poolMessage: string; onStudy: () => void; onMock: () => void; onResume: () => void; onSections: () => void; onVocabulary: () => void; onStudyGames: () => void; onSettings: () => void; onExamData: () => void; onHistory: (sessionId?: string | null) => void }) {
  const history = loadHistory()
  return <div className="app-shell">
    <aside className="sidebar"><Brand /><nav><button className="nav-item nav-item--active">홈</button><button className="nav-item" onClick={onMock}>모의시험</button><button className="nav-item" onClick={onSections}>섹션 연습</button><button className="nav-item" onClick={onVocabulary}>단어장</button><button className="nav-item" onClick={onStudyGames}>단어·문장 게임</button><button className="nav-item" onClick={onSettings}>설정</button><button className="nav-item" onClick={onExamData}>시험 데이터</button><button className="nav-item" onClick={() => onHistory()}>학습 기록</button></nav><div className="sidebar-note"><strong>안내</strong><p>모든 점수는 연습용 추정치이며 ETS 공식 점수가 아닙니다. {CLOUD_SYNC_CONFIGURED ? '개인 기록은 로그인하면 계정에 동기화됩니다.' : '기록은 이 기기에만 저장됩니다.'}</p></div></aside>
    <header className="mobile-home-header"><Brand /><button className="text-button" onClick={() => onHistory()}>학습 기록 <ArrowIcon /></button></header>
    <main className="dashboard"><div className="dashboard-top"><div><h1>실전처럼, 매일 새 세트.</h1><p>{BANK_SIZE}개의 독창적인 문제은행에서 한 주제를 여러 맥락과 관점으로 연습합니다.</p>{ACTIVE_PACK.source === 'imported' && <p className="active-pack-badge">가져온 문제은행 · {ACTIVE_PACK.title}</p>}<div className="actions"><button className="button button--primary button--large" onClick={onStudy}>랜덤 전체 세트 시작 <ArrowIcon /></button><button className="button button--secondary button--large" onClick={onMock}>실전 모의시험</button><button className="button button--secondary button--large" onClick={onSections}>섹션 연습</button><button className="button button--secondary button--large" onClick={onVocabulary}>단어장</button><button className="button button--secondary button--large" onClick={onStudyGames}>단어·문장 게임</button><button className="button button--secondary button--large" onClick={onSettings}>설정</button><button className="button button--secondary button--large" onClick={onExamData}>시험 데이터</button></div><div className="mode-difference"><div><strong>⚡ 랜덤 전체 세트</strong><span>한 문제씩 풀고 즉시 정답과 해설을 확인합니다.</span></div><div><strong>🧠 단어·문장 게임</strong><span>뜻·동의어·해석·영작을 바로 확인하고 선택적으로 AI 평가를 받습니다.</span></div></div></div><div className="mode-summary"><strong>연습 구성</strong><dl><dt>문제은행</dt><dd>{BANK_SIZE}문항</dd><dt>맥락 주제</dt><dd>{CONTEXT_TOPIC_COUNT}개 묶음</dd><dt>순서</dt><dd>R → L → W → S</dd><dt>저장</dt><dd>{CLOUD_SYNC_CONFIGURED ? '로그인 시 계정 동기화' : '로컬 자동 저장'}</dd></dl></div></div>
      {session && <button className="resume-bar" onClick={onResume}><span><strong>진행 중인 세트가 있습니다</strong><small>{session.itemIndex + 1}번 문항부터 계속할 수 있습니다.</small></span><span>이어하기 <ArrowIcon /></span></button>}
      {poolMessage && <p className="notice notice--error">{poolMessage}</p>}
      <section><div className="section-heading"><h2>시험 순서 및 구성</h2><p>현재 시험은 아래 순서로 진행되며 예정된 휴식은 없습니다.</p></div><div className="sequence">{(Object.keys(SECTION_META) as Section[]).map((key, index) => <div className="sequence-step" key={key}><div><span className="step-number">{index + 1}</span><strong>{SECTION_META[key].label}</strong><em>{SECTION_META[key].minutes}분</em></div><p>{SECTION_META[key].tasks}</p></div>)}</div></section>
      <section className="recent"><div className="section-heading"><h2>최근 연습</h2><p>기록은 이 기기에 저장되며, 로그인하면 계정에 비공개로 동기화됩니다.</p></div>{history.length === 0 ? <div className="empty"><strong>아직 완료한 세트가 없습니다.</strong><span>랜덤 세트를 풀면 결과가 여기에 표시됩니다.</span></div> : <div className="history-list">{history.slice(0, 5).map((entry) => { const answered = Object.keys(entry.answers).length; return <button className="history-row" key={entry.id} onClick={() => onHistory(entry.id)}><span><strong>{savedSessionLabel(entry)}</strong><small>{new Date(entry.startedAt).toLocaleString('ko-KR')}</small></span><span>{answered} / {entry.itemIds?.length || answered} 응답 · 해설 보기 <ArrowIcon /></span></button> })}</div>}</section>
    </main>
  </div>
}

function SectionSelect({ onBack, onSelect }: { onBack: () => void; onSelect: (section: Section) => void }) {
  const excludedIds = loadExcludedItemIds()
  return <div className="simple-page"><header><Brand /><button className="text-button" onClick={onBack}><ArrowIcon direction="left" /> 홈으로</button></header><main className="select-main"><h1>집중할 섹션을 고르세요.</h1><p>섹션을 고른 다음 전체 유형을 섞거나 하나의 세부 유형만 선택할 수 있습니다. 학습 기록에서 제외한 문항은 후보 수에 포함되지 않습니다.</p><div className="section-list">{(Object.keys(SECTION_META) as Section[]).map((key, index) => <button key={key} disabled={countBySectionFrom(PRACTICE_ITEMS, key, excludedIds) === 0} onClick={() => onSelect(key)}><span className="step-number">{index + 1}</span><span><strong>{SECTION_META[key].label}</strong><small>{SECTION_META[key].tasks}</small></span><em>랜덤 후보 {countBySectionFrom(PRACTICE_ITEMS, key, excludedIds)}문항</em><ArrowIcon /></button>)}</div></main></div>
}

function TaskSelect({ section, onBack, onSelectAll, onSelectTask }: { section: Section; onBack: () => void; onSelectAll: () => void; onSelectTask: (title: string, label: string) => void }) {
  const excludedIds = loadExcludedItemIds()
  const tasks = getPracticeTaskTypesFrom(PRACTICE_ITEMS, section, excludedIds)
  return <div className="simple-page"><header><Brand /><button className="text-button" onClick={onBack}><ArrowIcon direction="left" /> 섹션으로</button></header><main className="select-main task-select-main"><span className="section-label">{SECTION_META[section].label}</span><h1>연습할 유형을 고르세요.</h1><p>한 유형만 반복하거나, 기존처럼 {SECTION_META[section].label}의 여러 유형을 섞어서 연습할 수 있습니다.</p><button className="task-all" onClick={onSelectAll}><span><strong>전체 유형 섞기</strong><small>{SECTION_META[section].tasks}</small></span><em>랜덤 후보 {countBySectionFrom(PRACTICE_ITEMS, section, excludedIds)}문항</em><ArrowIcon /></button><div className="task-list">{tasks.map((task, index) => <button key={task.title} onClick={() => onSelectTask(task.title, task.label)}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{task.label}</strong><small>{task.description}</small></span><em>후보 {task.candidateCount} · 한 세트 {task.setSize}</em><ArrowIcon /></button>)}</div></main></div>
}

function Intro({ items, mode, practiceLabel, onBack, onStart: navigateToTest }: { items: BaseItem[]; mode: PracticeMode; practiceLabel?: string; onBack: () => void; onStart: () => void }) {
  const first = items[0]
  const isFull = new Set(items.map((item) => item.section)).size > 1
  const isMock = mode === 'mock'
  const readingCards = items.filter((item) => item.section === 'reading').length
  const readingScoredItems = countReadingScoredItems(items)
  const selectionLabel = readingScoredItems > readingCards
    ? `${items.length}개 화면 · Reading 채점 항목 ${readingScoredItems}개 구성`
    : `${items.length}문항 구성`
  const immediateFeedback = !isMock
  const hasListening = items.some((item) => item.section === 'listening' && Boolean(item.audioText))
  const hasSpeaking = items.some((item) => item.section === 'speaking' && Boolean(item.audioText))
  const hasAudio = hasListening || hasSpeaking
  const requiresAudioPreflight = false
  const localTts = hasAudio ? hasLocalTtsServer() : false
  const profile = hasAudio ? getVoiceProfile() : null
  const [attempt, setAttempt] = useState(0)
  const [preparation, setPreparation] = useState<{ phase: 'preparing' | 'ready' | 'system' | 'error'; message: string; progress?: TTSProgressDetail }>(() => requiresAudioPreflight
    ? { phase: 'preparing', message: '모의시험에 필요한 음성 준비를 시작합니다…' }
    : { phase: 'ready', message: '음성이 필요한 문항에서 변환 완료 후 재생 버튼이 활성화됩니다.' })
  const examAudio = items.flatMap((item) => item.audioText && (item.section === 'listening' || item.section === 'speaking')
    ? [{ text: item.audioText, speechMode: examSpeechMode(item.section, item.title) }]
    : [])
  useEffect(() => {
    if (!hasAudio || !profile) {
      setPreparation({ phase: 'ready', message: '' })
      return () => stopTTS()
    }
    if (!isMock) {
      setPreparation({ phase: 'ready', message: '음성이 필요한 문항에서 변환 완료 후 재생 버튼이 활성화됩니다.' })
      return () => stopTTS()
    }
    let active = true
    const unsubscribe = subscribeExamTTSPrecache((state) => {
      if (!active || state.status === 'idle') return
      if (state.status === 'error') setPreparation({ phase: 'error', message: state.message, progress: { phase: 'generating', percent: state.percent } })
      else setPreparation({ phase: state.status === 'ready' ? 'ready' : 'preparing', message: state.message, progress: { phase: state.status === 'ready' ? 'ready' : 'generating', percent: state.percent, cached: state.status === 'ready' } })
    })
    setPreparation({ phase: 'preparing', message: '모의시험에 필요한 음성을 모두 변환하고 있습니다…' })
    prepareExamTTS(examAudio, profile.id, (message, progress) => { if (active) setPreparation((current) => ({ ...current, message, progress: progress || current.progress })) })
      .then((result) => {
        if (!active) return
        if (result.engine !== 'kokoro') setPreparation({ phase: 'system', message: '선택한 기기 영어 음성이 준비됐습니다. 문항에서는 재생 버튼을 눌러 시작합니다.' })
      })
      .catch((error: unknown) => { if (active && !(error instanceof DOMException && error.name === 'AbortError')) setPreparation({ phase: 'error', message: error instanceof Error ? error.message : '시험 음성을 준비하지 못했습니다.' }) })
    return () => { active = false; unsubscribe(); stopTTS() }
  }, [attempt, hasAudio, isMock, items, localTts, profile?.id])
  const preparing = preparation.phase === 'preparing'
  const ready = preparation.phase === 'ready' || preparation.phase === 'system'
  const modeTitle = practiceLabel || (mode === 'study' ? '즉시 피드백 랜덤 세트' : mode === 'mock' ? '실전 모의시험' : `${SECTION_META[first.section].label} 집중 연습`)
  return <div className="intro-screen"><header><Brand /><span>System check</span></header><main><div className="intro-copy"><span className="section-label">{isFull ? 'R · L · W · S' : SECTION_META[first.section].label}</span><h1>{modeTitle}</h1><p>{selectionLabel}이 {BANK_SIZE}개 문제은행에서 새로 선택되었습니다. Complete the Words 한 화면은 10개 빈칸을 채점합니다.</p><ul>{immediateFeedback ? <><li>정답이 있는 문항은 제출 직후 문제·내 답·정답·해설을 함께 보여줍니다.</li><li>피드백을 확인하는 동안 타이머가 멈춥니다.</li></> : <><li>정답과 해설은 전체 시험을 마친 뒤에 공개됩니다.</li><li>모의시험에서는 AI 글쓰기 코칭과 답안 수정 기능이 비활성화됩니다.</li></>}{hasAudio && <li>{isMock ? `Listening·Speaking 음성은 ${localTts ? '로컬 서버' : '이 웹브라우저'}에서 배경 준비되며, 준비를 기다리지 않고 시작할 수 있습니다.` : '음성이 필요한 문항에서는 변환이 끝난 뒤 사용자가 재생 버튼을 눌러 시작합니다.'}</li>}{hasListening && <li>Listening에서는 한 음원을 한 번 재생하고 같은 묶음의 문제를 이어서 풉니다.</li>}{hasSpeaking && <li>Speaking 녹음을 위해 마이크 권한이 필요합니다.</li>}</ul></div><div className="system-panel"><h2>시작 전 확인</h2><div><span>학습 방식</span><strong>{immediateFeedback ? '문항별 즉시 채점' : '종료 후 채점'}</strong></div><div><span>선택 문항</span><strong>{selectionLabel}</strong></div>{hasAudio && profile && <div><span>오디오 출력</span><strong>{profile.shortLabel}</strong></div>}{hasSpeaking && <div><span>마이크</span><strong>Speaking에서 요청</strong></div>}{hasAudio && <div className={`preflight-status preflight-status--${preparation.phase}`} role="status" aria-live="polite"><span className={preparing ? 'audio-pulse audio-pulse--active' : 'audio-pulse'} /><span><strong>{preparing ? '시험 음성 배경 준비 중' : preparation.phase === 'ready' ? isMock ? '모의시험 음성 준비 완료' : '문항별 음성 준비' : preparation.phase === 'system' ? '기기 음성 준비 완료' : '음성 준비 실패'}</strong><small>{preparation.message}</small>{preparing && preparation.progress?.percent !== undefined && <span className="preflight-progress" role="progressbar" aria-label="모의시험 전체 음성 준비 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={preparation.progress.percent}><span style={{ width: `${preparation.progress.percent}%` }} /></span>}{preparing && preparation.progress?.loadedBytes !== undefined && preparation.progress.totalBytes !== undefined && <small>{(preparation.progress.loadedBytes / 1024 / 1024).toFixed(1)} / {(preparation.progress.totalBytes / 1024 / 1024).toFixed(1)} MB{preparation.progress.file ? ` · ${preparation.progress.file}` : ''}</small>}</span></div>}{hasAudio && preparation.phase === 'error' && <button className="button button--secondary preflight-test" onClick={() => setAttempt((value) => value + 1)}>음성 준비 다시 시도</button>}<button className="button button--primary button--large" disabled={requiresAudioPreflight && !ready} onClick={navigateToTest}>{isMock ? '모의시험 시작' : '연습 시작'} <ArrowIcon /></button><button className="text-button" onClick={onBack}>나중에 하기</button></div></main></div>
}

function Test({ items, session, setSession, onAnswer, onFinish }: { items: BaseItem[]; session: SavedSession; setSession: (s: SavedSession) => void; onAnswer: (id: string, answer: Answer) => void; onFinish: () => void }) {
  const questionLayoutRef = useRef<HTMLElement>(null)
  const [timeHidden, setTimeHidden] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [audioActive, setAudioActive] = useState(false)
  const [coachActive, setCoachActive] = useState(false)
  const index = Math.min(session.itemIndex, items.length - 1)
  const item = items[index]
  const currentAnswer = session.answers[item.id]
  const isMock = session.mode === 'mock'
  const immediateFeedback = session.mode !== 'mock'
  const feedbackEligible = immediateFeedback && item.answer !== undefined
  const reviewed = feedbackEligible && Boolean(session.reviewedItemIds?.includes(item.id))
  const answered = currentAnswer !== undefined && (!Array.isArray(currentAnswer) || currentAnswer.length > 0) && (typeof currentAnswer !== 'string' || currentAnswer.trim().length > 0)
  const feedbackCorrect = reviewed && isCorrect(item, currentAnswer)
  const reviewedItems = new Set(session.reviewedItemIds || [])
  const correctSoFar = items.filter((candidate) => reviewedItems.has(candidate.id) && isCorrect(candidate, session.answers[candidate.id])).length
  const sectionItems = items.filter((candidate) => candidate.section === item.section && candidate.module === item.module)
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
  const expireScope = useCallback(() => {
    if (!isMock) { moveNext(); return }
    let nextIndex = index + 1
    while (nextIndex < items.length && items[nextIndex].section === item.section && items[nextIndex].module === item.module) nextIndex += 1
    if (nextIndex >= items.length) { onFinish(); return }
    const updated = { ...session, itemIndex: nextIndex, updatedAt: new Date().toISOString() }
    setSession(updated)
    saveActive(updated)
  }, [index, isMock, item.module, item.section, items, moveNext, onFinish, session, setSession])
  const primaryAction = feedbackEligible && !reviewed ? revealAnswer : moveNext
  const primaryLabel = feedbackEligible && !reviewed ? '정답 확인' : index === items.length - 1 ? 'Finish' : immediateFeedback ? '다음 문제' : 'Next'
  const canBack = !immediateFeedback && item.section !== 'listening' && index > 0 && items[index - 1].section === item.section && items[index - 1].module === item.module
  const back = () => { if (canBack) { const updated = { ...session, itemIndex: index - 1 }; setSession(updated); saveActive(updated) } }
  const assistantActive = (item.section === 'listening' && audioActive) || (item.section === 'writing' && coachActive)
  const timerPaused = !isMock && (assistantActive || reviewed)
  const timerExpire = isMock ? expireScope : feedbackEligible && !reviewed ? revealAnswer : moveNext
  const mockSeconds = item.section === 'reading' ? (item.module === 1 ? 18 : 12) * 60 : item.section === 'listening' ? (item.module === 1 ? 18 : 11) * 60 : SECTION_META[item.section].minutes * 60
  const timerSeconds = isMock ? mockSeconds : item.timeSeconds
  const timerKey = isMock ? `${item.section}-${item.module}` : item.id
  const previousItem = items[index - 1]
  const audioAlreadyPlayedForGroup = item.kind === 'listen-choice' && previousItem?.kind === 'listen-choice' && previousItem.stimulusGroupId === item.stimulusGroupId
  useEffect(() => {
    setHelpOpen(false)
    setAudioActive(false)
    setCoachActive(false)
    window.getSelection()?.removeAllRanges()
    questionLayoutRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [item.id])
  return <div className="test-screen"><header><Brand /><div className="test-tools">{immediateFeedback && <span className="study-mode-badge">즉시 피드백</span>}<button onClick={() => setHelpOpen(true)}>Help</button><button onClick={() => setTimeHidden((value) => !value)}>{timeHidden ? 'Show Time' : 'Hide Time'}</button><span className="timer-wrap"><Timer key={timerKey} seconds={timerSeconds} hidden={timeHidden} paused={timerPaused} onExpire={timerExpire} /></span></div></header><div className="test-subhead"><strong>{SECTION_META[item.section].label} — Module {item.module}</strong><div className="question-nav">{navStart > 0 && <b>…</b>}{visibleNavItems.map((candidate, i) => <span key={candidate.id} className={`${candidate.id === item.id ? 'current' : ''} ${session.answers[candidate.id] !== undefined ? 'answered' : ''}`}>{navStart + i + 1}</span>)}{navStart + visibleNavItems.length < sectionItems.length && <b>…</b>}</div><span>Question {localIndex + 1} of {sectionItems.length}</span></div><main ref={questionLayoutRef} className={`question-layout question-layout--${item.kind}`}><Question key={item.id} item={item} answer={currentAnswer} locked={reviewed} onAnswer={(answer) => onAnswer(item.id, answer)} onAudioState={item.section === 'listening' ? setAudioActive : undefined} onCoachState={!isMock && item.section === 'writing' ? setCoachActive : undefined} coachEnabled={!isMock} audioAlreadyPlayedForGroup={audioAlreadyPlayedForGroup} /></main>{reviewed && <InstantFeedback item={item} answer={currentAnswer} correct={feedbackCorrect} correctSoFar={correctSoFar} />}<footer><span>{item.context ? `${item.topic} · ${item.context}` : item.topic} · {item.difficulty}</span><div>{canBack && <button className="button button--secondary" onClick={back}><ArrowIcon direction="left" /> Back</button>}<button className="button button--primary" disabled={feedbackEligible && !reviewed && !answered} onClick={primaryAction}>{primaryLabel} <ArrowIcon /></button></div></footer>{helpOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setHelpOpen(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="help-title">시험 화면 도움말</h2><ul>{immediateFeedback && <li>정답 확인을 누르면 바로 채점되며, 문제·내 답·정답·해설을 확인하는 동안 타이머가 멈춥니다.</li>}<li>{immediateFeedback ? '즉시 피드백 연습은 한 방향으로 진행됩니다.' : '모의시험 타이머는 문항이 아니라 현재 섹션 또는 모듈 전체에 적용됩니다.'}</li><li>Listening에서는 한 음원을 한 번만 재생하고 같은 묶음의 문제를 이어서 풉니다.</li><li>{isMock ? '모의시험 중에는 AI 글쓰기 코칭과 타이머 일시정지가 제공되지 않습니다.' : '연습 중 오디오와 AI 코칭을 기다리는 동안에는 타이머가 멈춥니다.'}</li><li>Hide Time은 타이머 표시만 숨기며 시간은 계속 흐릅니다.</li><li>응답은 이 브라우저에 자동 저장됩니다.</li></ul><button autoFocus className="button button--primary" onClick={() => setHelpOpen(false)}>Close</button></section></div>}</div>
}

function InstantFeedback({ item, answer, correct, correctSoFar }: { item: BaseItem; answer: Answer | undefined; correct: boolean; correctSoFar: number }) {
  const question = item.prompt || (item.kind === 'listen-choice' ? item.audioText : undefined) || item.passage || item.instruction
  const source = item.prompt ? item.passage || item.audioText : undefined
  return <section className={`instant-feedback ${correct ? 'instant-feedback--correct' : 'instant-feedback--wrong'}`} role="status" aria-live="polite">
    <div className="instant-feedback__result"><span>{correct ? '✓ 정답이에요!' : '정답을 확인했어요'}</span><strong>{correct ? '좋아요. 문제의 요구와 근거를 정확히 연결했습니다.' : '내 답과 정답이 갈린 근거를 바로 확인해 보세요.'}</strong><small>현재까지 {correctSoFar}개 정답</small></div>
    <div className="instant-feedback__question"><span>방금 푼 문제</span><small>{item.title} · {item.instruction}</small><strong>{question}</strong></div>
    <dl><div><dt>내 답</dt><dd>{displayAnswer(item, answer)}</dd></div><div><dt>정답</dt><dd>{displayAnswer(item, item.answer)}</dd></div></dl>
    <div className="instant-feedback__explanation"><strong>정답이 되는 이유</strong><p>{item.explanation || '문제에서 요구하는 정보와 정답 선택지를 지문 또는 음성의 핵심 내용과 대조해 보세요.'}</p></div>
    {source && <details className="instant-feedback__source"><summary>{item.passage ? '관련 지문 다시 보기' : '음성 원문 다시 보기'}</summary><p>{source}</p></details>}
  </section>
}

function Question({ item, answer, locked = false, onAnswer, onAudioState, onCoachState, coachEnabled = true, audioAlreadyPlayedForGroup = false }: { item: BaseItem; answer: Answer | undefined; locked?: boolean; onAnswer: (answer: Answer) => void; onAudioState?: (active: boolean) => void; onCoachState?: (active: boolean) => void; coachEnabled?: boolean; audioAlreadyPlayedForGroup?: boolean }) {
  if (item.kind === 'complete-words') {
    const pieces = item.passage!.split(/(\w+___)/g)
    const values = Array.isArray(answer) ? answer : []
    let blank = -1
    return <div className="single-column"><div className="question-title"><span>{item.title}</span><ContextLabel item={item} /><h1>{item.instruction}</h1></div><div className="cloze-passage">{pieces.map((piece, i) => { if (!piece.endsWith('___')) return <span key={i}>{piece}</span>; blank += 1; const index = blank; return <label key={i}>{piece.slice(0, -3)}<input aria-label={`빈칸 ${index + 1}`} disabled={locked} value={values[index] || ''} onChange={(event) => { const next = [...values]; next[index] = event.target.value; onAnswer(next) }} /></label> })}</div></div>
  }
  if (item.kind === 'multiple-choice') return <SplitQuestion item={item} answer={answer} locked={locked} onAnswer={onAnswer} />
  if (item.kind === 'listen-choice') return <div className="single-column listening"><div className="question-title"><span>{item.title}</span><ContextLabel item={item} /><h1>{item.instruction}</h1></div>{audioAlreadyPlayedForGroup ? <p className="notice">이 문제 묶음의 음원은 앞 문항에서 한 번 재생되었습니다.</p> : <AudioPrompt key={item.stimulusGroupId || item.id} text={item.audioText!} speechMode={examSpeechMode('listening', item.title)} onPlaybackChange={onAudioState} />}<h2>{item.prompt || 'Choose the best response.'}</h2><Options options={item.options!} answer={answer} locked={locked} onAnswer={onAnswer} /></div>
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
    return <div className={coachEnabled ? 'writing-layout writing-layout--coach' : 'writing-layout'}><div><div className="question-title"><span>{item.title}</span><ContextLabel item={item} /><h1>{item.instruction}</h1></div><p className="writing-prompt">{item.prompt}</p>{item.passage && <pre className="student-posts">{item.passage}</pre>}</div><div className="editor"><div className="editor-meta"><strong>Your response</strong><span>{text.trim() ? text.trim().split(/\s+/).length : 0} words</span></div><textarea value={text} onChange={(event) => onAnswer(event.target.value)} spellCheck={false} placeholder="Type your response here…" /></div>{coachEnabled && <Suspense fallback={<aside className="writing-coach writing-coach--loading">AI 코치를 불러오는 중입니다…</aside>}><WritingCoach key={item.id} item={item} response={text} onApply={onAnswer} onBusyChange={onCoachState} /></Suspense>}</div>
  }
  return <div className="single-column speaking"><div className="question-title"><span>{item.title}</span><ContextLabel item={item} /><h1>{item.instruction}</h1></div><AudioPrompt key={item.id} text={item.audioText!} speechMode={examSpeechMode('speaking', item.title)} /><div className="speaking-prompt">{item.kind === 'interview' ? item.audioText : 'Repeat the sentence you heard.'}</div><Recorder onRecorded={(duration) => onAnswer(duration)} /></div>
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
