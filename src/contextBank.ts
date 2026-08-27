import type { BaseItem } from './types'

type Difficulty = NonNullable<BaseItem['difficulty']>
type Question = [prompt: string, options: string[], answer: number, explanation: string]
type ContextBundle = {
  topic: string
  difficulty: Difficulty
  reading: { context: string; passage: string; questions: [Question, Question] }
  listening: { context: string; transcript: string; questions: [Question, Question] }
  email: { context: string; prompt: string }
  discussion: { context: string; prompt: string; posts: string }
  interview: { context: string; questions: [string, string] }
}

const BUNDLES: ContextBundle[] = [
  {
    topic: '기후 적응', difficulty: 'B2',
    reading: { context: '해안 도시의 침수 대응 연구', passage: 'Coastal cities once relied mainly on sea walls, but many now combine engineered barriers with wetlands, elevated buildings, and evacuation planning. Wetlands reduce wave energy and provide habitat, yet they require space and time to recover. Concrete barriers protect dense districts immediately but can redirect water toward neighboring areas. Because no measure works equally well everywhere, planners compare local geography, population density, maintenance costs, and the consequences of failure.', questions: [
      ['Why do planners combine several measures?', ['One measure fits every location.', 'Different measures address different risks.', 'Wetlands eliminate maintenance.', 'Barriers create habitat.'], 1, 'The passage emphasizes that each measure has different strengths and local effects.'],
      ['What is one possible drawback of a concrete barrier?', ['It grows too slowly.', 'It may redirect water elsewhere.', 'It cannot protect dense areas.', 'It removes evacuation routes.'], 1, 'A barrier can shift water toward a neighboring community.'],
    ] },
    listening: { context: '캠퍼스 폭염 대응 회의', transcript: 'Student: The shaded courtyard is closed during construction, but it is the coolest route between the dormitories and the library. Facilities manager: We can open the indoor corridor earlier and place temporary water stations there. The trees cannot be replanted until autumn, so we need a short-term plan for September.', questions: [
      ['What problem does the student identify?', ['The library is closed.', 'A cool walking route is unavailable.', 'The dormitories lack water.', 'Trees were planted too early.'], 1, 'Construction has removed access to the shaded route.'],
      ['What temporary solution is proposed?', ['Cancel construction', 'Open an indoor route and add water stations', 'Move the library', 'Plant trees immediately'], 1, 'The manager proposes an earlier indoor corridor opening and water stations.'],
    ] },
    email: { context: '지역사회 침수 훈련', prompt: 'Your neighborhood flood drill is scheduled during an important class. Write to the coordinator. Explain the conflict, ask whether another session is available, and request the emergency materials in advance.' },
    discussion: { context: '도시정책 세미나', prompt: 'Professor Allen: Should cities prioritize large protective infrastructure or smaller neighborhood-level climate projects?', posts: 'Rina: Large systems can protect many people at once.\nDavid: Local projects can respond to different neighborhood needs.' },
    interview: { context: '개인과 지역사회의 회복력', questions: ['Describe one climate risk that affects where you live or study.', 'Who should take primary responsibility for preparing for that risk, and why?'] },
  },
  {
    topic: '인공지능과 교육', difficulty: 'C1',
    reading: { context: '자동 피드백의 학습 효과', passage: 'Automated feedback can help students revise immediately, but speed alone does not guarantee learning. A system may identify a weak argument without explaining why it is weak, encouraging superficial edits. More effective tools ask learners to compare alternatives, justify revisions, and reflect on recurring mistakes. Researchers therefore evaluate not only whether a final answer improves but also whether students can transfer the underlying skill to a new task without assistance.', questions: [
      ['What limitation of automated feedback is emphasized?', ['It is always slow.', 'It can encourage shallow corrections.', 'It cannot find weak arguments.', 'It prevents revision.'], 1, 'Fast identification without explanation may produce superficial changes.'],
      ['Why do researchers test a new task without assistance?', ['To measure transfer of learning', 'To make the system faster', 'To remove all feedback', 'To compare typing speed'], 0, 'Independent performance reveals whether the underlying skill was learned.'],
    ] },
    listening: { context: '교수와 학생의 AI 사용 상담', transcript: 'Student: I used an AI tool to outline my paper, but two sources in the outline do not exist. Professor: Keep the useful categories if they reflect your own argument, but verify every claim in the library database. Also attach your prompts and explain which parts you changed. That record will help me evaluate your process.', questions: [
      ['What problem occurred?', ['The paper was deleted.', 'The outline included nonexistent sources.', 'The library database failed.', 'The student changed no text.'], 1, 'Two cited sources were fabricated.'],
      ['Why does the professor request the prompts?', ['To reproduce the tool', 'To evaluate the student’s process', 'To publish the outline', 'To replace the paper'], 1, 'The prompt record shows how the student used and revised the output.'],
    ] },
    email: { context: 'AI 도구 사용 공개', prompt: 'You used an approved AI tool to reorganize a draft but the course instructions require disclosure. Write to your instructor. Describe how you used it, what you verified yourself, and ask whether your disclosure statement is sufficient.' },
    discussion: { context: '평가 설계 토론', prompt: 'Professor Morgan: Should universities redesign assignments because generative AI is widely available?', posts: 'Hana: Assignments should emphasize decisions and revision histories.\nLeo: Traditional tasks still measure essential individual skills.' },
    interview: { context: '학습 도구 선택', questions: ['Describe a task for which AI assistance could be useful but risky.', 'What evidence would convince you that an AI-supported activity improved learning?'] },
  },
  {
    topic: '지속가능한 식량 체계', difficulty: 'B2',
    reading: { context: '도시 농업의 생산성과 한계', passage: 'Urban farms rarely supply all the food a city needs, but their value is not limited to total production. They can shorten transport for delicate vegetables, create cooler green spaces, and give residents practical knowledge about food. However, land prices, contaminated soil, and seasonal labor restrict expansion. Evaluations should therefore compare several outcomes rather than judging a project only by kilograms of produce.', questions: [
      ['What is the main argument?', ['Urban farms should replace rural farms.', 'Urban farms have benefits beyond food quantity.', 'Land prices are unimportant.', 'All city soil is contaminated.'], 1, 'The passage identifies educational and environmental benefits in addition to production.'],
      ['Why should evaluations use several outcomes?', ['Production is impossible to measure.', 'Projects serve multiple purposes.', 'Transport never matters.', 'Every farm uses the same land.'], 1, 'A single output measure misses the projects’ other goals.'],
    ] },
    listening: { context: '대학 식당의 음식물 쓰레기 실험', transcript: 'Manager: We reduced plate waste after offering smaller portions, but students sometimes return for a second serving. Research assistant: That is still useful if the total waste falls. We should weigh discarded food and track satisfaction instead of counting how many times students visit the counter.', questions: [
      ['What change did the dining hall make?', ['Raised prices', 'Offered smaller portions', 'Removed second servings', 'Closed a counter'], 1, 'The dining hall introduced smaller initial portions.'],
      ['What does the assistant recommend measuring?', ['Only counter visits', 'Waste and satisfaction', 'Meal color', 'Kitchen size'], 1, 'Both discarded food and student satisfaction show the policy’s effects.'],
    ] },
    email: { context: '지역 농산물 행사 운영', prompt: 'A campus food event advertised local products, but several labels did not identify where items came from. Write to the organizer. Explain why the information matters and suggest a clearer labeling method for the next event.' },
    discussion: { context: '식량정책 강의', prompt: 'Professor Rivera: Should governments focus more on reducing food waste or increasing food production?', posts: 'Mina: Existing food would serve more people if less were wasted.\nOmar: Population growth still requires higher and more reliable production.' },
    interview: { context: '소비 습관과 식량', questions: ['Describe one change that could reduce food waste in a school or workplace.', 'Would people accept that change easily? Explain why or why not.'] },
  },
  {
    topic: '우주 탐사', difficulty: 'B2',
    reading: { context: '로봇 탐사선과 표본 귀환', passage: 'A rover can analyze many sites without returning material to Earth, while a sample-return mission allows laboratories to use instruments too large to send into space. Returned samples can also be preserved for future technologies. The trade-off is complexity: collecting, sealing, launching, and transporting material requires several systems to work in sequence. Scientists often use rover observations to select the small number of samples most likely to answer major questions.', questions: [
      ['What is an advantage of returning samples?', ['Rovers become unnecessary.', 'Earth laboratories can use larger instruments.', 'The mission requires fewer systems.', 'Every site can be sampled.'], 1, 'Laboratories on Earth have instruments that cannot travel on a rover.'],
      ['How do rover observations support sample return?', ['They select promising material.', 'They launch the samples.', 'They replace laboratory tests.', 'They simplify every system.'], 0, 'Remote observations guide limited sampling choices.'],
    ] },
    listening: { context: '천문대 관측 일정 조정', transcript: 'Student: Clouds covered the target during my reserved hour. Can I repeat the observation tonight? Technician: The telescope is booked, but another student is using a filter you do not need. If both projects can share the same pointing direction, I can extend that session and collect both datasets.', questions: [
      ['Why was the first observation unsuccessful?', ['The telescope broke.', 'Clouds blocked the target.', 'The filter was missing.', 'The target moved.'], 1, 'Cloud cover prevented the scheduled observation.'],
      ['Under what condition can data be collected tonight?', ['Both projects use the same direction.', 'The student buys a filter.', 'The telescope booking is canceled.', 'The weather remains cloudy.'], 0, 'Sharing is possible if the telescope can point at the same target region.'],
    ] },
    email: { context: '천문관측 동아리 행사', prompt: 'Your astronomy club planned a public observation night, but bright construction lights now affect the site. Write to the facilities office. Explain the event, describe the lighting problem, and request a temporary adjustment.' },
    discussion: { context: '과학 예산 토론', prompt: 'Professor Singh: Should public funding prioritize robotic space missions or missions that send humans?', posts: 'Elena: Robots cost less and can enter dangerous environments.\nMarcus: Human crews can adapt quickly and inspire public interest.' },
    interview: { context: '탐사의 가치', questions: ['Which space research question do you think is most valuable to society?', 'How should scientists explain the cost of space exploration to the public?'] },
  },
  {
    topic: '문화유산 보존', difficulty: 'C1',
    reading: { context: '디지털 복원과 진품성', passage: 'Digital reconstruction can reveal the probable appearance of a damaged site, but every reconstruction contains interpretation. Missing colors, materials, or dimensions must be inferred from evidence and comparison. A highly realistic image may conceal this uncertainty from viewers. Responsible projects distinguish measured data from hypothetical additions and allow users to inspect alternative reconstructions when experts disagree.', questions: [
      ['Why can realistic images be misleading?', ['They are always inaccurate.', 'They may hide interpretive uncertainty.', 'They cannot show color.', 'Experts never compare sites.'], 1, 'Visual realism can make inferred details appear certain.'],
      ['What practice does the author recommend?', ['Remove all hypotheses.', 'Separate evidence from inferred additions.', 'Choose one expert secretly.', 'Avoid digital models.'], 1, 'Users should be able to tell measured information from interpretation.'],
    ] },
    listening: { context: '박물관 전시 라벨 검토', transcript: 'Curator: The label calls this object ceremonial, but the evidence only shows that it was rarely used. Intern: Should we remove the interpretation? Curator: Not entirely. Write that some scholars connect its unusual decoration with ceremony, then explain that ordinary use is also possible.', questions: [
      ['What is uncertain about the object?', ['Its age', 'Whether it was ceremonial', 'Its material', 'Where it is displayed'], 1, 'Rare use does not prove a ceremonial function.'],
      ['How will the label change?', ['It will present multiple interpretations.', 'It will omit all decoration.', 'It will call the object ordinary.', 'It will remove scholarly views.'], 0, 'The revised label will state both the hypothesis and its uncertainty.'],
    ] },
    email: { context: '구술사 자료 사용 허가', prompt: 'You want to use part of a recorded community interview in a student exhibition. Write to the archive. Identify the material, explain the educational use, and ask about permission and attribution requirements.' },
    discussion: { context: '박물관 윤리 세미나', prompt: 'Professor Laurent: When historical evidence is uncertain, how should museums present competing interpretations?', posts: 'Sora: Visitors should see the evidence behind each view.\nBen: Too many alternatives can make an exhibition confusing.' },
    interview: { context: '기억과 장소', questions: ['Describe a place or object that helps a community remember its history.', 'Should preservation ever limit the way a city develops? Explain.'] },
  },
  {
    topic: '공중보건', difficulty: 'B2',
    reading: { context: '백신 정보 전달 연구', passage: 'Health messages often fail when they provide facts without addressing the reason people hesitate. Some individuals worry about side effects, while others distrust the institution delivering the message or face practical barriers such as transportation. Effective campaigns identify these different causes and respond accordingly. A clinic may need clear risk comparisons, trusted community messengers, extended hours, or all three.', questions: [
      ['Why is one general message often ineffective?', ['Health facts are unnecessary.', 'Hesitation has different causes.', 'Clinics always close early.', 'Transportation is the only barrier.'], 1, 'People may hesitate for informational, institutional, or practical reasons.'],
      ['What does the passage suggest about campaigns?', ['Use the same solution everywhere.', 'Match responses to specific barriers.', 'Avoid community messengers.', 'Discuss only side effects.'], 1, 'Campaign design should reflect the cause of hesitation.'],
    ] },
    listening: { context: '대학 보건센터 예약 개선', transcript: 'Nurse: Many students miss appointments scheduled weeks earlier. Administrator: Text reminders helped, but some students still cannot come during class hours. Let us test two evening clinics and compare attendance, waiting time, and staff workload before changing the full schedule.', questions: [
      ['What problem remains after text reminders?', ['Students forget the clinic location.', 'Some cannot attend during class hours.', 'Staff receive no messages.', 'Evening clinics are overcrowded.'], 1, 'Schedule conflicts continue even when students remember.'],
      ['Why will the center test only two evening clinics?', ['To evaluate several effects first', 'To eliminate daytime service', 'To reduce messages', 'To avoid collecting data'], 0, 'A limited trial will measure attendance, waiting, and workload.'],
    ] },
    email: { context: '보건 캠페인 접근성', prompt: 'A campus health workshop has useful information, but its registration page is not accessible with a screen reader. Write to the health office. Describe the problem, explain its effect, and request an alternative registration method.' },
    discussion: { context: '예방정책 수업', prompt: 'Professor Kim: Should public health campaigns use emotional stories or statistical evidence?', posts: 'Amira: Stories make risks understandable and memorable.\nJon: Statistics help people judge how common a risk really is.' },
    interview: { context: '건강 정보 판단', questions: ['How do you decide whether online health information is trustworthy?', 'What can universities do to improve students’ health decisions?'] },
  },
  {
    topic: '지속가능한 교통', difficulty: 'B2',
    reading: { context: '통근 행동과 교통망 설계', passage: 'A new rail line does not automatically reduce car travel. Riders must be able to reach stations safely, transfer reliably, and complete the final part of a trip. Frequent buses, protected bicycle routes, and walkable streets extend the effective reach of rail. Researchers therefore measure an entire journey rather than treating the train segment as an isolated service.', questions: [
      ['Why might a rail line fail to reduce driving?', ['Trains cannot travel far.', 'Connections to stations may be poor.', 'Researchers dislike rail.', 'Walking is always faster.'], 1, 'The complete trip may remain inconvenient without first- and last-mile links.'],
      ['What does “effective reach” refer to?', ['Train speed only', 'The area from which people can conveniently use rail', 'Ticket price', 'The length of the platform'], 1, 'Connecting modes enlarge the population with practical station access.'],
    ] },
    listening: { context: '캠퍼스 셔틀 노선 변경', transcript: 'Student: The new shuttle stops closer to the science building, but it arrives five minutes after the regional bus leaves. Planner: We optimized walking distance and overlooked the transfer. I will compare both timetables and see whether moving the departure by ten minutes affects the next route.', questions: [
      ['What disadvantage does the new shuttle have?', ['It stops too far away.', 'It misses a regional bus connection.', 'It never reaches science.', 'It uses a longer route.'], 1, 'The arrival occurs after the connecting bus departs.'],
      ['What will the planner examine?', ['Whether a schedule shift affects another route', 'Whether to remove the science stop', 'How to raise fares', 'How students walk'], 0, 'The planner must consider the network effect of changing departure time.'],
    ] },
    email: { context: '자전거 주차 시설', prompt: 'The bicycle racks near your building are full and several bikes block the accessible entrance. Write to campus transportation. Describe both problems and suggest a safer location for additional racks.' },
    discussion: { context: '도시 이동성 토론', prompt: 'Professor Rossi: Should cities reduce parking spaces in order to improve public transportation and walking?', posts: 'Nadia: Less parking can encourage more efficient travel.\nEric: Some workers and people with disabilities still depend on cars.' },
    interview: { context: '일상 이동 경험', questions: ['Describe the most inconvenient part of a regular trip you make.', 'Would better information or better infrastructure improve that trip more?'] },
  },
  {
    topic: '해양 과학', difficulty: 'C1',
    reading: { context: '산호초 복원 실험', passage: 'Coral nurseries grow fragments before attaching them to damaged reefs, but high survival in a nursery does not guarantee long-term restoration. Corals must tolerate heat, disease, storms, and competition after transplantation. Selecting only fast-growing individuals may also reduce genetic diversity. Programs increasingly track ecological functions, such as habitat creation and reproduction, rather than counting living fragments alone.', questions: [
      ['Why is nursery survival an incomplete measure?', ['Nurseries contain no coral.', 'Transplanted coral faces additional stresses.', 'Fragments never grow.', 'Storms occur only indoors.'], 1, 'Conditions on the reef introduce multiple long-term challenges.'],
      ['What risk comes from selecting only fast growers?', ['Lower genetic diversity', 'Slower nursery work', 'More storms', 'Less measurement'], 0, 'Narrow selection can reduce variation needed for resilience.'],
    ] },
    listening: { context: '연안 조사 장비 배치', transcript: 'Researcher: The salinity sensor drifted after three days, so the late readings may be unreliable. Technician: The backup sensor remained stable. We can use the overlap period to estimate the drift, but we should report the correction and its uncertainty rather than silently replacing the values.', questions: [
      ['What happened to the main sensor?', ['It was lost.', 'Its readings gradually became inaccurate.', 'It measured temperature.', 'It stopped immediately.'], 1, 'Sensor drift means increasing measurement bias over time.'],
      ['Why use the overlap period?', ['To estimate the correction', 'To hide uncertainty', 'To remove the backup', 'To extend the field trip'], 0, 'Simultaneous readings allow comparison of the unstable sensor with a stable one.'],
    ] },
    email: { context: '해변 시민과학 조사', prompt: 'You joined a beach survey but later noticed that one observation was entered under the wrong location. Write to the project leader. Identify the record, explain the mistake, and ask how to correct it without losing the audit history.' },
    discussion: { context: '해양보전 세미나', prompt: 'Professor Adeyemi: Should limited conservation funds protect the most damaged marine areas or the healthiest remaining ones?', posts: 'Yuki: Damaged sites need urgent restoration.\nCaleb: Healthy sites may have a better chance of remaining resilient.' },
    interview: { context: '과학과 해양보호', questions: ['Which human activity creates the greatest challenge for oceans in your view?', 'How can scientists communicate uncertainty without weakening public concern?'] },
  },
  {
    topic: '도시 생물다양성', difficulty: 'B2',
    reading: { context: '녹지 연결성과 야생동물', passage: 'A large park can support many species, but isolated parks may function like islands. Tree-lined streets, gardens, and narrow stream corridors allow some animals and seeds to move between larger habitats. These connections are not equally useful to every species; bright lights, traffic, or a lack of shelter can interrupt them. Planners must examine the needs of particular organisms instead of assuming that any green strip is a corridor.', questions: [
      ['Why are isolated parks compared with islands?', ['They contain ocean water.', 'Movement between habitats is difficult.', 'They have no plants.', 'Traffic enters every park.'], 1, 'Isolation limits movement and exchange among populations.'],
      ['What warning does the passage give planners?', ['Every green strip helps every species.', 'Corridor quality depends on species needs.', 'Large parks are unnecessary.', 'Lighting always improves movement.'], 1, 'Different organisms require different shelter and movement conditions.'],
    ] },
    listening: { context: '캠퍼스 조명과 새 충돌 조사', transcript: 'Student: Most bird collisions occurred at the glass walkway during migration weeks. Biologist: Then a year-round lighting ban may be unnecessary. Let us test window markers and dim the nearby lights during peak migration, while keeping enough illumination for pedestrian safety.', questions: [
      ['When did most collisions occur?', ['During construction', 'During migration weeks', 'Throughout winter', 'Only at noon'], 1, 'The collisions were concentrated in seasonal migration periods.'],
      ['What balanced plan is proposed?', ['Close the walkway permanently.', 'Use markers and seasonal dimming.', 'Remove all safety lights.', 'Move the birds.'], 1, 'The plan combines collision prevention with pedestrian safety.'],
    ] },
    email: { context: '생태 관찰 행사', prompt: 'A campus nature walk overlaps with loud landscaping work near the observation area. Write to facilities. Explain how noise affects the activity and request a brief schedule adjustment or an alternative site.' },
    discussion: { context: '도시생태 수업', prompt: 'Professor Evans: Should cities manage urban wildlife actively or allow ecosystems to adjust on their own?', posts: 'Priya: Management can reduce conflict and protect vulnerable species.\nAlex: Frequent intervention may create new ecological problems.' },
    interview: { context: '사람과 야생동물의 공존', questions: ['Describe an example of wildlife adapting to a human environment.', 'What should people do when protecting wildlife conflicts with convenience?'] },
  },
  {
    topic: '순환경제와 재료', difficulty: 'C1',
    reading: { context: '제품 수명과 재활용 설계', passage: 'A product advertised as recyclable may still be difficult to recycle if it combines many bonded materials. Separating layers can require more energy and labor than the recovered material is worth. Designers can improve circularity by using fewer material types, accessible fasteners, and standardized parts. Yet durability also matters: a product that lasts twice as long may reduce resource use even if its eventual recycling rate is lower.', questions: [
      ['Why can a recyclable product remain impractical to recycle?', ['It lasts too long.', 'Its materials are difficult to separate economically.', 'Standard parts are unavailable.', 'Recycling uses no labor.'], 1, 'Technical recyclability does not ensure economical material recovery.'],
      ['What complication does durability introduce?', ['Recycling rate is not the only environmental measure.', 'Long-lasting products use more parts.', 'Durability prevents repair.', 'All durable products are recyclable.'], 0, 'A long service life may reduce total resource demand despite end-of-life limits.'],
    ] },
    listening: { context: '공학 실험실의 부품 재사용', transcript: 'Student: These aluminum frames look undamaged. Can we use them in the next prototype? Engineer: Possibly, but measure the mounting holes first. Repeated assembly may have enlarged them, and a loose connection would change the vibration test. Record which parts are reused so we can interpret the results.', questions: [
      ['What must be checked before reuse?', ['Frame color', 'Mounting-hole dimensions', 'Aluminum price', 'Prototype software'], 1, 'Repeated assembly may have changed the holes.'],
      ['Why should reused parts be recorded?', ['To interpret possible effects on results', 'To hide vibration', 'To avoid measurement', 'To order identical paint'], 0, 'Material history may influence the experiment and must remain traceable.'],
    ] },
    email: { context: '수리 가능한 장비 구매', prompt: 'Your department plans to buy tablets that are difficult to repair. Write to the purchasing committee. Explain the long-term cost concern, compare one repairable alternative, and request that service life be considered.' },
    discussion: { context: '제품정책 토론', prompt: 'Professor Becker: Should manufacturers be legally required to provide replacement parts and repair information?', posts: 'Fatima: Repair access reduces waste and consumer costs.\nGrant: Requirements may increase prices and expose proprietary designs.' },
    interview: { context: '소비와 제품 수명', questions: ['Describe a product you repaired, reused, or replaced recently.', 'What would make consumers choose longer-lasting products?'] },
  },
]

