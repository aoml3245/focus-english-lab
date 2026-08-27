import { type MouseEvent as ReactMouseEvent, useRef, useState } from 'react'
import {
  analyzeWordWithLocalLlm,
  findDictionaryEntry,
  loadFavorites,
  normalizeWord,
  saveFavorites,
  savePersonalWord,
  translateSentenceWithLocalLlm,
  type LearningEntry,
} from './learning'

type WordState = 'idle' | 'dictionary' | 'llm' | 'ready' | 'error'
type SentenceResult = { text: string; translation: string; note: string }
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const FUNCTION_WORDS: Record<string, Pick<LearningEntry, 'meaningKo' | 'meaningEn' | 'partOfSpeech'>> = {
  the: { meaningKo: '정관사: 특정한 대상을 가리킴', meaningEn: 'the definite article used before a specific noun', partOfSpeech: 'determiner' },
  a: { meaningKo: '부정관사: 하나의 불특정 대상을 가리킴', meaningEn: 'an indefinite article used before a singular noun', partOfSpeech: 'determiner' },
  an: { meaningKo: '부정관사: 모음 소리 앞의 불특정 대상을 가리킴', meaningEn: 'an indefinite article used before a vowel sound', partOfSpeech: 'determiner' },
}

export default function ReadingAssistant({ passage, topic }: { passage: string; topic: string }) {
  const passageRef = useRef<HTMLParagraphElement>(null)
  const requestRef = useRef(0)
  const [entry, setEntry] = useState<LearningEntry | null>(null)
  const [wordState, setWordState] = useState<WordState>('idle')
  const [saved, setSaved] = useState(false)
  const [sentence, setSentence] = useState<SentenceResult | null>(null)
  const [sentenceLoading, setSentenceLoading] = useState(false)
  const [notice, setNotice] = useState('단어를 클릭하거나 문장을 드래그해 선택하세요.')

  const inspectWord = async (rawWord: string) => {
    const word = normalizeWord(rawWord)
    if (!word) return
    const exampleSentence = passage.match(/[^.!?]+[.!?]?/g)?.find((candidate) => new RegExp(`\\b${escapePattern(word)}\\b`, 'i').test(candidate))?.trim() || passage
    const requestId = ++requestRef.current
    setSentence(null)
    setEntry({ word, meaningKo: '', meaningEn: '', partOfSpeech: '', cefr: '', ipa: '', synonyms: [], example: exampleSentence, translation: '', frequency: 1, topics: [topic] })
    setSaved(loadFavorites().has(word))
    setWordState('dictionary')
    setNotice('내장 사전에서 문맥 뜻을 찾고 있습니다…')
    const functionWord = FUNCTION_WORDS[word]
    if (functionWord) {
      setEntry((current) => current ? { ...current, ...functionWord } : current)
      setWordState('ready')
      setNotice('문법 기능어입니다. 핵심 내용어를 선택하면 문맥 뜻과 유의어를 더 자세히 볼 수 있습니다.')
      return
    }
    const dictionaryEntry = await findDictionaryEntry(word).catch(() => null)
    if (requestRef.current !== requestId) return
    if (dictionaryEntry) setEntry({ ...dictionaryEntry, example: exampleSentence, topics: [...new Set([topic, ...dictionaryEntry.topics])] })
    setWordState('llm')
    setNotice(dictionaryEntry ? '뜻을 먼저 표시했습니다. 로컬 LLM이 문맥에 맞게 다듬는 중입니다…' : '로컬 LLM이 뜻과 유의어를 정리하고 있습니다…')
    try {
      const enriched = await analyzeWordWithLocalLlm(word, exampleSentence, dictionaryEntry)
      if (requestRef.current !== requestId) return
      const next = { ...enriched, topics: [...new Set([topic, ...enriched.topics])] }
      setEntry(next)
      if (loadFavorites().has(word)) savePersonalWord(next)
      setWordState('ready')
      setNotice('로컬 LLM이 현재 문맥을 기준으로 정리했습니다.')
    } catch {
      if (requestRef.current !== requestId) return
      setWordState(dictionaryEntry ? 'ready' : 'error')
      setNotice(dictionaryEntry ? '로컬 LLM은 연결되지 않았지만 내장 사전 뜻을 표시합니다.' : '로컬 LLM에 연결할 수 없습니다. Ollama를 실행한 뒤 다시 선택해 주세요.')
    }
  }

  const translateSelection = async () => {
    const selection = window.getSelection()
    const selectedText = selection?.toString().replace(/\s+/g, ' ').trim() || ''
    if (!selectedText || !passageRef.current || !selection?.rangeCount) return
    const common = selection.getRangeAt(0).commonAncestorContainer
    if (!passageRef.current.contains(common.nodeType === Node.TEXT_NODE ? common.parentNode : common)) return
    if (/^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(selectedText)) {
      void inspectWord(selectedText)
      return
    }
    if (selectedText.split(/\s+/).length < 2) return
    const requestId = ++requestRef.current
    setEntry(null)
    setSentence({ text: selectedText, translation: '', note: '' })
    setSentenceLoading(true)
    setNotice('로컬 LLM이 선택한 문장을 해석하고 있습니다…')
    try {
      const result = await translateSentenceWithLocalLlm(selectedText)
      if (requestRef.current !== requestId) return
      setSentence({ text: selectedText, ...result })
      setNotice('선택한 문장의 자연스러운 해석과 핵심 표현입니다.')
    } catch {
      if (requestRef.current !== requestId) return
      setSentence({ text: selectedText, translation: '로컬 LLM에 연결할 수 없어 해석을 만들지 못했습니다.', note: 'Ollama가 실행 중인지 확인해 주세요.' })
      setNotice('문장 해석에 로컬 LLM 연결이 필요합니다.')
    } finally {
      if (requestRef.current === requestId) setSentenceLoading(false)
    }
  }

  const inspectClickedWord = (event: ReactMouseEvent<HTMLParagraphElement>) => {
    if (window.getSelection()?.toString().trim()) return
    const documentWithCaret = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }
    const range = documentWithCaret.caretRangeFromPoint?.(event.clientX, event.clientY)
    const node = range?.startContainer
    if (!node || node.nodeType !== Node.TEXT_NODE) return
    const text = node.textContent || ''
    let start = range.startOffset
    let end = range.startOffset
    while (start > 0 && /[A-Za-z'’-]/.test(text[start - 1])) start -= 1
    while (end < text.length && /[A-Za-z'’-]/.test(text[end])) end += 1
    const word = text.slice(start, end)
    if (word) void inspectWord(word)
  }

  const saveCurrent = () => {
    if (!entry) return
    const savedEntry = savePersonalWord({ ...entry, topics: [...new Set([topic, ...entry.topics])] })
    setEntry(savedEntry)
    setSaved(true)
    setNotice('“내가 만든 단어장”에 저장했습니다.')
  }

  const removeCurrent = () => {
    if (!entry) return
    const favorites = loadFavorites()
    favorites.delete(normalizeWord(entry.word))
    saveFavorites(favorites)
    setSaved(false)
    setNotice('저장 표시를 해제했습니다.')
  }

  return <div className="reading-assistant">
    <p ref={passageRef} className="interactive-passage" onMouseUp={translateSelection} onTouchEnd={translateSelection} onClick={inspectClickedWord}>{passage}</p>
    <section className={`reading-inspector ${entry || sentence ? 'reading-inspector--active' : ''}`} aria-live="polite">
      <div className="reading-inspector-head"><strong>읽기 도우미</strong><span>{notice}</span></div>
      {entry && <div className="word-insight">
        <div className="word-insight-title"><div><h3>{entry.word}</h3><span>{entry.partOfSpeech}{entry.ipa ? ` · ${entry.ipa}` : ''}</span></div><button className={saved ? 'save-word save-word--active' : 'save-word'} onClick={saved ? removeCurrent : saveCurrent} disabled={wordState === 'dictionary'}>{saved ? '내 단어장에 저장됨' : '내 단어장에 넣기'}</button></div>
        {entry.meaningKo ? <><strong>{entry.meaningKo}</strong>{entry.meaningEn && <p>{entry.meaningEn}</p>}<div className="insight-synonyms"><span>문맥 유의어</span>{entry.synonyms.length ? entry.synonyms.slice(0, 3).map((word) => <em key={word}>{word}</em>) : <small>{wordState === 'llm' || wordState === 'dictionary' ? '로컬 LLM이 정리 중입니다.' : '문맥상 가까운 유의어가 없습니다.'}</small>}</div></> : <p>뜻을 불러오고 있습니다…</p>}
        {wordState === 'llm' && <div className="llm-progress"><i /> 로컬 LLM 분석 중</div>}
      </div>}
      {sentence && <div className="sentence-insight"><blockquote>{sentence.text}</blockquote>{sentenceLoading ? <div className="llm-progress"><i /> 로컬 LLM 번역 중</div> : <><strong>{sentence.translation}</strong>{sentence.note && <p>{sentence.note}</p>}</>}</div>}
    </section>
  </div>
}
