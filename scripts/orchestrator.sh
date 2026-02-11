#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/orchestrator.sh verify
  ./scripts/orchestrator.sh deploy
  ./scripts/orchestrator.sh poll <deployment-url>

Commands:
  verify   Runs lint, typecheck, tests, and perf smoke.
  deploy   Triggers Vercel deploy (if Vercel CLI is available).
  poll     Polls Vercel deployment status until ready/error.
EOF
}

verify() {
  echo "[orchestrator] Running verification gates..."
  pnpm run ci
  pnpm run perf:smoke
  echo "[orchestrator] Verification passed."
}

deploy() {
  if ! command -v vercel >/dev/null 2>&1; then
    echo "[orchestrator] Vercel CLI not found. Install with: npm i -g vercel"
    exit 1
  fi

  echo "[orchestrator] Triggering Vercel deploy..."
  vercel --yes
}

poll() {
  if [[ $# -lt 1 ]]; then
    echo "[orchestrator] poll requires deployment URL"
    exit 1
  fi
  local deployment_url="$1"

  if ! command -v vercel >/dev/null 2>&1; then
    echo "[orchestrator] Vercel CLI not found. Install with: npm i -g vercel"
    exit 1
  fi

  echo "[orchestrator] Polling deployment: $deployment_url"
  while true; do
    inspect_json="$(vercel inspect "$deployment_url" --output=json)"
    status="$(node -e "const data = JSON.parse(process.argv[1]); console.log(data.readyState || 'UNKNOWN');" "$inspect_json")"
    echo "[orchestrator] Current status: $status"
    if [[ "$status" == "READY" ]]; then
      echo "[orchestrator] Deployment succeeded."
      exit 0
    fi
    if [[ "$status" == "ERROR" || "$status" == "CANCELED" ]]; then
      echo "[orchestrator] Deployment failed with status: $status"
      exit 1
    fi
    sleep 10
  done
}

command="${1:-}"
case "$command" in
  verify)
    verify
    ;;
  deploy)
    deploy
    ;;
  poll)
    shift
    poll "$@"
    ;;
  *)
    usage
    exit 1
    ;;
esac
