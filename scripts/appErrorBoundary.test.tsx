import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AppErrorBoundary from '../src/AppErrorBoundary'

describe('application recovery screen', () => {
  it('keeps normal content unchanged', () => {
    const boundary = new AppErrorBoundary({ children: <p>normal screen</p> })
    expect(renderToStaticMarkup(boundary.render())).toBe('<p>normal screen</p>')
  })

  it('provides recovery without silently reloading or deleting saved data', () => {
    const boundary = new AppErrorBoundary({ children: <p>normal screen</p> })
    boundary.state = { ...boundary.state, ...AppErrorBoundary.getDerivedStateFromError() }
    const html = renderToStaticMarkup(boundary.render())
    expect(html).toContain('role="alert"')
    expect(html).toContain('최신 버전으로 다시 열기')
    expect(html).toContain('홈으로 다시 열기')
    expect(html).toContain('삭제하지 않습니다')
    expect(html).toContain('저장되지 않은 입력')
    expect(html).not.toContain('normal screen')
    boundary.state = { ...boundary.state, busy: true }
    expect(renderToStaticMarkup(boundary.render())).toContain('disabled=""')
  })
})
