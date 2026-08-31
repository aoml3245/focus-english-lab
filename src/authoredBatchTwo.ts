import type { BaseItem } from './types'

type Objective = [prompt: string, options: string[], answer: number, explanation: string]

const dailyItems: BaseItem[] = [
  {
    id: 'a2-r-freezer', topic: '연구실 시설', context: '냉동고 정기 점검', difficulty: 'B2',
    passage: 'The biology building’s minus-80-degree freezer will be serviced next Thursday. Lab managers must move temperature-sensitive samples to the backup unit in Room 214 by 5 p.m. Wednesday. Unlabeled containers will not be transferred and may be discarded after the maintenance period.',
    prompt: 'Which samples will staff refuse to move to the backup freezer?',
    options: ['Samples stored before Wednesday', 'Containers without identifying labels', 'Materials kept in Room 214', 'Items requiring very low temperatures'], answer: 1,
    explanation: 'The notice explicitly excludes unlabeled containers from the transfer.',
  },
  {
    id: 'a2-r-language-exchange', topic: '언어 교환', context: '참가 확정 절차', difficulty: 'B1',
    passage: 'Registration for the language exchange has reached capacity. Students already on the waiting list should not submit a second form. If a place becomes available, the coordinator will send an offer by email. The recipient must accept within twenty-four hours or the place will go to the next person.',
    prompt: 'What must a wait-listed student do after receiving an offer?',
    options: ['Complete another registration form', 'Reply within one day', 'Contact the next person on the list', 'Attend an orientation immediately'], answer: 1,
    explanation: 'An offered place is held for only twenty-four hours.',
  },
  {
    id: 'a2-r-parking', topic: '캠퍼스 교통', context: '공사 기간 임시 주차', difficulty: 'B2',
    passage: 'Lot D permit holders may park in Lot F from September 3 through September 14 while drainage work is completed. Their existing permits will open the Lot F gate during that period. Drivers who normally use Lot F should continue using it; no spaces have been reserved for either group.',
    prompt: 'What does the notice imply about parking in Lot F?',
    options: ['Lot D users must purchase a temporary permit.', 'Only construction vehicles may enter during the project.', 'Two groups will compete for the available spaces.', 'Regular Lot F users must relocate for two weeks.'], answer: 2,
    explanation: 'Both permit groups may use Lot F, and the notice says that spaces are not reserved.',
  },
  {
    id: 'a2-r-accommodations', topic: '시험 지원', context: '별도 시험실 신청', difficulty: 'B2',
    passage: 'Students approved for a reduced-distraction testing room must book the room at least seven calendar days before an exam. Approval from Accessibility Services does not create a reservation automatically. For exams announced with less than a week’s notice, contact the testing office as soon as the instructor posts the date.',
    prompt: 'What misunderstanding does the notice correct?',
    options: ['Every examination is announced seven days in advance.', 'Accessibility approval automatically reserves a room.', 'Only instructors may contact the testing office.', 'Reduced-distraction rooms require no prior approval.'], answer: 1,
    explanation: 'The notice distinguishes eligibility approval from the separate act of reserving a room.',
  },
  {
    id: 'a2-r-garden', topic: '캠퍼스 정원', context: '해충 관리 안내', difficulty: 'B1',
    passage: 'The teaching garden will remain open while beneficial insects are released to control aphids. Please do not apply personal pesticides or move the small mesh shelters attached to several plants. The insects do not sting people and will disperse naturally after the aphid population falls.',
    prompt: 'Why are visitors asked to leave the mesh shelters in place?',
    options: ['They protect insects being used for pest control.', 'They mark plants that visitors may harvest.', 'They prevent the garden from closing early.', 'They contain chemicals that repel people.'], answer: 0,
    explanation: 'The shelters are part of a biological pest-control effort using beneficial insects.',
  },
  {
    id: 'a2-r-career-fair', topic: '취업 지원', context: '온라인 상담 부스', difficulty: 'B1',
    passage: 'Most career-fair employers will meet students in the recreation center, but four organizations are participating online only. Their virtual booths appear in the event portal, not on the building map. Students may join those booths from any location, although headphones are recommended for private conversations.',
    prompt: 'Where should students look for employers attending remotely?',
    options: ['On the recreation-center floor plan', 'In the event’s online portal', 'At the private interview desk', 'Inside the campus headphone library'], answer: 1,
    explanation: 'Online-only organizations are listed in the portal rather than on the physical map.',
  },
  {
    id: 'a2-r-practice-rooms', topic: '음악 시설', context: '연습실 출입 카드', difficulty: 'B2',
    passage: 'Beginning this semester, music practice rooms unlock with student identification cards. Access is activated only after the required hearing-safety orientation. Students who completed the orientation last year retain access, but those who merely watched the online video without attending the demonstration must register for a new session.',
    prompt: 'Who needs to attend a new orientation session?',
    options: ['A student whose card already opens the rooms', 'Someone who completed last year’s full orientation', 'A learner who watched the video but missed the demonstration', 'Every musician returning from the previous semester'], answer: 2,
    explanation: 'Watching the video alone did not satisfy the demonstration requirement.',
  },
  {
    id: 'a2-r-lost-property', topic: '분실물 보관소', context: '전자기기 수령', difficulty: 'B1',
    passage: 'Found electronic devices are held at Campus Security for thirty days. To claim one, bring photo identification and describe a feature that is not visible from the outside, such as the lock-screen image or a file stored on the device. Staff cannot release an item using a serial number alone if ownership remains unclear.',
    prompt: 'What information can help establish ownership of a found device?',
    options: ['The date on which Campus Security closes', 'A detail stored or displayed inside the device', 'The name of the employee who found it', 'A serial number with no other description'], answer: 1,
    explanation: 'A private internal detail helps distinguish the owner from someone who only knows the device model or number.',
  },
].map((item) => ({
  ...item, section: 'reading' as const, module: 1, kind: 'multiple-choice' as const,
  title: 'Read in Daily Life', instruction: '실용문을 읽고 필요한 행동, 조건, 함의를 파악하세요.',
  difficulty: item.difficulty as NonNullable<BaseItem['difficulty']>, timeSeconds: 75, sourceFamily: 'authored-batch-2',
}))

