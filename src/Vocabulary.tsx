import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowIcon, Brand } from './components'
import { loadFavorites, loadPersonalWords, normalizeWord, requestVocabulary, saveFavorites, type LearningEntry } from './learning'
import PersonalVocabularyWorkspace from './PersonalVocabularyWorkspace'
import { removePersonalWordCompletely } from './personalVocabulary'
import { playReadyChime } from './readyChime'
import { loadVoiceProfileId, playTTS, prepareSpeech, stopTTS } from './tts'
import type { VocabularyDownloadProgress } from './cloudSync'

type IndexedEntry = LearningEntry & { searchText: string }
type VocabularyAudioState = { key: string; phase: 'preparing' | 'ready' | 'playing' | 'done' | 'error'; status: string }
const LEVELS = ['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const LEVEL_WEIGHT: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }

export default function Vocabulary({ onBack }: { onBack: () => void }) {
  const [vocabulary, setVocabulary] = useState<IndexedEntry[]>([])
  const [dictionaryVocabulary, setDictionaryVocabulary] = useState<LearningEntry[]>([])
  const [loadError, setLoadError] = useState('')
  const [downloadProgress, setDownloadProgress] = useState<VocabularyDownloadProgress | null>(null)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const [level, setLevel] = useState('All')
  const [topic, setTopic] = useState('All')
  const [savedOnly, setSavedOnly] = useState(false)
  const [academicOnly, setAcademicOnly] = useState(false)
  const [sort, setSort] = useState<'academic' | 'frequency' | 'alphabetical'>('academic')
  const [cardIndex, setCardIndex] = useState(0)
  const [favorites, setFavorites] = useState(loadFavorites)
  const [libraryVersion, setLibraryVersion] = useState(0)
  const [audio, setAudio] = useState<VocabularyAudioState | null>(null)
  const audioRequest = useRef(0)
  const audioPreparation = useRef<AbortController | null>(null)
  const swipeStartX = useRef<number | null>(null)
  useEffect(() => {
    let active = true
    requestVocabulary((progress) => { if (active) setDownloadProgress(progress) }).then((entries) => {
      if (!active) return
      setDictionaryVocabulary(entries)
      const merged = new Map(entries.map((entry) => [entry.word, entry]))
      for (const personal of loadPersonalWords()) {
        const base = merged.get(personal.word)
        merged.set(personal.word, { ...base, ...personal, frequency: base?.frequency || personal.frequency, topics: [...new Set([...(personal.topics || []), ...(base?.topics || [])])] })
      }
      setVocabulary([...merged.values()].map((entry) => ({ ...entry, searchText: [entry.word, entry.meaningKo, entry.meaningEn, ...entry.synonyms, ...entry.topics, ...(entry.meanings || []).flatMap((sense) => [sense.meaningKo, sense.meaningEn, ...sense.synonyms])].join(' ').toLowerCase() })))
      setFavorites(loadFavorites())
      window.setTimeout(() => { if (active) setDownloadProgress(null) }, 5000)
    }).catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : '단어장 데이터를 불러오지 못했습니다.') })
    return () => { active = false }
  }, [libraryVersion])
  useEffect(() => () => { audioRequest.current += 1; audioPreparation.current?.abort(); stopTTS() }, [])
  const topics = useMemo(() => [...new Set(vocabulary.flatMap((entry) => entry.topics))].sort((a, b) => a.localeCompare(b, 'ko')), [vocabulary])
  const academicCount = useMemo(() => vocabulary.reduce((count, entry) => count + (entry.academicCore ? 1 : 0), 0), [vocabulary])
  const personalWords = useMemo(() => new Set(loadPersonalWords().map((entry) => normalizeWord(entry.word))), [libraryVersion, vocabulary])

  const filtered = useMemo(() => {
    const values = vocabulary.filter((entry) =>
      (!deferredQuery || entry.searchText.includes(deferredQuery)) &&
      (level === 'All' || entry.cefr === level) &&
      (topic === 'All' || entry.topics.includes(topic)) &&
      (!academicOnly || Boolean(entry.academicCore)) &&
      (!savedOnly || favorites.has(entry.word)),
    )
    return values.sort((a, b) => {
      if (sort === 'alphabetical') return a.word.localeCompare(b.word)
      if (sort === 'frequency') {
        const corpusDifference = Number(b.frequency > 0) - Number(a.frequency > 0)
        if (corpusDifference) return corpusDifference
        if (a.frequency !== b.frequency) return b.frequency - a.frequency
        return (a.frequencyRank ?? Number.MAX_SAFE_INTEGER) - (b.frequencyRank ?? Number.MAX_SAFE_INTEGER) || a.word.localeCompare(b.word)
      }
      const academicDifference = Number(Boolean(b.academicCore)) - Number(Boolean(a.academicCore))
      if (academicDifference) return academicDifference
      const levelDifference = (LEVEL_WEIGHT[b.cefr] || 0) - (LEVEL_WEIGHT[a.cefr] || 0)
      if (levelDifference) return levelDifference
      return b.frequency - a.frequency || (a.frequencyRank ?? Number.MAX_SAFE_INTEGER) - (b.frequencyRank ?? Number.MAX_SAFE_INTEGER) || a.word.localeCompare(b.word)
    })
  }, [academicOnly, deferredQuery, favorites, level, savedOnly, sort, topic, vocabulary])
  const safeCardIndex = Math.min(cardIndex, Math.max(0, filtered.length - 1))
  const activeEntry = filtered[safeCardIndex]
  const stopVocabularyAudio = useCallback(() => {
    audioRequest.current += 1
    audioPreparation.current?.abort()
    audioPreparation.current = null
    stopTTS()
    setAudio(null)
  }, [])
  const changeFilter = (change: () => void) => { stopVocabularyAudio(); change(); setCardIndex(0) }
  const moveCard = useCallback((direction: -1 | 1) => {
    stopVocabularyAudio()
    setCardIndex((current) => Math.max(0, Math.min(filtered.length - 1, current + direction)))
  }, [filtered.length, stopVocabularyAudio])
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      if (event.key === 'ArrowLeft' && safeCardIndex > 0) { event.preventDefault(); moveCard(-1) }
      if (event.key === 'ArrowRight' && safeCardIndex + 1 < filtered.length) { event.preventDefault(); moveCard(1) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filtered.length, moveCard, safeCardIndex])
  const finishSwipe = (clientX: number) => {
    const start = swipeStartX.current
    swipeStartX.current = null
    if (start === null || Math.abs(clientX - start) < 60) return
    if (clientX < start && safeCardIndex + 1 < filtered.length) moveCard(1)
    if (clientX > start && safeCardIndex > 0) moveCard(-1)
  }
  const playVocabularyAudio = async (key: string, text: string) => {
    if (audio?.key === key && audio.phase === 'playing') { stopVocabularyAudio(); return }
    const request = ++audioRequest.current
    const prepared = audio?.key === key && (audio.phase === 'ready' || audio.phase === 'done')
    if (!prepared) {
      audioPreparation.current?.abort()
      const controller = new AbortController()
      audioPreparation.current = controller
      setAudio({ key, phase: 'preparing', status: '음성을 변환하고 있습니다.' })
      try {
        await prepareSpeech(text, loadVoiceProfileId(), 'sentence', (status) => {
          if (request === audioRequest.current) setAudio({ key, phase: 'preparing', status })
        }, controller.signal)
        if (request !== audioRequest.current || controller.signal.aborted) return
        setAudio({ key, phase: 'ready', status: '음성 준비가 끝났습니다. 재생을 눌러 주세요.' })
        void playReadyChime()
      } catch (error) {
        if (request !== audioRequest.current || controller.signal.aborted) return
        setAudio({ key, phase: 'error', status: error instanceof Error ? error.message : '음성을 준비하지 못했습니다.' })
      }
      return
    }
    setAudio({ key, phase: 'playing', status: '재생 중…' })
    try {
      const result = await playTTS(text, loadVoiceProfileId(), (status) => {
        if (request !== audioRequest.current) return
        setAudio({ key, phase: 'playing', status })
      }, { speechMode: 'sentence' })
      if (request !== audioRequest.current || result === 'cancelled') return
      setAudio({ key, phase: 'done', status: result === 'fallback' ? '시스템 음성으로 재생했습니다.' : '재생이 끝났습니다.' })
    } catch (error) {
      if (request !== audioRequest.current) return
      setAudio({ key, phase: 'error', status: error instanceof Error ? error.message : '음성을 재생하지 못했습니다.' })
    }
  }
  const toggleFavorite = (word: string) => {
    setFavorites((current) => {
      const next = new Set(current)
      if (next.has(word)) next.delete(word)
      else next.add(word)
      saveFavorites(next)
      return next
    })
  }
  const deletePersonalWord = (word: string) => {
    if (!window.confirm(`내가 추가한 "${word}" 단어와 이 단어의 암기 통계를 완전히 삭제할까요? 다른 기기에서도 삭제됩니다.`)) return
    if (removePersonalWordCompletely(word)) setLibraryVersion((value) => value + 1)
  }

  return <div className="vocab-page">
    <header><Brand /><button className="text-button" onClick={onBack}><ArrowIcon direction="left" /> 홈으로</button></header>
    <main>
      <div className="vocab-hero"><div><h1>문장으로 익히는 단어장</h1><p>문제은행의 문맥 어휘와 공개 사전에서 직접 검수를 마친 어휘를 1,000개 단위로 공개합니다. 단어와 예문은 음성 설정에서 고른 목소리로 들을 수 있습니다.</p></div><dl><div><dt>전체 어휘</dt><dd>{vocabulary.length ? vocabulary.length.toLocaleString('en-US') : '—'}</dd></div><div><dt>학술 핵심</dt><dd>{vocabulary.length ? academicCount.toLocaleString('en-US') : '—'}</dd></div><div><dt>저장한 단어</dt><dd>{favorites.size.toLocaleString('en-US')}</dd></div></dl></div>
      {vocabulary.length > 0 && downloadProgress?.phase === 'done' && <VocabularyCacheSummary progress={downloadProgress} />}
      <section className="vocab-controls" aria-label="단어장 검색과 필터">
        <label className="vocab-search"><span>단어 검색</span><input type="search" value={query} onChange={(event) => changeFilter(() => setQuery(event.target.value))} placeholder="영어 단어, 한국어 뜻, 동의어 검색" /></label>
        <label><span>난이도</span><select value={level} onChange={(event) => changeFilter(() => setLevel(event.target.value))}>{LEVELS.map((value) => <option key={value} value={value}>{value === 'All' ? '전체' : value}</option>)}</select></label>
        <label><span>주제</span><select value={topic} onChange={(event) => changeFilter(() => setTopic(event.target.value))}><option value="All">전체 주제</option>{topics.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span>정렬</span><select value={sort} onChange={(event) => changeFilter(() => setSort(event.target.value as typeof sort))}><option value="academic">TOEFL 학술 우선순</option><option value="frequency">문항 빈도순</option><option value="alphabetical">알파벳순</option></select></label>
        <button className={academicOnly ? 'filter-toggle filter-toggle--active' : 'filter-toggle'} onClick={() => changeFilter(() => setAcademicOnly((value) => !value))}>{academicOnly ? '학술 핵심만 보는 중' : '학술 핵심만'}</button>
        <button className={savedOnly ? 'filter-toggle filter-toggle--active' : 'filter-toggle'} onClick={() => changeFilter(() => setSavedOnly((value) => !value))}>{savedOnly ? '내 단어장만 보는 중' : '내 단어장'}</button>
      </section>
      <div className="vocab-result-head"><p><strong>{filtered.length.toLocaleString('en-US')}</strong>개 단어</p>{activeEntry && <span><b>{safeCardIndex + 1}</b> / {filtered.length.toLocaleString('en-US')}</span>}</div>
      {loadError ? <div className="vocab-empty"><strong>{loadError}</strong><span>페이지를 새로고침해 다시 시도해 주세요.</span></div> : !vocabulary.length ? <VocabularyLoading progress={downloadProgress} /> : activeEntry ? <section className="vocab-deck" aria-label="한 장씩 보는 단어장">
        <button className="vocab-deck-nav vocab-deck-nav--previous" aria-label="이전 단어" disabled={safeCardIndex === 0} onClick={() => moveCard(-1)}><ArrowIcon direction="left" /><span>이전 단어</span></button>
        <div className="vocab-deck-stage" onPointerDown={(event) => { swipeStartX.current = event.clientX }} onPointerUp={(event) => finishSwipe(event.clientX)} onPointerCancel={() => { swipeStartX.current = null }}>
          <VocabularyCard key={activeEntry.word} entry={activeEntry} saved={favorites.has(activeEntry.word)} personal={personalWords.has(normalizeWord(activeEntry.word))} audio={audio} onPlay={playVocabularyAudio} onToggle={() => toggleFavorite(activeEntry.word)} onDelete={() => deletePersonalWord(activeEntry.word)} />
        </div>
        <button className="vocab-deck-nav vocab-deck-nav--next" aria-label="다음 단어" disabled={safeCardIndex + 1 >= filtered.length} onClick={() => moveCard(1)}><span>다음 단어</span><ArrowIcon /></button>
        <div className="vocab-deck-progress" aria-hidden="true"><span style={{ width: `${((safeCardIndex + 1) / filtered.length) * 100}%` }} /></div>
        <p className="vocab-deck-hint">좌우로 스와이프하거나 화살표 키로 넘기세요. 카드 안에서는 위아래로 스크롤할 수 있습니다.</p>
      </section> : <div className="vocab-empty"><strong>조건에 맞는 단어가 없습니다.</strong><span>검색어나 필터를 바꿔 보세요.</span></div>}
      <PersonalVocabularyWorkspace vocabulary={dictionaryVocabulary} onLibraryChanged={() => setLibraryVersion((value) => value + 1)} />
      <p className="vocab-attribution">학술 핵심 기준: 앱 문항 빈도 또는 B2–C2 난이도와 공개 사전 빈도<br />어휘 정보: <a href="https://github.com/jhseo1211/open-english-korean-dict" target="_blank" rel="noreferrer">Open English–Korean Dictionary</a> · <a href="https://en-word.net/downloads" target="_blank" rel="noreferrer">Open English WordNet 2025</a></p>
    </main>
  </div>
}

function formatDownloadBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function VocabularyLoading({ progress }: { progress: VocabularyDownloadProgress | null }) {
  const percent = progress?.totalChunks ? Math.round(progress.completedChunks / progress.totalChunks * 100) : 0
  const amount = progress ? `${formatDownloadBytes(progress.downloadedBytes)} 새로 받음${progress.totalBytes ? ` · 전체 ${formatDownloadBytes(progress.totalBytes)}` : ''}` : '0 B 새로 받음'
  const title = progress?.phase === 'manifest' ? '단어장 다운로드 목록을 확인하고 있습니다.' : progress?.phase === 'processing' ? '받은 단어를 검색 가능한 목록으로 정리하고 있습니다.' : '기본 단어장을 받고 있습니다.'
  return <div className="vocab-download" role="status" aria-live="polite"><strong>{title}</strong><div className="vocab-download__meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div><div><span>{progress?.completedChunks || 0} / {progress?.totalChunks || '—'}개 조각</span><span>{amount}</span></div><small>{(progress?.loadedEntries || 0).toLocaleString('ko-KR')}개 단어 불러오는 중 · 캐시 {progress?.cachedChunks || 0}개 재사용</small></div>
}

function VocabularyCacheSummary({ progress }: { progress: VocabularyDownloadProgress }) {
  return <div className="vocab-cache-summary" role="status"><strong>단어장 준비 완료</strong><span>전체 {progress.totalChunks}개 조각 · {formatDownloadBytes(progress.downloadedBytes)} 새로 받음 · 캐시 {progress.cachedChunks}개 재사용</span></div>
}

