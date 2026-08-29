#!/usr/bin/env python3
"""Enrich every vocabulary entry with reviewed, part-of-speech-aware senses.

The English definitions and synonyms come from Open English WordNet. Gemma 3
curates a broad English candidate pool, TranslateGemma translates only the
selected senses, and Qwen 3.5 independently checks the Korean and the sense used
by a corpus example. Progress is stored as JSONL so a long review can resume.
"""

from __future__ import annotations

import argparse
import difflib
import fcntl
import json
import os
import re
import time
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from build_vocabulary import POS_LABEL, clean_definition, definition_tokens, load_wordnet

MAX_SENSES = 3
MAX_CANDIDATES = 9
ASCII_ONLY_RE = re.compile(r"^[\x00-\x7f]+$")
UNEXPECTED_SCRIPT_RE = re.compile(r"[\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff]")
HANGUL_RE = re.compile(r"[가-힣]")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("public/vocabulary.json"))
    parser.add_argument("--wordnet", type=Path, default=Path("work/english-wordnet-2025"))
    parser.add_argument("--output", type=Path, default=Path("public/vocabulary.json"))
    parser.add_argument("--selection-cache", type=Path, default=Path("work/vocabulary/semantic-selection-v3.jsonl"))
    parser.add_argument("--draft-cache", type=Path, default=Path("work/vocabulary/semantic-draft-v3.jsonl"))
    parser.add_argument("--validation-cache", type=Path, default=Path("work/vocabulary/semantic-validation-v3.jsonl"))
    parser.add_argument("--context-cache", type=Path, default=Path("work/vocabulary/semantic-context-v3.jsonl"))
    parser.add_argument("--cache", type=Path, default=Path("work/vocabulary/semantic-review-v3.jsonl"))
    parser.add_argument("--report", type=Path, default=Path("work/vocabulary/semantic-quality-report.json"))
    parser.add_argument("--translator-model", default="translategemma:latest")
    parser.add_argument("--curator-model", default="gemma3:4b")
    parser.add_argument("--judge-model", default="qwen3.5:9b")
    parser.add_argument("--context-model", default="gemma3:12b")
    parser.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--limit", type=int, default=0, help="Review only the first N entries for pipeline testing")
    parser.add_argument("--words", default="", help="Comma-separated headwords for targeted regression testing")
    parser.add_argument("--merge", action="store_true", help="Merge a limited/targeted review into the full input artifact")
    parser.add_argument("--lock-file", type=Path, default=Path("work/vocabulary/semantic-review.lock"))
    return parser.parse_args()


def similarity(left: str, right: str) -> float:
    a, b = definition_tokens(left), definition_tokens(right)
    return len(a & b) / max(1, len(a | b))


def hint_similarity(left: str, right: str) -> float:
    """Add morphological matching for terse legacy hints such as capability/capacity."""
    exact = similarity(left, right)
    left_tokens, right_tokens = definition_tokens(left), definition_tokens(right)
    fuzzy_matches = sum(
        max((difflib.SequenceMatcher(None, token, other).ratio() for other in right_tokens), default=0) >= 0.72
        for token in left_tokens
    )
    return max(exact, fuzzy_matches / max(1, len(left_tokens | right_tokens)))


def hint_rank(left: str, right: str) -> tuple[int, float]:
    return (len(definition_tokens(left) & definition_tokens(right)), hint_similarity(left, right))


def sense_candidates(
    entry: dict[str, Any], synsets: dict[str, dict[str, Any]], senses: dict[str, list[str]]
) -> list[dict[str, Any]]:
    available: list[dict[str, Any]] = []
    seen_synsets: set[str] = set()
    for synset_id in senses.get(entry["word"], []):
        synset = synsets.get(synset_id)
        if not synset or synset_id in seen_synsets or synset.get("partOfSpeech") not in POS_LABEL:
            continue
        definitions = synset.get("definition") or []
        if not definitions:
            continue
        definition = clean_definition(definitions[0])
        if any(similarity(definition, item["meaningEn"]) >= 0.78 for item in available):
            continue
        synonyms: list[str] = []
        for member in synset.get("members", []):
            candidate = member.lower().replace("_", " ").strip()
            if candidate != entry["word"] and candidate not in synonyms and len(candidate) <= 36:
                synonyms.append(candidate)
            if len(synonyms) == 3:
                break
        available.append({
            "senseId": synset_id,
            "partOfSpeech": POS_LABEL[synset["partOfSpeech"]],
            "meaningEn": definition,
            "synonyms": synonyms,
        })
        seen_synsets.add(synset_id)

    if not available:
        return [{
            "senseId": f'{entry["word"]}:legacy',
            "partOfSpeech": entry["partOfSpeech"],
            "meaningEn": clean_definition(entry["meaningEn"]),
            "synonyms": entry.get("synonyms", [])[:3],
        }]

    # Offer the curator a broad but balanced pool. The source POS comes first,
    # followed by up to three early senses of every other POS. This prevents an
    # obsolete first noun sense from hiding a common sense such as beat=rhythm.
    source_pos = entry.get("partOfSpeech")
    ordered: list[dict[str, Any]] = []
    used: set[str] = set()
    for wanted_pos in [source_pos, "noun", "verb", "adjective", "adverb"]:
        if not wanted_pos:
            continue
        added_for_pos = 0
        for item in available:
            if item["senseId"] in used or item["partOfSpeech"] != wanted_pos:
                continue
            ordered.append(item)
            used.add(item["senseId"])
            added_for_pos += 1
            if added_for_pos == 3 or len(ordered) == MAX_CANDIDATES:
                break
        if len(ordered) == MAX_CANDIDATES:
            break
    for item in available:
        if item["senseId"] not in used:
            ordered.append(item)
            used.add(item["senseId"])
        if len(ordered) == MAX_CANDIDATES:
            break
    return ordered


