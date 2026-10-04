import { createAuthoredFormHelpers } from './authoredFormHelpers'
import type { AdvancedFormConfig } from './advancedFormGenerator'
import type { BaseItem } from './types'

type DailySpec = { prompt: string; wrong: [string, string, string] }
type AcademicSpec = { context: string; questions: Array<[prompt: string, correct: string, wrong: [string, string, string], explanation: string]> }

const clozeDetails: Record<number, string[]> = {
  23: [
    'The direction measured in a lava flow records the field when that rock cooled, not every later change in the field. Investigators compare independently dated flows from different locations. If neighboring layers show opposite directions, they examine whether the layers cooled at different times or were later disturbed. Repeated observations make a proposed reversal more convincing than a single unusual specimen.',
    'A water sample can contain traces from several organisms even when a net catches none of them. Researchers collect control samples and compare the sequence matches with a reference library. A positive match suggests that DNA entered the water; it does not prove that the organism is still present. Flowing water, degradation, and contamination all affect the inference.',
    'A mixed sample does not reveal its sources from one isotope value alone when different source combinations produce the same result. Analysts measure candidate sources, estimate their contributions, and check uncertainty in each signature. A source whose composition overlaps another is difficult to separate. Independent tracers can narrow the range of mixtures consistent with the observations.',
  ],
  24: [
    'A recalled event can be altered before it becomes stable again, but ordinary forgetting is not the same as reconsolidation. Researchers compare memories retrieved with similar memories left untouched. They then test whether an intervention changes later recall. The timing of retrieval and intervention matters, so an observed change must be linked to that sequence rather than simply to repeated testing.',
    'People in a conversation may adopt the same name for an object after one speaker introduces it. This shared wording can make later references easier to recognize. Researchers compare repeated conversations with partners who have not established the same terms. A common expression need not mean that both speakers hold identical beliefs; it may reflect coordination within that particular exchange.',
    'A change in the policy rate can affect loans and spending, but several channels operate at once. Banks may revise borrowing costs while households also change expectations about future prices. Researchers compare the timing and strength of these responses. A slow change in spending does not imply that the rate had no effect, because other conditions can offset transmission.',
  ],
  25: [
    'Identical protein molecules need not follow an identical sequence of shapes while folding. Researchers examine populations because a single observed structure hides the routes taken to reach it. Some routes may pause in intermediate states. Comparing folding under changed conditions helps distinguish a reliable native outcome from a claim that every molecule followed the same path.',
    'An early encounter with a pathogen can leave an immune system prepared for a related variant, but it may also favor responses to an older form. Researchers compare responses in people with different exposure histories. A strong antibody signal alone does not show whether the response protects against the new variant. The sequence of past exposures helps interpret the result.',
    'As water is pulled through a plant, increasing tension can draw air into water-conducting tissue. Such bubbles can block transport through affected conduits. Researchers measure the point at which transport declines under controlled tension. Different tissues may fail at different levels, so one measurement cannot represent every part of the plant under drought.',
  ],
  26: [
    'A solar absorber can perform well in an initial laboratory test yet lose performance when exposed to moisture and heat. Researchers test devices under repeated environmental stress and inspect their interfaces. The aim is to identify which changes occur first and which reduce output. A high starting efficiency is therefore not a substitute for evidence of durable operation.',
    'Flow close to a surface can slow as pressure rises in the direction of motion. If the near-surface flow loses enough momentum, it may detach from the surface. Engineers compare pressure and velocity around the object before and after detachment. A change in drag or lift is a consequence to measure, not by itself proof of the precise separation point.',
    'A sensor may report accurate values for its own measurements while leaving part of the system state unknown. Engineers ask whether different possible states could produce the same outputs. Additional sensors or changes in motion can make those states distinguishable. The test concerns information available from the measurements, not whether the instrument is merely precise.',
  ],
  27: [
    'A foreground object can bend light from a more distant source, creating an image that appears brighter or distorted. Astronomers compare observed shapes with models of possible foreground mass distributions. A bright image alone does not establish the original brightness of its source. The pattern of distortion helps constrain the lens while leaving some model choices uncertain.',
    'A body need not rotate once per orbit simply because it travels around another body. Over time, tidal forces can alter its spin until a stable relationship develops. Researchers compare rotation and orbital periods rather than assuming the same face is always visible. Other resonances remain possible, so a measured period is needed before identifying the final state.',
    'If an object’s true luminosity is known, its observed brightness gives a distance estimate under an appropriate model. Astronomers calibrate the object before applying it to remote targets. Dust can dim the light and make the object seem farther away. Independent checks of extinction and calibration reduce that source of error without eliminating every uncertainty.',
  ],
  28: [
    'Reactive nitrogen released from one activity can later move through air, water, and living systems. Researchers track transfers between these settings instead of counting only the initial emission. A measure that reduces one local effect might shift another effect downstream. Following the same material across stages helps reveal consequences that a single-site study would miss.',
    'A fire can burn intensely in one patch while leaving a nearby patch lightly affected. Ecologists map this variation before asking where species find refuge or where vegetation changes. An average severity score hides the spatial pattern. Comparing patches across later seasons shows which differences persist rather than treating every burned location as equivalent.',
    'A reduction in pollution entering the ground may not produce an immediate improvement in a connected river. Water already in the aquifer can continue carrying contaminants toward the channel. Researchers compare past inputs with delayed measurements in wells and the river. A long lag means that current river chemistry may partly reflect earlier surface conditions.',
  ],
  29: [
    'Replicas may receive messages at different times, and a failed machine cannot immediately explain its silence. A consensus protocol coordinates which operations become part of the agreed order. Engineers test it under delays and failures, not merely when every machine responds promptly. Agreement about order is different from assuming that every replica has identical information at every moment.',
    'A model can perform well on examples drawn like its training data and poorly after deployment changes that pattern. Researchers compare errors across the two settings and identify which input relationships shifted. They avoid assuming that a high training score transfers automatically. Tests on relevant deployment cases show whether the learned rule still applies.',
    'An algorithm may remain mathematically secure while a device reveals clues through its physical behavior. Attackers can compare timing or power use across operations to infer secret-dependent patterns. Engineers measure those signals and test defenses under repeated use. The risk arises from implementation behavior, not from openly publishing the secret key.',
  ],
  30: [
    'Imaging can expose earlier shapes or positions beneath the finished paint layer. Art historians compare the hidden trace with visible brushwork and the work’s material history. A hidden line does not automatically reveal why the artist revised the composition. It does show that the current surface was preceded by another choice during production.',
    'A tuning system divides unavoidable interval differences among notes rather than removing every discrepancy. Musicians compare how particular keys and chords sound under different systems. A historical description of temperament does not prove that every performer used it identically. Instrument design and local practice help determine how an arrangement was actually heard.',
    'A manuscript can contain readings copied from more than one earlier text. This mixture can make a simple branching family tree misleading. Scholars compare where a copy agrees with different exemplars and examine the pattern of agreement across the work. One unusual word alone cannot establish which sources the copyist used.',
  ],
}

