#!/usr/bin/env python3
"""Read-only integrity/privacy checks for the exported learner dataset.

These checks do not replace direct semantic review or establish zero errors.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

from vocabulary_validation import ALLOWED_PARTS_OF_SPEECH, has_complete_study_example

FORBIDDEN_KEYS = {
    "uid", "userid", "email", "account", "access_token", "refresh_token",
    "apikey", "api_key", "privatekey", "private_key", "firestore", "firebase",
    "reviewledger", "directreview", "meaningreview", "reviewmethod",
    "selectedprimary", "translationrepairs", "personalmeaningko",
    "dictionarymeaningko", "learningstats", "sessions", "password",
}
SECRET_PATTERNS = (
    r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    r"AIza[0-9A-Za-z_-]{35}",
    r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}",
    r"/Users/[^\s\"']+",
    r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
)


def validate(directory, expected_count):
    manifest = json.loads((directory / "manifest.json").read_text())
    entries = []
    errors = []
    total_bytes = 0
    seen_files = set()
    def inspect(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key.lower() in FORBIDDEN_KEYS:
                    errors.append("Forbidden private metadata key")
                inspect(child)
        elif isinstance(value, list):
            for child in value:
                inspect(child)
        elif isinstance(value, str) and any(re.search(pattern, value) for pattern in SECRET_PATTERNS):
            errors.append("Potential secret, personal address or local path")
    for chunk in manifest["chunks"]:
        filename = chunk["file"]
        if not re.fullmatch(r"chunk-\d{3}\.json", filename) or filename in seen_files:
            errors.append("Invalid or duplicate shard filename")
            continue
        seen_files.add(filename)
        payload = (directory / filename).read_bytes()
        total_bytes += len(payload)
        if len(payload) >= 5_000_000:
            errors.append("Oversized shard")
        if len(payload) != chunk["bytes"] or hashlib.sha256(payload).hexdigest() != chunk["sha256"]:
            errors.append("Shard byte/hash mismatch")
        values = json.loads(payload)
        if len(values) != chunk["count"]:
            errors.append("Shard count mismatch")
        inspect(values)
        entries.extend(values)
    if set(path.name for path in directory.glob("chunk-*.json")) != seen_files:
        errors.append("Unmanifested shard")
    if len(entries) != expected_count or manifest["entryCount"] != expected_count:
        errors.append("Total count mismatch")
    if len({entry["word"] for entry in entries}) != len(entries):
        errors.append("Duplicate vocabulary word")
    if total_bytes != manifest["totalBytes"] or len(seen_files) != manifest["chunkCount"]:
        errors.append("Manifest aggregate mismatch")
    for entry in entries:
        senses = entry.get("meanings", [])
        if not 1 <= len(senses) <= 3 or not has_complete_study_example(entry):
            errors.append("Invalid sense count or unfinished example: " + entry["word"])
            continue
        if any(entry.get(key) != senses[0].get(key) for key in ("meaningKo", "meaningEn", "partOfSpeech", "synonyms")):
            errors.append("Primary alignment mismatch: " + entry["word"])
        if len({sense["senseId"] for sense in senses}) != len(senses):
            errors.append("Duplicate sense ID: " + entry["word"])
        if not re.search("[가-힣]", entry["translation"]):
            errors.append("Missing Korean translation: " + entry["word"])
        for sense in senses:
            synonyms = sense.get("synonyms", [])
            if sense.get("partOfSpeech") not in ALLOWED_PARTS_OF_SPEECH:
                errors.append("Unsupported part of speech: " + entry["word"])
            if not sense.get("meaningEn", "").strip() or not re.search("[가-힣]", sense.get("meaningKo", "")):
                errors.append("Missing bilingual definition: " + entry["word"])
            if len(synonyms) > 3 or len(set(synonyms)) != len(synonyms) or any(not synonym.strip() for synonym in synonyms):
                errors.append("Invalid synonyms: " + entry["word"])
    if errors:
        raise ValueError("\n".join(errors[:30]))
    return {"entryCount": len(entries), "chunkCount": len(seen_files), "bytes": total_bytes,
            "structuralErrors": 0, "privacyWarnings": 0}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", type=Path, default=Path("public/data/vocabulary"))
    parser.add_argument("--expected-count", type=int, required=True)
    args = parser.parse_args()
    print(json.dumps(validate(args.directory, args.expected_count)))
