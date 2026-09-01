#!/usr/bin/env python3
"""Export directly accepted vocabulary as versioned, browser-friendly public shards."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any

from direct_review_batches import digest, load_ledger, ordered


PUBLIC_FIELDS = (
    "word", "meaningKo", "meaningEn", "partOfSpeech", "cefr", "ipa", "synonyms",
    "meanings", "example", "translation", "frequency", "frequencyRank", "topics",
    "academicCore", "source", "context",
)
SENSE_FIELDS = ("senseId", "meaningKo", "meaningEn", "partOfSpeech", "synonyms")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("private/vocabulary.json"))
    parser.add_argument("--ledger", type=Path, default=Path("work/vocabulary/direct-review-ledger.jsonl"))
    parser.add_argument("--output", type=Path, default=Path("public/data/vocabulary"))
    parser.add_argument("--checkpoint", type=int, default=0, help="Published count; defaults to the last 1,000 boundary.")
    parser.add_argument("--chunk-size", type=int, default=250)
    return parser.parse_args()


def public_entry(entry: dict[str, Any]) -> dict[str, Any]:
    result = {field: entry[field] for field in PUBLIC_FIELDS if field in entry}
    result["meanings"] = [
        {field: sense[field] for field in SENSE_FIELDS if field in sense}
        for sense in entry.get("meanings", [])
    ]
    return result


def write_atomic(path: Path, value: Any) -> bytes:
    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("wb") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    temporary.replace(path)
    return payload


def main() -> None:
    args = parse_args()
    if args.chunk_size < 50:
        raise SystemExit("Chunk size must be at least 50 entries.")
    vocabulary = json.loads(args.input.read_text(encoding="utf-8"))
    accepted = load_ledger(args.ledger)
    accepted_entries = [
        entry for entry in ordered(vocabulary)
        if accepted.get(entry["word"]) == digest(entry)
    ]
    checkpoint = args.checkpoint or (len(accepted_entries) // 1000) * 1000
    if checkpoint <= 0 or checkpoint % 1000:
        raise SystemExit("Checkpoint must be a positive multiple of 1,000.")
    if len(accepted_entries) < checkpoint:
        raise SystemExit(f"Only {len(accepted_entries)} entries are currently accepted; cannot export {checkpoint}.")
    selected = accepted_entries[:checkpoint]
    invalid = [
        entry["word"] for entry in selected
        if not entry.get("meanings")
        or any(entry.get(field) != entry["meanings"][0].get(field) for field in ("meaningKo", "meaningEn", "partOfSpeech", "synonyms"))
        or not entry.get("example")
        or not entry.get("translation")
    ]
    if invalid:
        raise SystemExit("Checkpoint contains structurally invalid accepted entries: " + ", ".join(invalid[:20]))

    args.output.mkdir(parents=True, exist_ok=True)
    for stale in args.output.glob("chunk-*.json"):
        stale.unlink()
    chunks = []
    total_bytes = 0
    for index, start in enumerate(range(0, len(selected), args.chunk_size)):
        filename = f"chunk-{index:03d}.json"
        payload = write_atomic(args.output / filename, [public_entry(entry) for entry in selected[start:start + args.chunk_size]])
        total_bytes += len(payload)
        chunks.append({
            "file": filename,
            "count": min(args.chunk_size, len(selected) - start),
            "bytes": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
        })
    manifest = {
        "schemaVersion": 1,
        "entryCount": len(selected),
        "reviewCheckpoint": checkpoint,
        "chunkSize": args.chunk_size,
        "chunkCount": len(chunks),
        "totalBytes": total_bytes,
        "license": "CC BY-SA 4.0",
        "sources": ["Open English-Korean Dictionary", "Open English WordNet 2025", "Princeton WordNet 3.0"],
        "chunks": chunks,
    }
    write_atomic(args.output / "manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
