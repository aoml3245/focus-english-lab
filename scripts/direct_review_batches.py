#!/usr/bin/env python3
"""Maintain inspectable, content-addressed progress for direct vocabulary review."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any


REVIEW_FIELDS = (
    "word", "meaningKo", "meaningEn", "partOfSpeech", "synonyms", "example", "translation", "meanings",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("private/vocabulary.json"))
    parser.add_argument("--ledger", type=Path, default=Path("work/vocabulary/direct-review-ledger.jsonl"))
    parser.add_argument("--current", type=Path, default=Path("work/vocabulary/direct-review-current.json"))
    parser.add_argument("--next", type=int, default=0, metavar="N")
    parser.add_argument("--accept-current", action="store_true")
    parser.add_argument("--status", action="store_true")
    return parser.parse_args()


def digest(entry: dict[str, Any]) -> str:
    payload = {field: entry.get(field) for field in REVIEW_FIELDS}
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def load_ledger(path: Path) -> dict[str, str]:
    accepted: dict[str, str] = {}
    if not path.exists():
        return accepted
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            record = json.loads(line)
            accepted[record["word"]] = record["digest"]
    return accepted


def ordered(vocabulary: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(vocabulary, key=lambda entry: (
        0 if entry.get("source") == "corpus" else 1,
        entry.get("frequencyRank", 10**9),
        entry["word"],
    ))


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    temporary.replace(path)


def compact(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "word": entry["word"], "source": entry.get("source"), "cefr": entry.get("cefr"),
        "rank": entry.get("frequencyRank"), "partOfSpeech": entry.get("partOfSpeech"),
        "meaningKo": entry.get("meaningKo"), "meaningEn": entry.get("meaningEn"),
        "synonyms": entry.get("synonyms", []), "example": entry.get("example"),
        "translation": entry.get("translation"), "meanings": entry.get("meanings", []),
        "digest": digest(entry),
    }


def main() -> None:
    args = parse_args()
    vocabulary = json.loads(args.input.read_text(encoding="utf-8"))
    by_word = {entry["word"]: entry for entry in vocabulary}
    accepted = load_ledger(args.ledger)

    if args.accept_current:
        current = json.loads(args.current.read_text(encoding="utf-8"))
        newly_accepted: list[dict[str, str]] = []
        changed: list[str] = []
        for reviewed in current.get("entries", []):
            entry = by_word.get(reviewed["word"])
            if not entry or digest(entry) != reviewed["digest"]:
                changed.append(reviewed["word"])
                continue
            newly_accepted.append({"word": entry["word"], "digest": digest(entry), "status": "direct-accepted"})
        args.ledger.parent.mkdir(parents=True, exist_ok=True)
        with args.ledger.open("a", encoding="utf-8") as handle:
            for record in newly_accepted:
                handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        print(json.dumps({"accepted": len(newly_accepted), "changedAndSkipped": changed}, ensure_ascii=False, indent=2))
        accepted.update({record["word"]: record["digest"] for record in newly_accepted})

    pending = [entry for entry in ordered(vocabulary) if accepted.get(entry["word"]) != digest(entry)]
    if args.next:
        batch = pending[: args.next]
        payload = {"size": len(batch), "entries": [compact(entry) for entry in batch]}
        atomic_json(args.current, payload)
        for index, entry in enumerate(payload["entries"], 1):
            print(f'{index:04d}\t{json.dumps(entry, ensure_ascii=False, separators=(",", ":"))}')

    if args.status or not args.next:
        print(json.dumps({
            "total": len(vocabulary), "acceptedCurrentContent": len(vocabulary) - len(pending),
            "pending": len(pending), "ledgerRows": sum(1 for _ in args.ledger.open()) if args.ledger.exists() else 0,
        }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
