# Vocabulary data license

`public/vocabulary.json` is a separate data artifact and is not covered by the repository's MIT software license.

## Open English–Korean Dictionary-derived fields

Korean meanings, English glosses, IPA, CEFR and frequency ranks were derived from [Open English–Korean Dictionary](https://github.com/jhseo1211/open-english-korean-dict) at commit `92cbfe63deee1ccead2c42677027d8b4a305b2c7`, licensed under [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).

The derived fields and the combined vocabulary dataset are redistributed under CC BY-SA 4.0. Changes include retaining valid entries from this project's original question corpus, selecting additional single-word B1–C2 entries by frequency, filtering fragments and unsuitable terms, disambiguating WordNet senses against the dictionary's English gloss, retaining up to three useful part-of-speech-aware senses, reviewing Korean glosses with local language models, combining corpus examples and translations, generating definition-oriented learner sentences for additions, adding frequency/topic fields, and calculating `academicCore`.

## WordNet-derived fields

English definitions, part-of-speech labels, lexical domains and synonym candidates for added entries include data derived from [Open English WordNet 2025](https://en-word.net/downloads), licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

Some fields retained from the earlier problem-derived vocabulary build may also trace to Princeton WordNet 3.0. WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved. Permission to use, copy, modify and distribute the database for any purpose without fee or royalty is granted subject to retaining the WordNet copyright notice, license statements and disclaimer. Princeton provides the database as-is without warranties and does not grant use of its name for advertising.

Full terms: [`licenses/WORDNET-LICENSE.txt`](./licenses/WORDNET-LICENSE.txt) and [Princeton WordNet license and commercial use](https://wordnet.princeton.edu/license-and-commercial-use).

## Reproducible build

The source databases are not checked into this repository. After downloading the two sources above, the checked-in artifact can be rebuilt with `scripts/build_vocabulary.py`, then semantically reviewed with `scripts/review_vocabulary.py`. The review uses resumable local-model caches under `work/vocabulary/`, cross-checks every entry with two independent instruction models, and sends only rejected glosses to a translation-specialized model. The current artifact contains the maximum 29,976 entries that pass the documented inputs and filters; the scripts fail if the requested target, required learner fields, model response shape, or Korean-script quality gates are not met. Generated definition sentences are functional learning aids, not quotations from either source or from an official TOEFL exam.

## Original corpus fields

Example sentences, Korean example translations, topic labels and frequency counts tied to this project's independently written question corpus remain subject to the licenses stated above when distributed as part of the combined `public/vocabulary.json` dataset. The original question corpus in `src/` is not copied from official test questions and is distributed with the source code under the MIT License.
