# Vocabulary data license

The public checkpoint under `public/data/vocabulary/` and the private `vocabulary.json` build artifact are separate from the application source and are not covered by the repository's MIT software license. The public checkpoint is distributed under CC BY-SA 4.0; `private/vocabulary.json` remains excluded from Git.

## Open English–Korean Dictionary-derived fields

Korean meanings, English glosses, IPA, CEFR and frequency ranks were derived from [Open English–Korean Dictionary](https://github.com/jhseo1211/open-english-korean-dict) at commit `92cbfe63deee1ccead2c42677027d8b4a305b2c7`, licensed under [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).

The derived fields and the combined vocabulary dataset are redistributed under CC BY-SA 4.0. Changes include retaining valid entries from this project's original question corpus, selecting additional single-word B1–C2 entries by frequency, filtering fragments and unsuitable terms, disambiguating WordNet senses against the dictionary's English gloss, retaining up to three useful part-of-speech-aware senses, directly editing Korean glosses, English definitions, examples, translations and strict synonyms, adding frequency/topic fields, and calculating `academicCore`.

## WordNet-derived fields

English definitions, part-of-speech labels, lexical domains and synonym candidates for added entries include data derived from [Open English WordNet 2025](https://en-word.net/downloads), licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

Some fields retained from the earlier problem-derived vocabulary build may also trace to Princeton WordNet 3.0. WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved. Permission to use, copy, modify and distribute the database for any purpose without fee or royalty is granted subject to retaining the WordNet copyright notice, license statements and disclaimer. Princeton provides the database as-is without warranties and does not grant use of its name for advertising.

Full terms: [`licenses/WORDNET-LICENSE.txt`](./licenses/WORDNET-LICENSE.txt) and [Princeton WordNet license and commercial use](https://wordnet.princeton.edu/license-and-commercial-use).

## Reproducible build

The source databases are not checked into this repository. `private/vocabulary.json`, review ledgers and model caches also remain local-only. The browser artifact is exported only at completed 1,000-entry direct-review checkpoints with `scripts/export_public_vocabulary.py`; its manifest records the exact published count and per-shard hashes. Generated and edited learner sentences are functional study aids, not quotations from either source or from an official TOEFL exam.

## Original corpus fields

Example sentences, Korean example translations, topic labels and frequency counts tied to this project's independently written question corpus remain subject to the licenses stated above when distributed as part of the combined private `vocabulary.json` dataset. The original question corpus in `src/` is not copied from official test questions and is distributed with the source code under the MIT License.
