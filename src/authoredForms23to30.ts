import { createAdvancedAuthoredForm } from './advancedFormGenerator'
import type { AdvancedFormConfig, LogicBrief, PracticalBrief } from './advancedFormGenerator'
import type { SentenceDatum } from './authoredFormHelpers'

type LogicSeed = [topic: string, label: string, principle: string]
type PracticalSeed = [topic: string, label: string, notice: string, inference: string]
type ThemeSeed = {
  form: number
  logic: LogicSeed[]
  practical: PracticalSeed[]
  email: { topic: string; prompt: string }
  discussion: { topic: string; prompt: string; passage: string }
  repeat: { topic: string; sentences: string[] }
  interview: { topic: string; questions: string[] }
}

const caveats: Array<(label: string) => string> = [
  (label) => `The apparent ${label} relationship can change when the temporal window or spatial boundary is altered.`,
  (label) => `A ${label} proxy may covary with the target process while also responding to unrelated mechanisms.`,
  (label) => `Selection into the observed ${label} sample can make a descriptive pattern look causal.`,
  (label) => `An aggregate ${label} average can conceal heterogeneous responses and threshold effects.`,
  (label) => `Preservation and detection determine which ${label} traces enter the surviving record.`,
  (label) => `A successful ${label} laboratory demonstration may not survive field variability or repeated use.`,
  (label) => `Several mechanisms predict the same ${label} surface pattern, so identification remains incomplete.`,
  (label) => `Background conditions shift the ${label} baseline against which a change is interpreted.`,
]

const methods: Array<(label: string) => string> = [
  (label) => `Replicate the ${label} result across independent samples and compare predictions made by rival mechanisms.`,
  (label) => `Calibrate the ${label} proxy against direct measurements collected over the relevant range.`,
  (label) => `Use a negative control for ${label} and record the sampling process before examining the outcome.`,
  (label) => `Disaggregate the ${label} observations and test whether the proposed threshold appears within subgroups.`,
  (label) => `Model the ${label} preservation process and compare material recovered from contrasting contexts.`,
  (label) => `Stress-test the ${label} mechanism under realistic loads, disturbances, and repeated cycles.`,
  (label) => `Design a ${label} intervention that makes the competing mechanisms yield different outcomes.`,
  (label) => `Measure the ${label} baseline repeatedly and predefine the boundary of the comparison.`,
]

function makeLogic(seed: LogicSeed, index: number): LogicBrief {
  return { topic: seed[0], label: seed[1], principle: seed[2], caveat: caveats[index % caveats.length](seed[1]), method: methods[index % methods.length](seed[1]), difficulty: index % 6 === 0 ? 'B2' : 'C1' }
}

function makePractical(seed: PracticalSeed, index: number): PracticalBrief {
  return { topic: seed[0], label: seed[1], notice: seed[2], inference: seed[3], difficulty: index % 5 === 0 ? 'B1' : 'B2' }
}

function sentences(form: number, labels: string[]): SentenceDatum[] {
  const starters = [
    `Only after the ${labels[0]} baseline had been reconstructed`,
    `Had the ${labels[1]} proxy been calibrated independently`,
    `Not until the ${labels[2]} sample was disaggregated`,
    `However persuasive the ${labels[3]} average may appear`,
    `So sensitive was ${labels[4]} to the chosen boundary that`,
    `Were the ${labels[5]} mechanism genuinely causal`,
    `The more carefully ${labels[6]} uncertainty is propagated`,
    `What the ${labels[7]} comparison cannot establish is`,
    `There being no stable ${labels[8]} reference`,
    `Rarely does a single ${labels[9]} observation reveal`,
  ]
  const fragments = [
    ['could researchers', 'separate the trend', 'from inherited', 'measurement drift', 'with confidence'],
    ['its fluctuations', 'might have provided', 'a defensible', 'estimate of', 'the process'],
    ['did the subgroup', 'reversal become', 'visible to', 'the research', 'team'],
    ['it cannot', 'by itself', 'exclude', 'a plausible', 'confounder'],
    ['minor revisions', 'produced', 'substantially different', 'historical', 'inferences'],
    ['the intervention', 'should alter', 'the predicted', 'intermediate outcome', 'first'],
    ['the less likely', 'a nominal', 'difference is', 'to seem', 'decisive'],
    ['whether the same', 'process would', 'operate beyond', 'the observed', 'setting'],
    ['the estimated', 'departure remained', 'conditional on', 'the normalization', 'procedure'],
    ['which of', 'several compatible', 'mechanisms actually', 'generated the', 'pattern'],
  ]
  return starters.map((starter, index) => [`What qualification belongs in the ${labels[index]} interpretation?`, starter, fragments[index], `f${form}-advanced-structure-${index}`])
}

function materialize(seed: ThemeSeed): AdvancedFormConfig {
  const logic = seed.logic.map(makeLogic)
  const practical = seed.practical.map(makePractical)
  return {
    form: seed.form,
    cloze: logic.slice(0, 3).map((item, index) => ({ ...item, extra: `The ${item.label} literature also asks whether the inferred relation remains stable under protocol ${seed.form}-${index + 1}.` })),
    practical: practical.slice(0, 10),
    academic: logic.slice(3, 7),
    conversations: logic.slice(7, 12),
    announcements: practical.slice(10, 14),
    talks: logic.slice(12, 18),
    sentenceData: sentences(seed.form, logic.slice(0, 10).map((item) => item.label)),
    email: seed.email,
    discussion: seed.discussion,
    repeat: seed.repeat,
    interview: seed.interview,
  }
}

