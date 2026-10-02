import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from validate_public_vocabulary import validate


class PublicIntegrityTests(unittest.TestCase):
    def fixture(self, path, extra=None):
        sense = {"senseId": "test-n", "partOfSpeech": "noun", "meaningKo": "표본", "meaningEn": "a test sample", "synonyms": []}
        entry = {"word": "sample", **sense, "meanings": [sense], "example": "The sample was ready.", "translation": "표본이 준비되었습니다."}
        entry.pop("senseId")
        entry.update(extra or {})
        payload = json.dumps([entry]).encode()
        (path / "chunk-000.json").write_bytes(payload)
        manifest = {"entryCount": 1, "chunkCount": 1, "totalBytes": len(payload), "chunks": [{"file": "chunk-000.json", "count": 1, "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}]}
        (path / "manifest.json").write_text(json.dumps(manifest))

    def test_normal_dataset(self):
        with tempfile.TemporaryDirectory() as name:
            path = Path(name)
            self.fixture(path)
            self.assertEqual(validate(path, 1)["structuralErrors"], 0)

    def test_corrupted_hash_is_rejected(self):
        with tempfile.TemporaryDirectory() as name:
            path = Path(name)
            self.fixture(path)
            (path / "chunk-000.json").write_bytes(b"[]")
            with self.assertRaises(ValueError):
                validate(path, 1)

    def test_private_metadata_and_email_are_rejected(self):
        for extra in ({"directReview": True}, {"context": "person@example.org"}):
            with tempfile.TemporaryDirectory() as name:
                path = Path(name)
                self.fixture(path, extra)
                with self.assertRaises(ValueError):
                    validate(path, 1)

    def test_incomplete_example_is_rejected(self):
        with tempfile.TemporaryDirectory() as name:
            path = Path(name)
            self.fixture(path, {"example": "The sam___ was ready."})
            with self.assertRaises(ValueError):
                validate(path, 1)
