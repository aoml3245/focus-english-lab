type ServiceSentenceContext = {
  actor: string
  service: string
  topic: string
}

type ResearchSentenceContext = {
  subject: string
  focusWord: string
}

export type SentenceBuildPattern = {
  prompt: string
  starter: string
  correct: string[]
  grammarFocus: string
}

export function buildServiceSentencePattern(context: ServiceSentenceContext, index: number): SentenceBuildPattern {
  const patterns: Array<() => SentenceBuildPattern> = [
    () => ({ prompt: `What will ${context.actor} do before deciding the future of ${context.service}?`, starter: context.actor, correct: ['will', 'review', 'the pilot evidence', 'before', 'making a final decision'], grammarFocus: 'future-before-gerund' }),
    () => ({ prompt: `What is the purpose of the pilot for ${context.service}?`, starter: `The pilot for ${context.service}`, correct: ['is designed', 'to show', 'whether', 'the proposed response', 'needs revision'], grammarFocus: 'passive-infinitive-whether' }),
    () => ({ prompt: `Why should people using ${context.service} report unexpected effects?`, starter: `Participants in ${context.service}`, correct: ['are being asked', 'to report', 'unexpected effects', 'so that', 'the plan', 'can be adjusted'], grammarFocus: 'passive-purpose-clause' }),
    () => ({ prompt: `When can a lasting change to ${context.service} be approved?`, starter: `A permanent change to ${context.service}`, correct: ['will not be made', 'until', 'the trial results', 'have been', 'carefully reviewed'], grammarFocus: 'future-perfect-time-clause' }),
    () => ({ prompt: `What question does ${context.actor} still need to answer?`, starter: `${context.actor} wants to determine`, correct: ['whether', 'the temporary response', 'remains effective', 'under', 'different conditions'], grammarFocus: 'embedded-whether-clause' }),
    () => ({ prompt: `Why is ${context.actor} beginning with a trial for ${context.service}?`, starter: `Rather than adopting the proposed response immediately, ${context.actor}`, correct: ['will test', 'a temporary version', 'before', 'deciding', 'whether to keep it'], grammarFocus: 'rather-than-time-clause' }),
    () => ({ prompt: `Under what condition could the plan for ${context.service} change?`, starter: `The initial plan for ${context.service}`, correct: ['may be revised', 'if', 'participants report', 'effects that', 'were not expected'], grammarFocus: 'modal-passive-conditional' }),
    () => ({ prompt: `How will the proposal for ${context.service} be evaluated instead of assumed effective?`, starter: `Before committing to ${context.service},`, correct: ['the organization', 'will run', 'a limited pilot', 'and then', 'compare the outcomes'], grammarFocus: 'before-gerund-sequence' }),
    () => ({ prompt: `How will evidence from ${context.service} support the decision?`, starter: `Evidence collected during ${context.service}`, correct: ['should help', 'the team', 'decide', 'which parts', 'to keep'], grammarFocus: 'modal-embedded-wh-clause' }),
    () => ({ prompt: `What remains uncertain about the response proposed for ${context.service}?`, starter: `The response proposed for ${context.service}`, correct: ['addresses', 'an immediate problem', 'but', 'its long-term value', 'remains uncertain'], grammarFocus: 'contrast-compound-clause' }),
    () => ({ prompt: `Why does ${context.actor} need participant feedback?`, starter: `${context.actor} cannot determine`, correct: ['how well', 'the change works', 'without', 'collecting feedback', 'from participants'], grammarFocus: 'embedded-how-without-gerund' }),
    () => ({ prompt: `What decides the next step for ${context.service}?`, starter: `What happens next in ${context.service}`, correct: ['depends on', 'whether', 'the trial', 'produces', 'acceptable results'], grammarFocus: 'subject-clause-depends-whether' }),
  ]
  return patterns[index % patterns.length]()
}

export function buildResearchSentencePattern(context: ResearchSentenceContext, index: number): SentenceBuildPattern {
  const research = `research on ${context.subject}`
  const patterns: Array<() => SentenceBuildPattern> = [
    () => ({ prompt: `How cautiously should the ${context.focusWord} result be interpreted?`, starter: `Researchers conducting ${research}`, correct: ['warned', 'that', 'the observed pattern', 'might not', 'apply universally'], grammarFocus: 'reported-modal-that-clause' }),
    () => ({ prompt: `What did the ${context.focusWord} evidence fail to establish?`, starter: `The results from ${research}`, correct: ['do not show', 'that', 'the same outcome', 'will occur', 'in every setting'], grammarFocus: 'negative-that-clause' }),
    () => ({ prompt: `What role does the explanation play in the ${context.focusWord} study?`, starter: `The explanation proposed in ${research}`, correct: ['connects', 'the observed outcome', 'with', 'a possible', 'underlying process'], grammarFocus: 'verb-preposition-complement' }),
    () => ({ prompt: `Why should the conclusion about ${context.focusWord} be tested again?`, starter: `Because evidence from ${research} has limits,`, correct: ['the conclusion', 'should be tested', 'with', 'additional data'], grammarFocus: 'because-modal-passive' }),
    () => ({ prompt: `What does the caveat imply about the ${context.focusWord} pattern?`, starter: `The caveat in ${research}`, correct: ['suggests', 'that', 'the pattern', 'could change', 'under different conditions'], grammarFocus: 'reporting-verb-modal-clause' }),
    () => ({ prompt: `How did the authors balance implication and limitation in the ${context.focusWord} report?`, starter: `The authors of ${research}`, correct: ['proposed', 'a broader implication', 'without', 'ignoring', 'the stated limitation'], grammarFocus: 'without-gerund-complement' }),
    () => ({ prompt: `Why is the mechanism important to the ${context.focusWord} finding?`, starter: `The mechanism described in ${research}`, correct: ['helps explain', 'why', 'the observed pattern', 'appeared', 'in the study'], grammarFocus: 'embedded-why-clause' }),
    () => ({ prompt: `What question remains after the ${context.focusWord} study?`, starter: `Further research on ${context.subject}`, correct: ['is needed', 'to determine', 'whether', 'the result', 'can be generalized'], grammarFocus: 'passive-infinitive-whether' }),
    () => ({ prompt: `What distinction does the ${context.focusWord} report make?`, starter: `The report on ${context.subject}`, correct: ['distinguishes', 'the evidence', 'from', 'a claim', 'of universal certainty'], grammarFocus: 'distinguish-from-complement' }),
    () => ({ prompt: `Why does the ${context.focusWord} conclusion remain useful despite its limit?`, starter: `The conclusion drawn from ${research}`, correct: ['remains useful', 'even though', 'one condition', 'limits', 'how broadly it applies'], grammarFocus: 'even-though-embedded-how' }),
  ]
  return patterns[index % patterns.length]()
}