const FORM_23: ThemeSeed = {
  form: 23,
  logic: [
    ['지구물리학', 'paleomagnetic reversal', 'Iron-bearing minerals can lock in the direction of Earth’s magnetic field as volcanic rock cools.'],
    ['분자생태학', 'environmental DNA', 'Fragments of DNA shed into water can reveal organisms that were not captured during a conventional survey.'],
    ['지구화학', 'isotope mixing', 'The isotopic composition of a mixture reflects both source signatures and their relative contributions.'],
    ['대기과학', 'aerosol cloud forcing', 'Particles can modify cloud droplets and radiation, but the sign and magnitude of the resulting forcing vary.'],
    ['연륜연대학', 'tree ring crossdating', 'Matching wide and narrow growth rings across trees can assign calendar years to undated wood.'],
    ['해양생태학', 'diel plankton migration', 'Many plankton descend by day and rise at night, trading feeding opportunity against visual predation.'],
    ['고고학', 'taphonomic filtering', 'Decay, transport, burial, and excavation transform a living community before it becomes an archaeological assemblage.'],
    ['계측학', 'calibration drift', 'A sensor may change its response gradually even when the environmental quantity remains constant.'],
    ['고생태학', 'isotopic baseline', 'Consumer isotope values cannot be interpreted without knowing how local primary producers establish the baseline.'],
    ['보전유전학', 'landscape resistance', 'Genetic differentiation may reflect how terrain and land use impede movement rather than geographic distance alone.'],
    ['지진학', 'seismic tomography', 'Travel-time differences among seismic waves permit inference about heterogeneous structures inside Earth.'],
    ['연대측정', 'Bayesian chronology', 'Stratigraphic order can constrain calibrated date distributions when the model represents archaeological relationships correctly.'],
    ['빙하학', 'glacier mass balance', 'Accumulation and ablation together determine whether a glacier gains or loses mass over a defined interval.'],
    ['산호생리학', 'coral bleaching', 'Heat stress can disrupt the symbiosis between corals and photosynthetic microorganisms without immediately killing the colony.'],
    ['토양생태학', 'carbon priming', 'Adding fresh organic material can stimulate microbes to decompose older soil carbon.'],
    ['과학사', 'archaeoastronomical alignment', 'A monument’s orientation may reflect celestial observation, terrain, ritual movement, or construction constraints.'],
    ['동물행동학', 'acoustic telemetry', 'Coded transmitters reveal detections at receivers but do not continuously trace an animal between stations.'],
    ['퇴적학', 'lake varve chronology', 'Alternating seasonal layers can form an annual sequence when deposition remains sufficiently regular and undisturbed.'],
  ],
  practical: [
    ['청정실', 'airlock purge', 'After either airlock door opens, wait for the purge indicator to turn green before opening the opposite door. A timer reaching zero does not override a red particle alarm.', 'Keep the opposite door closed until the green purge signal appears.'],
    ['표본관', 'herbarium loan', 'Loan sheets may be photographed, but destructive sampling requires separate written permission tied to a specimen barcode.', 'Obtain barcode-specific approval before removing plant material.'],
    ['무인기 조사', 'drone weather limit', 'The survey drone remains grounded when gusts exceed the limit printed on the mission card, even if average wind is lower.', 'Cancel launch when recorded gusts exceed the mission threshold.'],
    ['동위원소실', 'procedural blank', 'Run the procedural blank through every preparation step used for samples. A blank added only at the instrument cannot reveal contamination introduced during digestion.', 'Process the blank from the beginning of sample preparation.'],
    ['현장기지', 'radio check-in', 'Field teams report by radio at the scheduled checkpoint. If terrain blocks transmission, move to the listed relay point rather than increasing power beyond the license.', 'Use the designated relay location when the first call fails.'],
    ['자료보관소', 'archive embargo', 'Files under donor embargo may be indexed internally, but neither their descriptions nor thumbnails can appear in the public catalog before release.', 'Keep both metadata and previews out of the public interface.'],
    ['조위관측', 'tide gauge datum', 'Do not merge gauge records until the benchmark survey confirms that both instruments use the same vertical datum.', 'Verify a common elevation reference before combining the series.'],
    ['발굴현장', 'excavation bag', 'A torn finds bag must be placed intact inside a new outer bag. Transfer neither the object nor its original label in the field.', 'Overbag the damaged package without separating its contents.'],
    ['현미경실', 'objective cleaning', 'Use lens paper and the approved solvent only on the immersion objective. Report dried residue instead of scraping it with a metal tool.', 'Escalate persistent residue rather than abrading the lens.'],
    ['기상관측', 'balloon notice', 'A weather balloon launch requires confirmation from airspace control on the day of release; yesterday’s authorization does not carry forward.', 'Secure same-day clearance before releasing the balloon.'],
    ['암석코어실', 'core freezer transfer', 'The core freezer moves to backup power at noon. Leave sealed boxes in their mapped racks and record any temperature alarm during the transfer.', 'Retain the mapped arrangement while documenting alarms.'],
    ['해양실습', 'sonar exclusion zone', 'Tomorrow’s sonar exercise will avoid the marked marine-mammal zone. If an observer reports an animal nearby, transmission pauses until the clearance interval ends.', 'Stop acoustic transmission after a nearby animal sighting.'],
    ['퇴적물창고', 'sediment inventory', 'Shelf locations will be frozen during Friday’s database migration. New cores may enter intake, but staff must not assign permanent positions until Monday.', 'Hold incoming cores in intake until the migrated catalog assigns shelves.'],
    ['산악안전', 'glacier route briefing', 'The glacier route briefing has moved indoors because visibility is poor. Participants still bring harnesses for inspection, although no field crossing will occur.', 'Bring the equipment for inspection despite the indoor session.'],
  ],
  email: { topic: '현장 데이터', prompt: 'A tide-gauge series was merged before staff verified that two stations used the same vertical datum. Write to the project coordinator. Explain the risk, request a temporary withdrawal of the combined graph, and propose checks before republication.' },
  discussion: { topic: '생태 감시', prompt: 'Professor Amari: Should environmental DNA replace most conventional biodiversity surveys in remote habitats?', passage: 'Leila: Water samples can reveal elusive species with much less field disturbance.\nJonas: Detection without abundance, location, or living specimens can mislead conservation decisions.' },
  repeat: { topic: '빙하 현장 브리핑', sentences: ['Welcome to the glacier monitoring workshop.', 'Check the route board before collecting any equipment.', 'Fasten the transceiver where it remains accessible.', 'Travel only within the corridor marked by the safety team.', 'Record snow depth without approaching exposed crevasses.', 'Report changing visibility before the next scheduled check-in.', 'At the turnaround time, secure every instrument, compare the team roster, and return by the flagged route.'] },
  interview: { topic: '간접 측정', questions: ['Describe a scientific question that researchers answer with an indirect proxy.', 'What makes the proxy useful?', 'Which alternative process could produce a similar signal?', 'What evidence would make the interpretation more convincing?'] },
}

