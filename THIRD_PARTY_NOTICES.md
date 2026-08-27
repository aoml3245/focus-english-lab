# Third-party vocabulary data notices

The generated vocabulary dataset in `public/vocabulary.json` incorporates lexical metadata from the following sources.

## Open English–Korean Dictionary

- Source: https://github.com/jhseo1211/open-english-korean-dict
- License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
- Used fields: Korean headword meanings, IPA, CEFR metadata, and part-of-speech metadata used during generation.
- Changes: Entries are selected from the app's original question corpus, lemmatized, matched to contextual senses, supplemented with examples from that corpus, and combined with the generated translations and WordNet data.

The derived lexical dataset is distributed under CC BY-SA 4.0. This notice does not change the license or ownership of the application's independently written question corpus or source code.

## Open English WordNet / Princeton WordNet

- Source: https://en-word.net/
- Downloads and license information: https://en-word.net/downloads
- Princeton WordNet license: https://wordnet.princeton.edu/license-and-commercial-use
- Used fields: English sense definitions and same-sense synonym candidates.

The public repository does not include downloaded dictionary databases, NLTK corpora, Academic Word List source files, research PDFs, model weights, or the local generation environment. Academic-core labels in the checked-in dataset are calculated only from CEFR level and frequency inside this project's original question corpus.

## Kokoro 82M text-to-speech

- JavaScript runtime: https://www.npmjs.com/package/kokoro-js
- Browser model: https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
- License: Apache License 2.0
- Usage: Listening and Speaking prompts can be synthesized locally in the browser with quantized ONNX weights. Model and voice files are downloaded on first use and retained by the browser cache when available.

The repository does not redistribute Kokoro model weights. They are fetched from the model host at runtime under the model's own license.

## JavaScript packages

React, React DOM, Vite and Vitest are MIT-licensed. `kokoro-js` and its Transformers runtime are Apache-2.0 licensed. Exact package versions and transitive dependencies are recorded in `package-lock.json`; installed package contents retain their own licenses and are not checked into this repository.
