import { SECTION_META } from './data'
import { getSessionStats } from './review'
import type { BaseItem, SavedSession } from './types'

export function SectionPerformance({ items, session }: { items: BaseItem[]; session: SavedSession }) {
  const { sectionStats } = getSessionStats(items, session)
  return <section className="section-performance" aria-label="영역별 학습 결과"><h2>영역별 수행 결과</h2><div className="performance-grid">{sectionStats.filter((stats) => stats.total || stats.constructed).map((stats) => <article key={stats.section}><h3>{SECTION_META[stats.section].label}</h3>{stats.percent !== null && <p><strong>{stats.percent}%</strong> · {stats.correct}/{stats.total} 채점 항목</p>}{stats.constructed > 0 && <p>작성형 {stats.constructedAnswered}/{stats.constructed}개 응답 · 자동 정답률에 미포함</p>}{session.adaptive?.decisions[stats.section as 'reading' | 'listening'] && <p>2단계: {session.adaptive.decisions[stats.section as 'reading' | 'listening']!.route === 'upper' ? '상위 난이도' : '기초 난이도'} · 첫 모듈 {session.adaptive.decisions[stats.section as 'reading' | 'listening']!.correct}/{session.adaptive.decisions[stats.section as 'reading' | 'listening']!.total}</p>}</article>)}</div><small>난이도와 분기는 자체 연습 기준입니다. 정답률을 TOEFL 1–6 점수로 환산하지 않습니다.</small></section>
}