const FORM_24: ThemeSeed = {
  form: 24,
  logic: [
    ['인지과학', 'memory reconsolidation', 'Retrieving a memory can temporarily make it susceptible to modification before it stabilizes again.'],
    ['언어학', 'lexical entrainment', 'Conversation partners often converge on the same expressions when repeatedly referring to an object.'],
    ['경제학', 'monetary transmission', 'A policy-rate change reaches spending and prices through borrowing costs, expectations, exchange rates, and credit conditions.'],
    ['사회과학', 'causal graph adjustment', 'A causal diagram can clarify which variables should be controlled and which controls would introduce bias.'],
    ['심리언어학', 'prediction error', 'Unexpected linguistic input can update expectations, although surprise does not identify the level at which learning occurs.'],
    ['정치경제학', 'fiscal multiplier', 'The output response to government spending depends on slack, monetary policy, financing, and the openness of the economy.'],
    ['인류학', 'prestige transmission', 'People may copy a model because of perceived status even when the copied behavior did not cause that status.'],
    ['교육측정', 'differential item functioning', 'A test item can favor equally able members of one group because it invokes group-specific experience.'],
    ['사회연결망', 'homophily selection', 'Similar people may form ties with one another, making peer influence difficult to separate from prior resemblance.'],
    ['행동경제학', 'reference dependence', 'People often evaluate an outcome relative to a comparison point rather than by final wealth alone.'],
    ['담화분석', 'repair sequence', 'Speakers use clarification and correction to resolve trouble while preserving the progress of interaction.'],
    ['인구학', 'cohort period separation', 'Age, calendar period, and birth cohort are linearly related, preventing unrestricted estimation of all three effects.'],
    ['신경경제학', 'reward prediction signal', 'Neural responses often track the difference between expected and received outcomes during learning.'],
    ['조직행동', 'psychological safety', 'Teams share concerns more readily when members expect questions and errors to be handled without interpersonal punishment.'],
    ['공공정책', 'administrative burden', 'Learning, compliance, and psychological costs can prevent eligible people from receiving a public benefit.'],
    ['음운론', 'categorical perception', 'Listeners may discriminate sounds better across a learned category boundary than within one category.'],
    ['사회학', 'status inconsistency', 'Different rankings in education, income, and occupational prestige need not place a person in one coherent hierarchy.'],
    ['의사결정', 'choice architecture', 'Defaults and presentation can alter choices without removing the available alternatives.'],
  ],
  practical: [
    ['연구윤리', 'debriefing waiver', 'A deception study may omit immediate debriefing only under the approved waiver. Investigators cannot delay disclosure merely because the next participant is waiting.', 'Follow the approved disclosure timing rather than the laboratory schedule.'],
    ['설문조사', 'panel identifier', 'Keep the panel identifier in the encrypted linkage table, not in the analysis file shared with external collaborators.', 'Remove the reidentification key from the collaborative dataset.'],
    ['통역실', 'interpreting channel', 'Remote interpreters join the language channel assigned on the session card. The general audio room is for technical checks and is not confidential.', 'Move substantive interpretation into the assigned protected channel.'],
    ['행동실험', 'bonus disclosure', 'Participants must see the bonus formula before making the incentivized decision. Explaining it afterward invalidates the payment manipulation.', 'Present the compensation rule before the relevant choice.'],
    ['도서관', 'restricted interview', 'Oral-history recordings marked narrator review may be transcribed internally but cannot be quoted until the narrator approves the transcript.', 'Wait for narrator approval before using a quotation publicly.'],
    ['학사행정', 'grade appeal clock', 'The appeal period begins when the written decision is posted, not when a student first opens the notification.', 'Calculate the deadline from the posting time.'],
    ['언어실험', 'headset profile', 'Load the participant-specific hearing profile before the practice trial. Changing amplification after the scored block begins requires restarting that block.', 'Configure amplification before scored responses start.'],
    ['경제자료', 'seasonal revision', 'The newly released employment series is preliminary. Cite its vintage date so later revisions can be distinguished from transcription errors.', 'Record which release vintage was used in the analysis.'],
    ['포커스그룹', 'observer consent', 'An additional observer may enter the focus group only if the consent form lists observers and every participant agrees before recording.', 'Confirm explicit consent before adding the observer.'],
    ['시험센터', 'adaptive test pause', 'A proctor may pause the adaptive test for a documented technical interruption, but cannot reopen an answered item.', 'Resume from the next item after recording the interruption.'],
    ['학생지원', 'benefit clinic', 'The benefits clinic accepts walk-ins Tuesday, while document review remains appointment-only because records must be assigned to a caseworker.', 'Book an appointment for document review rather than joining the walk-in line.'],
    ['연구패널', 'attrition call', 'Follow-up calls begin Wednesday. Remove participants who withdrew consent before loading numbers into the dialer.', 'Exclude withdrawn participants before outreach begins.'],
    ['세미나', 'anonymous question', 'Anonymous seminar questions will be read aloud, but submissions containing identifying case details will be returned privately for revision.', 'Revise a question that could identify an individual case.'],
    ['자료실', 'census microdata', 'The microdata room closes early Friday. Active sessions end at four, and results awaiting disclosure review remain on the secure server.', 'Leave unreviewed output on the secure system when the room closes.'],
  ],
  email: { topic: '연구윤리', prompt: 'You learn that a recorded focus group included an observer who was not listed on the consent form. Write to the principal investigator. Describe the consent problem, request that access to the recording be restricted, and propose a documented review of affected data.' },
  discussion: { topic: '공공행정', prompt: 'Professor Nwosu: Should governments automatically enroll eligible residents in social-benefit programs?', passage: 'Mina: Default enrollment removes paperwork that excludes people the policy intends to help.\nCaleb: Automatic enrollment can use outdated records and may reduce informed choice.' },
  repeat: { topic: '행동 연구 안내', sentences: ['Welcome to the decision research laboratory.', 'Store your phone in the numbered locker.', 'Read the payment rule before beginning the practice round.', 'Ask the proctor if any symbol on the screen is unclear.', 'Make each choice without consulting another participant.', 'Wait for the completion message before leaving the booth.', 'After the session, collect the receipt, review the debriefing statement, and report any technical interruption to the coordinator.'] },
  interview: { topic: '선택 설계', questions: ['Describe a default option that affects an everyday decision.', 'Why might people remain with that default?', 'When could the default undermine informed choice?', 'How should an institution evaluate whether the design is fair?'] },
}

const FORM_25: ThemeSeed = {
  form: 25,
  logic: [
    ['생물물리학', 'protein folding landscape', 'A protein population can reach its native structure through multiple routes on a rugged energy landscape.'],
    ['면역학', 'original antigenic imprinting', 'An early immune exposure can shape later responses to related variants in both helpful and limiting ways.'],
    ['식물생리학', 'hydraulic vulnerability', 'Air bubbles interrupt water transport when xylem tension exceeds the resistance of conduits.'],
    ['발생생물학', 'morphogen threshold', 'Cells can adopt different fates when they experience distinct concentrations or durations of a signaling molecule.'],
    ['미생물생태학', 'quorum sensing', 'Microbes release and detect signaling molecules whose concentration can coordinate density-dependent behavior.'],
    ['진화생물학', 'balancing selection', 'Multiple alleles may persist when their relative fitness changes across genotypes, places, or times.'],
    ['유전체학', 'linkage disequilibrium', 'Nearby genetic variants can remain statistically associated because recombination has not fully separated them.'],
    ['세포생물학', 'phase separation', 'Biomolecules can form dynamic condensates without a surrounding membrane through multivalent interactions.'],
    ['생태학', 'priority effect', 'The order in which species arrive can redirect community development by altering resources and niches.'],
    ['생화학', 'allosteric regulation', 'Binding away from an active site can shift a protein ensemble and alter catalytic activity.'],
    ['신경과학', 'homeostatic plasticity', 'Neurons can adjust overall excitability to stabilize activity after persistent changes in input.'],
    ['역학', 'collider bias', 'Conditioning on a common effect of two variables can create an association that was absent beforehand.'],
    ['분자진화', 'gene duplication', 'A duplicated gene can retain dosage, divide ancestral functions, acquire a new role, or decay.'],
    ['생태생리학', 'thermal acclimation', 'Organisms can alter physiology after sustained temperature exposure without changing inherited sequence.'],
    ['바이러스학', 'antigenic drift', 'Accumulated mutations in viral surface proteins can reduce recognition by existing antibodies.'],
    ['균류학', 'mycorrhizal exchange', 'Fungal partners can trade mineral nutrients for plant-derived carbon, with terms varying by environment.'],
    ['고생물학', 'mosaic evolution', 'Traits within one lineage need not change together or at the same evolutionary rate.'],
    ['생물통계학', 'survivorship bias', 'Analyses restricted to surviving units can omit failures that shaped the observed distribution.'],
  ],
  practical: [
    ['세포배양', 'incubator alarm', 'An incubator alarm must be acknowledged in person. Silencing the phone notification does not confirm that temperature and carbon dioxide recovered.', 'Inspect the chamber and record recovery before closing the alarm.'],
    ['생물안전', 'cabinet certification', 'Work with open cultures pauses when the cabinet certification expires, even if a recertification visit is already booked.', 'Keep cultures closed until certification becomes current.'],
    ['냉동표본', 'thaw cycle', 'A vial removed from cryogenic storage receives a thaw-cycle entry even when it is returned unopened.', 'Log every removal that warmed the vial above storage conditions.'],
    ['현미경', 'fluorescence exposure', 'Set exposure using the sacrificial control slide before imaging rare tissue. Repeated preview scans contribute to photobleaching.', 'Optimize the camera on the control rather than the rare specimen.'],
    ['동물시설', 'cage transfer', 'Transfer cards follow the cage, not the room. Scan both the old and new rack positions before moving animals.', 'Update both location records during the physical transfer.'],
    ['유전체실', 'index collision', 'Do not pool libraries whose sample indexes become identical after the sequencer trims the first base.', 'Check indexes in their instrument-processed form before pooling.'],
    ['표본배송', 'dry ice vent', 'Dry-ice packages must allow gas to escape and may not be sealed inside an airtight secondary container.', 'Use packaging that vents sublimated carbon dioxide safely.'],
    ['온실', 'watering quarantine', 'Quarantine benches use dedicated watering wands. A shared hose can move soil or pests between rooms.', 'Keep irrigation equipment inside its assigned quarantine zone.'],
    ['단백질실', 'column pressure', 'Stop the chromatography run if pressure rises above the method limit; lowering the alarm threshold is not a remedy.', 'Pause the run and investigate the obstruction.'],
    ['임상표본', 'consent scope', 'A blood sample approved for metabolic analysis cannot enter an unrelated genetic study without compatible consent.', 'Verify permission for the new genomic use before transfer.'],
    ['배양실', 'media recall', 'Lot 7 culture medium is under review. Isolate plates prepared with that lot and retain them until quality staff issue a disposition.', 'Segregate affected cultures instead of discarding them immediately.'],
    ['생태실험', 'mesocosm drainage', 'The outdoor tanks drain Friday. Remove tagged organisms first and screen the outflow for unintended releases.', 'Recover organisms and inspect the discharge before drainage.'],
    ['시퀀싱실', 'run reservation', 'Tonight’s sequencer slot begins thirty minutes later after maintenance. Libraries remain refrigerated and should not be denatured at the original time.', 'Delay final preparation to match the revised start.'],
    ['표본은행', 'freezer map audit', 'During the freezer-map audit, staff may verify boxes but may not relocate them without a second person recording the change.', 'Use witnessed documentation for any necessary relocation.'],
  ],
  email: { topic: '유전체 연구', prompt: 'You discover that sequencing libraries with colliding processed indexes were pooled together. Write to the core manager. Explain how samples could be misassigned, request that downstream release pause, and propose checks for salvaging or repeating the run.' },
  discussion: { topic: '생명공학', prompt: 'Professor Adeyemi: Should researchers release engineered organisms to control invasive species?', passage: 'Priya: A targeted organism may reduce pesticide use and protect native habitats.\nElliot: Evolution, dispersal, and ecological interactions can create changes that are difficult to reverse.' },
  repeat: { topic: '세포 배양 교육', sentences: ['Welcome to the sterile culture training area.', 'Confirm that the cabinet certification is current.', 'Arrange clean supplies before opening the first vessel.', 'Move your hands slowly to preserve the protective airflow.', 'Disinfect each item before it enters the work zone.', 'Record any contamination without hiding the affected culture.', 'When the procedure ends, seal every sample, clear the waste, and document the incubator location in the shared record.'] },
  interview: { topic: '생물학적 가역성', questions: ['Describe a biological intervention that could spread beyond its target.', 'What benefit is the intervention designed to provide?', 'Which ecological feedback might make reversal difficult?', 'What safeguards should precede a field release?'] },
}