const responseData: Array<[string, string[], number, string]> = [
  ['Did the committee postpone its decision?', ['Yes, it wants to review the cost estimate first.', 'The estimate contains three tables.', 'I decided to take the morning train.', 'The committee room is on the second floor.'], 0, 'The question asks whether a decision was delayed, and the first response confirms it and gives a reason.'],
  ['Would you like me to reserve a seat for you?', ['The lecture lasted for an hour.', 'Yes, if there is one near the aisle.', 'I reserved the textbook yesterday.', 'There were nearly a hundred seats.'], 1, 'The offer calls for accepting or declining a seat reservation.'],
  ['How come the greenhouse lights are still on?', ['The plants need a longer light cycle this week.', 'The greenhouse is behind the laboratory.', 'I turned in the assignment already.', 'They are brighter than the hallway walls.'], 0, '“How come” asks for the reason the lights remain on.'],
  ['Has anyone returned my calculator?', ['It uses a rechargeable battery.', 'Try checking the lost-property desk.', 'The calculation was not difficult.', 'Anyone can take the statistics course.'], 1, 'The reply appropriately suggests where a returned item might be found.'],
  ['Which draft should I send to the editor?', ['Editing begins after lunch.', 'The file was sent by courier.', 'Use the version with Professor Lee’s comments.', 'The editor works for a science journal.'], 2, 'The speaker needs to choose among drafts, so the answer identifies the correct version.'],
  ['Aren’t the museum tickets included in our fee?', ['They are, but you still need to book a time.', 'The museum displayed ancient coins.', 'I included a graph in the report.', 'Our group entered through the west door.'], 0, 'The reply addresses both inclusion in the fee and the remaining reservation requirement.'],
  ['What kept you from finishing the survey?', ['It was about public transportation.', 'Several questions would not load on my phone.', 'I finished the workshop before noon.', 'The survey team has five members.'], 1, 'The question asks about an obstacle, and the loading problem explains it.'],
  ['Could the package have arrived at the other office?', ['The package weighs almost two kilograms.', 'No, both offices close at six.', 'Possibly—I entered the old building number.', 'The office ordered new envelopes.'], 2, 'The mistaken building number makes delivery to the other office plausible.'],
  ['When are you planning to rehearse your talk?', ['After I revise the final two slides.', 'The talk concerns coastal erosion.', 'I planned the experiment with Mina.', 'Rehearsal improves pronunciation.'], 0, 'The response gives a future point at which rehearsal will occur.'],
  ['Why didn’t Omar join the field trip?', ['He joined the geology club last year.', 'His laboratory session could not be rescheduled.', 'The trip visited three coastal sites.', 'Omar brought the sampling equipment.'], 1, 'An unmovable laboratory session explains his absence.'],
  ['Do we have enough paint to finish the model?', ['The model represents a train station.', 'Only if we use the gray for the roof as well.', 'I finished painting at the studio.', 'The container is made of plastic.'], 1, 'The conditional answer directly evaluates whether the available paint is sufficient.'],
  ['Where did you find the citation for that claim?', ['In the review article listed on the course page.', 'The claim was difficult to pronounce.', 'I cited it in the final paragraph.', 'That page has a blue background.'], 0, 'The question asks for the source location, which the review article supplies.'],
  ['Shouldn’t the data be backed up before the update?', ['The update changed the menu icons.', 'Yes, I am copying them to the server now.', 'The data contain twelve variables.', 'I backed into the parking space.'], 1, 'The reply agrees with the precaution and describes taking it.'],
  ['How long will the replacement battery take to arrive?', ['It should be here early next week.', 'The battery lasts about eight hours.', 'I replaced the broken cable.', 'Shipping batteries requires careful packaging.'], 0, 'The question asks about delivery time, not battery duration.'],
  ['Who is leading tomorrow’s campus tour?', ['The tour starts beside the fountain.', 'Nadia is, unless her flight is delayed.', 'Tomorrow will be warmer than today.', 'The group toured the new residence hall.'], 1, 'The response identifies the guide and adds a relevant condition.'],
  ['Why not submit the photograph in black and white?', ['That could work; color is not part of the grading criteria.', 'The photograph was taken near the river.', 'Black ink is stored in the cabinet.', 'I submitted the application twice.'], 0, 'The suggestion is evaluated against the assignment requirements.'],
  ['Have you figured out which bus stops near the archive?', ['The archive closes on national holidays.', 'Bus 14, but only on weekdays.', 'I stopped reading at chapter fourteen.', 'The driver archived the old schedule.'], 1, 'The answer names the relevant bus and qualifies its schedule.'],
]