function SpeakerIcon({ stopped = false }: { stopped?: boolean }) {
  if (stopped) return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" /></svg>
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10v4h3l4 3V7L8 10H5Z" /><path d="M15 9.5a4 4 0 0 1 0 5" /><path d="M17.5 7a7 7 0 0 1 0 10" /></svg>
}

function VocabularyAudioButton({ label, accessibleLabel, state, onClick }: { label: string; accessibleLabel: string; state: VocabularyAudioState | null; onClick: () => void }) {
  const busy = state?.phase === 'preparing' || state?.phase === 'playing'
  const buttonLabel = state?.phase === 'preparing' ? '준비 중…' : state?.phase === 'ready' ? '재생' : state?.phase === 'playing' ? '정지' : state?.phase === 'done' ? '다시 듣기' : state?.phase === 'error' ? '준비 다시 시도' : `${label} 준비`
  return <div className="vocab-audio-control"><button className={busy ? 'vocab-audio-button vocab-audio-button--active' : 'vocab-audio-button'} aria-label={`${accessibleLabel} ${buttonLabel}`} aria-pressed={state?.phase === 'playing'} disabled={state?.phase === 'preparing'} onClick={onClick}><SpeakerIcon stopped={state?.phase === 'playing'} /><span>{buttonLabel}</span></button>{state && <small className={state.phase === 'error' ? 'vocab-audio-status vocab-audio-status--error' : 'vocab-audio-status'} aria-live="polite">{state.status}</small>}</div>
}