const FORM_26: ThemeSeed = {
  form: 26,
  logic: [
    ['재료과학', 'perovskite stability', 'Perovskite solar absorbers can achieve high efficiency while remaining sensitive to moisture, heat, and interfacial reactions.'],
    ['유체역학', 'boundary layer separation', 'An adverse pressure gradient can detach near-surface flow and enlarge drag or stall.'],
    ['로봇공학', 'sensor observability', 'A system state is observable only when its measurements contain enough independent information to infer that state.'],
    ['에너지공학', 'battery solid electrolyte', 'A solid electrolyte can reduce flammable liquid components while introducing contact and mechanical challenges.'],
    ['구조공학', 'progressive collapse', 'Local structural damage can propagate when alternative load paths lack sufficient capacity.'],
    ['열역학', 'exergy destruction', 'Irreversible processes consume the portion of energy capable of producing useful work.'],
    ['광학', 'metamaterial resonance', 'Subwavelength structures can produce effective electromagnetic responses unavailable in their bulk constituents.'],
    ['제어공학', 'integrator windup', 'A saturated actuator can allow accumulated control error to drive a large overshoot after saturation ends.'],
    ['토목공학', 'soil liquefaction', 'Cyclic loading can raise pore pressure until saturated granular soil loses effective strength.'],
    ['컴퓨터공학', 'cache coherence', 'Multiple processors require a protocol that keeps private cached copies consistent after writes.'],
    ['음향공학', 'room impulse response', 'Reflections recorded after a brief sound characterize how a room modifies later signals.'],
    ['기계공학', 'fatigue crack closure', 'Contact between crack faces can reduce the effective loading range experienced at the crack tip.'],
    ['반도체', 'quantum tunneling', 'A particle has a nonzero probability of crossing a barrier that classical energy would not overcome.'],
    ['교통공학', 'induced travel demand', 'Added road capacity can lower the immediate cost of driving and attract trips that partly refill the space.'],
    ['수문공학', 'green roof retention', 'Vegetated roofs delay and retain some stormwater, with performance governed by antecedent moisture and storm intensity.'],
    ['정보이론', 'error correcting code', 'Redundant encoded structure permits recovery from some transmission errors without retransmitting the message.'],
    ['제조공학', 'residual stress', 'Uneven thermal or mechanical history can leave internal stress even when no external load is applied.'],
    ['우주공학', 'orbital perturbation', 'Departures from a two-body orbit accumulate through nonspherical gravity, drag, radiation, and third-body forces.'],
  ],
  practical: [
    ['로봇실험', 'emergency stop custody', 'One named operator keeps the wireless emergency stop throughout a robot trial. Handing it over requires pausing motion and announcing the transfer.', 'Stop the platform before transferring safety authority.'],
    ['배터리실', 'cell quarantine', 'A cell showing swelling enters the fire-rated quarantine cabinet and must not be discharged through ordinary cycling equipment.', 'Move the swollen cell to protected isolation.'],
    ['풍동실', 'model fastener', 'Count model fasteners before and after every wind-tunnel run. A missing fastener triggers an interior inspection before the fan restarts.', 'Inspect the tunnel whenever the hardware count is incomplete.'],
    ['구조실험', 'load frame zero', 'Zero the load frame with the fixture installed but before the specimen carries load. Rezeroing midtest erases the original reference.', 'Establish the force reference before loading begins.'],
    ['레이저실', 'beam enclosure', 'Alignment at reduced power still requires the beam enclosure unless the written alignment procedure identifies an open segment.', 'Keep the optical path enclosed except where the protocol explicitly permits access.'],
    ['드론실', 'propeller inspection', 'Replace a propeller with any visible edge crack; balancing a cracked blade does not restore its strength.', 'Remove damaged blades rather than attempting a balance correction.'],
    ['데이터센터', 'cooling failover', 'During cooling failover, pause new computing jobs but allow active checkpoint writes to finish before shutting nodes down.', 'Stop new workload admission while preserving active checkpoints.'],
    ['재료시험', 'strain gauge cure', 'The bonded strain gauge must cure for the adhesive’s specified duration. A stable resistance reading does not shorten chemical curing.', 'Wait the full adhesive cure time before testing.'],
    ['기계공작', 'machine interlock', 'Report an unreliable guard interlock and tag the machine out. Holding the switch manually is prohibited.', 'Remove the machine from service when its guard sensor fails.'],
    ['수리실험', 'flume tailgate', 'Set the downstream tailgate before introducing sediment so the initial bed is not scoured by an uncontrolled depth change.', 'Establish water depth before sediment feeding begins.'],
    ['로봇교육', 'low speed validation', 'Tomorrow’s manipulation trial begins in command-disabled mode, followed by a low-speed empty-workspace check before objects are introduced.', 'Validate sensing and stopping in staged conditions first.'],
    ['광학시설', 'laser booking', 'The ultrafast laser booking starts late after a compressor inspection. Users should keep temperature-sensitive samples in storage until staff release the room.', 'Delay sample removal until the facility confirms readiness.'],
    ['공학창고', 'torque tool recall', 'Two torque wrenches are recalled for calibration. Return them with their cases and do not substitute an unverified hand estimate.', 'Use only a currently calibrated torque tool.'],
    ['건물실험', 'shake table perimeter', 'The viewing perimeter expands during the high-acceleration run. Floor markings, not the earlier chair positions, define the exclusion boundary.', 'Stand outside the revised marked zone.'],
  ],
  email: { topic: '로봇 안전', prompt: 'During a robot trial, two people issued commands while the emergency-stop operator was changing. Write to the laboratory supervisor. Describe the control ambiguity, request suspension of comparable trials, and propose a single-authority handoff checklist.' },
  discussion: { topic: '도시교통', prompt: 'Professor Mensah: Should growing cities continue widening major roads to reduce congestion?', passage: 'Hana: Additional lanes can remove bottlenecks and improve freight reliability.\nDario: Lower travel costs induce more driving and consume land that could support other modes.' },
  repeat: { topic: '로봇 시험 절차', sentences: ['Welcome to the mobile robotics test area.', 'Identify the emergency-stop operator before enabling power.', 'Inspect the marked workspace for loose objects.', 'Run the first trajectory at the approved low speed.', 'Watch both the robot and the live safety display.', 'Pause immediately if command ownership becomes uncertain.', 'After every run, disable motion, preserve the event log, and record any handoff of control authority.'] },
  interview: { topic: '공학적 실패', questions: ['Describe an engineering system that can fail gradually rather than suddenly.', 'Which measurement could reveal deterioration early?', 'Why might a laboratory test underestimate field risk?', 'How should designers decide when preventive replacement is justified?'] },
}

