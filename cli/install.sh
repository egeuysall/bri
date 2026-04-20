#!/usr/bin/env bash
set -euo pipefail

if ! command -v bun >/dev/null 2>&1; then
  echo "bun required. install: https://bun.sh/docs/installation" >&2
  exit 1
fi

BIN_DIR="${HOME}/.local/bin"
TARGET="${BIN_DIR}/bri"

mkdir -p "${BIN_DIR}"

cat > "${TARGET}" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
exec env NODE_ENV=production bunx --bun github:egeuysall/bri#master "$@"
WRAPPER

chmod +x "${TARGET}"

echo "bri installed at ${TARGET}"
echo "update checks enabled (24h cache)"

case ":${PATH}:" in
  *":${BIN_DIR}:"*)
    echo "run: bri --help"
    ;;
  *)
    echo "add ${BIN_DIR} to PATH, then run: bri --help"
    ;;
esac