function VocabularyCard({ entry, saved, personal, audio, onPlay, onToggle, onDelete }: { entry: LearningEntry; saved: boolean; personal: boolean; audio: VocabularyAudioState | null; onPlay: (key: string, text: string) => void; onToggle: () => void; onDelete: () => void }) {
  const wordKey = `${entry.word}:word`
  const exampleKey = `${entry.word}:example`
  const meanings = entry.meanings?.length ? entry.meanings : [{ senseId: `${entry.word}:primary`, meaningKo: entry.dictionaryMeaningKo || entry.meaningKo, meaningEn: entry.meaningEn, partOfSpeech: entry.partOfSpeech, synonyms: entry.synonyms }]
  return <article className="vocab-card">
    <div className="vocab-word"><div className="vocab-term"><h2>{entry.word}</h2>{entry.ipa && <span>{entry.ipa}</span>}<VocabularyAudioButton label="단어 듣기" accessibleLabel={entry.word} state={audio?.key === wordKey ? audio : null} onClick={() => onPlay(wordKey, entry.word)} /></div><div><span>{entry.partOfSpeech}</span><span>{entry.cefr}</span>{entry.academicCore && <span className="academic-badge">학술 핵심</span>}<button className={saved ? 'save-word save-word--active' : 'save-word'} onClick={onToggle}>{saved ? '저장됨' : '저장'}</button>{personal && <button className="delete-personal-word" onClick={onDelete}>내 단어 삭제</button>}</div></div>
    <div className="vocab-meanings">{entry.personalMeaningKo && entry.dictionaryMeaningKo && <div className="vocab-meaning-compare"><div><small>내가 입력한 뜻</small><strong>{entry.personalMeaningKo}</strong></div><div><small>기존 단어장 뜻</small><strong>{entry.dictionaryMeaningKo}</strong></div></div>}<ol>{meanings.map((sense, index) => <li key={sense.senseId}><div><span>{index + 1}</span><em>{sense.partOfSpeech}</em>{index === 0 && <small>대표·문맥 뜻</small>}</div><strong>{sense.meaningKo}</strong><p>{sense.meaningEn}</p>{sense.synonyms.length > 0 && <div className="vocab-sense-synonyms">{sense.synonyms.map((synonym) => <em key={synonym}>{synonym}</em>)}</div>}</li>)}</ol></div>
    <blockquote><VocabularyAudioButton label="예문 듣기" accessibleLabel={entry.word} state={audio?.key === exampleKey ? audio : null} onClick={() => onPlay(exampleKey, entry.example)} /><p>{entry.example}</p><footer>{entry.translation || '해석 생성 중'}</footer></blockquote>
    <div className="vocab-meta"><span>{entry.source === 'local-llm' ? '로컬 LLM 문맥 정리' : entry.source === 'dictionary' && entry.frequencyRank ? `영어 사용 빈도 ${entry.frequencyRank.toLocaleString('en-US')}위` : `문항에서 ${entry.frequency}회`}</span><span>{entry.topics.join(' · ')}</span></div>
  </article>
}