const FORM_27: ThemeSeed = {
  form: 27,
  logic: [
    ['천체물리학', 'gravitational lensing', 'Mass bends light, allowing foreground structure to magnify, distort, or multiply images of a background source.'],
    ['행성과학', 'tidal locking', 'Tidal dissipation can synchronize a body’s rotation period with its orbital period.'],
    ['우주론', 'standard candle distance', 'An object with calibrated luminosity yields distance when its intrinsic and observed brightness are compared.'],
    ['항성물리학', 'stellar metallicity', 'Elements heavier than helium influence opacity, spectra, planet formation, and the inferred history of a star.'],
    ['외계행성학', 'transit timing variation', 'Departures from strictly periodic transits can indicate gravitational perturbations by additional planets.'],
    ['전파천문학', 'dispersion measure', 'Frequency-dependent pulse delay reveals the integrated column of free electrons along a radio path.'],
    ['태양물리학', 'coronal heating', 'The solar corona reaches temperatures far above the visible surface through incompletely resolved magnetic processes.'],
    ['관측천문학', 'adaptive optics', 'Rapid mirror corrections can compensate for atmospheric wavefront distortion measured from a reference source.'],
    ['은하천문학', 'rotation curve inference', 'Orbital speeds that remain high far from galactic centers imply more gravitating matter than visible stars provide.'],
    ['우주화학', 'spectral redshift', 'A shift of spectral features toward longer wavelengths can arise from cosmic expansion, motion, or gravity.'],
    ['행성지질학', 'crater retention age', 'A surface with more accumulated impact craters is generally older when resurfacing and impact flux are accounted for.'],
    ['우주기상', 'magnetospheric substorm', 'Stored magnetic energy can be released rapidly into particle acceleration and auroral currents.'],
    ['별형성', 'initial mass function', 'The distribution of stellar birth masses shapes the light, chemistry, and remnant population of a galaxy.'],
    ['중력파천문학', 'waveform chirp', 'A compact binary produces increasing frequency and amplitude as its orbit shrinks before merger.'],
    ['외계생명과학', 'biosignature disequilibrium', 'Coexisting atmospheric gases far from chemical equilibrium may suggest replenishment by an active process.'],
    ['행성대기', 'runaway greenhouse', 'A warming feedback can increase atmospheric water vapor until outgoing radiation no longer balances absorbed energy.'],
    ['시간측정', 'pulsar timing array', 'Correlated timing deviations across stable pulsars can reveal very low-frequency gravitational waves.'],
    ['우주론', 'cosmic variance', 'Observers sample only one finite realization of the universe, limiting precision on the largest scales.'],
  ],
  practical: [
    ['천문대', 'dome slit check', 'Confirm that the dome slit and telescope azimuth agree before slewing above thirty degrees. The software warning does not physically realign the dome.', 'Realign the enclosure before raising the telescope.'],
    ['관측예약', 'weather queue', 'Queue observations postponed by cloud remain active only if investigators update their constraints before noon.', 'Refresh the observing constraints to retain queue eligibility.'],
    ['광학실', 'dark frame set', 'Dark frames must match the exposure time and detector temperature of the science images.', 'Acquire calibration frames under the same detector conditions.'],
    ['전파시설', 'interference log', 'Record local radio interference with start and stop times; deleting contaminated scans alone hides the cause.', 'Preserve a timed account of interference alongside data flags.'],
    ['운석보관', 'meteorite glovebox', 'Samples leave the dry glovebox only in sealed transfer vessels whose humidity indicator is current.', 'Use a verified sealed vessel for movement outside dry storage.'],
    ['레이저측정', 'range safety', 'Satellite ranging pauses whenever an aircraft enters the protected pointing corridor, regardless of target visibility.', 'Suspend laser transmission when the corridor is occupied.'],
    ['관측자료', 'blind catalog', 'Source identities remain masked until the classification criteria and exclusion list are frozen.', 'Finalize analysis rules before revealing object identities.'],
    ['시간동기', 'clock offset', 'Log the observatory clock offset before and after each occultation sequence rather than correcting only the final timestamp.', 'Bracket the observation with independent timing checks.'],
    ['망원경', 'mirror wash', 'Do not wash the primary mirror for cosmetic dust alone; cleaning begins only after the reflectivity and contamination review.', 'Base cleaning on performance evidence and formal review.'],
    ['행성영상', 'navigation kernel', 'Use the released navigation kernel associated with the image batch. A newer preliminary kernel may shift coordinates.', 'Process the batch with its designated geometry release.'],
    ['천문관', 'red light tour', 'Tonight’s public tour uses red pathway lights. Visitors should cover white phone screens before entering the observing deck.', 'Protect dark adaptation by shielding bright displays.'],
    ['우주자료실', 'embargoed alert', 'The transient alert remains internal until the partner observatories complete the coordinated observation window.', 'Delay public distribution until the collaboration window ends.'],
    ['학생관측', 'remote telescope handoff', 'Remote control changes teams at midnight. The outgoing group parks the telescope and transfers the weather log before credentials switch.', 'Complete a parked-state and log handoff before changing operators.'],
    ['분광실', 'lamp warmup', 'The calibration lamp requires its full warmup interval even when the first line appears bright.', 'Wait for spectral stability rather than judging visible brightness.'],
  ],
  email: { topic: '관측 데이터', prompt: 'You discover that an occultation timestamp was corrected using only a single clock reading taken after the event. Write to the observing team. Explain the uncertainty, request that the result be labeled provisional, and propose timing checks for reanalysis and future observations.' },
  discussion: { topic: '우주과학', prompt: 'Professor Bell: Should public agencies spend more on missions searching for potentially habitable exoplanets?', passage: 'Ravi: Such missions drive instrumentation and address a fundamental scientific question.\nElena: Habitability claims remain indirect while urgent Earth-observation missions also need funding.' },
  repeat: { topic: '천문 관측', sentences: ['Welcome to the remote observing session.', 'Review the weather display before opening the dome.', 'Confirm that the telescope is parked at the handoff.', 'Load the calibration sequence before selecting a science target.', 'Record any interruption from clouds or local radio traffic.', 'Protect dark adaptation when entering the observing floor.', 'Before transferring control, park the instrument, save the timing log, and brief the next team on unresolved warnings.'] },
  interview: { topic: '우주 증거', questions: ['Describe an astronomical object known mainly through indirect evidence.', 'Which observation supports its existence?', 'What alternative explanation must be considered?', 'How could a new instrument discriminate between the hypotheses?'] },
}

