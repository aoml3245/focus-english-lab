import { Component, type ReactNode } from 'react'
import { refreshAppToLatest } from './AppUpdate'

type State = { failed: boolean; busy: boolean; message: string }

/** A deployment can invalidate lazy bundles in a tab running an older version. */
export default class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, busy: false, message: '' }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  update = async () => {
    if (this.state.busy) return
    this.setState({ busy: true, message: '최신 버전을 확인하고 있습니다…' })
    try {
      await refreshAppToLatest((message) => this.setState({ message }))
    } catch {
      this.setState({ busy: false, message: '업데이트를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.' })
    }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <main className="app-recovery" role="alert">
      <h1>화면을 다시 불러와 주세요.</h1>
      <p>배포 후 이전 앱 파일을 불러오지 못했거나 화면에 오류가 생겼습니다.</p>
      <p>저장된 단어장·학습 기록·음성 모델은 삭제하지 않습니다. 아직 저장되지 않은 입력은 다시 적어야 할 수 있습니다.</p>
      <button className="button button--primary" disabled={this.state.busy} onClick={() => void this.update()}>
        {this.state.busy ? '업데이트 확인 중…' : '최신 버전으로 다시 열기'}
      </button>
      <button className="button" disabled={this.state.busy} onClick={() => {
        window.location.hash = '/home'
        window.location.reload()
      }}>홈으로 다시 열기</button>
      <p role="status">{this.state.message}</p>
    </main>
  }
}
