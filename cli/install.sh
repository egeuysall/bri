#!/usr/bin/env bash
set -euo pipefail

GITHUB_REPO="${BRI_GITHUB_REPO:-egeuysall/bri}"
BIN_DIR="${BRI_INSTALL_DIR:-${HOME}/.local/bin}"
TARGET="${BIN_DIR}/bri"
TMP_TARGET="$(mktemp "${TMPDIR:-/tmp}/bri.XXXXXX")"

info() {
  echo "[info] $*"
}

ok() {
  echo "[ok] $*"
}

warn() {
  echo "[warn] $*"
}

fail() {
  echo "[error] $*" >&2
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "required command not found: $1"
  fi
}

cleanup() {
  rm -f "${TMP_TARGET}"
}
trap cleanup EXIT

detect_asset_name() {
  local os arch normalized_arch

  os="$(uname -s)"
  arch="$(uname -m)"
  normalized_arch=""

  case "${os}" in
    Darwin)
      os="darwin"
      ;;
    Linux)
      os="linux"
      ;;
    *)
      fail "unsupported operating system: ${os}"
      ;;
  esac

  case "${arch}" in
    x86_64|amd64)
      normalized_arch="x64"
      ;;
    arm64|aarch64)
      normalized_arch="arm64"
      ;;
    *)
      fail "unsupported architecture: ${arch}"
      ;;
  esac

  printf 'bri-%s-%s' "${os}" "${normalized_arch}"
}

detect_profile_file() {
  local shell_name

  shell_name="$(basename "${SHELL:-}")"

  case "${shell_name}" in
    zsh)
      printf '%s' "${ZDOTDIR:-${HOME}}/.zshrc"
      ;;
    bash)
      if [ -f "${HOME}/.bashrc" ]; then
        printf '%s' "${HOME}/.bashrc"
      else
        printf '%s' "${HOME}/.bash_profile"
      fi
      ;;
    fish)
      printf '%s' "${HOME}/.config/fish/config.fish"
      ;;
    *)
      printf '%s' "${HOME}/.profile"
      ;;
  esac
}

ensure_path_persisted() {
  local profile shell_name marker entry

  case ":${PATH}:" in
    *":${BIN_DIR}:"*)
      return 0
      ;;
  esac

  export PATH="${BIN_DIR}:${PATH}"

  profile="$(detect_profile_file)"
  shell_name="$(basename "${SHELL:-}")"

  mkdir -p "$(dirname "${profile}")"

  if [ "${shell_name}" = "fish" ]; then
    marker="# bri-cli-path"
    entry="fish_add_path -g \"${BIN_DIR}\""
  else
    marker="# bri-cli-path"
    entry="export PATH=\"${BIN_DIR}:\$PATH\""
  fi

  if [ -f "${profile}" ] && grep -Fq "${entry}" "${profile}"; then
    info "PATH updated for current session (${BIN_DIR})"
    return 0
  fi

  {
    printf '\n%s\n' "${marker}"
    printf '%s\n' "${entry}"
  } >>"${profile}"

  ok "persisted PATH update in ${profile}"
}

setup_daily_autoupdate() {
  local os marker cron_line current_cron filtered_cron uid launch_agents_dir plist_path

  os="$(uname -s)"

  if [ "${os}" = "Darwin" ]; then
    launch_agents_dir="${HOME}/Library/LaunchAgents"
    plist_path="${launch_agents_dir}/com.bri.cli.autoupdate.plist"
    mkdir -p "${launch_agents_dir}"

    cat >"${plist_path}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.bri.cli.autoupdate</string>
    <key>ProgramArguments</key>
    <array>
      <string>${TARGET}</string>
      <string>self-update</string>
      <string>--yes</string>
      <string>--quiet</string>
      <string>--install-path</string>
      <string>${TARGET}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StartInterval</key>
    <integer>86400</integer>
    <key>StandardOutPath</key>
    <string>/tmp/bri-autoupdate.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/bri-autoupdate.log</string>
  </dict>
</plist>
EOF

    if command -v launchctl >/dev/null 2>&1; then
      uid="$(id -u)"
      launchctl bootout "gui/${uid}" "${plist_path}" >/dev/null 2>&1 || true
      launchctl bootstrap "gui/${uid}" "${plist_path}" >/dev/null 2>&1 || true
    fi

    ok "configured daily background auto-update (launchd)"
    return 0
  fi

  if [ "${os}" = "Linux" ] && command -v crontab >/dev/null 2>&1; then
    marker="# bri-cli-auto-update"
    cron_line="17 4 * * * ${TARGET} self-update --yes --quiet --install-path ${TARGET} >/dev/null 2>&1 ${marker}"
    current_cron="$(crontab -l 2>/dev/null || true)"
    filtered_cron="$(printf '%s\n' "${current_cron}" | grep -v "${marker}" || true)"

    {
      printf '%s\n' "${filtered_cron}"
      printf '%s\n' "${cron_line}"
    } | awk 'NF > 0' | crontab -

    ok "configured daily background auto-update (cron)"
    return 0
  fi

  warn "background auto-update scheduler unavailable on this platform"
}

finalize_binary() {
  if [ "$(uname -s)" = "Darwin" ] && command -v xattr >/dev/null 2>&1; then
    xattr -d com.apple.quarantine "${TARGET}" >/dev/null 2>&1 || true
    xattr -d com.apple.provenance "${TARGET}" >/dev/null 2>&1 || true
  fi
}

verify_binary() {
  if "${TARGET}" --version >/dev/null 2>&1; then
    ok "verified binary startup"
    return 0
  fi

  rm -f "${TARGET}" >/dev/null 2>&1 || true
  fail "installed binary failed startup check for ${ASSET_NAME}"
}

require_cmd curl
mkdir -p "${BIN_DIR}"

ASSET_NAME="$(detect_asset_name)"
DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/latest/download/${ASSET_NAME}"

info "downloading ${ASSET_NAME} from ${GITHUB_REPO}..."
curl --fail --location --proto '=https' --tlsv1.2 --retry 3 --retry-connrefused --silent --show-error "${DOWNLOAD_URL}" -o "${TMP_TARGET}"
chmod +x "${TMP_TARGET}"
mv "${TMP_TARGET}" "${TARGET}"
chmod 755 "${TARGET}"
finalize_binary

info "release source: https://github.com/${GITHUB_REPO}/releases/latest"
verify_binary
ok "bri installed at ${TARGET}"
ok "standalone binary installed (no bun runtime required)"

ensure_path_persisted
setup_daily_autoupdate
ok "run: bri --help"