const FORM_28: ThemeSeed = {
  form: 28,
  logic: [
    ['환경과학', 'nitrogen cascade', 'One atom of reactive nitrogen can move through agriculture, air, water, and ecosystems while causing several effects.'],
    ['산불생태학', 'fire severity mosaic', 'A wildfire can produce a patchwork of burn severities that creates both refuges and heavily altered areas.'],
    ['수문학', 'groundwater lag', 'Contaminants stored in an aquifer may sustain river concentrations long after surface inputs decline.'],
    ['대기화학', 'secondary aerosol', 'Atmospheric reactions transform gaseous precursors into particulate matter after emission.'],
    ['복원생태학', 'shifting baseline', 'Each generation may accept the already-degraded environment of its youth as normal.'],
    ['기후과학', 'compound event', 'Moderate hazards can interact across space or time to create impacts larger than either hazard alone.'],
    ['해양학', 'ocean deoxygenation', 'Warmer water holds less oxygen while stratification and respiration can further reduce ventilation.'],
    ['생태독성학', 'bioaccumulation', 'An organism can retain a contaminant faster than it eliminates the substance.'],
    ['산림과학', 'assisted migration', 'Managers may move populations toward projected suitable climates when natural dispersal appears too slow.'],
    ['도시생태학', 'heat island inequity', 'Tree cover, surface materials, housing, and occupation distribute heat exposure unevenly within a city.'],
    ['보전정책', 'leakage effect', 'Protecting one location can displace extraction or development into an unprotected location.'],
    ['토양학', 'nutrient limitation shift', 'Adding one nutrient can make another resource become the dominant constraint on productivity.'],
    ['해안공학', 'managed retreat', 'Moving infrastructure away from an eroding coast can reduce repeated defense costs while disrupting communities.'],
    ['기후정책', 'additionality test', 'A carbon project earns credible credit only for reductions beyond what would otherwise have occurred.'],
    ['담수생태학', 'environmental flow', 'A river flow regime supports ecosystems through its timing, magnitude, duration, and variability.'],
    ['폐기물관리', 'rebound consumption', 'Efficiency can lower the cost of a service and induce greater use that offsets part of the savings.'],
    ['생물지리학', 'range velocity', 'Species must shift distributions at different rates to track moving climatic conditions.'],
    ['환경정의', 'cumulative exposure', 'Multiple pollutants and social stressors can combine in communities already facing limited adaptive resources.'],
  ],
  practical: [
    ['대기측정', 'filter field blank', 'Carry the field blank through transport and handling without drawing air through it. A laboratory blank cannot reveal contamination at the sampling site.', 'Expose the blank to field handling while keeping the pump off.'],
    ['하천조사', 'upstream sample', 'Collect the upstream bottle before team members enter the channel and disturb sediment.', 'Take the reference sample before wading begins.'],
    ['산불현장', 'hot zone release', 'A burned plot remains closed until the safety officer clears unstable trees; cool weather alone does not reopen it.', 'Wait for a formal hazard clearance before entry.'],
    ['야생동물', 'camera location', 'Public reports may show camera-trap images but must remove coordinates for threatened nesting species.', 'Strip sensitive location data before publication.'],
    ['토양실험', 'composite sample', 'Mix only cores assigned to the same depth interval and management unit. Equal mass does not make unmatched cores comparable.', 'Pool material only within the predefined sampling stratum.'],
    ['수질실험', 'dissolved fraction', 'Filter dissolved-nutrient samples immediately in the field; settling overnight is not equivalent to filtration.', 'Separate the dissolved fraction at collection time.'],
    ['복원현장', 'seed provenance', 'Use seed from the approved provenance zone unless the assisted-migration trial label is attached.', 'Keep ordinary restoration stock within its authorized source region.'],
    ['탄소조사', 'permanence buffer', 'Do not count reserve credits as sold reductions; the buffer exists to replace future reversals.', 'Keep risk-reserve units outside the market total.'],
    ['해안조사', 'dune closure', 'The dune transect closes during nesting. Surveyors use the boardwalk observation points instead of crossing the marked habitat.', 'Collect observations from the designated route during closure.'],
    ['폐기물실', 'battery sorting', 'Tape exposed lithium-battery terminals before placing cells in the designated recycling drum.', 'Insulate the terminals prior to collection.'],
    ['환경센터', 'air alert', 'Tomorrow’s outdoor sampling begins two hours later under the air-quality alert, but refrigerated bottle pickup keeps its original time.', 'Delay field departure while collecting prepared bottles as scheduled.'],
    ['보전회의', 'community transcript', 'The consultation transcript will circulate to speakers for correction before it enters the public planning record.', 'Allow contributors to review the record before release.'],
    ['수문관측', 'well purge', 'Monitoring wells require stabilization of field parameters, not a fixed purge volume, before samples are collected.', 'Use stable measurements to decide when sampling begins.'],
    ['생태자료', 'rare species mask', 'The shared dashboard reports rare-species presence by watershed, while exact points remain in the restricted layer.', 'Use aggregated locations for general access.'],
  ],
  email: { topic: '환경 자료', prompt: 'A public biodiversity dashboard exposes exact coordinates through its downloadable file even though the visible map aggregates rare-species locations. Write to the data manager. Explain the disclosure route, request immediate restriction, and propose a release test covering both display and download layers.' },
  discussion: { topic: '기후적응', prompt: 'Professor Ortega: Should conservation agencies move species beyond their historical ranges as climates warm?', passage: 'Nadia: Assisted migration may prevent extinction when habitats shift faster than natural dispersal.\nFelix: Introduced populations can disrupt recipient ecosystems and forecasts of future habitat remain uncertain.' },
  repeat: { topic: '하천 표본 채취', sentences: ['Welcome to the watershed sampling station.', 'Match each bottle to the analyte on the field sheet.', 'Collect the upstream reference before entering the water.', 'Filter dissolved samples at the time of collection.', 'Keep the field blank closed while handling it normally.', 'Record stabilized well parameters rather than a guessed purge volume.', 'Before leaving, inspect every label, preserve the temperature log, and report any departure from the sampling protocol.'] },
  interview: { topic: '환경 개입', questions: ['Describe an environmental intervention that transfers risk between places.', 'Who receives the intended benefit?', 'Which group or ecosystem might bear an unintended cost?', 'What monitoring would reveal whether the transfer occurred?'] },
}