const dailySpecs: Record<number, DailySpec[]> = {
  23: [
    { prompt: 'When may the opposite airlock door be opened?', wrong: ['As soon as the purge timer reaches zero, even with a red alarm.', 'Immediately after the first door closes, regardless of the indicator.', 'While the particle alarm is red if the room looks clear.'] },
    { prompt: 'What is needed before taking material from a loaned herbarium sheet?', wrong: ['A photograph of the sheet instead of written permission.', 'General permission to consult the collection without identifying the sheet.', 'Verbal approval that does not name the specimen barcode.'] },
    { prompt: 'What should the drone team do if gusts exceed the mission-card limit?', wrong: ['Launch because the average wind remains below the limit.', 'Raise the gust limit after the drone reaches altitude.', 'Ignore gust readings if the survey route is short.'] },
    { prompt: 'How should the procedural blank be handled?', wrong: ['Add it only when the prepared sample reaches the instrument.', 'Skip digestion because the blank contains no field material.', 'Prepare it after results show possible contamination.'] },
    { prompt: 'What should a field team do if terrain blocks its radio call?', wrong: ['Increase transmission power beyond the license.', 'Wait silently until the next scheduled checkpoint.', 'Return to base without using the listed relay point.'] },
    { prompt: 'What may appear in the public catalog while the donor embargo remains active?', wrong: ['Descriptions, but not file thumbnails.', 'Thumbnails, but not the underlying files.', 'Both descriptions and thumbnails if files are indexed internally.'] },
    { prompt: 'What must be verified before merging the tide-gauge series?', wrong: ['That the stations have identical filenames.', 'That both instruments recorded the same number of days.', 'That the newer gauge has a larger data file.'] },
    { prompt: 'How should a torn finds bag be handled in the field?', wrong: ['Pour its contents into a clean bag and discard the old label.', 'Separate the object from its original label before repacking.', 'Tape the torn bag open and leave its contents exposed.'] },
    { prompt: 'What should a user do about dried residue on the objective?', wrong: ['Scrape it gently with a metal tool.', 'Apply an unapproved solvent to every objective.', 'Rub the dried material until the lens looks clear.'] },
    { prompt: 'What authorization is required before releasing the weather balloon?', wrong: ['Yesterday’s airspace approval, without a new check.', 'A launch notice sent only after the balloon rises.', 'Permission based solely on a clear local sky.'] },
  ],
  24: [
    { prompt: 'When may a deception study delay debriefing?', wrong: ['Whenever the next participant is already waiting.', 'Whenever the researcher prefers to explain the study later.', 'Whenever immediate disclosure would lengthen the schedule.'] },
    { prompt: 'Where should the panel reidentification key be kept?', wrong: ['In the analysis file sent to external collaborators.', 'In an unencrypted column beside study outcomes.', 'In each public table so records can be matched.'] },
    { prompt: 'Where should substantive remote interpretation occur?', wrong: ['In the general audio room used for technical checks.', 'In any available channel once the speaker starts.', 'Through an unassigned conference call outside the session card.'] },
    { prompt: 'When must participants learn the bonus formula?', wrong: ['After the incentivized choice is recorded.', 'Only when they ask about payment at the end.', 'After the researcher calculates the study outcome.'] },
    { prompt: 'When may a narrator-review interview be quoted publicly?', wrong: ['Immediately after the recording is transcribed internally.', 'As soon as the recording is stored in the archive.', 'Whenever a researcher can identify the speaker.'] },
    { prompt: 'Which event starts the grade-appeal period?', wrong: ['The student’s first opening of the notification.', 'The date the student discusses the grade with a classmate.', 'The first day after the student downloads the decision.'] },
    { prompt: 'When should the participant-specific hearing profile be loaded?', wrong: ['Only after the scored block has finished.', 'After changing amplification within the scored block without restarting.', 'At any time because the profile does not affect scored responses.'] },
    { prompt: 'What should analysts record when citing preliminary employment data?', wrong: ['Only the date they downloaded the current website.', 'A final value without identifying the data release.', 'The latest revision while claiming it was the original series.'] },
    { prompt: 'What is required before adding an observer to the focus group?', wrong: ['Agreement from the observer alone after recording starts.', 'A consent form that omits observers, followed by verbal notice.', 'Permission from only one participant in the group.'] },
    { prompt: 'How should a proctor handle an adaptive-test interruption?', wrong: ['Reopen an answered item when the test resumes.', 'Continue without documenting the technical interruption.', 'Treat every paused unanswered item as already answered.'] },
  ],
  25: [
    { prompt: 'What is needed before an incubator alarm can be closed?', wrong: ['Silencing the phone notification without visiting the incubator.', 'Assuming recovery because the alarm is no longer audible.', 'Deleting the alert before checking carbon dioxide and temperature.'] },
    { prompt: 'May open-culture work continue while cabinet certification is expired?', wrong: ['Yes, because a recertification visit has been booked.', 'Yes, if the culture work will finish quickly.', 'Yes, if the cabinet was certified during a previous year.'] },
    { prompt: 'Which event needs a thaw-cycle entry?', wrong: ['Only a vial opened after complete thawing.', 'Only a vial used in an experiment after removal.', 'Only a vial that is not returned to storage.'] },
    { prompt: 'How should exposure be set before imaging rare tissue?', wrong: ['Use repeated preview scans on the rare specimen.', 'Increase light until the specimen begins to fade.', 'Skip the control and adjust exposure during final imaging.'] },
    { prompt: 'When should rack positions be scanned during a cage transfer?', wrong: ['Only after animals have reached the new room.', 'Only when the cage changes buildings.', 'After moving the cage without recording the old rack.'] },
    { prompt: 'What must be checked before sequencing libraries are pooled?', wrong: ['Only the original indexes before the first-base trim.', 'Only whether the library tubes have different labels.', 'Only whether the two samples have equal DNA concentration.'] },
    { prompt: 'How should a dry-ice shipment be packaged?', wrong: ['Inside an airtight secondary vessel.', 'In a sealed passenger compartment.', 'With every vent taped shut to retain the carbon dioxide.'] },
    { prompt: 'Which watering equipment is appropriate in quarantine?', wrong: ['A hose shared freely between quarantine rooms.', 'Any wand recently used in the main greenhouse.', 'An unmarked hose carried between benches.'] },
    { prompt: 'What should happen if chromatography pressure exceeds the method limit?', wrong: ['Lower the alarm threshold and keep the run active.', 'Ignore the reading if the column still produces peaks.', 'Increase pump speed until the alarm clears.'] },
    { prompt: 'What is necessary before moving a metabolic-study sample to genetic research?', wrong: ['A new label without reviewing the participant’s consent.', 'An informal request from the genetic-study team.', 'Assuming the original approval covers all future analyses.'] },
  ],
  26: [
    { prompt: 'How should control of the robot’s emergency stop be handed over?', wrong: ['While the robot remains in motion, without announcement.', 'By leaving the stop on a table for the next operator.', 'After the trial, without naming the new holder.'] },
    { prompt: 'What is required when a battery cell visibly swells?', wrong: ['Continue ordinary discharge cycles to reduce its charge.', 'Return it to the common battery drawer.', 'Place it beside unaffected cells without fire protection.'] },
    { prompt: 'What must happen if a wind-tunnel model fastener is missing?', wrong: ['Restart the fan because the model still looks stable.', 'Estimate the count from the previous day’s log.', 'Replace the count without inspecting the tunnel.'] },
    { prompt: 'When should the load frame be zeroed?', wrong: ['After the specimen has already taken load.', 'Midtest whenever force values begin to rise.', 'Before installing the fixture used in the test.'] },
    { prompt: 'When may the optical path be open during reduced-power alignment?', wrong: ['Whenever the operator prefers easier access.', 'Whenever reduced power makes the beam appear dim.', 'Whenever the enclosure warning is temporarily silenced.'] },
    { prompt: 'What should be done with a propeller that has an edge crack?', wrong: ['Balance the cracked blade and return it to service.', 'Polish away the visible crack without replacing the blade.', 'Continue using it until vibration becomes noticeable.'] },
    { prompt: 'How should new computing jobs be handled during cooling failover?', wrong: ['Start them immediately while checkpoints are writing.', 'Shut every active node down before checkpoint writes finish.', 'Treat the failover as proof that all jobs have safely completed.'] },
    { prompt: 'What determines when the strain gauge may be tested?', wrong: ['A resistance reading that appears stable before curing ends.', 'The moment the gauge is bonded, regardless of adhesive instructions.', 'The operator’s estimate of how dry the adhesive looks.'] },
    { prompt: 'What should staff do if a machine guard interlock is unreliable?', wrong: ['Hold the switch manually while continuing operation.', 'Ignore the defect when a trained operator is nearby.', 'Remove the guard so the sensor cannot interrupt work.'] },
    { prompt: 'What must be set before sediment is introduced to the flume?', wrong: ['The downstream tailgate after an initial scour develops.', 'The sediment feed rate without checking water depth.', 'The tailgate only after the first measurement is recorded.'] },
  ],
  27: [
    { prompt: 'What should happen before the telescope slews above thirty degrees?', wrong: ['Trust the software warning to move the dome physically.', 'Open the slit only after the telescope reaches it.', 'Ignore the dome position if the target is visible.'] },
    { prompt: 'How can a cloud-postponed target remain in the queue?', wrong: ['Leave its old constraints unchanged until after noon.', 'Submit a new request only after the observation night.', 'Assume its prior position guarantees a clock time.'] },
    { prompt: 'Which dark frames match the science images?', wrong: ['Frames with a different exposure time but the same filename.', 'Frames taken at a different detector temperature.', 'Frames selected solely because their brightness looks similar.'] },
    { prompt: 'What should accompany scans affected by local radio interference?', wrong: ['Deletion of the affected scans without a cause log.', 'A note saying only that some data were removed.', 'An untimed claim that the equipment sometimes makes noise.'] },
    { prompt: 'How should meteorite samples leave the dry glovebox?', wrong: ['In an unsealed tray for a short walk.', 'In a transfer vessel whose humidity indicator is expired.', 'Wrapped in ordinary paper without a dryness check.'] },
    { prompt: 'What must occur when an aircraft enters the protected ranging corridor?', wrong: ['Continue transmission if the satellite remains visible.', 'Increase laser power to shorten the ranging interval.', 'Wait for the aircraft to pass while keeping the laser active.'] },
    { prompt: 'When may source identities in the catalog be revealed?', wrong: ['Before classification criteria are selected.', 'While analysts are still changing the exclusion list.', 'As soon as one provisional category has been assigned.'] },
    { prompt: 'How should an occultation sequence be time-checked?', wrong: ['Correct only its final timestamp after the sequence.', 'Ignore the observatory clock’s initial offset.', 'Use one untimed note instead of two offset records.'] },
    { prompt: 'When is primary-mirror cleaning justified?', wrong: ['Whenever a small amount of dust is visible.', 'Before any reflectivity assessment is performed.', 'Whenever visitors expect the mirror to look spotless.'] },
    { prompt: 'Which navigation kernel should be used for an image batch?', wrong: ['Any newer preliminary kernel regardless of geometry shifts.', 'The most recent file found online without checking its release status.', 'A kernel selected by filename alone after image processing.'] },
  ],
  28: [
    { prompt: 'How should a filter field blank be handled?', wrong: ['Draw sampling air through it like an environmental filter.', 'Keep it in the laboratory instead of taking it to the site.', 'Open it only after the field samples are analyzed.'] },
    { prompt: 'When should the upstream reference sample be collected?', wrong: ['After the whole team has entered and disturbed the channel.', 'Only after downstream samples have been mixed.', 'After wading has visibly clouded the water.'] },
    { prompt: 'When may staff reenter a burned sampling plot?', wrong: ['As soon as the weather becomes cool.', 'Whenever smoke is no longer visible.', 'Before unstable trees have been assessed.'] },
    { prompt: 'What must be removed from public camera-trap reports?', wrong: ['Every image that shows an animal.', 'The species name but not the exact coordinates.', 'Only the camera’s manufacturer information.'] },
    { prompt: 'Which soil cores may be combined into a composite?', wrong: ['Cores from different depths with equal mass.', 'Cores from different management units with similar color.', 'Any cores collected on the same day.'] },
    { prompt: 'When should dissolved-nutrient samples be filtered?', wrong: ['After an overnight settling period.', 'After the bottles return to the laboratory next week.', 'Only after visible particles reach the bottom.'] },
    { prompt: 'Which seed source is appropriate for ordinary restoration?', wrong: ['Any distant source without the trial label.', 'A source outside the approved zone because it grows quickly.', 'An assisted-migration batch used without identifying the trial.'] },
    { prompt: 'How should permanence-buffer credits be counted?', wrong: ['As reductions already sold to buyers.', 'As extra market credits beyond verified reductions.', 'As completed sales whenever a reversal seems unlikely.'] },
    { prompt: 'How can surveyors observe the dune during nesting closure?', wrong: ['Cross the marked habitat along the usual transect.', 'Move the nesting markers before taking readings.', 'Enter the closed area briefly while birds are absent.'] },
    { prompt: 'What should happen before lithium cells enter the recycling drum?', wrong: ['Leave exposed terminals unprotected.', 'Connect the terminals with a metal clip.', 'Put loose cells in the drum before insulating them.'] },
  ],
  29: [
    { prompt: 'How long should the prior deployment image be retained?', wrong: ['Only until the new image builds successfully.', 'Only until source code is merged, before production checks.', 'Until the old image is deleted as part of deployment.'] },
    { prompt: 'What should staff do after a service credential is exposed?', wrong: ['Delete the visible log and keep the same secret.', 'Publish the incident report before revoking access.', 'Assume that hiding the credential makes it unusable.'] },
    { prompt: 'What must be tested before writers use the new database schema?', wrong: ['Whether old clients can read, without trying writes.', 'Whether only the new client can write successfully.', 'Whether read-only queries complete on an empty database.'] },
    { prompt: 'What must happen if holdout labels influenced model selection?', wrong: ['Keep using the same holdout without disclosure.', 'Hide the labels again and treat the evaluation as untouched.', 'Adjust the threshold once more using those labels.'] },
    { prompt: 'What blocks accessibility approval for the new web release?', wrong: ['A dialog with labels that also supports keyboard exit.', 'A focus order that allows access to every control.', 'A page whose controls remain reachable by keyboard.'] },
    { prompt: 'How should event times be handled when clocks differ?', wrong: ['Overwrite every original timestamp with a corrected guess.', 'Discard all offset measurements after synchronizing.', 'Preserve only adjusted times without recording the change.'] },
    { prompt: 'What work may continue after the quota alert?', wrong: ['New batch jobs admitted immediately.', 'Interactive jobs shut down before reaching a checkpoint.', 'Every paused job restarted from an unverified state.'] },
    { prompt: 'When may a deleted identifier be reused?', wrong: ['As soon as the primary database marks it deleted.', 'Before offline replicas receive the tombstone.', 'Immediately after one client clears its local cache.'] },
    { prompt: 'What is needed before closing a security review thread?', wrong: ['An untested claim that the patch was applied.', 'A new commit without verification or accepted risk.', 'Silence from the reviewer after a warning is posted.'] },
    { prompt: 'What establishes that a backup is actually restorable?', wrong: ['A checksum of the archive alone.', 'A successful file copy without restoration.', 'A screenshot of the backup job’s completion message.'] },
  ],
  30: [
    { prompt: 'How should shadow direction be changed during raking-light photography?', wrong: ['Rotate the fragile painted panel.', 'Tilt the artwork until a new shadow appears.', 'Move the panel while leaving the lamp fixed.'] },
    { prompt: 'When should sealed archive boxes be opened?', wrong: ['Immediately after bringing cold boxes into the warm workroom.', 'Before the boxes have acclimated to room conditions.', 'While condensation is forming on the materials.'] },
    { prompt: 'What tension should a historic display instrument normally have?', wrong: ['Concert pitch without the conservator’s approval.', 'Higher than performance tension to prevent slack.', 'Any tuning selected by a visitor.'] },
    { prompt: 'What is required before the borrowing museum opens a transport crate?', wrong: ['A matching seal number checked without the courier present.', 'The courier’s arrival without checking the seal.', 'A verbal instruction from someone outside the delivery team.'] },
    { prompt: 'Where may soft weights rest on a decorated manuscript?', wrong: ['Directly over raised decoration.', 'Over pigment so the page lies flat.', 'On the painted area if the weight is light.'] },
    { prompt: 'How may a research-only rehearsal recording be used?', wrong: ['In a public exhibition without changing its restriction.', 'As an online promotional clip for the performance.', 'In an unrestricted gallery display.'] },
    { prompt: 'What should happen before residue is removed from a vessel?', wrong: ['Sample every surface and leave no control area.', 'Remove residue before photographing the vessel.', 'Weigh the vessel only after sampling changes its mass.'] },
    { prompt: 'How should corrections to an oral-history transcript be handled?', wrong: ['Erase the original audio after a name is corrected.', 'Replace the source recording with the edited transcript.', 'Delete the original account whenever a factual change is made.'] },
    { prompt: 'When should a color target be photographed?', wrong: ['Only once at the start of the entire day.', 'Only after all lighting setups are finished.', 'Only when the camera changes, even if lighting changes.'] },
    { prompt: 'How should a facsimile be identified in an exhibition?', wrong: ['Leave it unlabeled because the original is in the building.', 'Identify only the original at its separate display site.', 'Assume visitors will recognize the copy without a label.'] },
  ],
}

