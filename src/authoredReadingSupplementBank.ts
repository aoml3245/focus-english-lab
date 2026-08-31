import type { BaseItem } from './types'

const academic = (
  id: string,
  topic: string,
  context: string,
  passage: string,
  questions: Array<[string, string[], number, string]>,
): BaseItem[] => questions.map(([prompt, options, answer, explanation], sequenceIndex) => ({
  id: `${id}-${sequenceIndex}`,
  section: 'reading', module: 1, kind: 'multiple-choice', title: 'Read an Academic Passage',
  instruction: '학술 지문을 읽고 중심 내용, 세부 근거, 추론을 구분해 답하세요.',
  topic, context, difficulty: 'C1', timeSeconds: 120, passage, prompt, options, answer, explanation,
  stimulusGroupId: id, sequenceIndex, sourceFamily: 'authored-supplement',
}))

export const AUTHORED_READING_SUPPLEMENT_ITEMS: BaseItem[] = [
  ...academic(
    'a-r-fungal-networks', '식물생태학', '균근 네트워크에 대한 해석',
    'Many plants exchange nutrients with fungi that live around or inside their roots. A single fungal individual can connect with several plants, creating what researchers call a common mycorrhizal network. Experiments show that carbon, nitrogen, or chemical signals can sometimes move through these connections. Popular accounts often describe the network as a cooperative system in which mature trees deliberately feed weaker neighbors. That interpretation goes beyond the evidence. Movement may result from differences in concentration, fungal self-interest, or competition among plants. In addition, experiments that trace a substance from one plant to another do not always show that the receiving plant gains enough to improve its survival. Researchers therefore distinguish the existence of transfer from its ecological importance.',
    [
      ['What is the passage mainly concerned with?', ['Explaining why fungi can survive only when attached to mature trees', 'Distinguishing observed transfers from broader claims about cooperation', 'Showing that all connected plants receive equal amounts of nitrogen', 'Arguing that laboratory tracing methods cannot detect carbon movement'], 1, 'The passage accepts evidence of transfer but cautions against treating it as proof of intentional cooperation or large ecological benefit.'],
      ['Why does the author mention differences in concentration?', ['To provide a noncooperative explanation for the movement of substances', 'To show why receiving plants always grow more quickly', 'To explain how researchers identify individual fungal species', 'To demonstrate that mature trees contain no nitrogen'], 0, 'Concentration gradients could produce transfer without one plant deliberately helping another.'],
      ['What additional evidence would best establish the ecological importance of a transfer?', ['Proof that the substance entered a fungal connection', 'A photograph of roots belonging to two nearby plants', 'A measurable improvement in the receiving plant’s performance', 'The discovery that a mature tree produced the substance first'], 2, 'The final sentence separates detecting movement from showing a meaningful effect on survival or performance.'],
    ],
  ),
  ...academic(
    'a-r-palimpsests', '문헌학', '재사용된 양피지와 다중분광 촬영',
    'In regions where prepared animal skin was expensive, scribes sometimes erased an older manuscript and wrote a new text on the same sheet. Such a reused manuscript is called a palimpsest. Scraping or washing removed most visible ink, but traces often remained within the uneven surface of the skin. Scholars once tried to darken those traces with chemicals, occasionally damaging both layers. Multispectral imaging now offers a less destructive approach. A manuscript is photographed under several wavelengths of light, each of which interacts differently with ink, stains, and parchment. Software combines the images to increase the contrast of the erased writing. The resulting text is not a simple photograph: processing choices can emphasize marks that resemble letters. Specialists must compare multiple images and use knowledge of handwriting and language before accepting a reading.',
    [
      ['Why did scribes create palimpsests?', ['They wanted later scholars to compare two writing systems.', 'Prepared writing material was valuable enough to reuse.', 'Chemical treatments made new ink easier to apply.', 'Older manuscripts could not be stored in libraries.'], 1, 'The opening explains that the cost of prepared animal skin encouraged reuse.'],
      ['What advantage does multispectral imaging have over earlier chemical methods?', ['It can reveal traces without applying damaging substances.', 'It automatically translates every recovered passage.', 'It removes the newer layer of writing permanently.', 'It requires only one photograph in ordinary light.'], 0, 'Imaging changes illumination and digital contrast rather than chemically altering the manuscript.'],
      ['Why must specialists examine more than the processed image?', ['The erased text is always written in an unknown language.', 'Animal skin reflects every wavelength in the same way.', 'Image processing can make ambiguous marks look meaningful.', 'The newer writing contains no information about letter shapes.'], 2, 'Processing may amplify letter-like marks, so readings require comparison and expert interpretation.'],
    ],
  ),
  ...academic(
    'a-r-dawn-chorus', '생물음향학', '새벽 합창과 음향 경쟁',
    'Many bird species sing intensely around sunrise, producing what is known as the dawn chorus. One explanation is that cool, still morning air can transmit some sounds effectively. Another is that feeding is difficult before there is enough light, leaving birds time for signaling. Yet the chorus creates a problem: many species occupy the same acoustic space. Birds may reduce interference by singing at different pitches, repeating songs at different rates, or pausing after a neighbor begins. Researchers studying these patterns must separate deliberate timing from coincidence. If two species become active at slightly different temperatures, their songs may occur at different times even without either bird responding to the other. Playback experiments help distinguish the possibilities by introducing a controlled song and measuring whether a bird changes its timing.',
    [
      ['What is the main purpose of the passage?', ['To prove that cool air is the only cause of the dawn chorus', 'To explain both the concentration of morning song and the difficulty of interpreting song timing', 'To show that birds are unable to hear species with different song pitches', 'To compare feeding rates before and after artificial light is introduced'], 1, 'The passage presents reasons for morning singing, describes acoustic interference, and cautions that timing patterns need experimental interpretation.'],
      ['Why might two species sing at different times without responding to each other?', ['They may become active under different temperature conditions.', 'One species may be unable to produce repeated songs.', 'Their songs always travel in opposite directions.', 'Both species may stop feeding at exactly the same moment.'], 0, 'A shared environmental variable can produce different schedules without direct interaction.'],
      ['How does a playback experiment help the researchers?', ['It changes the morning air temperature for every species.', 'It identifies the amount of food available before sunrise.', 'It tests whether a bird adjusts its timing after a known acoustic cue.', 'It prevents neighboring birds from hearing one another.'], 2, 'A controlled song lets researchers observe whether the focal bird changes behavior in direct response.',
      ],
    ],
  ),
  ...academic(
    'a-r-tooth-isotopes', '생물고고학', '치아 동위원소와 이동 경로',
    'The chemical composition of tooth enamel can help archaeologists investigate where a person spent childhood. As enamel forms, it incorporates strontium from food and water. Ratios of strontium isotopes vary with local geology, and enamel changes very little after formation. Researchers compare a tooth’s ratio with maps built from plants, animals, soils, and water. A mismatch with the burial region may suggest that the individual grew up elsewhere. The inference is not a precise address, however. Distant regions can share similar geology, and food traded across regions can blur the local signal. Different teeth also form at different ages. Sampling more than one tooth may therefore reveal a childhood move, but only if the timing of enamel formation and the range of plausible geological matches are considered.',
    [
      ['Why is tooth enamel useful for studying childhood location?', ['It preserves a chemical signal acquired while the tooth was forming.', 'It changes rapidly whenever an adult enters a new region.', 'It contains a written record of food traded by a community.', 'It has the same isotope ratio in every geological setting.'], 0, 'Enamel incorporates local strontium during formation and is relatively stable afterward.'],
      ['What does a mismatch with the burial region most directly indicate?', ['The burial was moved by modern archaeologists.', 'The person may have lived elsewhere while the sampled tooth formed.', 'The regional isotope map must contain no plant samples.', 'The individual consumed no local food during adulthood.'], 1, 'A nonlocal enamel signal points to residence elsewhere during tooth development, not necessarily at death.'],
      ['Why might researchers analyze more than one tooth from the same person?', ['Different teeth can preserve signals from different childhood periods.', 'A single tooth cannot contain any strontium isotopes.', 'Later teeth always identify an exact town of residence.', 'Comparing teeth removes the need for geological reference maps.'], 0, 'Because teeth form at different ages, their combined signals can reveal movement during childhood.'],
    ],
  ),
]