const FORM_29: ThemeSeed = {
  form: 29,
  logic: [
    ['컴퓨터과학', 'distributed consensus', 'Replicated computers must agree on an ordered state despite delay, failure, and incomplete knowledge.'],
    ['기계학습', 'distribution shift', 'A model trained under one data-generating process can fail when deployment changes inputs or their relationship to outcomes.'],
    ['보안공학', 'side channel leakage', 'Timing, power, cache behavior, or sound can reveal secrets without breaking the underlying algorithm.'],
    ['데이터베이스', 'snapshot isolation', 'Transactions can read a consistent snapshot yet still permit anomalies involving concurrent writes.'],
    ['자연어처리', 'tokenization boundary', 'How text is divided into units affects sequence length, rare forms, and cross-language behavior.'],
    ['인공지능', 'reward specification', 'An optimizing agent can exploit an imperfect objective in ways that satisfy the score but violate the designer’s intent.'],
    ['네트워크', 'congestion control', 'Senders adjust transmission rates using delayed signals about capacity and loss shared across a network.'],
    ['소프트웨어공학', 'technical debt', 'A shortcut can accelerate immediate delivery while increasing the cost and risk of later change.'],
    ['정보검색', 'ranking feedback loop', 'Items shown near the top receive more interaction, which can reinforce their future rank.'],
    ['암호학', 'forward secrecy', 'Ephemeral session keys can protect earlier traffic even if a long-term key is compromised later.'],
    ['분산시스템', 'eventual consistency', 'Replicas may temporarily disagree but converge when updates cease and communication succeeds.'],
    ['인간컴퓨터상호작용', 'automation complacency', 'Reliable automation can reduce vigilance and slow detection of rare failures.'],
    ['알고리즘', 'approximation guarantee', 'A provable bound relates an efficient solution to an optimum that may be infeasible to compute exactly.'],
    ['데이터윤리', 'membership inference', 'An attacker may estimate whether a particular record participated in model training.'],
    ['클라우드컴퓨팅', 'autoscaling lag', 'Resource provisioning reacts after workload signals arrive, leaving transient periods of undercapacity or excess.'],
    ['시각화', 'uncertainty encoding', 'Intervals, ensembles, or distributions communicate information that a single estimate conceals.'],
    ['컴파일러', 'undefined behavior', 'A program outside a language specification’s guarantees permits transformations that surprise programmers.'],
    ['인과추론', 'data provenance', 'A trustworthy result depends on knowing how records were collected, transformed, excluded, and joined.'],
  ],
  practical: [
    ['소프트웨어배포', 'rollback image', 'Keep the last verified deployment image until the new release passes production health checks. A successful build is not a rollback test.', 'Retain and verify the prior image through release validation.'],
    ['보안', 'credential rotation', 'Rotate the exposed service credential before publishing the incident report; deleting the visible log does not revoke the secret.', 'Revoke and replace the credential immediately.'],
    ['데이터베이스', 'schema migration', 'Run the compatibility check before writers adopt the new schema. Read-only success cannot prove old clients will write safely.', 'Validate legacy write behavior before changing producers.'],
    ['기계학습', 'holdout firewall', 'Do not inspect holdout labels while selecting features or thresholds. Create a new evaluation set if the boundary was crossed.', 'Replace a holdout that influenced model selection.'],
    ['접근성', 'keyboard release', 'A web release cannot pass accessibility review while the dialog traps keyboard focus, even if every control has a label.', 'Correct keyboard navigation before approval.'],
    ['로그관리', 'clock synchronization', 'Preserve original event timestamps and record clock offsets; rewriting all times destroys evidence about synchronization error.', 'Store offsets without overwriting source timestamps.'],
    ['클라우드', 'quota alert', 'The quota alert pauses batch admission but leaves interactive jobs running until their next checkpoint.', 'Stop new batch starts while allowing protected work to checkpoint.'],
    ['개인정보', 'deletion tombstone', 'A deletion tombstone must propagate to offline replicas before the identifier can be reused.', 'Confirm replica deletion before recycling the identifier.'],
    ['코드리뷰', 'security thread', 'A security review thread closes only after mitigation is verified or the risk owner records acceptance.', 'Require verified remediation or explicit accountable acceptance.'],
    ['백업', 'restore drill', 'A backup is considered tested only after a clean environment restores and verifies the data, not when an archive checksum alone passes.', 'Demonstrate recovery in an isolated environment.'],
    ['서비스운영', 'canary expansion', 'Tomorrow’s canary remains at five percent until latency and error budgets hold for the entire observation window.', 'Do not expand traffic before the monitoring window completes.'],
    ['데이터공유', 'column quarantine', 'The exported table contains an undocumented identifier column. Access is suspended while ownership and sensitivity are reviewed.', 'Restrict the file until the unknown field is classified.'],
    ['컴퓨팅센터', 'maintenance checkpoint', 'Long jobs must create a restorable checkpoint before Saturday maintenance; a progress message alone is insufficient.', 'Verify a usable saved state before shutdown.'],
    ['보안교육', 'phishing simulation', 'Simulation messages carry an internal campaign marker. If a real credential was entered, report it as an incident rather than only completing training.', 'Escalate actual credential disclosure separately from the exercise.'],
  ],
  email: { topic: '데이터 보안', prompt: 'A shared research export contains an undocumented identifier column that may allow reidentification. Write to the data owner. Explain the exposure, request immediate access suspension, and propose provenance and sensitivity checks before a corrected release.' },
  discussion: { topic: '인공지능 평가', prompt: 'Professor Iqbal: Should high-stakes institutions use predictive models that are more accurate but difficult to explain?', passage: 'Sora: Better prediction can allocate scarce inspections and interventions more effectively.\nMateo: Affected people need to contest errors, and hidden dependencies can encode unfair treatment.' },
  repeat: { topic: '소프트웨어 배포', sentences: ['Welcome to the production release review.', 'Confirm that the rollback image remains available.', 'Check the schema against both old and new clients.', 'Keep holdout labels outside the model-selection workflow.', 'Expand canary traffic only after the observation window.', 'Preserve source timestamps when documenting clock offsets.', 'Before approval, verify the recovery drill, close every security thread, and record the owner of each accepted risk.'] },
  interview: { topic: '자동화 신뢰', questions: ['Describe an automated system people may trust too readily.', 'Why does reliable performance reduce vigilance?', 'What rare failure would be especially harmful?', 'How could the interface keep human oversight effective?'] },
}

