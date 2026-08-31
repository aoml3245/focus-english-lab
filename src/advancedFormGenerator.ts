import { createAuthoredFormHelpers } from './authoredFormHelpers'
import type { Difficulty, Question, SentenceDatum } from './authoredFormHelpers'
import type { BaseItem } from './types'

export type LogicBrief = {
  topic: string
  label: string
  principle: string
  caveat: string
  method: string
  difficulty?: Difficulty
}

export type PracticalBrief = {
  topic: string
  label: string
  notice: string
  inference: string
  difficulty?: Difficulty
}

export type AdvancedFormConfig = {
  form: number
  cloze: Array<LogicBrief & { extra: string }>
  practical: PracticalBrief[]
  academic: LogicBrief[]
  conversations: LogicBrief[]
  announcements: PracticalBrief[]
  talks: LogicBrief[]
  sentenceData: SentenceDatum[]
  email: { topic: string; prompt: string; difficulty?: Difficulty }
  discussion: { topic: string; prompt: string; passage: string }
  repeat: { topic: string; sentences: string[] }
  interview: { topic: string; questions: string[] }
}

const distractors = (label: string, prompt: string, index: number) => {
  const scope = prompt.replace(/[?.!]/g, '').replace(/^(What|Why|Which|How)\s+/i, '').toLowerCase()
  return [
    `Contextual variation is irrelevant when deciding ${scope}.`,
    `The broadest causal claim alone settles ${scope}.`,
    `Independent measurement is unnecessary for judging ${scope}.`,
    `The ${label} pattern must remain constant to answer ${scope}.`,
    `Selection bias is automatically absent from any account of ${scope}.`,
    `A surface observation by itself resolves ${scope}.`,
  ].slice(index % 3, index % 3 + 3)
}

function placedQuestion(prompt: string, correct: string, label: string, answer: number, salt: number, explanation: string): Question {
  const wrong = distractors(label, prompt, salt)
  const options = [...wrong]
  options.splice(answer, 0, correct)
  return [prompt, options, answer, explanation]
}

function blankTen(text: string, targets: string[]) {
  if (targets.length !== 10) throw new Error('Each generated cloze requires ten target words.')
  const firstStop = text.indexOf('.')
  let passage = text
  const answers: string[] = []
  for (const target of targets) {
    const searchFrom = Math.max(firstStop + 1, 0)
    const matcher = new RegExp(`\\b${target}\\b`, 'i')
    const tail = passage.slice(searchFrom)
    const match = matcher.exec(tail)
    if (!match) throw new Error(`Missing cloze target ${target}`)
    const full = match[0]
    const stemLength = Math.min(4, Math.max(2, Math.floor(full.length / 2)))
    const replacement = `${full.slice(0, stemLength)}___`
    const position = searchFrom + match.index
    passage = `${passage.slice(0, position)}${replacement}${passage.slice(position + full.length)}`
    answers.push(full.slice(stemLength))
  }
  return { passage, answer: answers.join('|') }
}

const clozeClauses = [
  [
    { text: 'compare observations across sites', targets: ['compare', 'observations'] },
    { text: 'identify mechanisms behind change', targets: ['identify', 'mechanisms'] },
    { text: 'evaluate alternatives explicitly', targets: ['evaluate', 'alternatives'] },
    { text: 'distinguish correlation from causation', targets: ['distinguish', 'correlation'] },
    { text: 'quantify uncertainty in estimates', targets: ['quantify', 'uncertainty'] },
  ],
  [
    { text: 'integrate evidence from several sources', targets: ['integrate', 'evidence'] },
    { text: 'reconstruct processes through time', targets: ['reconstruct', 'processes'] },
    { text: 'measure variation among contexts', targets: ['measure', 'variation'] },
    { text: 'preserve records for verification', targets: ['preserve', 'records'] },
    { text: 'communicate limitations with precision', targets: ['communicate', 'limitations'] },
  ],
  [
    { text: 'examine patterns at multiple scales', targets: ['examine', 'patterns'] },
    { text: 'combine methods with complementary strengths', targets: ['combine', 'methods'] },
    { text: 'estimate effects under explicit assumptions', targets: ['estimate', 'effects'] },
    { text: 'separate causes that predict similar outcomes', targets: ['separate', 'causes'] },
    { text: 'replicate findings in independent material', targets: ['replicate', 'findings'] },
  ],
]

