type OpenTaskContext = {
  topic: string
  subject?: string
  service: string
  problem: string
  action: string
  actor: string
  debate: string
  counterpoint: string
  personal: string
  finding?: string
  limitation?: string
}

const PEOPLE = [
  ['Maya', 'Theo'], ['Lina', 'Owen'], ['Priya', 'Marcus'], ['Hana', 'Caleb'],
  ['Sora', 'Daniel'], ['Amira', 'Jon'], ['Elena', 'Noah'], ['Yuki', 'Sam'],
] as const

export function buildEmailPrompt(seed: OpenTaskContext, index: number) {
  const plans = [
    `Write to ${seed.actor} about ${seed.service}. Explain how ${seed.problem} affects you, evaluate the plan to ${seed.action}, and ask when the change will take effect.`,
    `You need help with ${seed.service} because ${seed.problem}. Email ${seed.actor}; describe what happened, request the proposed action (${seed.action}), and ask how access will be maintained meanwhile.`,
    `A recent difficulty with ${seed.service} has affected your schedule: ${seed.problem}. Write to ${seed.actor} to document the impact, suggest ${seed.action}, and request a specific follow-up date.`,
    `You received an update about ${seed.service}, but ${seed.problem}. Email ${seed.actor}. Clarify the part that concerns you, respond constructively to the plan to ${seed.action}, and ask what alternative is available.`,
    `Write a courteous message to ${seed.actor} after encountering this problem with ${seed.service}: ${seed.problem}. Give one concrete consequence, propose ${seed.action}, and request confirmation of the next step.`,
    `You want to participate in ${seed.service}, yet ${seed.problem}. Contact ${seed.actor} to explain your goal, ask whether they can ${seed.action}, and request any instructions you should follow.`,
    `A classmate told you that ${seed.actor} may ${seed.action} in response to a problem with ${seed.service}. Write to verify the information, explain why ${seed.problem} matters to you, and ask how updates will be announced.`,
    `After using ${seed.service}, you noticed that ${seed.problem}. Email ${seed.actor} with a concise account of the issue, recommend ${seed.action}, and ask whether your report requires any additional evidence.`,
  ]
  return plans[index % plans.length]
}

export function buildDiscussionTask(seed: OpenTaskContext, index: number) {
  const [first, second] = PEOPLE[index % PEOPLE.length]
  const subject = seed.subject || seed.service
  const finding = seed.finding || `the proposed approach could address ${seed.problem}`
  const limitation = seed.limitation || seed.counterpoint
  const prompts = [
    `Professor Allen: ${seed.debate} Explain which consideration should carry the most weight and why.`,
    `Professor Rivera: ${seed.debate} Take a position, then address one reasonable objection to it.`,
    `Professor Chen: In discussing ${subject}, ${seed.debate} Support your answer with a principle or example.`,
    `Professor Okafor: Policy choices about ${subject} often involve competing benefits. ${seed.debate}`,
    `Professor Laurent: Imagine that resources for ${subject} are limited. ${seed.debate} Explain the tradeoff behind your choice.`,
    `Professor Singh: Consider both immediate and long-term effects of ${subject}. ${seed.debate}`,
    `Professor Morgan: Stakeholders disagree about how to handle ${subject}. ${seed.debate} Add a perspective the discussion has not yet considered.`,
    `Professor Kim: Evidence can support more than one policy response in ${subject}. ${seed.debate} State what evidence would strengthen your position.`,
  ]
  const exchanges = [
    `${first}: The finding that ${finding} supports acting soon.\n${second}: However, ${limitation}, so a broad policy could create avoidable costs.`,
    `${first}: I would prioritize feasibility because ${seed.counterpoint}.\n${second}: Feasibility matters, but the expected benefit—${finding}—should not be overlooked.`,
    `${first}: A limited trial could reveal whether ${finding}.\n${second}: Trials are useful only if decision makers also account for the risk that ${limitation}.`,
    `${first}: People directly affected by ${seed.problem} should have a larger role in the decision.\n${second}: Expert evidence is also necessary because ${seed.counterpoint}.`,
    `${first}: The long-term value may justify the initial effort if ${finding}.\n${second}: That conclusion remains uncertain since ${limitation}.`,
    `${first}: Clear standards for ${subject} would make the response more consistent.\n${second}: Local flexibility may be better because ${seed.counterpoint}.`,
    `${first}: Public information about ${subject} could help people adapt while the policy is tested.\n${second}: Information alone may be insufficient when ${seed.problem}.`,
    `${first}: I support the proposal because it addresses ${seed.problem}.\n${second}: I would compare alternatives first, especially because ${limitation}.`,
  ]
  return { prompt: prompts[index % prompts.length], passage: exchanges[index % exchanges.length] }
}

