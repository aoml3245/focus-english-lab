import { useEffect, useRef, useState } from 'react'
import { QUESTION_BANK } from './bank'
import { ArrowIcon, Brand } from './components'
import { clearImportedExamPack, createExamPack, downloadExamPack, getActiveExamPackInfo, getActivePracticeItems, parseExamPack, saveImportedExamPack } from './examPack'

const FORMAT_EXAMPLE = `{
  "format": "focus-english-lab.exam-pack",
  "version": 1,
  "title": "나의 연습 문제",
  "items": [{
    "id": "reading-001",
    "section": "reading",
    "module": 1,
    "kind": "multiple-choice",
    "title": "Read an Academic Passage",
    "instruction": "Read and answer the question.",
    "passage": "Researchers observed...",
    "prompt": "What is the main idea?",
    "options": ["첫 선택지", "둘째 선택지"],
    "answer": 0,
    "timeSeconds": 90
  }]
}`

export default function ExamData({ onBack, onActivate }: { onBack: () => void; onActivate: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [info, setInfo] = useState(getActiveExamPackInfo)
  const [status, setStatus] = useState('파일은 이 브라우저에서만 읽으며 어디에도 업로드하지 않습니다.')
  const [helpOpen, setHelpOpen] = useState(false)
  useEffect(() => {
    if (!helpOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setHelpOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [helpOpen])

  const downloadExample = () => {
    const kinds = new Set<string>()
    const examples = QUESTION_BANK.filter((item) => !kinds.has(item.kind) && Boolean(kinds.add(item.kind)))
    downloadExamPack(createExamPack(examples, 'Focus English Lab 형식 예제'), 'focus-english-lab-format-example.felpack.json')
  }

  const importFile = async (file?: File) => {
    if (!file) return
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('시험 데이터 파일은 25MB 이하여야 합니다.')
      const pack = parseExamPack(JSON.parse(await file.text()))
      saveImportedExamPack(pack)
      setInfo({ title: pack.title, itemCount: pack.items.length, source: 'imported' })
      setStatus(`${pack.items.length.toLocaleString('ko-KR')}문항을 불러왔습니다. 홈으로 이동하면 이 문제은행을 사용합니다.`)
      window.setTimeout(onActivate, 350)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '시험 데이터 파일을 읽지 못했습니다.')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const restore = () => {
    clearImportedExamPack()
    setInfo(getActiveExamPackInfo())
    setStatus('기본 1,000문항 문제은행으로 돌아왔습니다.')
    window.setTimeout(onActivate, 350)
  }

  return <div className="data-page">
    <header><Brand /><button className="text-button" onClick={onBack}><ArrowIcon direction="left" /> 홈으로</button></header>
    <main>
      <div className="data-hero"><span>PORTABLE EXAM DATA</span><div className="data-hero-head"><h1>시험 데이터만 들고 어디서든 연습하세요.</h1><button className="format-help-button" type="button" aria-label="시험 데이터 파일 형식 도움말" title="파일 형식 보기" onClick={() => setHelpOpen(true)}>?</button></div><p>휴대폰이나 다른 컴퓨터에서 같은 웹페이지를 열고 <code>.felpack.json</code> 파일을 선택하면 바로 사용할 수 있습니다.</p></div>
      <section className="data-current"><div><span>현재 문제은행</span><h2>{info.title}</h2><p>{info.itemCount.toLocaleString('ko-KR')}문항 · {info.source === 'imported' ? '가져온 파일' : '웹앱 기본 내장'}</p></div><strong>{info.source === 'imported' ? '가져옴' : '기본'}</strong></section>
      <div className="data-actions-grid">
        <section><h2>파일 열기</h2><p>문항 ID와 정답 범위를 검사한 뒤 브라우저에 저장합니다.</p><input ref={inputRef} className="visually-hidden" type="file" accept=".json,.felpack.json,application/json" onChange={(event) => void importFile(event.target.files?.[0])} /><button className="button button--primary" onClick={() => inputRef.current?.click()}>시험 데이터 파일 선택</button></section>
        <section><h2>현재 데이터 보관</h2><p>현재 사용 중인 문제은행을 다른 기기로 옮길 수 있습니다.</p><button className="button button--secondary" onClick={() => downloadExamPack(createExamPack(getActivePracticeItems(), info.title))}>현재 문제은행 내려받기</button></section>
        <section><h2>기본 1,000문항 받기</h2><p>독창적으로 작성된 기본 문제만 포함된 휴대용 파일입니다.</p><button className="button button--secondary" onClick={() => downloadExamPack(createExamPack(QUESTION_BANK))}>기본 데이터 내려받기</button></section>
        <section><h2>기본 데이터로 복원</h2><p>가져온 파일을 해제합니다. 학습 기록은 지워지지 않습니다.</p><button className="button button--secondary" disabled={info.source === 'built-in'} onClick={restore}>기본 문제은행 사용</button></section>
      </div>
      <p className="data-status" role="status" aria-live="polite">{status}</p>
      <div className="data-note"><strong>기기 사이에 자동 동기화되지는 않습니다.</strong><p>시험 데이터 파일은 문제와 해설을 옮깁니다. 학습 기록·내 단어장 백업은 개인정보가 섞일 수 있어 별도 파일 기능으로 분리할 예정입니다.</p></div>
    </main>
    {helpOpen && <div className="modal-backdrop format-help-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false) }}>
      <section className="format-help" role="dialog" aria-modal="true" aria-labelledby="format-help-title">
        <div className="format-help-title"><div><span>FILE GUIDE</span><h2 id="format-help-title">문제 파일은 이렇게 만드세요.</h2></div><button type="button" aria-label="도움말 닫기" onClick={() => setHelpOpen(false)}>×</button></div>
        <p><code>.felpack.json</code>은 UTF-8로 저장한 일반 JSON 파일입니다. 파일당 최대 25MB·10,000문항을 지원하며, 객관식 <code>answer</code>는 <strong>0부터 시작</strong>합니다(0 = 첫 번째 선택지).</p>
        <div className="format-help-grid">
          <div><h3>공통 필수 필드</h3><ul><li><code>id</code>: 파일 안에서 고유한 문자열</li><li><code>section</code>: reading / listening / writing / speaking</li><li><code>kind</code>: 아래 8개 유형 중 하나</li><li><code>module</code>, <code>title</code>, <code>instruction</code>, <code>timeSeconds</code></li><li><code>topic</code>, <code>difficulty</code>, <code>explanation</code>은 선택 사항</li></ul></div>
          <div><h3>유형별 추가 필드</h3><ul><li><code>complete-words</code>: passage, 문자열 answer</li><li><code>multiple-choice</code>: passage, prompt, options, 숫자 answer</li><li><code>listen-choice</code>: audioText, options, 숫자 answer</li><li><code>sentence-build</code>: prompt, starter, words, 문자열 answer</li><li><code>email</code> / <code>discussion</code>: prompt</li><li><code>repeat</code> / <code>interview</code>: audioText</li></ul></div>
        </div>
        <h3>가장 작은 객관식 예제</h3><pre><code>{FORMAT_EXAMPLE}</code></pre>
        <div className="format-help-actions"><button className="button button--secondary" type="button" onClick={downloadExample}>8개 유형 예제 파일 받기</button><button className="button button--primary" type="button" onClick={() => setHelpOpen(false)}>확인</button></div>
      </section>
    </div>}
  </div>
}