const responseTemplates = [
  (x: string) => [`Has the ${x} review been approved?`, `Not yet; the reviewer requested one additional check of ${x}.`],
  (x: string) => [`Why was the ${x} session postponed?`, `A required instrument for ${x} failed its calibration test.`],
  (x: string) => [`Could you send me the revised ${x} record?`, `Certainly; I will attach the corrected ${x} file this afternoon.`],
  (x: string) => [`Is the ${x} facility accessible today?`, `Yes, but ${x} visitors must use the east entrance.`],
  (x: string) => [`Where should I return the ${x} materials?`, `Place the ${x} materials on the labeled intake shelf.`],
  (x: string) => [`Did the ${x} measurement remain stable?`, `It did, although the auxiliary ${x} display fluctuated briefly.`],
  (x: string) => [`Would you mind checking my ${x} calculation?`, `Of course; mark the ${x} step where the values diverge.`],
  (x: string) => [`When will the ${x} results be released?`, `After the independent ${x} audit finishes on Thursday.`],
  (x: string) => [`Should we exclude the unusual ${x} observation?`, `Only if the written ${x} protocol justifies that exclusion.`],
  (x: string) => [`Who is responsible for the ${x} archive?`, `The collections officer manages access to the ${x} archive.`],
  (x: string) => [`Haven't you submitted the ${x} amendment?`, `No; one signature on the ${x} amendment is still missing.`],
  (x: string) => [`Can the ${x} sample be measured again?`, `Yes, provided the second ${x} reading is logged separately.`],
  (x: string) => [`How often is the ${x} sensor inspected?`, `The ${x} sensor is inspected before every field deployment.`],
  (x: string) => [`May I publish the precise ${x} location?`, `Only after the ${x} data steward confirms the consent terms.`],
  (x: string) => [`Why doesn't the ${x} total match the ledger?`, `A returned ${x} item has not been entered into the database.`],
  (x: string) => [`Could the ${x} trend reflect a confounder?`, `Yes; the groups differed before the ${x} intervention began.`],
  (x: string) => [`What did the advisor recommend for ${x}?`, `She recommended testing an alternative explanation for ${x}.`],
]