const FORM_30: ThemeSeed = {
  form: 30,
  logic: [
    ['미술사', 'pentimento evidence', 'Imaging can reveal an artist’s earlier compositional choice beneath a revised painted surface.'],
    ['음악학', 'historical temperament', 'Tuning systems distribute interval discrepancies differently, changing the character of keys and harmonies.'],
    ['문헌학', 'scribal contamination', 'A copyist can consult more than one exemplar, combining readings that do not fit a simple family tree.'],
    ['건축사', 'adaptive reuse', 'Converting an existing building preserves embodied material while imposing new structural and programmatic demands.'],
    ['고고학', 'ceramic chaîne opératoire', 'Raw-material choice, forming, firing, use, repair, and discard connect pottery to social practice.'],
    ['문화유산', 'authorized heritage discourse', 'Official institutions can privilege monumental expert narratives over community meanings and everyday places.'],
    ['연극학', 'performance ephemerality', 'A script and recording preserve traces of a performance but not the full event experienced by an audience.'],
    ['보존과학', 'solvent gel cleaning', 'A gel can limit solvent penetration and contact time while still altering a vulnerable surface.'],
    ['고전학', 'formulaic composition', 'Repeated phrases can support oral composition and memory without making every performance identical.'],
    ['박물관학', 'provenance gap', 'Missing ownership history can conceal illicit excavation, forced sale, or lawful but undocumented transfer.'],
    ['언어사', 'semantic bleaching', 'A frequently used lexical form can lose specific meaning as it develops a grammatical function.'],
    ['사진사', 'material indexicality', 'A photograph bears a physical or digital relation to a captured event while remaining framed and interpreted.'],
    ['고대사', 'coin hoard terminus', 'The newest securely identified coin establishes an earliest possible burial date, not the exact date of concealment.'],
    ['도시사', 'palimpsest landscape', 'Successive construction, demolition, naming, and reuse leave overlapping traces in an urban environment.'],
    ['문학이론', 'unreliable narration', 'Discrepancies between a narrator’s account and textual evidence invite readers to reconstruct another interpretation.'],
    ['공연예술', 'acoustic reconstruction', 'Models of historical spaces can estimate audibility while relying on uncertain materials, occupancy, and source behavior.'],
    ['기록학', 'archival silence', 'Power and preservation shape which events are documented, retained, described, and made accessible.'],
    ['디지털인문학', 'OCR layout error', 'Page columns, marginalia, damaged type, and historical fonts can cause systematic recognition mistakes.'],
  ],
  practical: [
    ['미술관', 'raking light session', 'Raking-light photography requires the painting to remain fixed while the lamp moves. Do not rotate a fragile panel to change shadow direction.', 'Move the light source rather than the artwork.'],
    ['기록보존', 'humidity acclimation', 'Sealed archive boxes acclimate in the workroom before opening so cold materials do not collect condensation.', 'Let containers reach room conditions while still closed.'],
    ['악기보존', 'string tension', 'Historic instruments on display are tuned below concert pitch unless the conservator authorizes performance setup.', 'Maintain reduced tension for ordinary display.'],
    ['유물대여', 'courier seal', 'The borrowing museum may open the transport crate only with the courier present and the seal number verified.', 'Wait for supervised seal verification before unpacking.'],
    ['필사본실', 'weight placement', 'Use soft weights at blank margins, never over pigment or raised decoration.', 'Support the page without pressing decorated areas.'],
    ['공연기록', 'performer restriction', 'A rehearsal recording marked research-only may be viewed in the archive but cannot appear in a public exhibition.', 'Keep the restricted footage out of public display.'],
    ['고고자료', 'residue sampling', 'Photograph and weigh the vessel before removing residue, and retain an unsampled control area.', 'Document the object and preserve comparison material.'],
    ['도시기록', 'oral history correction', 'Narrators may correct names and factual errors in transcripts without erasing the original audio record.', 'Preserve the source recording while updating the transcript.'],
    ['디지털화', 'color target', 'Include the color target in the first image of every lighting setup, not merely once per day.', 'Capture a reference whenever illumination changes.'],
    ['전시디자인', 'facsimile label', 'A facsimile must be labeled as such even when the original is temporarily displayed elsewhere in the same building.', 'Identify the reproduction at its own display location.'],
    ['박물관', 'gallery vibration test', 'The sculpture gallery remains closed during floor vibration testing, while the adjacent study room opens through its exterior entrance.', 'Use the separate entrance for study-room access.'],
    ['도서관', 'marginalia scan', 'Tomorrow’s scanner update changes the default crop. Operators must test a sacrificial page to ensure marginal notes remain visible.', 'Validate the new crop before scanning collection material.'],
    ['문화재', 'site coordinate request', 'Researchers requesting precise site coordinates need community approval in addition to institutional credentials.', 'Obtain consent from the relevant community authority.'],
    ['공연장', 'acoustic measurement', 'The hall impulse-response test starts after the ventilation system shuts down. Audience seating stays in its performance configuration.', 'Preserve the intended room arrangement during measurement.'],
  ],
  email: { topic: '문화유산 접근', prompt: 'A researcher with institutional credentials requests exact coordinates for a culturally sensitive site, but community approval is absent. Write to the collections director. Explain why credentials alone are insufficient, request that release remain blocked, and propose a consent-verification record.' },
  discussion: { topic: '박물관 윤리', prompt: 'Professor Dubois: Should museums display objects with unresolved gaps in ownership history?', passage: 'Amara: Careful display can expose uncertainty and invite information that helps reconstruct provenance.\nTheo: Exhibition may legitimize possession and create incentives to neglect prior ownership claims.' },
  repeat: { topic: '필사본 디지털화', sentences: ['Welcome to the manuscript imaging room.', 'Allow sealed boxes to acclimate before opening them.', 'Place soft weights only on undecorated margins.', 'Include the color target after every lighting change.', 'Test the crop on a sacrificial page first.', 'Preserve marginal notes even when they appear unrelated.', 'At the end, close each support carefully, reconcile the image count, and return every manuscript to its labeled enclosure.'] },
  interview: { topic: '문화적 소유권', questions: ['Describe a cultural object whose ownership could be disputed.', 'Which evidence would help reconstruct its provenance?', 'How might public display affect the dispute?', 'What responsibilities should the current institution accept?'] },
}

export const AUTHORED_FORM_23_ITEMS = createAdvancedAuthoredForm(materialize(FORM_23))
export const AUTHORED_FORM_24_ITEMS = createAdvancedAuthoredForm(materialize(FORM_24))
export const AUTHORED_FORM_25_ITEMS = createAdvancedAuthoredForm(materialize(FORM_25))
export const AUTHORED_FORM_26_ITEMS = createAdvancedAuthoredForm(materialize(FORM_26))
export const AUTHORED_FORM_27_ITEMS = createAdvancedAuthoredForm(materialize(FORM_27))
export const AUTHORED_FORM_28_ITEMS = createAdvancedAuthoredForm(materialize(FORM_28))
export const AUTHORED_FORM_29_ITEMS = createAdvancedAuthoredForm(materialize(FORM_29))
export const AUTHORED_FORM_30_ITEMS = createAdvancedAuthoredForm(materialize(FORM_30))

export const AUTHORED_FORM_23_IDS = AUTHORED_FORM_23_ITEMS.map((item) => item.id)
export const AUTHORED_FORM_24_IDS = AUTHORED_FORM_24_ITEMS.map((item) => item.id)
export const AUTHORED_FORM_25_IDS = AUTHORED_FORM_25_ITEMS.map((item) => item.id)
export const AUTHORED_FORM_26_IDS = AUTHORED_FORM_26_ITEMS.map((item) => item.id)
export const AUTHORED_FORM_27_IDS = AUTHORED_FORM_27_ITEMS.map((item) => item.id)
export const AUTHORED_FORM_28_IDS = AUTHORED_FORM_28_ITEMS.map((item) => item.id)
export const AUTHORED_FORM_29_IDS = AUTHORED_FORM_29_ITEMS.map((item) => item.id)
export const AUTHORED_FORM_30_IDS = AUTHORED_FORM_30_ITEMS.map((item) => item.id)
