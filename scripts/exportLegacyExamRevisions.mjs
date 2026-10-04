import { readFileSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { createHash } from 'node:crypto'

// Export original authored question text only, never learner answers or private data.
const [baselinePath, correctionsPath] = process.argv.slice(2)
if (!baselinePath || !correctionsPath) throw new Error('Usage: node scripts/exportLegacyExamRevisions.mjs BASELINE_BANK_JSON AUDIT_JSON')
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const baselineHash = createHash('sha256').update(JSON.stringify(baseline)).digest('hex')
if (baselineHash !== '41876b5a12b239587125e5d34ab4dcb41e74319f9e9178046e4cf7acf19aad06') throw new Error('Not the audited 0.1.83 baseline.')
const audit = JSON.parse(readFileSync(correctionsPath, 'utf8'))
const corrections = audit.findings.find((finding) => finding.type === 'confirmed_answer_index_mismatch').cases
if (corrections.length !== 198) throw new Error('Expected all 198 confirmed keys.')
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context) } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context)
    throw error
  }
} })
const { QUESTION_BANK } = await import('../src/bank.ts')
const current = new Map(QUESTION_BANK.map((item) => [item.id, item]))
const legacy = baseline.filter((item) => JSON.stringify(current.get(item.id)) !== JSON.stringify(item))
for (const old of legacy) {
  const revised = current.get(old.id)
  // Curated alternatives can regrade an old answer only when the original
  // starter and canonical tile sequence are unchanged. Never transplant a
  // rewrite's answers onto a different historical question.
  if (old.kind === 'sentence-build' && revised?.acceptedAnswers?.length && old.starter === revised.starter && old.answer === revised.answer) {
    old.acceptedAnswers = revised.acceptedAnswers
  }
}
const byId = new Map(legacy.map((item) => [item.id, item]))
for (const correction of corrections) {
  const old = byId.get(correction.id)
  if (!old) throw new Error(`Missing changed legacy question: ${correction.id}`)
  old.answer = correction.supportedAnswerIndex
}
// Keep original option ordering for old numeric answers, but repair confirmed bad keys.
writeFileSync(new URL('../src/legacyQuestionRevisions.json', import.meta.url), `${JSON.stringify(legacy)}\n`)
console.log(JSON.stringify({ baselineHash, preservedQuestionRevisions: legacy.length, correctedLegacyKeys: corrections.length, bytes: Buffer.byteLength(JSON.stringify(legacy)) }, null, 2))