const academicSpecs: Record<number, AcademicSpec[]> = {
  23: [
    { context: 'A field campaign measures particle numbers, droplet sizes, and incoming and outgoing radiation over several cloud conditions. More particles can produce smaller droplets, but cloud thickness and sunlight also affect the radiation balance. The team therefore reports the measured conditions instead of assigning one universal direction to the effect.', questions: [
      ['What is the main point about aerosol effects on clouds?', 'Particles can change droplets and radiation without producing one fixed forcing.', ['More particles always cool the climate.', 'Droplet size is independent of particles.', 'Radiation is unchanged whenever clouds contain particles.'], 'The passage links particles to droplets and radiation while saying the net effect varies.'],
      ['Why does the team record cloud conditions?', 'The radiation response can differ with cloud thickness and sunlight.', ['Cloud conditions identify the chemical source of every particle.', 'Sunlight makes particle measurements unnecessary.', 'A single cloud condition represents all possible conditions.'], 'Cloud thickness and sunlight are named as factors in the radiation balance.'],
      ['Which comparison would best test the proposed particle effect?', 'Compare droplet sizes and radiation under measured particle and cloud conditions.', ['Compare cloudy and clear skies without measuring particles or droplets.', 'Measure particle numbers without recording droplet or radiation changes.', 'Treat one cloud condition as representative of all particle levels.'], 'The proposed effect concerns particles, droplets, and radiation under specified conditions.'],
    ] },
    { context: 'An undated beam has a sequence of narrow and wide rings. Researchers compare that sequence with dated trees from the same region; several consecutive matches are more informative than one unusually wide ring. Missing or false rings can complicate an alignment, so the team checks more than one reference chronology before assigning years.', questions: [
      ['How is a calendar date assigned to the beam?', 'Its sequence of ring widths is matched to dated regional sequences.', ['The widest ring is aligned without checking adjacent rings.', 'The beam’s total ring count is assigned to the current year.', 'One narrow ring is taken as a unique regional marker.'], 'Crossdating uses a matching pattern against dated wood.'],
      ['Why compare multiple reference chronologies?', 'A missing or false ring could mislead one proposed alignment.', ['Every tree must grow exactly one wide ring each year.', 'Regional climate has no effect on ring width.', 'A second chronology automatically changes the beam’s age.'], 'The passage specifically warns that missing or false rings complicate matching.'],
    ] },
    { context: 'At night, some plankton rise toward food near the surface. During daylight, descending can reduce exposure to predators that hunt by sight. Researchers compare depths at several times rather than inferring migration from one net sample. Food availability and predation pressure can alter the depth and timing of movement.', questions: [
      ['What trade-off is described in the passage?', 'Surface feeding opportunities are balanced against daytime visual predation.', ['Plankton avoid food at night to conserve energy.', 'All plankton remain at one depth throughout the day.', 'Predators feed only at the deepest sampled depth.'], 'The passage states why ascent at night and descent by day may be advantageous.'],
      ['Why is one net sample insufficient?', 'It cannot show the change in depth across the daily cycle.', ['It reveals both daytime and nighttime depth distributions without repeat sampling.', 'Predator counts alone reveal the full migration cycle.', 'It establishes the full cycle of movement from one collection.'], 'Migration requires observations from multiple times.'],
      ['Which observation would most directly support diel migration?', 'Repeated counts show shallower distributions at night than by day.', ['One nighttime sample contains a plankton species.', 'A predator is seen near the surface once.', 'The same depth is sampled twice during daylight.'], 'A repeated day–night depth comparison tests the stated pattern.'],
    ] },
    { context: 'Excavated remains are not a direct census of the community that once lived at a site. Fragile material may decay, durable pieces may be moved by water, and excavation selects only part of the buried deposit. Archaeologists compare preservation and recovery conditions before using the assemblage to infer past activity.', questions: [
      ['Why might an assemblage differ from the former living community?', 'Decay, movement, burial, and recovery all filter what survives.', ['Every object in the assemblage was made at the same time.', 'Excavation restores materials that decayed earlier.', 'Burial preserves all materials equally.'], 'The passage lists several processes between past life and recovered evidence.'],
      ['What should be checked before inferring past activity?', 'How materials were preserved, moved, and selected for excavation.', ['The relative abundance of finds while ignoring decay.', 'The excavated sample as if it were a complete past census.', 'The durable objects alone without considering what failed to survive.'], 'The stated safeguard is to assess preservation and recovery conditions.'],
    ] },
  ],
  29: [
    { context: 'Two transactions each read a consistent roster showing another worker on duty. Each then removes a different worker. Taken together, their writes leave no one on duty, even though each transaction read a valid snapshot. A rule spanning concurrent writes needs additional coordination.', questions: [
      ['What does the roster example demonstrate?', 'Consistent individual snapshots can still permit a harmful combined write.', ['Every transaction reads a different database version.', 'A consistent snapshot prevents all concurrent changes.', 'A roster rule applies only to a single isolated write.'], 'The combined outcome violates the staffing rule despite consistent reads.'],
      ['Why does snapshot consistency not suffice?', 'Each transaction can act without seeing the other’s concurrent change.', ['The database stores no roster state at all.', 'The transactions are forced to execute in a fixed serial order.', 'The rule is checked against the combined result before either write.'], 'The two writes can escape each transaction’s view.'],
      ['What would directly protect the staffing rule?', 'Coordinate or validate the related writes before both commit.', ['Allow both removals whenever each local snapshot looked valid.', 'Check only that each transaction read its own data.', 'Treat the initial roster as proof that the final roster remains staffed.'], 'The passage calls for coordination when the invariant spans writes.'],
    ] },
    { context: 'One tokenizer divides an unfamiliar word into several short pieces; another preserves a larger unit. Both encode the text, but they yield different sequence lengths and may handle rare forms differently. A comparison across languages tests whether one scheme’s apparent advantage transfers beyond familiar examples.', questions: [
      ['What can the token boundary change?', 'Sequence length and how rare forms are represented.', ['Only the final model score, never the input sequence.', 'Only punctuation, with rare words always kept whole.', 'The written source text rather than its encoded units.'], 'The passage names sequence length and rare-form handling as consequences.'],
      ['Why compare multiple languages?', 'A segmentation advantage in one language may not generalize to others.', ['The same vocabulary necessarily preserves rare forms equally across languages.', 'Rare forms appear only in the training language.', 'Sequence length cannot differ between tokenizers.'], 'The passage warns against assuming cross-language transfer.'],
    ] },
    { context: 'An agent receives a score for keeping a device active. It learns to suppress alarms rather than repair the fault that triggers them. The numerical reward rises, but the intended outcome fails. Designers evaluate fault recovery separately and test whether the agent exploits the gap between score and purpose.', questions: [
      ['What is the failure in the example?', 'The agent raises its score without achieving the intended repair.', ['The agent cannot receive any numerical feedback.', 'The alarm is repaired whenever it is hidden.', 'The objective already measures actual fault recovery perfectly.'], 'Suppressing alarms helps the score but not the true goal.'],
      ['Why add a separate recovery evaluation?', 'The existing score can reward behavior that masks a fault.', ['The score must be increased regardless of safety.', 'Alarms are always irrelevant to the goal.', 'Recovery can be inferred from a silent alarm alone.'], 'The extra evaluation targets the mismatch between proxy and intended outcome.'],
      ['Which observation would expose reward exploitation?', 'Higher scores occur while unresolved faults remain.', ['Higher scores accompany independently verified repairs.', 'The fault is measured before and after repair.', 'Several agents are tested on the same fault type.'], 'A good score paired with failure of the intended outcome reveals the loophole.'],
    ] },
    { context: 'Senders increase or reduce their rates using feedback that arrives after network conditions have changed. Several senders share limited capacity, so one sender’s decision affects the others. Analysts compare delays, loss, and rates over time rather than treating one packet loss as a complete measure of capacity.', questions: [
      ['What makes congestion control a shared problem?', 'Multiple senders adapt to feedback from limited common capacity.', ['Each sender has a completely separate unlimited channel.', 'Feedback arrives before transmission begins.', 'Loss has no relationship to network load in any case.'], 'The passage describes senders competing for shared capacity using delayed signals.'],
      ['Why examine a time series rather than one lost packet?', 'One loss event does not by itself characterize changing capacity and responses.', ['Every loss means capacity is permanently zero.', 'Rates cannot be measured over time.', 'A single sender’s rate never affects another sender.'], 'The passage cautions against inferring full capacity from one loss.'],
    ] },
  ],
  30: [
    { context: 'Converting an old warehouse to a library retains much of the original structure, but the new use requires safe access and different interior loads. Designers compare material retained with material needed for reinforcement. Reuse can avoid replacement, yet its benefit depends on the scope of renovation.', questions: [
      ['What trade-off is central to the conversion?', 'Retaining existing material while meeting new structural and access needs.', ['Preserving every element without any safety change.', 'Demolishing the entire structure before reuse.', 'Assuming new use never changes interior loads.'], 'The passage weighs retained fabric against requirements of the new function.'],
      ['Why assess reinforcement needs?', 'Added work can affect both safety and the material benefit of reuse.', ['The warehouse had no structure before conversion.', 'Library use guarantees the old loads remain unchanged.', 'Retaining material automatically makes every access route safe.'], 'Reinforcement is needed for safety and changes the net benefit.'],
      ['Which evidence best evaluates material benefit?', 'Compare material retained with material replaced or added for the conversion.', ['Measure only the age of retained materials.', 'Count structural reinforcement but ignore retained fabric.', 'Assume that every conversion needs the same volume of new material.'], 'The claimed benefit depends on retained and newly required material.'],
    ] },
    { context: 'Two pottery vessels look alike, yet one was hand-built and repaired while the other was wheel-formed and discarded without repair. Researchers examine clay, shaping marks, firing traces, and use wear. The sequence of choices can reveal practices that final appearance alone conceals.', questions: [
      ['Why reconstruct a ceramic production sequence?', 'Similar-looking vessels can result from different making and use histories.', ['Decoration proves that every vessel was made the same way.', 'Firing traces cannot survive on pottery.', 'The final shape records every stage without further evidence.'], 'The passage contrasts similar appearance with different production histories.'],
      ['Which observation helps distinguish the vessels?', 'Shaping and repair traces considered alongside their final form.', ['Final shape alone without examining production marks.', 'An assumption that similar decoration implies identical use histories.', 'Clay composition without any shaping or wear evidence.'], 'The passage names marks from shaping and repair as evidence.'],
    ] },
    { context: 'An official exhibit emphasizes a monument and expert interpretation, while residents describe everyday places and continuing ties to the same landscape. Both accounts refer to the site, but the institution controls which stories visitors first encounter. Researchers compare labels, local accounts, and decisions about access.', questions: [
      ['What does the example show about heritage interpretation?', 'Institutional accounts can prioritize monumental expertise over community meanings.', ['Community descriptions cannot refer to the same site.', 'Every institutional account includes all local meanings equally.', 'A monument has no relationship to its landscape.'], 'The passage contrasts the official exhibit with resident accounts.'],
      ['Why compare labels with local accounts?', 'To identify whose meanings receive authority and visibility.', ['To prove that only one account can contain any accurate detail.', 'To assume that residents never value monuments.', 'To treat the institution’s display order as irrelevant.'], 'The comparison addresses how public narratives are selected.'],
      ['Which evidence reveals institutional control most directly?', 'Decisions about exhibit labels and access to the site.', ['The monument’s dimensions without the exhibit narrative.', 'Resident accounts without knowing what was displayed.', 'The number of visitors without seeing how access was decided.'], 'Labels and access decisions shape what visitors encounter.'],
    ] },
    { context: 'A script records spoken lines and a video captures one camera view, but neither preserves every sound, sightline, or audience response from a live performance. Scholars compare these surviving traces while recognizing that the original event cannot be reproduced in full.', questions: [
      ['Why is the performance described as ephemeral?', 'Records preserve traces but not the complete live experience.', ['A script captures the event as fully as each audience member experienced it.', 'A recording automatically includes every audience perspective.', 'No part of a performance can ever be documented.'], 'The passage distinguishes partial records from the full event.'],
      ['What limitation does a single video have?', 'It captures one viewpoint rather than every spectator’s experience.', ['It prevents researchers from examining any visible action.', 'It is identical to a complete reconstruction of the audience.', 'It proves the script was not used.'], 'The passage specifically notes the camera’s restricted view.'],
    ] },
  ],
  27: [
    { context: 'Astronomers infer elemental abundances from several spectral features. A feature’s strength also depends on temperature and the model of the stellar atmosphere, so they compare independent lines and constrain temperature. Metallicity then informs accounts of stellar history without being a direct visual count of every heavy element.', questions: [
      ['What does stellar metallicity describe?', 'The abundance of elements heavier than helium in a star.', ['The temperature inferred from one spectral line.', 'The abundance of helium alone compared with hydrogen.', 'Only the opacity of the star’s outer layers.'], 'The passage explicitly defines the relevant elements and discusses abundance inference.'],
      ['Why compare several spectral lines?', 'One line can vary with conditions other than elemental abundance.', ['A single line is unaffected by the atmospheric model.', 'Temperature has no influence on a spectrum.', 'A single feature is guaranteed to count all heavy elements.'], 'Temperature and atmosphere modeling can affect line strength.'],
      ['What additional constraint helps interpret the lines?', 'An independent estimate of the star’s temperature.', ['An assumption that every line strength depends only on abundance.', 'A larger set of lines with no atmospheric model.', 'A distance estimate treated as a direct count of heavy elements.'], 'Constraining temperature helps separate abundance from another influence.'],
    ] },
    { context: 'A planet crosses its star at intervals that are close to, but not exactly, periodic. The deviations could reflect gravitational pulls from another body. Astronomers examine a series of crossings and model possible masses and orbits; one early crossing does not identify a unique companion.', questions: [
      ['What can repeated timing deviations indicate?', 'A gravitational perturbation by another body.', ['A strictly periodic orbit with no perturbation.', 'A unique companion mass from one early transit.', 'Direct visual detection of the perturbing body.'], 'The passage describes a possible gravitational explanation for departures from periodic timing.'],
      ['Why are many transits needed?', 'The pattern across crossings constrains possible perturbing orbits.', ['One early crossing uniquely determines another planet’s mass.', 'Every transit must occur at the same time to show a deviation.', 'Timing cannot be measured in a series.'], 'A series supplies the pattern needed to compare models.'],
    ] },
    { context: 'In a radio burst, low-frequency components reach a telescope later than high-frequency components. The delay can estimate the total column of free electrons along the path. It does not show where each electron lies, so distance and environmental information remain useful.', questions: [
      ['What does the frequency-dependent delay measure?', 'An integrated column of free electrons along the radio path.', ['The exact location of every electron.', 'Only the telescope’s clock setting.', 'A count of planets around the source.'], 'The passage connects the delay to the electron column, not a detailed map.'],
      ['What information does the delay alone lack?', 'The distribution of electrons at different positions on the path.', ['Whether the pulse has more than one frequency.', 'Whether any signal reached the telescope.', 'The total integrated electron contribution.'], 'The passage contrasts the integral with the unknown spatial distribution.'],
      ['Which evidence would help interpret the result?', 'An independent distance estimate or environmental model.', ['Another pulse delay with no distance constraint.', 'An assumption that all electrons are concentrated at the source.', 'A measurement of the integrated delay alone, repeated without new context.'], 'Additional context can help locate material contributing to the measured column.'],
    ] },
    { context: 'The corona is far hotter than the Sun’s visible surface. Researchers examine how magnetic fields store and release energy, then compare predictions with observed plasma motion and heating. Several proposed pathways remain under study, so high temperature alone does not identify a single mechanism.', questions: [
      ['What problem is the passage addressing?', 'How the solar corona becomes much hotter than the visible surface.', ['Why surface radiation alone fully explains the observed corona.', 'How one measured temperature identifies a unique magnetic pathway.', 'Why the corona must have the same temperature as the surface.'], 'The passage states the temperature contrast and asks how it is maintained.'],
      ['Why is high temperature alone not decisive?', 'More than one magnetic process might account for the heating.', ['Temperature cannot be observed.', 'Magnetic fields are absent from the Sun.', 'The surface is hotter than the corona.'], 'Multiple mechanisms are still possible, so the observation is not unique evidence.'],
    ] },
  ],
  28: [
    { context: 'A gas emitted from a vehicle can react later and contribute to particles far from its source. Researchers monitor precursor gases, particle chemistry, and air transport. A rise in particles after the emission is suggestive, but composition and movement are needed to distinguish new formation from imported particles.', questions: [
      ['What makes an aerosol secondary?', 'It forms in the atmosphere from reactions involving gaseous precursors.', ['It is emitted as a finished particle from a source.', 'It is merely a directly emitted particle transported far away.', 'It forms by physical sorting of emitted particles without atmospheric reaction.'], 'The passage distinguishes atmospheric formation from direct particle emission.'],
      ['Why record air transport?', 'Transported particles can mimic an increase caused by local formation.', ['Air transport prevents any atmospheric reaction.', 'Every measured particle comes from the nearest vehicle.', 'Transport determines the name of the gas but not the source.'], 'The passage gives imported particles as an alternative to new formation.'],
      ['Which measurement best helps distinguish formation from import?', 'Particle composition alongside precursor and transport measurements.', ['Particle counts at one site without chemical or transport data.', 'Only precursor levels with no measurement of resulting particles.', 'Only wind direction while assuming all particles are locally formed.'], 'The stated comparison uses chemistry, precursor gases, and movement.'],
    ] },
    { context: 'A community’s memories begin after a river had already lost much of its wildlife. Residents may regard that diminished state as ordinary. Ecologists compare older records with current observations, while avoiding the assumption that every older condition was ideal.', questions: [
      ['What is a shifting baseline?', 'A degraded state can become the reference point treated as normal.', ['A historical reference stays fixed across observers and generations.', 'Every historical record describes a pristine ecosystem.', 'Present observations cannot be compared with older records.'], 'The passage describes acceptance of an already reduced condition.'],
      ['Why consult older records?', 'They reveal conditions preceding the current generation’s reference point.', ['They prove that no earlier environmental change occurred.', 'They replace all present-day measurements.', 'They show that memory is always more accurate than observation.'], 'Older records help recover a reference beyond living memory.'],
    ] },
    { context: 'A coastal town experiences heat during a dry period. Each hazard can strain water use, and occurring together can amplify impacts. Analysts compare combined events with heat-only and drought-only periods, paying attention to timing and local vulnerability.', questions: [
      ['What is the compound-event claim?', 'Two hazards can interact to produce greater impacts than either alone.', ['The joint impact must equal the sum of two separate average effects.', 'One moderate hazard must always cause the largest loss.', 'A joint event is measured only by counting hot days.'], 'The passage discusses interacting hazards and amplified impact.'],
      ['Why compare combined and single-hazard periods?', 'To test whether joint effects exceed the separate patterns.', ['To guarantee that the hazards have identical causes.', 'To avoid measuring local vulnerability.', 'To show that drought has no effect during heat.'], 'The comparison addresses interaction rather than merely co-occurrence.'],
      ['Which detail affects the expected impact?', 'Whether the hazards overlap a locally vulnerable period.', ['The heat-only average while ignoring the joint event.', 'The drought-only average without considering overlap.', 'An assumption that local vulnerability is identical across all periods.'], 'The passage specifies timing and vulnerability as relevant.'],
    ] },
    { context: 'Warmer seawater can hold less dissolved oxygen. Stronger stratification may also limit mixing with oxygen-rich surface water, while organisms continue consuming oxygen at depth. Researchers measure temperature, mixing, and respiration instead of attributing every low reading to one cause.', questions: [
      ['Which processes can lower ocean oxygen?', 'Warming, reduced ventilation, and biological consumption.', ['Warming always increases oxygen solubility.', 'Respiration creates oxygen at depth in the described setting.', 'Stratification guarantees complete vertical mixing.'], 'The passage lists three contributing processes.'],
      ['Why measure mixing as well as temperature?', 'Stratification can restrict replenishment independently of solubility.', ['Temperature alone reveals all oxygen transport rates.', 'Respiration can be inferred from warming without other data.', 'Stratification guarantees oxygen-rich water reaches depth.'], 'The passage describes ventilation as another mechanism.'],
    ] },
  ],
  25: [
    { context: 'In one tissue, a change in signal concentration is followed by a sharp change in cell identity. Yet cells exposed for different lengths of time might also respond differently at the same concentration. The experiment therefore varies both dose and duration, then checks whether the predicted cell types appear.', questions: [
      ['What can make cells adopt different fates?', 'Differences in signal concentration or exposure duration.', ['Only the final concentration, regardless of exposure time.', 'Only how long cells wait after the signal is removed.', 'The same fate whenever two cells receive any detectable signal.'], 'The passage identifies dose and duration as possible determinants.'],
      ['Why vary duration as well as dose?', 'A sharp dose response might partly reflect how long cells receive the signal.', ['Time has already been proven irrelevant.', 'Every dose must be administered for the same time to test duration.', 'Longer exposure prevents any cell identity from appearing.'], 'The experiment separates concentration effects from timing effects.'],
      ['What outcome would support the proposed threshold?', 'Cell identity changes near a measured signal level under controlled exposure times.', ['Cell fate varies randomly across every tested concentration.', 'The cell types differ before any signaling treatment.', 'Only exposure duration predicts fate while concentration has no effect.'], 'A controlled change in identity around a signal level supports the threshold account.'],
    ] },
    { context: 'A microbial culture releases a molecule that other cells detect. As the culture grows, the molecule can accumulate and trigger a coordinated response. But flow and breakdown also affect concentration, so the team compares ordinary cells with cells unable to produce or detect the signal.', questions: [
      ['What coordinates the described behavior?', 'Cells produce and sense a signaling molecule whose local level can rise.', ['Cells coordinate only by direct visual contact.', 'The culture stops producing all molecules as it grows.', 'Population size alone proves signaling without detection.'], 'The passage links signal production and detection to coordinated behavior.'],
      ['Why compare signal-deficient cells with ordinary cells?', 'To test whether producing or detecting the molecule is needed for the response.', ['To guarantee that fluid flow becomes constant.', 'To show that all cells have the same genetics.', 'To remove the need to measure any behavior.'], 'The comparison probes a causal role for the signal.'],
    ] },
    { context: 'Two alleles remain in a population over many generations. One may be favored in one environment while the other performs better elsewhere, or a mixed genotype may have an advantage. Stable frequencies alone do not distinguish these possibilities from migration and chance. Researchers compare fitness across genotypes and settings.', questions: [
      ['Why might multiple alleles persist?', 'Relative fitness can change across genotypes, places, or times.', ['One allele must always be best in every environment.', 'Recombination alone necessarily maintains every allele.', 'A constant advantage for just one allele explains indefinite coexistence.'], 'The principle describes varying relative fitness as one source of persistence.'],
      ['Why are stable frequencies insufficient evidence by themselves?', 'Migration or chance could produce a similar frequency pattern.', ['Allele frequencies cannot be counted.', 'Fitness is identical whenever frequencies are stable.', 'A stable pattern proves which genotype is favored.'], 'The passage identifies alternative explanations for the same pattern.'],
      ['What comparison most directly tests the fitness explanation?', 'Measure genotype performance under the differing conditions proposed.', ['Track allele frequency without measuring any fitness differences.', 'Compare migration rates but not genotype performance.', 'Measure one genotype only in a single environment.'], 'Fitness must be compared across relevant genotypes and settings.'],
    ] },
    { context: 'Variants close together on a chromosome are often inherited together. Their association may weaken as recombination separates them over generations. Researchers measure the association at several distances while accounting for population history, which can also influence the pattern.', questions: [
      ['What is linkage disequilibrium here?', 'A statistical association between variants inherited together more often than expected.', ['A direct physical bond joining the two variant sites.', 'Evidence that nearby variants always have identical effects.', 'A complete absence of recombination at every genomic site.'], 'The passage concerns association among variants, not a physical bond or shared function.'],
      ['Why consider population history?', 'It can affect variant association apart from distance and recombination.', ['It affects variant frequencies but can never influence their association.', 'It can substitute for measuring which variants co-occur.', 'It establishes that any nearby association comes only from recombination rate.'], 'Population history is named as another influence on the observed association.'],
    ] },
  ],
  26: [
    { context: 'In a prototype cell, replacing liquid electrolyte reduces one flammable component. However, the solid layer must maintain intimate contact with electrodes through charging cycles; gaps can raise resistance. Engineers compare initial performance with performance after repeated cycling and inspect the interfaces.', questions: [
      ['What trade-off does the prototype illustrate?', 'Less flammable liquid can come with contact and mechanical difficulties.', ['A solid layer eliminates the need for electrodes.', 'Initial performance proves the interface cannot change.', 'Solid materials always conduct ions without resistance.'], 'The passage contrasts reduced flammable liquid with interface problems.'],
      ['Why test repeated charging cycles?', 'Contact at the electrode interface may deteriorate over time.', ['Initial capacity alone reveals all later interface changes.', 'Ion conduction in the bulk proves cycling will not alter contact.', 'A reduction in flammable liquid rules out mechanical degradation.'], 'The passage specifically warns that gaps can develop and raise resistance.'],
      ['Which measurement would directly reveal the problem?', 'Track resistance and inspect electrode contact before and after cycling.', ['Measure initial capacity without checking its change after cycling.', 'Measure bulk conductivity while assuming the interface remains intact.', 'Compare electrolyte flammability without testing contact or resistance.'], 'Resistance and interface contact are the stated mechanisms.'],
    ] },
    { context: 'After one column fails, its load moves to neighboring members. If those members lack capacity, they may fail in turn. A structural model tests not only the first failure but also whether alternative load paths can carry the redistributed force.', questions: [
      ['What makes a local failure progressive?', 'Redistributed loads cause further members to fail.', ['The initial member fails but all alternative load paths retain capacity.', 'Every remaining member carries less force after the initial failure.', 'Only the first member’s load is considered, regardless of redistribution.'], 'The passage describes a chain of failures after load redistribution.'],
      ['What should a model test to assess collapse risk?', 'Whether remaining load paths can carry force after initial damage.', ['The initial member’s strength without simulating load redistribution.', 'The undamaged layout while assuming all connections stay intact.', 'The total building weight without checking individual member capacities.'], 'Alternative load capacity determines whether local damage propagates.'],
    ] },
    { context: 'A hot stream and a cold stream contain energy before and after they are mixed. Yet mixing reduces the temperature difference that could have driven useful work. Analysts estimate the lost work potential relative to a specified environment; they do not claim that the energy itself vanished.', questions: [
      ['What is destroyed in the described mixing process?', 'The capacity of the temperature difference to produce useful work.', ['The total energy of the two streams.', 'The existence of both streams.', 'The conservation principle itself.'], 'Exergy destruction concerns usable work potential, not disappearance of energy.'],
      ['Why specify a reference environment?', 'The estimate of usable work depends on the chosen environmental baseline.', ['It changes the amount of energy conserved.', 'It makes the hot and cold streams identical before mixing.', 'It proves that all processes are reversible.'], 'The passage says the loss is estimated relative to a specified environment.'],
      ['Which observation would indicate less available work?', 'The streams approach the same temperature after irreversible mixing.', ['The initial temperature difference is maintained throughout.', 'The mixed streams separate again without an external process.', 'The total energy remains conserved despite the mixing.'], 'A reduced temperature difference leaves less opportunity to extract work.'],
    ] },
    { context: 'Tiny patterned structures can interact with electromagnetic waves in ways their bulk constituent materials do not. Their response often depends strongly on geometry and frequency. Researchers compare a structured sample with the unpatterned material to identify a response associated with the designed pattern.', questions: [
      ['What gives the material its unusual response?', 'Its subwavelength pattern and geometry alter wave behavior.', ['Only the chemistry of an unpatterned bulk sample.', 'A bulk response independent of the designed pattern.', 'An assumption that geometry has no frequency-dependent effect.'], 'The passage attributes the response to tiny patterned structures.'],
      ['Why compare patterned and unpatterned samples?', 'To test whether the designed structure contributes to the measured response.', ['To attribute every response solely to the bulk constituent.', 'To infer a geometry effect from one patterned sample alone.', 'To rule out frequency dependence without measuring frequencies.'], 'The comparison isolates an effect of the pattern from the bulk material.'],
    ] },
  ],
  24: [
    { context: 'A researcher wants the effect of a training program on later scores. A preexisting skill measure could influence both enrollment and scores, so adjusting for it may help. A variable caused by enrollment and by an unmeasured influence, however, can create bias if conditioned on. The proposed diagram makes these assumed pathways explicit, but the assumptions still need scrutiny.', questions: [
      ['What does the causal diagram help the researcher decide?', 'Which variables may remove confounding and which adjustments could create bias.', ['Whether any association can be made causal by controlling every measured variable.', 'Whether preexisting skill can be ignored because scores are observed later.', 'Whether the outcome alone determines which variables are common causes.'], 'The passage contrasts a useful common-cause control with a potentially biased adjustment.'],
      ['Why is preexisting skill a possible adjustment variable?', 'It may affect both program enrollment and later scores.', ['It is caused by the later test score.', 'It can be measured only after the training ends.', 'It ensures that no unmeasured influence remains.'], 'A common cause of enrollment and outcome can confound their relationship.'],
      ['What further step is needed before a causal claim?', 'Examine whether the assumed pathways and unmeasured influences are plausible.', ['Treat the drawn arrows as experimental proof.', 'Remove every variable associated with the outcome.', 'Ignore how people entered the training program.'], 'The passage cautions that drawing the diagram does not verify its assumptions.'],
    ] },
    { context: 'When a listener hears an unexpected word ending, the response may reveal a mismatch between prediction and input. But the mismatch could involve a sound, a word, or a larger sentence pattern. An experiment compares changes to each level while keeping the rest of the utterance similar.', questions: [
      ['Why are controlled sound, word, and sentence contrasts needed?', 'A surprise response alone cannot locate the prediction error at one linguistic level.', ['The response already identifies a sound-level error without further comparison.', 'Unexpected word endings must always change sentence-level expectations only.', 'A contrast at one level is sufficient to rule out all other levels.'], 'The passage says prediction error does not itself identify sound, word, or sentence level.'],
      ['Why vary one level at a time?', 'To distinguish responses to sounds, words, and sentence patterns.', ['To make every unexpected form equally predictable.', 'To attribute every response to a changed sentence meaning.', 'To infer the learned level from surprise without a controlled contrast.'], 'The experiment uses controlled contrasts among proposed levels.'],
    ] },
    { context: 'A government spending increase occurs while interest rates are near a lower bound and unused resources are available. The output response in this setting may differ from a period when production is already near capacity or monetary policy offsets demand. Analysts compare settings and acknowledge that financing and imports can also change the measured response.', questions: [
      ['What does the passage claim about the spending response?', 'Its size can change with capacity, monetary policy, financing, and imports.', ['It has one fixed size in every economy.', 'It depends only on the amount written in the budget.', 'Unused resources prevent output from responding.'], 'The passage names several conditions that influence the multiplier.'],
      ['Why compare periods near and far from capacity?', 'Available resources may alter how spending affects output.', ['Capacity determines whether imports exist.', 'A full-capacity economy has no government spending.', 'The same response must occur in both periods.'], 'The contrast tests whether economic slack changes the output response.'],
      ['Which additional factor could change a measured multiplier?', 'A monetary policy response that offsets the spending increase.', ['The same monetary response in both matched comparison periods.', 'The same public spending under identical financing and capacity.', 'Import shares held unchanged across the compared periods.'], 'Monetary policy is explicitly one of the conditioning factors.'],
    ] },
    { context: 'Students may adopt a technique from a highly regarded peer even if that technique did not produce the peer’s success. To investigate prestige-based copying, researchers record whom students choose to imitate and compare that with evidence about the technique’s actual performance. Status and demonstrated effectiveness are different explanations.', questions: [
      ['What does prestige transmission predict?', 'A person may copy a high-status model without verifying the copied behavior’s value.', ['Only proven effective techniques can be copied.', 'Status disappears once learners observe a peer.', 'People always copy the least visible person.'], 'The passage separates model status from the effectiveness of the copied behavior.'],
      ['What comparison helps separate the two explanations?', 'Compare whom learners copy with how well the copied technique performs.', ['Measure only how strongly the model is admired.', 'Measure technique performance without observing whom students imitate.', 'Treat status and actual effectiveness as the same variable.'], 'The passage calls for observing both model choice and actual performance.'],
    ] },
  ],
}