const responseItems: BaseItem[] = responseData.map(([audioText, options, answer, explanation], index) => ({
  id: `a2-l-response-${index}`, section: 'listening', module: 1, kind: 'listen-choice',
  title: 'Listen and Choose a Response', instruction: '짧은 말을 듣고 상황에 가장 자연스럽게 이어지는 응답을 고르세요.',
  topic: '캠퍼스 의사소통', difficulty: index < 9 ? 'B1' : 'B2', timeSeconds: 35,
  audioText, options, answer, explanation, sourceFamily: 'authored-batch-2',
}))

const listeningGroup = (
  id: string,
  title: 'Listen to a Conversation' | 'Listen to an Announcement' | 'Listen to an Academic Talk',
  topic: string,
  context: string,
  difficulty: 'B1' | 'B2' | 'C1',
  audioText: string,
  questions: Objective[],
): BaseItem[] => questions.map(([prompt, options, answer, explanation], sequenceIndex) => ({
  id: `${id}-${sequenceIndex}`, section: 'listening', module: 1, kind: 'listen-choice', title,
  instruction: title === 'Listen to an Announcement' ? '공지의 변경 사항, 조건, 필요한 행동을 파악하세요.' : title === 'Listen to a Conversation' ? '대화의 문제, 제안, 다음 행동을 파악하세요.' : '강의의 중심 주장과 근거의 관계를 파악하세요.',
  topic, context, difficulty, timeSeconds: title === 'Listen to an Announcement' ? 55 : title === 'Listen to a Conversation' ? 70 : 80,
  audioText, prompt, options, answer, explanation, stimulusGroupId: id, sequenceIndex,
  sourceFamily: 'authored-batch-2',
}))