const base = (id: string, section: BaseItem['section'], kind: BaseItem['kind'], title: string, topic: string, context: string, difficulty: Difficulty, timeSeconds: number): BaseItem => ({
  id, section, module: 1, kind, title, topic, context, difficulty, timeSeconds, instruction: '',
})

export const CONTEXT_ITEMS: BaseItem[] = BUNDLES.flatMap((bundle, bundleIndex) => {
  const prefix = `ctx-${bundleIndex}`
  const reading = bundle.reading.questions.map(([prompt, options, answer, explanation], index) => ({
    ...base(`${prefix}-r${index}`, 'reading', 'multiple-choice', 'Read an Academic Passage', bundle.topic, bundle.reading.context, bundle.difficulty, 120),
    instruction: '학술적 맥락을 읽고 핵심 주장과 세부 근거를 파악하세요.', passage: bundle.reading.passage, prompt, options, answer, explanation,
  }))
  const listening = bundle.listening.questions.map(([prompt, options, answer, explanation], index) => ({
    ...base(`${prefix}-l${index}`, 'listening', 'listen-choice', 'Listen to a Conversation', bundle.topic, bundle.listening.context, bundle.difficulty, 70),
    instruction: '대화의 문제, 제안, 함의를 파악하세요.', audioText: bundle.listening.transcript, prompt, options, answer, explanation,
  }))
  const email = {
    ...base(`${prefix}-w0`, 'writing', 'email', 'Write an Email', bundle.topic, bundle.email.context, bundle.difficulty, 420),
    instruction: '상황과 독자를 고려해 목적이 분명한 이메일을 작성하세요.', prompt: bundle.email.prompt,
  }
  const discussion = {
    ...base(`${prefix}-w1`, 'writing', 'discussion', 'Write for an Academic Discussion', bundle.topic, bundle.discussion.context, bundle.difficulty, 600),
    instruction: '두 관점을 연결하고 자신의 주장과 근거를 제시하세요.', prompt: bundle.discussion.prompt, passage: bundle.discussion.posts,
  }
  const speaking = bundle.interview.questions.map((audioText, index) => ({
    ...base(`${prefix}-s${index}`, 'speaking', 'interview', 'Take an Interview', bundle.topic, bundle.interview.context, bundle.difficulty, 45),
    instruction: '질문에 직접 답하고 구체적인 이유나 사례를 덧붙이세요.', audioText,
  }))
  return [...reading, ...listening, email, discussion, ...speaking]
})

export const BASE_CONTEXT_TOPIC_COUNT = BUNDLES.length