def select_batch(
    batch: list[dict[str, Any]], model: str, ollama_url: str,
) -> list[dict[str, Any]]:
    """Use an English-capable curator to retain at most three learner senses."""
    compact = []
    for entry in batch:
        compact.append({
            "w": entry["word"],
            "pos": entry.get("partOfSpeech", ""),
            "hint": entry.get("meaningEn", ""),
            "e": entry.get("example", "") if entry.get("source") == "corpus" else "",
            "s": [[sense["partOfSpeech"], sense["meaningEn"]] for sense in entry["candidateMeanings"]],
        })
    expected = sum(len(entry["candidateMeanings"]) for entry in batch)
    schema = {
        "type": "object",
        "properties": {
            "keep": {"type": "array", "items": {"type": "integer", "minimum": 0, "maximum": 1},
                     "minItems": expected, "maxItems": expected},
            "p": {"type": "array", "items": {"type": "integer", "minimum": 0, "maximum": MAX_CANDIDATES - 1},
                  "minItems": len(batch), "maxItems": len(batch)},
        },
        "required": ["keep", "p"], "additionalProperties": False,
    }
    prompt = (
        "You curate an English-Korean TOEFL learner dictionary before translation. For each word, choose 1-3 "
        "distinct, common modern, academic, or useful general senses. Reject archaic, highly specialist, and near-duplicate "
        "senses. Return one flat keep bit per candidate in exact word/sense order. Return p as the zero-based best sense "
        "for the example e; if e is empty, use the most common useful meaning consistent with pos and hint. p must be kept. "
        "Never select more than 3 per word. INPUT=" + json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
    )
    payload = json.dumps({
        "model": model, "prompt": prompt, "stream": False, "format": schema,
        "think": False,
        "options": {"temperature": 0.05, "num_predict": max(700, len(batch) * 24)},
    }).encode("utf-8")
    request = urllib.request.Request(
        f'{ollama_url.rstrip("/")}/api/generate', data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=600) as response:
        parsed = json.loads(json.loads(response.read()).get("response", ""))
    bits, primaries = parsed.get("keep", []), parsed.get("p", [])
    if len(bits) != expected or len(primaries) != len(batch):
        raise ValueError("Incomplete sense selection")
    results: list[dict[str, Any]] = []
    offset = 0
    for entry, primary_value in zip(batch, primaries):
        count = len(entry["candidateMeanings"])
        primary = int(primary_value)
        if not 0 <= primary < count:
            primary = 0
        same_pos = [
            index for index, sense in enumerate(entry["candidateMeanings"])
            if sense["partOfSpeech"] == entry.get("partOfSpeech")
        ]
        if same_pos:
            if entry.get("source") == "corpus":
                primary = max(
                    same_pos,
                    key=lambda index: hint_rank(entry.get("meaningEn", ""), entry["candidateMeanings"][index]["meaningEn"]),
                )
            else:
                # OEWN's first sense within the source POS is a safer default
                # than a short, sometimes corrupt bilingual legacy gloss.
                primary = same_pos[0]
        chosen = [index for index in range(count) if int(bits[offset + index]) == 1]
        offset += count
        chosen = [primary, *[index for index in chosen if index != primary]]
        if entry.get("source") == "dictionary":
            alternate_pool = [
                index for index, sense in enumerate(entry["candidateMeanings"])
                if sense["partOfSpeech"] != entry["candidateMeanings"][primary]["partOfSpeech"]
            ]
            alternate = max(
                alternate_pool,
                default=None,
                key=lambda index: hint_rank(entry.get("meaningEn", ""), entry["candidateMeanings"][index]["meaningEn"]),
            )
            if (alternate is not None
                    and hint_similarity(entry.get("meaningEn", ""), entry["candidateMeanings"][alternate]["meaningEn"]) > 0
                    ):
                chosen = [index for index in chosen if index != alternate]
                chosen.insert(1, alternate)
        chosen = chosen[:MAX_SENSES]
        if not chosen:
            chosen = [primary]
        results.append({"word": entry["word"], "selected": chosen, "primary": primary, "selectionModel": model})
    return results


