#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: ./scripts/agent-ticket.sh <agent-name> <ticket-id>"
  exit 1
fi

agent_name="$1"
ticket_id="$2"

branch_name="agent/${agent_name}/${ticket_id}"
git checkout -b "$branch_name"
echo "Created and switched to branch: $branch_name"