const announcementItems: BaseItem[] = [
  ...listeningGroup('a2-l-ann-stockroom', 'Listen to an Announcement', '화학 실험실', '시약 창고 재고 조사', 'B2',
    'The chemistry stockroom will conduct its annual inventory on Monday and Tuesday. Routine supply orders placed after noon Friday will not be filled until Wednesday. If an experiment requires a time-sensitive reagent, the supervising instructor—not an individual student—should email the stockroom manager before Friday noon. Emergency requests will be reviewed, but approval is not guaranteed because some cabinets must remain sealed during counting.', [
      ['What will happen to an ordinary order submitted late Friday?', ['It will be delivered directly to the laboratory.', 'It will remain unfilled until the inventory ends.', 'It will require approval from an individual student.', 'It will be counted as an emergency request.'], 1, 'Routine orders after the cutoff wait until Wednesday.'],
      ['Who should contact the manager about a reagent needed urgently?', ['The course instructor responsible for the experiment', 'Any student who has used the reagent before', 'The employee conducting the cabinet count', 'A delivery driver arriving on Monday'], 0, 'The announcement specifically assigns urgent contact to the supervising instructor.'],
    ]),
  ...listeningGroup('a2-l-ann-election', 'Listen to an Announcement', '학생회 선거', '투표 장소와 신분 확인', 'B1',
    'Voting in the student council election opens tomorrow at eight in the morning. Students may vote online or at the library polling table, but not by both methods. The online system requires the security code sent to each student’s university email account. At the library, voters should present a current student card. A receipt confirms that a ballot was recorded; it does not reveal which candidates were selected.', [
      ['What is required to vote at the library table?', ['A printed copy of the emailed security code', 'A valid student identification card', 'A receipt from an earlier online ballot', 'A list of the voter’s preferred candidates'], 1, 'In-person voters identify themselves with a current student card.'],
      ['What does the voting receipt show?', ['The names selected on the ballot', 'The time at which polls will close', 'That the system accepted a vote', 'Whether a student used both voting methods'], 2, 'The receipt verifies recording without disclosing the voter’s choices.'],
    ]),
  ...listeningGroup('a2-l-ann-screening', 'Listen to an Announcement', '영화 자료관', '상영 장소 변경', 'B2',
    'Friday’s silent-film screening has moved from the archive theater to Lecture Hall B because the theater projector needs repair. The hall’s digital system cannot display the archive’s original print, so a high-resolution scan will be shown instead. The pianist and discussion leader remain scheduled, and the starting time is unchanged. Ticket holders should use the east entrance, where staff will exchange their theater tickets for hall passes.', [
      ['Why will viewers see a digital scan rather than the original print?', ['The replacement room lacks the equipment needed for the print.', 'The pianist requested a brighter image.', 'The archive sold the print before the screening.', 'Ticket holders voted to change the film format.'], 0, 'The lecture hall’s projector cannot display the physical archive print.'],
      ['What should ticket holders do upon arrival?', ['Request a refund from the discussion leader', 'Enter through the theater and wait for the pianist', 'Trade their existing tickets for passes at the east entrance', 'Bring a digital copy of the film to Lecture Hall B'], 2, 'Staff at the east entrance will exchange theater tickets for hall passes.'],
    ]),
  ...listeningGroup('a2-l-ann-trail', 'Listen to an Announcement', '생태 복원 봉사', '강변 산책로 작업', 'B1',
    'Saturday’s river-trail project will begin at the south footbridge rather than the visitor center. Recent rain left the northern section too muddy for equipment carts. Volunteers will plant grasses and install temporary fencing on the drier bank. Boots and reusable water bottles are recommended. Tools and work gloves will be provided, so participants should not bring sharp equipment from home.', [
      ['Why was the meeting point changed?', ['The visitor center has no drinking water.', 'Wet ground prevents equipment access in the north.', 'The footbridge requires immediate structural repair.', 'Volunteers requested a shorter planting session.'], 1, 'Mud on the northern section makes it unsuitable for equipment carts.'],
      ['Which item will organizers supply?', ['Protective work gloves', 'Personal hiking boots', 'Reusable drinking bottles', 'Privately owned cutting tools'], 0, 'The announcement says that both tools and gloves are provided.'],
    ]),
]

