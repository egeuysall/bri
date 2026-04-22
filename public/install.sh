#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BRI_BASE_URL:-https://bri.egeuysal.com}"

BIN_DIR="${HOME}/.local/bin"
TARGET="${BIN_DIR}/bri"
TMP_TARGET="$(mktemp "${TMPDIR:-/tmp}/bri.XXXXXX")"

cleanup() {
  rm -f "${TMP_TARGET}"
}
trap cleanup EXIT

mkdir -p "${BIN_DIR}"

OS="$(uname -s)"
ARCH="$(uname -m)"
PLATFORM=""

case "${OS}" in
  Darwin)
    case "${ARCH}" in
      arm64|aarch64) PLATFORM="darwin-arm64" ;;
      x86_64|amd64) PLATFORM="darwin-x64" ;;
      *)
        echo "unsupported architecture on macOS: ${ARCH}" >&2
        exit 1
        ;;
    esac
    ;;
  *)
    echo "unsupported operating system: ${OS}" >&2
    exit 1
    ;;
esac

BINARY_URL="${BASE_URL}/bin/bri-${PLATFORM}"

echo "downloading bri binary (${PLATFORM})..."
curl -fsSL "${BINARY_URL}" -o "${TMP_TARGET}"
chmod +x "${TMP_TARGET}"
mv "${TMP_TARGET}" "${TARGET}"
chmod 755 "${TARGET}"

echo "bri installed at ${TARGET}"
echo "standalone binary installed (no bun runtime required)"
echo "update checks enabled (24h cache)"

case ":${PATH}:" in
  *":${BIN_DIR}:"*)
    echo "run: bri --help"
    ;;
  *)
    echo "add ${BIN_DIR} to PATH, then run: bri --help"
    ;;
esac
