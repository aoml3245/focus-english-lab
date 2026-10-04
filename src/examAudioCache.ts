/** Temporary exam-only audio. Unlike the ordinary LRU, it keeps every ready clip. */
export class ExamAudioCache {
  private readonly clips = new Map<string, Blob[]>()
  private bytes = 0
  constructor(private readonly maxBytes = 128 * 1024 * 1024) {}
  get(key: string) { return this.clips.get(key) }
  set(key: string, clips: Blob[]) {
    const oldBytes = (this.clips.get(key) || []).reduce((sum, clip) => sum + clip.size, 0)
    const newBytes = clips.reduce((sum, clip) => sum + clip.size, 0)
    if (this.bytes - oldBytes + newBytes > this.maxBytes) {
      throw new Error(`시험 음성이 임시 보관 한도(${Math.round(this.maxBytes / 1024 / 1024)} MiB)를 넘었습니다. 이 시험 세트는 현재 음성 보관 한도에 맞지 않아 시작할 수 없습니다. 준비한 양쪽 분기 음원은 이 고정 한도 안에서만 보관합니다.`)
    }
    this.clips.set(key, clips)
    this.bytes += newBytes - oldBytes
  }
  clear() { this.clips.clear(); this.bytes = 0 }
}
