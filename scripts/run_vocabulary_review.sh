#!/bin/zsh
set -u

project_dir="${0:A:h:h}"
cd "$project_dir" || exit 1

while true; do
  /usr/bin/python3 scripts/review_vocabulary.py \
    --batch-size 10 \
    --workers 4 \
    --selection-cache work/vocabulary/semantic-selection-sample-v7.jsonl \
    --context-cache work/vocabulary/semantic-context-sample-g12.jsonl \
    --draft-cache work/vocabulary/semantic-draft-sample-v7.jsonl \
    --validation-cache work/vocabulary/semantic-validation-sample-v7.jsonl \
    --cache work/vocabulary/semantic-review-sample-v7.jsonl \
    --output private/vocabulary.json \
    --report work/vocabulary/semantic-quality-report-full.json
  exit_code=$?
  if (( exit_code == 0 )); then
    exit 0
  fi
  print -r -- "[$(date '+%Y-%m-%d %H:%M:%S')] review exited with status $exit_code; retrying in 30 seconds"
  sleep 30
done
