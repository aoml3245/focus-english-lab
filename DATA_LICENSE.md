# Vocabulary data license

`public/vocabulary.json` is a separate data artifact and is not covered by the repository's MIT software license.

## Open English–Korean Dictionary-derived fields

Korean meanings, IPA, CEFR and part-of-speech metadata were derived from [Open English–Korean Dictionary](https://github.com/jhseo1211/open-english-korean-dict), licensed under [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).

The derived fields and the combined vocabulary dataset are redistributed under CC BY-SA 4.0. Changes include selecting words from this project's original question corpus, lemmatizing and matching contextual senses, combining corpus examples and translations, adding frequency/topic fields, and calculating `academicCore` from CEFR level and corpus frequency.

## WordNet-derived fields

English definitions and synonym candidates include data derived from Princeton WordNet / Open English WordNet.

WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved. Permission to use, copy, modify and distribute the database for any purpose without fee or royalty is granted subject to retaining the WordNet copyright notice, license statements and disclaimer. Princeton provides the database as-is without warranties and does not grant use of its name for advertising.

Full terms: [`licenses/WORDNET-LICENSE.txt`](./licenses/WORDNET-LICENSE.txt) and [Princeton WordNet license and commercial use](https://wordnet.princeton.edu/license-and-commercial-use).

## Original corpus fields

Example sentences, Korean example translations, topic labels and frequency counts tied to this project's independently written question corpus remain subject to the licenses stated above when distributed as part of the combined `public/vocabulary.json` dataset. The original question corpus in `src/` is not copied from official test questions and is distributed with the source code under the MIT License.