export function buildRepeatScenario(seed: OpenTaskContext, index: number) {
  const subject = seed.subject || seed.service
  const families = [
    [
      `Welcome to the briefing on ${seed.service}.`,
      `Today we will explain how the temporary arrangement for ${seed.service} works.`,
      `The current difficulty is that ${seed.problem}.`,
      `${seed.actor} plans to ${seed.action}.`,
      `Please follow the posted ${seed.service} instructions while the change is being tested.`,
      `If ${seed.service} creates an unexpected effect, report it before the review meeting.`,
      `Your observations about ${subject} will help the team decide whether the arrangement should be revised or continued.`,
    ],
    [
      `Thank you for joining this update about ${seed.service}.`,
      `Several participants have reported that ${seed.problem}.`,
      `A short-term response for ${seed.service} will begin after today’s orientation.`,
      `Under that plan, ${seed.actor} will ${seed.action}.`,
      `Check the ${seed.service} schedule carefully because access may differ during the trial.`,
      `Anyone who needs an alternative to ${seed.service} should contact the responsible office early.`,
      `After reviewing participation in ${seed.service}, the organizers will announce the next phase.`,
    ],
    [
      `This session introduces the revised procedure for ${seed.service}.`,
      `The revision responds to a practical concern: ${seed.problem}.`,
      `Before the ${seed.service} procedure begins, staff will confirm that everyone understands the route.`,
      `${seed.actor} will then ${seed.action}.`,
      `Do not assume that the first ${seed.service} arrangement will become permanent.`,
      `The team will compare ${seed.service} results from different days and investigate any irregular pattern.`,
      `A final decision about ${subject} will balance the observed benefit with the needs of people affected by the change.`,
    ],
    [
      `Here is the latest information about ${seed.service}.`,
      `The office is responding because ${seed.problem}.`,
      `For the first stage of ${seed.service}, participation will remain voluntary whenever possible.`,
      `The main action is for ${seed.actor} to ${seed.action}.`,
      `Keep a record of ${seed.service} delays or access problems rather than relying on memory.`,
      `If conditions affecting ${seed.service} change, the coordinator may adjust the procedure before the scheduled review.`,
      `Consistent reports about ${subject} are important because they show whether the solution works beyond a single case.`,
    ],
  ]
  return families[index % families.length]
}

export function buildInterviewScenario(seed: OpenTaskContext, index: number) {
  const subject = seed.subject || seed.service
  const families = [
    [
      `Describe an experience related to ${seed.personal}. What happened?`,
      `What made that ${subject} experience important or difficult for you?`,
      `If you faced the same situation involving ${subject} again, what would you change?`,
      `How could an institution help people handle a similar ${subject} situation?`,
    ],
    [
      `When have you had to make a decision involving ${seed.personal}?`,
      `Which information about ${subject} influenced your decision most strongly?`,
      `What is one disadvantage of the ${subject} choice you made?`,
      `Do you think other people should make the same choice about ${subject}? Why or why not?`,
    ],
    [
      `Think of a familiar example of ${seed.personal}. Please describe it.`,
      `Why might another person view that ${subject} example differently?`,
      `What practical improvement would address the main difficulty in ${subject}?`,
      `What evidence would show that the ${subject} improvement was successful?`,
    ],
    [
      `How does ${seed.personal} affect your daily work or study?`,
      `Which part of the effect of ${subject} is easiest to change?`,
      `Who should take responsibility for changing the ${subject} situation?`,
      `How might the ${subject} situation develop over the next several years?`,
    ],
  ]
  return families[index % families.length]
}
