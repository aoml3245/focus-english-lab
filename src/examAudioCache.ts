/** Temporary exam-only audio. Unlike the ordinary LRU, it keeps every ready clip. */
export class ExamAudioCache {
  private readonly clips = new Map<string, Blob[]>()
  private bytes = 0
  constructor(private readonly maxBytes = 64 * 1024 * 1024) {}
  get(key: string) { return this.clips.get(key) }
  set(key: string, clips: Blob[]) {
    const oldBytes = (this.clips.get(key) || []).reduce((sum, clip) => sum + clip.size, 0)
    const newBytes = clips.reduce((sum, clip) => sum + clip.size, 0)
    if (this.bytes - oldBytes + newBytes > this.maxBytes) {
      throw new Error('시험 음성이 임시 메모리 한도(64MB)를 넘었습니다. 기기 기본 음성을 선택하거나 더 작은 연습 세트를 사용해 주세요.')
    }
    this.clips.set(key, clips)
    this.bytes += newBytes - oldBytes
  }
  clear() { this.clips.clear(); this.bytes = 0 }
}
