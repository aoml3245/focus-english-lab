# Third-party vocabulary data notices

The generated public vocabulary checkpoints and private build artifact incorporate lexical metadata from the following sources.

## Open English–Korean Dictionary

- Source: https://github.com/jhseo1211/open-english-korean-dict
- License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
- Snapshot: commit `92cbfe63deee1ccead2c42677027d8b4a305b2c7`
- Used fields: Korean headword meanings, English glosses, IPA, CEFR metadata, and frequency ranks.
- Changes: Valid problem-corpus entries are retained; additional B1–C2 entries are selected by frequency, filtered, matched to WordNet senses, and combined with generated definition-oriented study sentences.

The derived lexical dataset is distributed under CC BY-SA 4.0. This notice does not change the license or ownership of the application's independently written question corpus or source code.

## Open English WordNet 2025 / Princeton WordNet

- Source: https://en-word.net/
- Downloads and license information: https://en-word.net/downloads
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- Earlier retained fields may also use Princeton WordNet under its license: https://wordnet.princeton.edu/license-and-commercial-use
- Used fields: English sense definitions, part-of-speech labels, lexical domains, and same-sense synonym candidates.

The public repository does not include downloaded dictionary databases, the full private build artifact, review ledgers, research PDFs, model weights, or the local generation environment. Public browser shards contain only entries that reached a completed 1,000-entry direct-review checkpoint. Academic-core labels combine corpus evidence with CEFR level and dictionary frequency; they are project study aids, not an official TOEFL vocabulary classification.

## Kokoro 82M text-to-speech

- JavaScript runtime: https://www.npmjs.com/package/kokoro-js
- Browser model: https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
- License: Apache License 2.0
- Usage: Listening and Speaking prompts can be synthesized locally in the browser with quantized ONNX weights. Model and voice files are downloaded on first use and retained by the browser cache when available.

The repository does not redistribute Kokoro model weights. They are fetched from the model host at runtime under the model's own license. Browser builds copy the installed ONNX Runtime Web non-JSEP WASM runtime into the deployment during `npm run build`; its MIT license remains governed by the installed package notice.

Kokoro uses the Apache-2.0 `phonemizer` 1.2.1 package for eSpeak-NG phoneme conversion. The build replaces one bundled `ReadableStream` async-iterator loop with the standards-compatible `getReader()` API to avoid an iOS WebKit initialization stall; the package's license and attribution are unchanged. GitHub Pages also includes the MIT-licensed `coi-serviceworker` 0.1.7 script so supported browsers can enable `SharedArrayBuffer` and parallel ONNX WASM without a custom server.

## Local language models used for vocabulary review

- Gemma 3 4B: https://ollama.com/library/gemma3:4b — Gemma Terms of Use; selects useful common senses from the WordNet candidate pool.
- TranslateGemma 4B: https://ollama.com/library/translategemma — Gemma Terms of Use; drafts concise Korean glosses only for selected definitions.
- Qwen 3.5 9B: https://ollama.com/library/qwen3.5:9b — Apache License 2.0; independently edits translations and rejects unsuitable senses.
- Gemma 3 12B: https://ollama.com/library/gemma3:12b — Gemma Terms of Use; checks the contextual primary meaning for problem-derived examples.

Model weights and Ollama caches are local-only and are not committed or redistributed. The checked-in vocabulary artifact contains reviewed text output, WordNet identifiers, and the documented source-derived fields; it does not contain model weights.

## JavaScript packages

React, React DOM, Vite, Vitest, ONNX Runtime Web and `coi-serviceworker` are MIT-licensed. `kokoro-js`, `phonemizer` and the Transformers runtime are Apache-2.0 licensed. Exact package versions and transitive dependencies are recorded in `package-lock.json`; installed package contents retain their own licenses and are not checked into this repository.