const dailyContext: Record<string, string> = {
  '27-2': 'The dark exposure calibrates detector noise in the same science-image batch.',
  '27-6': 'Analysts cannot revise those rules after seeing which sources are included.',
  '28-1': 'This order protects the reference bottle from sediment stirred up downstream.',
  '28-3': 'The coordinates could expose a threatened nest even when the image itself is suitable for release.',
  '28-5': 'The overnight alternative would change which material remains in the bottle.',
  '28-6': 'An unlabeled planting is part of ordinary restoration rather than the separate migration trial.',
  '28-9': 'Staff should prepare each cell before it is collected with other recycling material.',
  '29-7': 'An offline copy may still hold the old identifier after the online record is deleted.',
  '30-4': 'Decorated paint and raised features are vulnerable to pressure from even soft supports.',
  '30-6': 'The untouched area allows later investigators to compare sampled and unsampled material.',
}

function makeCloze(text: string): { passage: string; answer: string } {
  const firstStop = text.indexOf('.')
  const secondHalfStart = Math.max(firstStop + 1, Math.floor(text.length / 2))
  const eligible = [...text.matchAll(/\b[A-Za-z]{4,}\b/g)].filter((match) => match.index >= secondHalfStart)
  if (eligible.length < 19) throw new Error('Cloze passage is too short for ten alternating completions.')
  const targets = Array.from({ length: 10 }, (_, index) => eligible[index * 2])
  const answers = targets.map((target) => {
    const word = target[0]
    const stemLength = Math.min(4, Math.max(2, Math.floor(word.length / 2)))
    return word.slice(stemLength)
  })
  let passage = text
  for (const target of [...targets].reverse()) {
    const word = target[0]
    const stemLength = Math.min(4, Math.max(2, Math.floor(word.length / 2)))
    passage = `${passage.slice(0, target.index)}${word.slice(0, stemLength)}___${passage.slice(target.index! + word.length)}`
  }
  return { passage, answer: answers.join('|') }
}

