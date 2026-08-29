#!/usr/bin/env python3
"""Build a redistributable learner vocabulary artifact from open sources.

Inputs are intentionally kept out of git. Download them from the sources named in
DATA_LICENSE.md, then pass their local paths to this script.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

TARGET_DEFAULT = 29_976
WORD_RE = re.compile(r"^[a-z][a-z-]{1,29}$")
POS_LABEL = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
LEVEL_WEIGHT = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6}
MATCH_STOPWORDS = {
    "a", "an", "and", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or",
    "someone", "something", "that", "the", "to", "used", "with",
}

# Personal names, fragments, function words and sensitive terms that add little
# value to a TOEFL-oriented memorization list. This is deliberately conservative.
LOW_VALUE = {
    "ain", "aren", "couldn", "didn", "doesn", "don", "hadn", "hasn", "haven", "isn", "ll", "maya",
    "mightn", "mustn", "needn", "prof", "shan", "shouldn", "ve", "wasn", "weren", "won", "wouldn",
    "porn", "porno", "pornography", "motherfucker", "motherfucking", "nigger", "nigga", "cunt",
}

DOMAIN_TOPIC = {
    "noun.cognition": "학술 일반", "noun.communication": "학술 일반", "verb.cognition": "학술 일반",
    "verb.communication": "학술 일반", "adj.all": "학술 일반", "adj.pert": "학술 일반", "adv.all": "학술 일반",
    "noun.process": "자연과학", "noun.phenomenon": "자연과학", "noun.substance": "자연과학",
    "noun.quantity": "자연과학", "noun.plant": "자연과학", "noun.animal": "자연과학",
    "noun.body": "생명·보건", "verb.body": "생명·보건", "noun.feeling": "심리·사회과학",
    "noun.person": "심리·사회과학", "noun.group": "심리·사회과학", "verb.social": "심리·사회과학",
    "verb.emotion": "심리·사회과학", "noun.artifact": "기술·공학", "verb.creation": "기술·공학",
    "noun.time": "역사·인문학", "noun.location": "역사·인문학", "noun.act": "학술 일반",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dictionary", type=Path, required=True, help="Open English-Korean Dictionary words.json")
    parser.add_argument("--wordnet", type=Path, required=True, help="Extracted Open English WordNet JSON directory")
    parser.add_argument("--existing", type=Path, default=Path("private/vocabulary.json"))
    parser.add_argument("--output", type=Path, default=Path("private/vocabulary.json"))
    parser.add_argument("--report", type=Path, default=Path("work/vocabulary/quality-report.json"))
    parser.add_argument("--target", type=int, default=TARGET_DEFAULT)
    return parser.parse_args()


def load_wordnet(directory: Path) -> tuple[dict[str, dict[str, Any]], dict[str, list[str]]]:
    synsets: dict[str, dict[str, Any]] = {}
    synset_domain: dict[str, str] = {}
    for path in sorted(directory.glob("*.json")):
        if path.name.startswith("entries-") or path.name == "frames.json":
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        for synset_id, value in payload.items():
            value["_domain"] = path.stem
            synsets[synset_id] = value
            synset_domain[synset_id] = path.stem

    senses: dict[str, list[str]] = {}
    for path in sorted(directory.glob("entries-*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        for lemma, by_pos in payload.items():
            normalized = lemma.lower().replace("_", " ")
            if " " in normalized:
                continue
            ordered: list[str] = []
            for pos_data in by_pos.values():
                ordered.extend(sense.get("synset", "") for sense in pos_data.get("sense", []))
            senses.setdefault(normalized, []).extend(synset_id for synset_id in ordered if synset_id in synsets)
    return synsets, senses


def clean_definition(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().rstrip(".")


def definition_tokens(value: str) -> set[str]:
    return {
        token for token in re.findall(r"[a-z]+", value.lower())
        if len(token) > 2 and token not in MATCH_STOPWORDS
    }


def inferred_pos(word: str, gloss: str) -> str | None:
    normalized = gloss.lower().strip()
    if word == "very" or word.endswith("ly") or normalized.startswith(("toward ", "in a manner", "to a great degree")):
        return "r"
    if normalized.startswith("to "):
        return "v"
    if normalized.startswith(("a ", "an ", "one who", "what ")) or any(
        marker in normalized for marker in (" person", " manager", " soldier", " place", " object")
    ):
        return "n"
    return None


def best_synset(
    word: str,
    source: dict[str, Any],
    synsets: dict[str, dict[str, Any]],
    senses: dict[str, list[str]],
) -> dict[str, Any] | None:
    """Prefer the WordNet sense whose definition overlaps the bilingual gloss.

    OEWN sense order alone can select the wrong part of speech for ambiguous words
    such as ``employ`` or ``content``. The dictionary's short English gloss is a
    useful, deterministic disambiguation hint even when its POS field is ``other``.
    """
    source_tokens = definition_tokens(str(source.get("meaning_en", "")))
    preferred_pos = inferred_pos(word, str(source.get("meaning_en", "")))
    ranked: list[tuple[int, int, dict[str, Any]]] = []
    for order, synset_id in enumerate(senses.get(word, [])):
        synset = synsets.get(synset_id)
        if not synset or not synset.get("definition") or synset.get("partOfSpeech") not in POS_LABEL:
            continue
        haystack = " ".join([*synset.get("definition", []), *synset.get("members", [])])
        overlap = len(source_tokens & definition_tokens(haystack))
        pos_bonus = 4 if preferred_pos == synset.get("partOfSpeech") else 0
        ranked.append((overlap * 10 + pos_bonus, -order, synset))
    return max(ranked, default=(0, 0, None), key=lambda row: (row[0], row[1]))[2]


def learner_example(word: str, definition: str, meaning_ko: str, part_of_speech: str) -> tuple[str, str]:
    quoted_word = f'“{word}”'
    if part_of_speech == "verb":
        example = f"In this vocabulary set, {quoted_word} describes the action: {definition}."
        translation = f"이 단어장에서 {quoted_word}는 ‘{meaning_ko}’라는 동작을 나타냅니다."
    elif part_of_speech == "adjective":
        example = f"In this vocabulary set, {quoted_word} describes something that is {definition}."
        translation = f"이 단어장에서 {quoted_word}는 ‘{meaning_ko}’의 성질을 나타냅니다."
    elif part_of_speech == "adverb":
        example = f"In this vocabulary set, the adverb {quoted_word} means {definition}."
        translation = f"이 단어장에서 부사 {quoted_word}는 ‘{meaning_ko}’라는 뜻입니다."
    else:
        example = f"In this vocabulary set, {quoted_word} refers to {definition}."
        translation = f"이 단어장에서 {quoted_word}는 ‘{meaning_ko}’라는 뜻입니다."
    return example, translation


def build_entry(word: str, source: dict[str, Any], synset: dict[str, Any]) -> dict[str, Any]:
    definition = clean_definition((source.get("meaning_en") or synset["definition"][0]))
    meaning_ko = clean_definition(source.get("meaning_ko", ""))
    pos_code = synset.get("partOfSpeech", "")
    part_of_speech = POS_LABEL.get(pos_code, "word")
    synonyms: list[str] = []
    for candidate in synset.get("members", []):
        normalized = candidate.lower().replace("_", " ").strip()
        if normalized == word or len(normalized) > 32 or normalized in synonyms:
            continue
        synonyms.append(normalized)
        if len(synonyms) == 3:
            break
    example, translation = learner_example(word, definition, meaning_ko, part_of_speech)
    rank = int(source["freq_rank"])
    cefr = source.get("cefr") if source.get("cefr") in LEVEL_WEIGHT else "C2"
    return {
        "word": word,
        "meaningKo": meaning_ko,
        "meaningEn": definition,
        "partOfSpeech": part_of_speech,
        "cefr": cefr,
        "ipa": source.get("ipa", ""),
        "synonyms": synonyms,
        "example": example,
        "translation": translation,
        "frequency": 0,
        "frequencyRank": rank,
        "topics": [DOMAIN_TOPIC.get(synset.get("_domain", ""), "일반 고급 어휘")],
        "academicCore": cefr in {"B2", "C1", "C2"} and rank <= 20_000,
        "source": "dictionary",
    }


def valid_word(word: str, source: dict[str, Any], synset: dict[str, Any] | None) -> bool:
    return bool(
        WORD_RE.fullmatch(word)
        and word not in LOW_VALUE
        and source.get("meaning_ko")
        and source.get("cefr") in {"B1", "B2", "C1", "C2"}
        and isinstance(source.get("freq_rank"), int)
        and synset
        and synset.get("partOfSpeech") in POS_LABEL
    )


def quality_report(entries: list[dict[str, Any]], target: int) -> dict[str, Any]:
    words = [entry.get("word", "") for entry in entries]
    required = ["word", "meaningKo", "meaningEn", "partOfSpeech", "cefr", "example", "translation", "topics"]
    return {
        "target": target,
        "rows": len(entries),
        "uniqueWords": len(set(words)),
        "duplicateWords": len(words) - len(set(words)),
        "invalidWordForms": sum(not WORD_RE.fullmatch(word) for word in words),
        "missingRequiredFields": {field: sum(not entry.get(field) for entry in entries) for field in required},
        "cefr": dict(sorted(Counter(entry.get("cefr", "") for entry in entries).items())),
        "partOfSpeech": dict(Counter(entry.get("partOfSpeech", "") for entry in entries).most_common()),
        "source": dict(Counter(entry.get("source", "corpus") for entry in entries).most_common()),
        "academicCore": sum(bool(entry.get("academicCore")) for entry in entries),
        "withThreeSynonyms": sum(len(entry.get("synonyms", [])) == 3 for entry in entries),
        "withIpa": sum(bool(entry.get("ipa")) for entry in entries),
    }


def main() -> None:
    args = parse_args()
    if not 1 <= args.target <= 50_000:
        raise SystemExit("--target must be between 1 and 50,000")
    dictionary = json.loads(args.dictionary.read_text(encoding="utf-8"))
    existing = json.loads(args.existing.read_text(encoding="utf-8"))
    synsets, senses = load_wordnet(args.wordnet)

    selected: dict[str, dict[str, Any]] = {}
    for entry in existing:
        word = str(entry.get("word", "")).lower().strip()
        source = dictionary.get(word)
        synset = best_synset(word, source, synsets, senses) if source else None
        if (
            entry.get("source") != "dictionary"
            and WORD_RE.fullmatch(word)
            and word not in LOW_VALUE
            and entry.get("meaningKo")
            and entry.get("meaningEn")
        ):
            selected[word] = {**entry, "word": word, "source": entry.get("source", "corpus")}

    candidates: list[tuple[int, str, dict[str, Any], dict[str, Any]]] = []
    for raw_word, source in dictionary.items():
        word = raw_word.lower().strip()
        if word in selected:
            continue
        synset = best_synset(word, source, synsets, senses)
        if valid_word(word, source, synset):
            candidates.append((int(source["freq_rank"]), word, source, synset))
    candidates.sort(key=lambda row: (row[0], row[1]))

    for _, word, source, synset in candidates:
        if len(selected) >= args.target:
            break
        selected[word] = build_entry(word, source, synset)
    if len(selected) != args.target:
        raise SystemExit(f"Could only build {len(selected):,} valid entries; target was {args.target:,}.")

    entries = sorted(
        selected.values(),
        key=lambda entry: (
            0 if entry.get("source") == "corpus" else 1,
            -int(bool(entry.get("academicCore"))),
            entry.get("frequencyRank", 10**9),
            entry["word"],
        ),
    )
    report = quality_report(entries, args.target)
    if report["rows"] != args.target or report["duplicateWords"] or report["invalidWordForms"] or any(report["missingRequiredFields"].values()):
        raise SystemExit(f"Quality gate failed: {json.dumps(report, ensure_ascii=False)}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
