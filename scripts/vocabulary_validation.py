"""Structural publication guards; these do not establish semantic accuracy."""
import re

ALLOWED_PARTS_OF_SPEECH = frozenset({
    "noun", "verb", "adjective", "adverb", "preposition", "conjunction",
    "pronoun", "determiner", "interjection",
})


def has_informative_primary_gloss(entry):
    word = str(entry.get("word") or "").strip().casefold()
    gloss = str(entry.get("meaningEn") or "").strip().casefold().rstrip(".!? ")
    gloss = re.sub(r"^to\s+", "", gloss)
    return bool(word and gloss and word != gloss)


def has_complete_study_example(entry):
    example = str(entry.get("example") or "").strip()
    translation = str(entry.get("translation") or "").strip()
    return bool(
        example and translation
        and not re.search(r"\b[A-Za-z]+_{2,}", example)
        and not re.match(r"In this vocabulary set\b", example, re.I)
        and not translation.startswith("이 단어장에서")
    )