export function createAdvancedAuthoredForm(config: AdvancedFormConfig) {
  const prefix = `f${config.form}`
  const { base, cloze, daily, readingGroup, response, listeningGroup, sentenceItems, orderedForm } = createAuthoredFormHelpers(prefix)
  let objectiveIndex = (config.form - 23) * 67
  const nextAnswer = () => objectiveIndex++ % 4

  const reading: BaseItem[] = config.cloze.map((brief, index) => {
    const rotation = (config.form - 23 + index) % 5
    const clauses = [...clozeClauses[index].slice(rotation), ...clozeClauses[index].slice(0, rotation)]
    const targets = clauses.flatMap((clause) => clause.targets)
    const openings = [
      `${brief.label} links a visible record to a process that cannot be observed directly.`,
      `${brief.label} offers evidence about change across an otherwise incomplete record.`,
      `${brief.label} is informative precisely because direct observation is rarely available.`,
      `${brief.label} turns a measurable trace into a hypothesis about an underlying system.`,
      `${brief.label} provides a partial archive of events that unfolded beyond direct observation.`,
      `${brief.label} helps researchers connect present structure with a hidden historical process.`,
      `${brief.label} is valuable when scientists must infer dynamics from an indirect physical signal.`,
      `${brief.label} supplies a constrained window onto a process that varies across scales.`,
    ]
    const targetSentence = `The analytical workflow for ${brief.label} follows a staged sequence. In this ${brief.label} analysis, investigators ${clauses.map((clause) => clause.text).join(', ').replace(/, ([^,]*)$/, ', and $1')}.`
    const prepared = blankTen(targetSentence, targets)
    const passage = `${openings[config.form - 23]} ${brief.principle} ${brief.extra} ${prepared.passage} ${brief.caveat}`
    return cloze(`cloze-${index}`, brief.topic, brief.difficulty || 'C1', passage, prepared.answer)
  })

  config.practical.forEach((brief, index) => {
    const answer = nextAnswer()
    reading.push(daily(`daily-${index}`, brief.topic, brief.difficulty || 'B2', `${brief.notice} This ${brief.label} instruction remains in force for the entire scheduled procedure.`, placedQuestion(
      `What action follows from the ${brief.label} notice?`, brief.inference, brief.label, answer, index,
      `The notice's condition requires this response in the ${brief.label} case.`,
    )))
  })

  config.academic.forEach((brief, index) => {
    const layouts = [
      `${brief.principle} Researchers contrast observations from different settings because one association cannot identify the process responsible for ${brief.label}. ${brief.method} ${brief.caveat} A defensible ${brief.label} conclusion states both the inferred mechanism and the conditions under which it might fail.`,
      `Work on ${brief.label} begins with a recurring empirical pattern. ${brief.principle} To decide among ${brief.label} explanations, investigators use the following strategy: ${brief.method} Even then, ${brief.caveat} The passage treats ${brief.label} uncertainty as information about the claim's scope.`,
      `${brief.principle} This account of ${brief.label} predicts intermediate changes, not merely a final correlation. ${brief.caveat} Accordingly, ${brief.label} researchers do more than enlarge the sample: ${brief.method} Agreement between these tests would narrow the viable ${brief.label} mechanisms.`,
      `A central difficulty in studying ${brief.label} is that the surviving evidence reflects both process and observation. ${brief.principle} ${brief.caveat} Investigators respond with a discriminating ${brief.label} test. ${brief.method} The ${brief.label} result is strongest when the measurement boundary is declared in advance.`,
      `${brief.principle} The key question is whether this description of ${brief.label} travels across scales. ${brief.method} A ${brief.label} comparison can reveal heterogeneous responses that an average hides. ${brief.caveat} Consequently, the ${brief.label} argument remains conditional rather than universal.`,
      `Explanations of ${brief.label} must connect a proposed cause to an independently observable consequence. ${brief.principle} Yet ${brief.caveat.toLowerCase()} One useful ${brief.label} response is methodological: ${brief.method} This ${brief.label} design gives rival accounts a genuine opportunity to fail.`,
      `${brief.principle} In the ${brief.label} literature, however, measurement does not map transparently onto mechanism. ${brief.caveat} Researchers predefine ${brief.label} contrasts and then proceed as follows: ${brief.method} The remaining ${brief.label} uncertainty limits extrapolation beyond sampled conditions.`,
      `Rather than asking whether ${brief.label} simply exists, investigators ask when and through which pathway it arises. ${brief.principle} ${brief.method} The ${brief.label} inference still has a boundary because ${brief.caveat.toLowerCase()} That ${brief.label} boundary belongs in the conclusion rather than being concealed.`,
    ]
    const passage = layouts[config.form - 23]
    const count = index === 0 || index === 2 ? 3 : 2
    const questions: Question[] = [
      placedQuestion(`Which conclusion is best supported by the ${brief.label} passage?`, `The evidence supports a mechanism-bound, qualified interpretation of ${brief.label}.`, brief.label, nextAnswer(), index, brief.principle),
      placedQuestion(`Why does the author qualify the evidence about ${brief.label}?`, `The ${brief.label} result may depend on scale and competing explanations.`, brief.label, nextAnswer(), index + 1, brief.caveat),
      placedQuestion(`Which approach would most directly strengthen the ${brief.label} analysis?`, `Contrast relevant conditions and independently probe the ${brief.label} mechanism.`, brief.label, nextAnswer(), index + 2, brief.method),
    ].slice(0, count)
    reading.push(...readingGroup(`academic-${index}`, brief.topic, brief.difficulty || 'C1', passage, questions))
  })

  const responseTopics = [...config.practical.map((item) => item.label), ...config.academic.map((item) => item.label), ...config.conversations.map((item) => item.label)]
  const responses = responseTemplates.map((template, index) => {
    const label = responseTopics[index % responseTopics.length]
    const [audioText, correct] = template(label)
    const answer = nextAnswer()
    const options = [
      `The ${label} record contains several background notes.`,
      `I encountered a different ${label} issue last semester.`,
      `The color assigned to ${label} is blue on the chart.`,
    ]
    options.splice(answer, 0, correct)
    return response(index, audioText, options, answer, `The reply directly answers the speech act concerning ${label}.`)
  })

  const conversations = config.conversations.flatMap((brief, index) => {
    const layouts = [
      `Student: The first ${brief.label} result looks convincing, so may I report the broad conclusion? Advisor: Not yet. ${brief.caveat} Student: What should I do next for ${brief.label}? Advisor: ${brief.method} Then connect the new ${brief.label} evidence to a specific mechanism.`,
      `Student: I summarized ${brief.label} with one average and called the effect general. Advisor: That ${brief.label} wording outruns the design. ${brief.caveat} Student: Would another ${brief.label} analysis help? Advisor: Yes. ${brief.method} Report which ${brief.label} interpretation survives.`,
      `Student: My graph for ${brief.label} matches the prediction. Advisor: A ${brief.label} match is useful, but another process could generate it. ${brief.caveat} Student: How can I distinguish the ${brief.label} accounts? Advisor: ${brief.method} Predefine the ${brief.label} contrast before reopening the outcome file.`,
      `Student: I want to remove the unusual ${brief.label} cases. Advisor: Which prior ${brief.label} rule allows that? ${brief.caveat} Student: I chose the ${brief.label} cutoff after seeing the result. Advisor: Then retain those cases and use this check: ${brief.method}`,
      `Student: Does this replicate the published ${brief.label} finding? Advisor: It reproduces the ${brief.label} direction, not yet the explanation. ${brief.caveat} Student: Does ${brief.label} replication require more than similarity? Advisor: Exactly. ${brief.method}`,
      `Student: The instrument gives a precise ${brief.label} estimate. Advisor: ${brief.label} precision does not guarantee validity. ${brief.caveat} Student: Which ${brief.label} validation should I report? Advisor: ${brief.method} Keep ${brief.label} calibration uncertainty separate from sampling uncertainty.`,
      `Student: Can I infer causation from the timing of ${brief.label}? Advisor: ${brief.label} temporal order may be necessary, but it is not sufficient. ${brief.caveat} Student: Which ${brief.label} result would be more decisive? Advisor: ${brief.method}`,
      `Student: I combined every site in the ${brief.label} dataset. Advisor: ${brief.label} aggregation may erase the condition driving the pattern. ${brief.caveat} Student: I will stratify the ${brief.label} data first. Advisor: Good, and also do this: ${brief.method}`,
    ]
    const audioText = layouts[config.form - 23]
    return listeningGroup(`conversation-${index}`, 'Listen to a Conversation', brief.topic, brief.difficulty || 'B2', audioText, [
      placedQuestion(`Why does the advisor reject the student's initial ${brief.label} claim?`, `For ${brief.label}, ${brief.caveat}`, brief.label, nextAnswer(), index, brief.caveat),
      placedQuestion(`What will the student do next in the ${brief.label} project?`, `For ${brief.label}, the student will ${brief.method.charAt(0).toLowerCase()}${brief.method.slice(1)}`, brief.label, nextAnswer(), index + 1, brief.method),
    ])
  })

  const announcements = config.announcements.flatMap((brief, index) => {
    const endings = [
      `Record any departure from the ${brief.label} rule in the shared log and contact the coordinator before substituting another procedure.`,
      `The desk will answer questions about ${brief.label}, but verbal permission does not replace the required record.`,
      `Supervisors will verify ${brief.label} at closing; unresolved cases stay in the marked holding area.`,
      `If ${brief.label} cannot proceed as announced, pause the task and preserve the current state for review.`,
      `A checklist beside the entrance explains ${brief.label}; sign it only after completing the stated action.`,
      `Questions about ${brief.label} go to facility staff, who will document any authorized exception.`,
      `The revised ${brief.label} schedule applies to existing bookings as well as new requests.`,
      `Keep the ${brief.label} confirmation with the associated materials so the next shift can verify it.`,
    ]
    const audioText = `${brief.notice} ${endings[config.form - 23]}`
    return listeningGroup(`announcement-${index}`, 'Listen to an Announcement', brief.topic, brief.difficulty || 'B2', audioText, [
      placedQuestion(`What must listeners do about ${brief.label}?`, brief.inference, brief.label, nextAnswer(), index, brief.inference),
      placedQuestion(`Why is the ${brief.label} exception entered in a shared log?`, `It preserves a traceable account of how the ${brief.label} condition was handled.`, brief.label, nextAnswer(), index + 1, 'The log supports later verification.'),
    ])
  })

  const talks = config.talks.flatMap((brief, index) => {
    const layouts = [
      `${brief.principle} For ${brief.label}, the observed pattern is informative only when a mechanism makes an additional testable prediction. ${brief.method} ${brief.caveat} Investigators therefore report the boundary of the ${brief.label} inference.`,
      `The lecture's puzzle concerns ${brief.label}. ${brief.principle} A descriptive match alone leaves several explanations alive, so researchers proceed as follows: ${brief.method} Still, ${brief.caveat.toLowerCase()}`,
      `${brief.principle} Notice that this explanation of ${brief.label} joins events across more than one scale. ${brief.caveat} To locate the active link, investigators use a discriminating design: ${brief.method}`,
      `Scientists once treated the main ${brief.label} pattern as self-explanatory. The modern ${brief.label} view is more constrained. ${brief.principle} ${brief.method} The qualification matters because ${brief.caveat.toLowerCase()}`,
      `A useful model of ${brief.label} must say not only what occurs but what would change under a new condition. ${brief.principle} ${brief.caveat} Researchers test that conditional prediction by this method: ${brief.method}`,
      `${brief.principle} In discussing ${brief.label}, the lecturer separates measurement precision from causal identification. ${brief.method} Even a stable estimate has limited scope because ${brief.caveat.toLowerCase()}`,
      `Consider ${brief.label} as a problem of inference from incomplete signals. ${brief.principle} One strategy deliberately pits explanations against each other: ${brief.method} ${brief.caveat}`,
      `The important feature of ${brief.label} is its dependence on boundary conditions. ${brief.principle} Rather than extrapolate immediately, researchers do this: ${brief.method} Their caution follows from the fact that ${brief.caveat.toLowerCase()}`,
    ]
    const audioText = layouts[config.form - 23]
    return listeningGroup(`talk-${index}`, 'Listen to an Academic Talk', brief.topic, brief.difficulty || 'C1', audioText, [
      placedQuestion(`What central idea does the lecturer emphasize about ${brief.label}?`, brief.principle, brief.label, nextAnswer(), index, brief.principle),
      placedQuestion(`Which limitation shapes the interpretation of ${brief.label}?`, `For ${brief.label}, ${brief.caveat}`, brief.label, nextAnswer(), index + 1, brief.caveat),
    ])
  })

  const writing = sentenceItems(config.sentenceData)
  writing.push({ ...base('email', 'writing', 'email', 'Write an Email', config.email.topic, config.email.difficulty || 'B2', 420), instruction: '상황, 영향, 요청 사항과 확인 방법을 구체적으로 작성하세요.', prompt: config.email.prompt })
  writing.push({ ...base('discussion', 'writing', 'discussion', 'Write for an Academic Discussion', config.discussion.topic, 'C1', 600), instruction: '두 관점을 평가하고 근거와 조건을 포함해 논지를 발전시키세요.', prompt: config.discussion.prompt, passage: config.discussion.passage })

  const speaking: BaseItem[] = [
    ...config.repeat.sentences.map((audioText, sequenceIndex) => ({ ...base(`repeat-${sequenceIndex}`, 'speaking', 'repeat', 'Listen and Repeat', config.repeat.topic, sequenceIndex < 2 ? 'B1' : 'B2', sequenceIndex < 3 ? 12 : 16), instruction: '한 번 듣고 준비 시간 없이 의미와 리듬을 살려 반복하세요.', audioText, stimulusGroupId: `${prefix}-repeat`, scenarioId: `${prefix}-repeat`, sequenceIndex })),
    ...config.interview.questions.map((audioText, sequenceIndex) => ({ ...base(`interview-${sequenceIndex}`, 'speaking', 'interview', 'Take an Interview', config.interview.topic, sequenceIndex === 0 ? 'B2' : 'C1', 45), instruction: '연속된 질문에 주장, 이유, 사례를 포함해 답하세요.', audioText, stimulusGroupId: `${prefix}-interview`, scenarioId: `${prefix}-interview`, sequenceIndex })),
  ]

  return orderedForm(reading, responses, conversations, announcements, talks, writing, speaking)
}