const additionalConversationItems: BaseItem[] = [
  ...listeningGroup('a2-l-conversation-scanner', 'Listen to a Conversation', '도서관 디지털화', '희귀도서 스캔 요청', 'B2',
    'Student: Could I scan an entire nineteenth-century field journal for my thesis? Librarian: The journal is out of copyright, but its binding is fragile. Our overhead camera can photograph selected pages without flattening the book. Submit the page numbers you need, and the digitization team will make the images. Student: I had hoped to search the whole text. Librarian: Start with the index and the expedition dates. If those pages show that a full copy is necessary, explain that in a second request.', [
      ['Why can the student not scan the journal personally?', ['The journal is still protected by copyright.', 'Its physical condition requires specialized handling.', 'The library camera cannot photograph old paper.', 'The thesis topic has not been approved.'], 1, 'The librarian permits copying in principle but protects the fragile binding with staff-operated equipment.'],
      ['What does the librarian ask the student to provide first?', ['A list of the particular pages currently needed', 'A replacement binding for the field journal', 'A searchable transcript of the entire volume', 'Written permission from the original expedition'], 0, 'The initial request should identify pages for targeted digitization.'],
      ['Why does the librarian mention the index and expedition dates?', ['They may help the student narrow the request before seeking a full copy.', 'They prove that the journal remains under copyright.', 'They identify who damaged the journal’s binding.', 'They can be removed and scanned on a flatbed machine.'], 0, 'Those sections can reveal whether complete digitization is genuinely necessary.'],
    ]),
  ...listeningGroup('a2-l-conversation-recorders', 'Listen to a Conversation', '생태 조사', '야외 녹음기 시간 오차', 'C1',
    'Student: The forest recorders captured bird calls, but their time stamps drifted apart by almost six minutes. Researcher: Did you synchronize them before deployment? Student: Yes, but the cold site used older batteries. Researcher: Low voltage can slow the internal clock. Keep the recordings; the sunrise chorus gives us a shared acoustic event. Align that event across the files, document the correction, and use fresh lithium batteries next time.', [
      ['What problem occurred in the recordings?', ['Bird calls were erased at the cold site.', 'The devices no longer agreed about when sounds occurred.', 'A sunrise event was recorded only in the laboratory.', 'Lithium batteries introduced additional background noise.'], 1, 'Clock drift caused a difference of several minutes among time stamps.'],
      ['What does the researcher suspect contributed to the problem?', ['Reduced battery performance in cold conditions', 'Failure to place the recorders in a forest', 'An incorrect identification of the bird species', 'Excessive sunlight reaching the microphones'], 0, 'The older batteries at the cold site may have supplied voltage that affected the clock.'],
      ['How can the current files be corrected?', ['Delete every sound recorded before sunrise.', 'Match a common natural sound event across the recordings.', 'Replace the batteries without changing the time stamps.', 'Estimate each time from the distance between trees.'], 1, 'The shared dawn chorus provides a reference for aligning otherwise drifting clocks.'],
    ]),
]