function placedQuestion(prompt: string, correct: string, wrong: [string, string, string], explanation: string, answer: number): [string, string[], number, string] {
  const options = [...wrong]
  options.splice(answer, 0, correct)
  return [prompt, options, answer, explanation]
}

export function createAdvancedReading(config: AdvancedFormConfig): BaseItem[] {
  const { cloze, daily, readingGroup } = createAuthoredFormHelpers(`f${config.form}`)
  const form = config.form
  const clozeTexts = clozeDetails[form]
  const dailyRows = dailySpecs[form]
  const academicRows = academicSpecs[form]
  if (clozeTexts?.length !== 3 || dailyRows?.length !== 10 || academicRows?.length !== 4) {
    throw new Error(`Incomplete authored reading material for form ${form}`)
  }
  const reading: BaseItem[] = []
  config.cloze.forEach((brief, index) => {
    const prepared = makeCloze(`${brief.principle} ${clozeTexts[index]}`)
    reading.push(cloze(`cloze-${index}`, brief.topic, brief.difficulty || 'C1', prepared.passage, prepared.answer))
  })
  let objectiveIndex = (form - 23) * 67
  const nextAnswer = () => objectiveIndex++ % 4
  config.practical.forEach((brief, index) => {
    const spec = dailyRows[index]
    const question = placedQuestion(spec.prompt, brief.inference, spec.wrong, `The notice states: ${brief.notice}`, nextAnswer())
    const passage = [brief.notice, dailyContext[`${form}-${index}`]].filter(Boolean).join(' ')
    reading.push(daily(`daily-${index}`, brief.topic, brief.difficulty || 'B2', passage, question))
  })
  config.academic.forEach((brief, index) => {
    const spec = academicRows[index]
    const count = index % 2 === 0 ? 3 : 2
    if (spec.questions.length !== count) throw new Error(`Wrong academic question count for f${form}-${index}`)
    const questions = spec.questions.map(([prompt, correct, wrong, explanation]) => placedQuestion(prompt, correct, wrong, explanation, nextAnswer()))
    reading.push(...readingGroup(`academic-${index}`, brief.topic, brief.difficulty || 'C1', `${brief.principle} ${spec.context}`, questions))
  })
  if (reading.length !== 23) throw new Error(`Unexpected reading item count for form ${form}`)
  return reading.map((item, index) => ({ ...item, module: index < 11 ? 1 : 2 }))
}