def select_batch_resilient(
    batch: list[dict[str, Any]], model: str, ollama_url: str,
) -> list[dict[str, Any]]:
    try:
        return select_batch(batch, model, ollama_url)
    except (ValueError, KeyError, TypeError, json.JSONDecodeError, urllib.error.URLError, TimeoutError):
        if len(batch) == 1:
            raise
        midpoint = len(batch) // 2
        return [
            *select_batch_resilient(batch[:midpoint], model, ollama_url),
            *select_batch_resilient(batch[midpoint:], model, ollama_url),
        ]


def apply_selection(entry: dict[str, Any], selection: dict[str, Any]) -> dict[str, Any]:
    original = entry["candidateMeanings"]
    selected_indices = selection["selected"]
    selected = [original[index] for index in selected_indices]
    primary_original = selection["primary"]
    primary = selected_indices.index(primary_original) if primary_original in selected_indices else 0
    return {**entry, "candidateMeanings": selected, "selectedPrimary": primary}


def load_cache(path: Path) -> dict[str, dict[str, Any]]:
    reviewed: dict[str, dict[str, Any]] = {}
    if not path.exists():
        return reviewed
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
            reviewed[record["word"]] = record
        except (json.JSONDecodeError, KeyError) as error:
            raise SystemExit(f"Invalid review cache line {line_number}: {error}") from error
    return reviewed


def acquire_lock(path: Path):
    """Prevent overlapping reviewers from appending duplicate cache records."""
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = path.open("a+", encoding="utf-8")
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError as error:
        handle.seek(0)
        owner = handle.read().strip() or "unknown process"
        handle.close()
        raise SystemExit(f"Vocabulary review is already running ({owner})") from error
    handle.seek(0)
    handle.truncate()
    handle.write(json.dumps({"pid": os.getpid(), "startedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z")}))
    handle.flush()
    return handle


def compact_cache(path: Path) -> None:
    """Remove harmless duplicate JSONL rows left by an older overlapping run."""
    if not path.exists():
        return
    nonempty_rows = sum(bool(line.strip()) for line in path.read_text(encoding="utf-8").splitlines())
    records = load_cache(path)
    if nonempty_rows == len(records):
        return
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as output:
        for record in records.values():
            output.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        output.flush()
        os.fsync(output.fileno())
    temporary.replace(path)
    print(f"Compacted {path.name}: {nonempty_rows:,} -> {len(records):,} rows", flush=True)


