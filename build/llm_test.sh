#!/bin/bash
# quick router checks from the build box: task, optional body file
URL=https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/llm
ANON=$(cat /tmp/anon.key); SEC=$(cat /tmp/wa.secret)
TASK=${1:-default}; BODY=${2:-}
if [ -z "$BODY" ]; then DATA='{"max_tokens":16,"temperature":0,"messages":[{"role":"user","content":"Reply with the single word OK."}]}'; else DATA=$(cat "$BODY"); fi
curl -s -m 90 -X POST "$URL" -H "Authorization: Bearer $ANON" -H "x-wa-secret: $SEC" -H "x-wa-task: $TASK" -H "x-wa-caller: build-test" -H "Content-Type: application/json" -d "$DATA"
echo