const talkItems: BaseItem[] = [
  ...listeningGroup('a2-l-talk-tree-rings', 'Listen to an Academic Talk', '고기후학', '나이테와 가뭄 해석', 'C1',
    'Tree rings are valuable climate records, but a narrow ring does not automatically indicate drought. Growth can also slow because of insect damage, shade, or an unusually cold spring. Researchers reduce this ambiguity by comparing many trees from the same region and by selecting species whose growth is known to respond strongly to moisture. If narrow rings appear across several sites in the same years, while independent lake records also indicate dry conditions, the drought interpretation becomes much stronger.', [
      ['Why is one narrow tree ring insufficient evidence of drought?', ['Several unrelated conditions can restrict growth.', 'Tree rings record temperature but never moisture.', 'A single tree produces many rings in one year.', 'Lake records prevent insects from damaging trees.'], 0, 'The lecture lists cold, shade, and insects as alternative causes of slow growth.'],
      ['What would most strengthen a drought interpretation?', ['Wide rings appearing in one shaded tree', 'Matching patterns across trees, sites, and another climate record', 'Evidence that a species grows under every moisture condition', 'A laboratory measurement made without a date'], 1, 'Agreement among multiple sites and independent evidence reduces ambiguity.'],
    ]),
  ...listeningGroup('a2-l-talk-pottery', 'Listen to an Academic Talk', '고고학', '토기의 열발광 연대측정', 'C1',
    'When pottery is fired, heat releases energy that had accumulated in mineral crystals. After burial, natural radiation gradually traps energy again. In thermoluminescence dating, a small sample is heated in a laboratory and emits light related to the stored energy. Researchers estimate the time since firing by combining that signal with the rate of radiation at the burial site. The method is useful when no organic material remains, but moving an object from its original context can make the radiation estimate less certain.', [
      ['What event does thermoluminescence dating attempt to date?', ['The extraction of clay from the ground', 'The most recent firing of the pottery', 'The discovery of the burial location', 'The laboratory heating of the sample'], 1, 'Initial firing resets the stored-energy signal that later begins accumulating again.'],
      ['Why can removal from the original site reduce accuracy?', ['The pottery immediately loses all trapped energy.', 'The original radiation environment becomes harder to estimate.', 'Organic material begins growing inside the clay.', 'Laboratory light changes the mineral composition.'], 1, 'The calculation depends on the radiation rate where the object was buried.'],
    ]),
  ...listeningGroup('a2-l-talk-anchoring', 'Listen to an Academic Talk', '행동경제학', '첫 가격이 판단에 미치는 영향', 'B2',
    'An anchor is an initial number that influences a later estimate, even when the number is not very informative. A shopper who first sees an expensive jacket may judge the next jacket as inexpensive, although its price is still high compared with similar products elsewhere. Anchoring does not mean people ignore all evidence. Instead, they often adjust away from the starting number too little. Experts can also be affected, particularly when evidence is uncertain and no clear comparison is available.', [
      ['How does the first jacket price function in the example?', ['It establishes a reference point for judging the second price.', 'It proves that both jackets were made by the same company.', 'It prevents the shopper from comparing any product features.', 'It reveals the average price charged by other stores.'], 0, 'The initial high price shifts the standard used to evaluate the next jacket.'],
      ['According to the lecturer, when may experts be especially vulnerable to anchoring?', ['When a correct answer is displayed beside the estimate', 'When uncertain evidence offers no obvious comparison', 'When they have previously purchased the same item', 'When an initial number is completely removed'], 1, 'Ambiguity makes it harder to replace the initial reference with a better one.'],
    ]),
  ...listeningGroup('a2-l-talk-navigation', 'Listen to an Academic Talk', '동물행동학', '자기장 감지 연구', 'C1',
    'Some migrating animals appear able to detect Earth’s magnetic field. Demonstrating this ability requires more than observing that an animal travels north or south. In controlled experiments, researchers alter the magnetic field around an enclosure while keeping visual cues and odors unchanged. If the animal changes its preferred direction in response to the artificial field, magnetoreception becomes a plausible explanation. Even then, the sensory mechanism may remain unknown, and laboratory behavior may not reveal how heavily the animal relies on magnetic information in the wild.', [
      ['Why do researchers alter the field while holding other cues constant?', ['To isolate magnetic information as the cause of a directional change', 'To teach captive animals a completely new migration route', 'To reproduce every condition encountered in the wild', 'To identify the exact sensory organ before observing behavior'], 0, 'Controlling vision and odor helps attribute changed orientation to the magnetic manipulation.'],
      ['What limitation remains after an animal responds to the artificial field?', ['Researchers still may not know the mechanism or its importance in nature.', 'The experiment cannot show that the animal selected a direction.', 'Earth’s field becomes permanently altered outside the enclosure.', 'Visual cues must have caused the response instead.'], 0, 'A behavioral response supports detection but does not fully explain the sense or its real-world weighting.'],
    ]),
  ...listeningGroup('a2-l-talk-albedo', 'Listen to an Academic Talk', '도시기후', '표면 반사율과 열', 'B2',
    'Albedo describes the fraction of incoming light that a surface reflects. A pale roof usually has a higher albedo than dark asphalt and absorbs less solar energy, which can reduce building temperatures on sunny days. Yet reflectivity is not the only design consideration. In a cold climate, reduced winter heat gain may increase heating demand, and reflected glare can affect neighboring buildings. Planners therefore evaluate annual energy use and local surroundings instead of judging a material by summer surface temperature alone.', [
      ['Why can a pale roof remain cooler in sunlight?', ['It reflects a larger share of incoming energy.', 'It releases artificial light into the building.', 'It stores winter heat beneath the roof surface.', 'It prevents air from moving around neighboring buildings.'], 0, 'Higher albedo means less solar energy is absorbed as heat.'],
      ['What broader point does the lecturer make about reflective materials?', ['They are suitable only for buildings in cold regions.', 'Their value depends on year-round and surrounding effects.', 'They eliminate both heating demand and glare.', 'Their albedo cannot be compared with dark surfaces.'], 1, 'The lecture cautions that seasonal energy and nearby impacts also matter.'],
    ]),
  ...listeningGroup('a2-l-talk-bilingual', 'Listen to an Academic Talk', '심리언어학', '이중언어 화자의 단어 접근', 'C1',
    'A bilingual speaker does not simply switch one language completely off when using the other. Experiments show that words from both languages can become partially active, especially when they sound alike or share a written form. This co-activation can speed recognition when meanings overlap, but it can also create competition. The effect depends on proficiency, context, and how recently each language was used. A slower response in one experiment therefore should not be treated as evidence that bilingualism generally weakens language ability.', [
      ['What does “co-activation” mean in the talk?', ['Two languages can influence processing at the same time.', 'A speaker always translates each word consciously.', 'Similar spellings guarantee identical meanings.', 'One language permanently replaces the other.'], 0, 'The lecturer describes partial activation of words from both languages during use.'],
      ['Why does the lecturer caution against interpreting one slow response broadly?', ['Response speed is never measurable in language studies.', 'Performance varies with proficiency, context, and recent use.', 'Competition occurs only among monolingual speakers.', 'Overlapping meanings always slow recognition.'], 1, 'Several conditions shape whether co-activation helps or interferes, so one result does not support a general deficit claim.'],
    ]),
]

export const AUTHORED_BATCH_TWO_ITEMS: BaseItem[] = [...dailyItems, ...responseItems, ...announcementItems, ...additionalConversationItems, ...talkItems]