def write_json_atomic(path: Path, value: Any, *, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as output:
        json.dump(value, output, ensure_ascii=False, indent=2 if pretty else None,
                  separators=None if pretty else (",", ":"))
        output.flush()
        os.fsync(output.fileno())
    temporary.replace(path)


def repair_translation(word: str, part_of_speech: str, definition: str, model: str, ollama_url: str) -> str:
    prompt = (
        "You are a professional English (en) to Korean (ko) translator. "
        "Translate the English definition into a concise Korean learner-dictionary gloss of 1-5 words. "
        "Use Hangul, do not use Arabic, Chinese, or Japanese script, and output the Korean gloss only. "
        f'Word: {word}; part of speech: {part_of_speech}; definition: {definition}'
    )
    payload = json.dumps({
        "model": model, "prompt": prompt, "stream": False,
        "think": False,
        "options": {"temperature": 0.05, "num_predict": 80},
    }).encode("utf-8")
    request = urllib.request.Request(
        f'{ollama_url.rstrip("/")}/api/generate', data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        result = json.loads(response.read()).get("response", "").strip().strip('"')
    if not result or not HANGUL_RE.search(result) or UNEXPECTED_SCRIPT_RE.search(result):
        raise ValueError(f"Translation repair failed for {word!r} / {definition!r}: {result!r}")
    return result


def review_word(entry: dict[str, Any], model: str, ollama_url: str) -> dict[str, Any]:
    definitions = [sense["meaningEn"] for sense in entry["candidateMeanings"]]
    numbered = "\n".join(f"{index + 1}. {definition}" for index, definition in enumerate(definitions))
    prompt = (
        f'Translate every numbered English definition of the word "{entry["word"]}" into one concise, natural Korean '
        "learner-dictionary headword gloss, usually 1-5 words. "
        "Prefer forms such as '실제의, 현실의', '모으다, 축적하다', or '이야기의 교훈'; do not mechanically translate the full sentence. "
        "Do not translate the spelling of the word; translate each exact definition. Never merge, omit, add, or reorder meanings. "
        "Use standard Korean terms, include needed objects such as '지뢰를 설치하다', and distinguish parts of speech. "
        "Use Hangul only for Korean words; never emit Arabic, Chinese, or Japanese characters. "
        "Output exactly one numbered Korean line per input and no explanation.\n" + numbered
    )
    payload = json.dumps({
        "model": model, "prompt": prompt, "stream": False,
        "options": {"temperature": 0.05, "num_predict": max(80, len(definitions) * 40)},
    }).encode("utf-8")
    request = urllib.request.Request(
        f'{ollama_url.rstrip("/")}/api/generate', data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=600) as response:
        raw = json.loads(response.read()).get("response", "").strip()
    matches = re.findall(r"(?m)^\s*(\d+)[.)]\s*(.+?)\s*$", raw)
    if len(definitions) == 1 and not matches:
        korean = [raw.strip().strip('"')]
    else:
        by_index = {int(index): value.strip() for index, value in matches}
        korean = [by_index.get(index, "") for index in range(1, len(definitions) + 1)]
    if len(korean) != len(definitions) or any(not value for value in korean):
        korean = [
            repair_translation(entry["word"], sense["partOfSpeech"], sense["meaningEn"], model, ollama_url)
            for sense in entry["candidateMeanings"]
        ]
    return {
        "word": entry["word"], "korean": korean,
        "primary": int(entry.get("selectedPrimary", 0)), "keep": [True] * len(definitions),
    }


def review_batch(
    batch: list[dict[str, Any]], model: str, ollama_url: str, workers: int
) -> list[dict[str, Any]]:
    compact = [{
        "w": entry["word"],
        "s": [[sense["partOfSpeech"], sense["meaningEn"]] for sense in entry["candidateMeanings"]],
    } for entry in batch]
    schema = {
        "type": "object", "properties": {
            "items": {
                "type": "array", "minItems": len(batch), "maxItems": len(batch),
                "items": {
                    "type": "object", "properties": {
                        "w": {"type": "string"},
                        "ko": {"type": "array", "items": {"type": "string"},
                               "minItems": 1, "maxItems": MAX_SENSES},
                    }, "required": ["w", "ko"], "additionalProperties": False,
                },
            },
        }, "required": ["items"], "additionalProperties": False,
    }
    prompt = (
        "You receive items {w,s}. w is context only: NEVER translate w itself. For every item, output the same w and "
        "ko with exactly len(s) strings. ko[i] must be a concise natural Korean learner-dictionary gloss of 1-5 words "
        "translating only English definition s[i][1], using POS s[i][0]. Do not add, omit, merge, shift, or reorder. INPUT="
        + json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
    )
    payload = json.dumps({
        "model": model, "prompt": prompt, "stream": False, "format": schema,
        "options": {"temperature": 0.0, "num_predict": max(300, len(batch) * 36)},
    }).encode("utf-8")
    try:
        request = urllib.request.Request(
            f'{ollama_url.rstrip("/")}/api/generate', data=payload, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(request, timeout=900) as response:
            parsed = json.loads(json.loads(response.read()).get("response", ""))
        by_word = {item["w"]: item["ko"] for item in parsed.get("items", [])}
        reviews = []
        for entry in batch:
            korean = by_word.get(entry["word"], [])
            if len(korean) != len(entry["candidateMeanings"]):
                raise ValueError(f'Batched translation mismatch for {entry["word"]}')
            reviews.append({
                "word": entry["word"], "korean": korean,
                "primary": int(entry.get("selectedPrimary", 0)), "keep": [True] * len(korean),
            })
        return reviews
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        with ThreadPoolExecutor(max_workers=workers) as executor:
            return list(executor.map(lambda entry: review_word(entry, model, ollama_url), batch))


def contextualize_word(entry: dict[str, Any], model: str, ollama_url: str) -> dict[str, Any]:
    schema = {
        "type": "object",
        "properties": {
            "ko": {"type": "string"}, "en": {"type": "string"},
            "pos": {"type": "string", "enum": ["noun", "verb", "adjective", "adverb"]},
        },
        "required": ["ko", "en", "pos"], "additionalProperties": False,
    }
    prompt = (
        "For the exact target word in the sentence, provide its natural Korean learner-dictionary gloss of 1-5 words, "
        "a concise English definition, and part of speech. Define only the target word, not the surrounding phrase or "
        "the whole sentence. For an adjective, return an adjective gloss, not the noun it modifies: acoustic zones means "
        "음향의, not 음향 구역; actual times means 실제의, not 실제 시간. Use the local grammatical context even if "
        "another dictionary sense is more frequent. Use Hangul only in ko; never add Hanja, Chinese, or Japanese text. "
        f'Target: {entry["word"]}\nSentence: {entry["example"]}'
    )
    payload = json.dumps({
        "model": model, "prompt": prompt, "stream": False, "think": False, "format": schema,
        "options": {"temperature": 0.0, "num_predict": 100},
    }).encode("utf-8")
    request = urllib.request.Request(
        f'{ollama_url.rstrip("/")}/api/generate', data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        parsed = json.loads(json.loads(response.read()).get("response", ""))
    korean = str(parsed.get("ko", "")).strip()
    if UNEXPECTED_SCRIPT_RE.search(korean):
        korean = re.sub(r"\s+", " ", UNEXPECTED_SCRIPT_RE.sub("", korean)).strip(" ,;/·")
    english = clean_definition(str(parsed.get("en", "")))
    part_of_speech = str(parsed.get("pos", ""))
    if (not HANGUL_RE.search(korean) or UNEXPECTED_SCRIPT_RE.search(korean) or len(korean) > 35
            or not english or part_of_speech not in {"noun", "verb", "adjective", "adverb"}):
        raise ValueError(f'Invalid contextual gloss for {entry["word"]}: {parsed!r}')
    return {
        "word": entry["word"], "meaningKo": korean, "meaningEn": english,
        "partOfSpeech": part_of_speech, "contextModel": model,
    }


def contextualize_batch(
    batch: list[dict[str, Any]], model: str, ollama_url: str, workers: int,
) -> list[dict[str, Any]]:
    with ThreadPoolExecutor(max_workers=workers) as executor:
        return list(executor.map(lambda entry: contextualize_word(entry, model, ollama_url), batch))


def verify_word(
    entry: dict[str, Any], review: dict[str, Any], validator_model: str, ollama_url: str,
) -> dict[str, Any]:
    count = len(entry["candidateMeanings"])
    supplied = [
        [sense["partOfSpeech"], sense["meaningEn"], review["korean"][index]]
        for index, sense in enumerate(entry["candidateMeanings"])
    ]
    response_schema = {
        "type": "object",
        "properties": {
            "ko": {
                "type": "array", "items": {"type": "string"}, "minItems": count, "maxItems": count,
            },
            "keep": {
                "type": "array", "items": {"type": "integer", "minimum": 0, "maximum": 1},
                "minItems": count, "maxItems": count,
            },
            "p": {"type": "integer", "minimum": 0, "maximum": MAX_SENSES - 1},
        },
        "required": ["ko", "keep", "p"], "additionalProperties": False,
    }
    prompt = (
        "You are the final independent editor of an English-Korean TOEFL learner dictionary. Rewrite every draft as a "
        "natural, concise Korean dictionary gloss, normally 1-5 words; never copy grammar errors or translate the whole "
        "definition. Examples: acoustic(adjective)=음향의, actual(adjective)=실제의, advisor(noun)=조언자 or 지도교수, "
        "increase by gathering=모이다 or 축적되다, mine(noun explosive device)=지뢰, lay mines=지뢰를 설치하다. "
        "Return ko in exact candidate order. keep=1 only for common modern, "
        "academic, or useful general senses; reject archaic, extremely specialist, and near-duplicate senses. Keep 1-3. "
        "p is the zero-based sense used by example, or the most useful common sense when example is empty; p must be kept. "
        f'Word={entry["word"]}; example={entry.get("example", "") if entry.get("source") == "corpus" else ""}; '
        "candidates=" + json.dumps(supplied, ensure_ascii=False, separators=(",", ":"))
    )
    payload = json.dumps({
        "model": validator_model, "prompt": prompt, "stream": False, "format": response_schema,
        "think": False,
        "options": {"temperature": 0.0, "num_predict": 180},
    }).encode("utf-8")
    request = urllib.request.Request(
        f'{ollama_url.rstrip("/")}/api/generate', data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=600) as response:
        parsed = json.loads(json.loads(response.read()).get("response", ""))
    korean, keep = parsed.get("ko", []), parsed.get("keep", [])
    if len(korean) != count or len(keep) != count:
        raise ValueError(f'Incomplete validator review for {entry["word"]}')
    if any(not HANGUL_RE.search(value) or UNEXPECTED_SCRIPT_RE.search(value) or len(value) > 35 for value in korean):
        raise ValueError(f'Invalid Korean validator output for {entry["word"]}: {korean!r}')
    primary = (
        int(review.get("primary", 0)) if entry.get("source") == "dictionary"
        else int(parsed.get("p", review.get("primary", 0)))
    )
    if not 0 <= primary < count:
        primary = int(review.get("primary", 0))
    review["korean"] = korean
    review["keep"] = [bool(value) for value in keep]
    review["keep"][primary] = True
    review["primary"] = primary
    review["validatorModel"] = validator_model
    review["needsRepair"] = []
    return review


def verify_batch(
    batch: list[dict[str, Any]], reviews: list[dict[str, Any]], validator_model: str, ollama_url: str,
    workers: int,
) -> list[dict[str, Any]]:
    if len(batch) != len(reviews):
        raise ValueError("Validator input length mismatch")
    compact = [{
        "w": entry["word"],
        "s": [[sense["partOfSpeech"], sense["meaningEn"], review["korean"][index]]
              for index, sense in enumerate(entry["candidateMeanings"])],
    } for entry, review in zip(batch, reviews)]
    schema = {
        "type": "object", "properties": {
            "items": {
                "type": "array", "minItems": len(batch), "maxItems": len(batch),
                "items": {
                    "type": "object", "properties": {
                        "w": {"type": "string"},
                        "ko": {"type": "array", "items": {"type": "string"},
                               "minItems": 1, "maxItems": MAX_SENSES},
                        "keep": {"type": "array", "items": {"type": "integer", "minimum": 0, "maximum": 1},
                                 "minItems": 1, "maxItems": MAX_SENSES},
                    }, "required": ["w", "ko", "keep"], "additionalProperties": False,
                },
            },
        }, "required": ["items"], "additionalProperties": False,
    }
    prompt = (
        "Final-edit each English-Korean dictionary item. Never translate w itself. Return every same w once; ko and keep "
        "must have exactly len(s) entries in identical order. ko[i] is a concise natural Korean dictionary gloss for the "
        "POS and English definition; correct every draft. keep=1 only for common modern useful meanings; keep 1-3. "
        "Examples: mine excavation=광산; mine explosive device=지뢰; lay mines=지뢰를 설치하다; contract legal "
        "agreement=계약; contract bridge=브리지 계약; beat win=이기다; moral story significance=교훈. INPUT="
        + json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
    )
    payload = json.dumps({
        "model": validator_model, "prompt": prompt, "stream": False, "think": False, "format": schema,
        "options": {"temperature": 0.0, "num_predict": max(400, len(batch) * 42)},
    }).encode("utf-8")
    try:
        request = urllib.request.Request(
            f'{ollama_url.rstrip("/")}/api/generate', data=payload, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(request, timeout=900) as response:
            parsed = json.loads(json.loads(response.read()).get("response", ""))
        by_word = {item["w"]: item for item in parsed.get("items", [])}
        result: list[dict[str, Any]] = []
        for entry, review in zip(batch, reviews):
            item = by_word.get(entry["word"], {})
            korean, keep = item.get("ko", []), item.get("keep", [])
            if len(korean) != len(entry["candidateMeanings"]) or len(keep) != len(korean):
                raise ValueError(f'Batched validation mismatch for {entry["word"]}')
            if any(not HANGUL_RE.search(value) or UNEXPECTED_SCRIPT_RE.search(value) or len(value) > 35 for value in korean):
                raise ValueError(f'Invalid batched Korean for {entry["word"]}')
            primary = int(review.get("primary", 0))
            review["korean"] = korean
            review["keep"] = [bool(value) for value in keep]
            review["keep"][primary] = True
            review["validatorModel"] = validator_model
            review["needsRepair"] = []
            result.append(review)
        return result
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        with ThreadPoolExecutor(max_workers=workers) as executor:
            return list(executor.map(
                lambda pair: verify_word(pair[0], pair[1], validator_model, ollama_url), zip(batch, reviews)
            ))


def repair_review(
    entry: dict[str, Any], review: dict[str, Any], repair_model: str, fallback_model: str, ollama_url: str
) -> dict[str, Any]:
    repaired = 0
    for sense_index in review.get("needsRepair", []):
        sense = entry["candidateMeanings"][sense_index]
        definition = sense["meaningEn"]
        try:
            review["korean"][sense_index] = repair_translation(
                entry["word"], sense["partOfSpeech"], definition, repair_model, ollama_url
            )
        except ValueError:
            review["korean"][sense_index] = repair_translation(
                entry["word"], sense["partOfSpeech"], definition, fallback_model, ollama_url
            )
        repaired += 1
    review.pop("needsRepair", None)
    review["translationModel"] = repair_model
    review["repairedSenses"] = repaired
    return review


def reviewed_entry(
    entry: dict[str, Any], review: dict[str, Any], context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    candidates = entry.pop("candidateMeanings")
    meanings = [
        {**sense, "meaningKo": review["korean"][index]}
        for index, sense in enumerate(candidates)
        if review.get("keep", [True] * len(candidates))[index]
    ]
    if entry.get("source") == "corpus":
        meanings = [sense for sense in meanings if sense["partOfSpeech"] == entry.get("partOfSpeech")]
    primary_index = review.get("primary", 0)
    primary_sense_id = candidates[primary_index]["senseId"]
    primary_position = next((index for index, sense in enumerate(meanings) if sense["senseId"] == primary_sense_id), 0)
    meanings.insert(0, meanings.pop(primary_position))
    if context:
        closest = max(
            meanings,
            default=None,
            key=lambda sense: similarity(context["meaningEn"], sense["meaningEn"]),
        )
        context_korean = context["meaningKo"]
        if context["partOfSpeech"] == "adjective" and " " in context_korean:
            same_pos = [sense for sense in meanings if sense["partOfSpeech"] == "adjective"]
            if same_pos:
                lexical = max(
                    same_pos,
                    key=lambda sense: similarity(entry.get("meaningEn", ""), sense["meaningEn"]),
                )
                context_korean = lexical["meaningKo"]
        context_sense = {
            "senseId": f'{entry["word"]}:context',
            "meaningKo": context_korean, "meaningEn": context["meaningEn"],
            "partOfSpeech": context["partOfSpeech"],
            "synonyms": closest.get("synonyms", []) if closest else entry.get("synonyms", [])[:3],
        }
        meanings = [context_sense, *meanings]
    deduplicated: list[dict[str, Any]] = []
    for sense in meanings:
        normalized_korean = re.sub(r"[\s,·]+", "", sense["meaningKo"])
        if any(
            normalized_korean == re.sub(r"[\s,·]+", "", prior["meaningKo"])
            or similarity(sense["meaningEn"], prior["meaningEn"]) >= 0.72
            for prior in deduplicated
        ):
            continue
        deduplicated.append(sense)
        if len(deduplicated) == MAX_SENSES:
            break
    meanings = deduplicated
    primary = meanings[0]
    return {
        **entry,
        "meaningKo": primary["meaningKo"],
        "meaningEn": primary["meaningEn"],
        "partOfSpeech": primary["partOfSpeech"],
        "synonyms": primary["synonyms"],
        "meanings": meanings,
        "meaningReview": "ollama-consensus-wordnet-v3",
        "translationRepairs": int(review.get("repairedSenses", 0)),
    }


def quality_report(entries: list[dict[str, Any]], cached: int, elapsed: float) -> dict[str, Any]:
    senses = [sense for entry in entries for sense in entry.get("meanings", [])]
    return {
        "rows": len(entries),
        "reviewedRows": sum(entry.get("meaningReview") == "ollama-consensus-wordnet-v3" for entry in entries),
        "cachedRowsAtStart": cached,
        "elapsedSeconds": round(elapsed, 1),
        "totalSenses": len(senses),
        "multiSenseWords": sum(len(entry.get("meanings", [])) > 1 for entry in entries),
        "meaningsByPartOfSpeech": dict(Counter(sense["partOfSpeech"] for sense in senses).most_common()),
        "missingKoreanMeanings": sum(not sense.get("meaningKo", "").strip() for sense in senses),
        "asciiOnlyKoreanMeanings": sum(bool(ASCII_ONLY_RE.fullmatch(sense.get("meaningKo", ""))) for sense in senses),
        "unexpectedScriptMeanings": sum(bool(UNEXPECTED_SCRIPT_RE.search(sense.get("meaningKo", ""))) for sense in senses),
        "duplicateSenseIds": len(senses) - len({(entry["word"], sense["senseId"]) for entry in entries for sense in entry.get("meanings", [])}),
        "translationRepairs": sum(int(entry.get("translationRepairs", 0)) for entry in entries),
    }


def main() -> None:
    args = parse_args()
    if not 1 <= args.batch_size <= 200:
        raise SystemExit("--batch-size must be between 1 and 200")
    if not 1 <= args.workers <= 8:
        raise SystemExit("--workers must be between 1 and 8")
    review_lock = acquire_lock(args.lock_file)
    for cache_path in [args.selection_cache, args.context_cache, args.draft_cache, args.validation_cache, args.cache]:
        compact_cache(cache_path)
    all_entries = json.loads(args.input.read_text(encoding="utf-8"))
    entries = all_entries
    if args.words:
        requested = {word.strip().lower() for word in args.words.split(",") if word.strip()}
        entries = [entry for entry in entries if entry["word"] in requested]
        missing = requested - {entry["word"] for entry in entries}
        if missing:
            raise SystemExit("Unknown --words: " + ", ".join(sorted(missing)))
    if args.limit:
        entries = entries[: args.limit]
    synsets, senses = load_wordnet(args.wordnet)
    pending_entries = [{**entry, "candidateMeanings": sense_candidates(entry, synsets, senses)} for entry in entries]
    selections = load_cache(args.selection_cache)
    drafts = load_cache(args.draft_cache)
    validations = load_cache(args.validation_cache)
    contexts = load_cache(args.context_cache)
    cache = load_cache(args.cache)
    initial_cached = len(cache)
    args.cache.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()

    with args.selection_cache.open("a", encoding="utf-8") as cache_file:
        for entry in pending_entries:
            if entry["word"] in selections or len(entry["candidateMeanings"]) != 1:
                continue
            selection = {
                "word": entry["word"], "selected": [0], "primary": 0,
                "selectionModel": "deterministic-single-sense",
            }
            selections[entry["word"]] = selection
            cache_file.write(json.dumps(selection, ensure_ascii=False, separators=(",", ":")) + "\n")
        cache_file.flush()
        missing_selections = [entry for entry in pending_entries if entry["word"] not in selections]
        for offset in range(0, len(missing_selections), args.batch_size):
            batch = missing_selections[offset : offset + args.batch_size]
            for attempt in range(1, 4):
                try:
                    chosen = select_batch_resilient(batch, args.curator_model, args.ollama_url)
                    break
                except (ValueError, json.JSONDecodeError, urllib.error.URLError, TimeoutError) as error:
                    if attempt == 3:
                        raise SystemExit(f"Selection failed after 3 attempts near {batch[0]['word']}: {error}") from error
                    print(f"Selection retry {attempt}/3 near {batch[0]['word']}: {error}", flush=True)
            for selection in chosen:
                selections[selection["word"]] = selection
                cache_file.write(json.dumps(selection, ensure_ascii=False, separators=(",", ":")) + "\n")
            cache_file.flush()
            print(f"Selected {len(selections):,}/{len(pending_entries):,} words", flush=True)

    pending_entries = [apply_selection(entry, selections[entry["word"]]) for entry in pending_entries]

    missing_contexts = [
        entry for entry in pending_entries if entry.get("source") == "corpus" and entry["word"] not in contexts
    ]
    with args.context_cache.open("a", encoding="utf-8") as cache_file:
        for offset in range(0, len(missing_contexts), args.batch_size):
            batch = missing_contexts[offset : offset + args.batch_size]
            for attempt in range(1, 4):
                try:
                    reviewed_contexts = contextualize_batch(batch, args.context_model, args.ollama_url, args.workers)
                    break
                except (ValueError, json.JSONDecodeError, urllib.error.URLError, TimeoutError) as error:
                    if attempt == 3:
                        raise SystemExit(f"Context review failed after 3 attempts near {batch[0]['word']}: {error}") from error
                    print(f"Context retry {attempt}/3 near {batch[0]['word']}: {error}", flush=True)
            for context in reviewed_contexts:
                contexts[context["word"]] = context
                cache_file.write(json.dumps(context, ensure_ascii=False, separators=(",", ":")) + "\n")
            cache_file.flush()
            print(f"Context-reviewed {len(contexts):,}/{sum(e.get('source') == 'corpus' for e in pending_entries):,} corpus words", flush=True)

    missing_drafts = [entry for entry in pending_entries if entry["word"] not in drafts]
    with args.draft_cache.open("a", encoding="utf-8") as cache_file:
        for offset in range(0, len(missing_drafts), args.batch_size):
            batch = missing_drafts[offset : offset + args.batch_size]
            for attempt in range(1, 4):
                try:
                    reviews = review_batch(batch, args.translator_model, args.ollama_url, args.workers)
                    break
                except (ValueError, json.JSONDecodeError, urllib.error.URLError, TimeoutError) as error:
                    if attempt == 3:
                        raise SystemExit(f"Review failed after 3 attempts near {batch[0]['word']}: {error}") from error
                    print(f"Retry {attempt}/3 near {batch[0]['word']}: {error}", flush=True)
            for review in reviews:
                drafts[review["word"]] = review
                cache_file.write(json.dumps(review, ensure_ascii=False, separators=(",", ":")) + "\n")
            cache_file.flush()
            print(f"Drafted {len(drafts):,}/{len(pending_entries):,} words", flush=True)

    missing_validations = [entry for entry in pending_entries if entry["word"] not in validations]
    with args.validation_cache.open("a", encoding="utf-8") as cache_file:
        for offset in range(0, len(missing_validations), args.batch_size):
            batch = missing_validations[offset : offset + args.batch_size]
            batch_drafts = [dict(drafts[entry["word"]]) for entry in batch]
            for attempt in range(1, 4):
                try:
                    reviews = verify_batch(batch, batch_drafts, args.judge_model, args.ollama_url, args.workers)
                    break
                except (ValueError, json.JSONDecodeError, urllib.error.URLError, TimeoutError) as error:
                    if attempt == 3:
                        raise SystemExit(f"Validation failed after 3 attempts near {batch[0]['word']}: {error}") from error
                    print(f"Validation retry {attempt}/3 near {batch[0]['word']}: {error}", flush=True)
            for review in reviews:
                validations[review["word"]] = review
                cache_file.write(json.dumps(review, ensure_ascii=False, separators=(",", ":")) + "\n")
            cache_file.flush()
            print(f"Validated {len(validations):,}/{len(pending_entries):,} words", flush=True)

    with args.cache.open("a", encoding="utf-8") as cache_file:
        for index, entry in enumerate(pending_entries):
            if entry["word"] in cache:
                continue
            review = repair_review(
                entry, dict(validations[entry["word"]]), args.judge_model, args.translator_model, args.ollama_url
            )
            cache[review["word"]] = review
            cache_file.write(json.dumps(review, ensure_ascii=False, separators=(",", ":")) + "\n")
            cache_file.flush()
            if (index + 1) % 100 == 0 or index + 1 == len(pending_entries):
                print(f"Finalized {len(cache):,}/{len(pending_entries):,} words", flush=True)

    reviewed = [reviewed_entry(entry, cache[entry["word"]], contexts.get(entry["word"])) for entry in pending_entries]
    report = quality_report(reviewed, initial_cached, time.monotonic() - started)
    if (report["reviewedRows"] != len(reviewed) or report["missingKoreanMeanings"]
            or report["asciiOnlyKoreanMeanings"] or report["unexpectedScriptMeanings"] or report["duplicateSenseIds"]):
        raise SystemExit("Semantic quality gate failed: " + json.dumps(report, ensure_ascii=False))
    output_entries = reviewed
    if args.merge:
        reviewed_by_word = {entry["word"]: entry for entry in reviewed}
        output_entries = [reviewed_by_word.get(entry["word"], entry) for entry in all_entries]
        report["outputRows"] = len(output_entries)
        report["mergedReviewedRows"] = len(reviewed_by_word)
    write_json_atomic(args.output, output_entries)
    write_json_atomic(args.report, report, pretty=True)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    review_lock.close()


if __name__ == "__main__":
    main()
