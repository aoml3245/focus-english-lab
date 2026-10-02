import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Chunk = { file: string; count: number; bytes: number; sha256: string }
type Manifest = { schemaVersion: number; entryCount: number; reviewCheckpoint: number; corpusEntryCount?: number; reviewComplete?: boolean; chunkCount: number; totalBytes: number; license: string; chunks: Chunk[] }
type Sense = { senseId: string; meaningKo: string; meaningEn: string; partOfSpeech: string; synonyms: string[] }
type Entry = { word: string; meaningKo: string; meaningEn: string; partOfSpeech: string; meanings: Sense[]; example: string; translation: string; synonyms: string[] }

const root = resolve(process.cwd(), 'public/data/vocabulary')
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')) as Manifest

describe('public vocabulary checkpoint', () => {
  it('publishes a completed checkpoint or the fully reviewed corpus with verified chunk hashes', () => {
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.entryCount).toBe(manifest.reviewCheckpoint)
    expect(manifest.entryCount).toBeGreaterThanOrEqual(1000)
    if (manifest.entryCount % 1000 !== 0) {
      expect(manifest.reviewComplete).toBe(true)
      expect(manifest.corpusEntryCount).toBe(29_976)
      expect(manifest.entryCount).toBe(manifest.corpusEntryCount)
    }
    if (manifest.reviewComplete) expect(manifest.entryCount).toBe(manifest.corpusEntryCount)
    expect(manifest.chunkCount).toBe(manifest.chunks.length)
    expect(manifest.license).toBe('CC BY-SA 4.0')
    let bytes = 0
    let count = 0
    for (const chunk of manifest.chunks) {
      const payload = readFileSync(resolve(root, chunk.file))
      expect(payload.byteLength).toBe(chunk.bytes)
      expect(createHash('sha256').update(payload).digest('hex')).toBe(chunk.sha256)
      expect((JSON.parse(payload.toString('utf8')) as Entry[])).toHaveLength(chunk.count)
      bytes += payload.byteLength
      count += chunk.count
    }
    expect(bytes).toBe(manifest.totalBytes)
    expect(count).toBe(manifest.entryCount)
  })

  it('contains unique, internally consistent learning entries', () => {
    const entries = manifest.chunks.flatMap((chunk) => JSON.parse(readFileSync(resolve(root, chunk.file), 'utf8')) as Entry[])
    expect(new Set(entries.map((entry) => entry.word)).size).toBe(entries.length)
    for (const entry of entries) {
      expect(entry.meanings.length).toBeGreaterThanOrEqual(1)
      expect(entry.meanings.length).toBeLessThanOrEqual(3)
      expect(entry.meaningKo).toBe(entry.meanings[0].meaningKo)
      expect(entry.meaningEn).toBe(entry.meanings[0].meaningEn)
      expect(entry.partOfSpeech).toBe(entry.meanings[0].partOfSpeech)
      expect(entry.synonyms).toEqual(entry.meanings[0].synonyms)
      expect(entry.example.trim()).not.toBe('')
      expect(entry.translation).toMatch(/[가-힣]/)
    }
  })
})
