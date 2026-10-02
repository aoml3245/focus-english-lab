"""Reject incomplete bilingual sense patches before direct-review approval.

This checks authoring completeness only; paired definitions still need semantic
review. Repeating an existing English definition is not proof of correspondence.
"""


def correction_pair_errors(corrections):
    errors = []
    for word, correction in corrections.items():
        for sense_id, patch in correction.get("meaningsBySenseId", {}).items():
            if "meaningKo" in patch and not str(patch.get("meaningEn", "")).strip():
                errors.append(f"Incomplete bilingual sense patch: {word}/{sense_id}; explicitly review meaningEn alongside meaningKo")
    return errors
