#!/usr/bin/env bash
set -euo pipefail

GITHUB_REPO="${BRI_GITHUB_REPO:-egeuysall/bri}"
BIN_DIR="${BRI_INSTALL_DIR:-${HOME}/.local/bin}"
TARGET="${BIN_DIR}/bri"
TMP_TARGET="$(mktemp "${TMPDIR:-/tmp}/bri.XXXXXX")"
SOURCE_ROOT="${BRI_SOURCE_ROOT:-${HOME}/.local/share/bri-cli}"

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

extract_json_field() {
  local json key compact
  json="$1"
  key="$2"
  compact="$(printf '%s' "${json}" | tr -d '\r\n')"
  printf '%s' "${compact}" | sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\\1/p" | head -n1
}

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

setup_daily_reinstall() {
  local os marker cron_line current_cron filtered_cron uid launch_agents_dir plist_path
  local command_string

  os="$(uname -s)"
  command_string="curl -fsSL https://bri.egeuysal.com/install.sh | bash"

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
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>${command_string}</string>
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

    ok "configured daily background auto-update (launchd reinstall mode)"
    return 0
  fi

  if [ "${os}" = "Linux" ] && command -v crontab >/dev/null 2>&1; then
    marker="# bri-cli-auto-update"
    cron_line="17 4 * * * ${command_string} >/dev/null 2>&1 ${marker}"
    current_cron="$(crontab -l 2>/dev/null || true)"
    filtered_cron="$(printf '%s\n' "${current_cron}" | grep -v "${marker}" || true)"

    {
      printf '%s\n' "${filtered_cron}"
      printf '%s\n' "${cron_line}"
    } | awk 'NF > 0' | crontab -

    ok "configured daily background auto-update (cron reinstall mode)"
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

  return 1
}

ensure_bun_runtime() {
  if command -v bun >/dev/null 2>&1; then
    return 0
  fi

  info "bun runtime not found, installing bun..."
  curl --fail --location --proto '=https' --tlsv1.2 --retry 3 --retry-connrefused --silent --show-error https://bun.sh/install | bash
  export PATH="${HOME}/.bun/bin:${PATH}"

  if command -v bun >/dev/null 2>&1; then
    ok "bun runtime installed"
    return 0
  fi

  fail "bun runtime installation failed"
}

latest_release_tag() {
  local api_url json tag
  api_url="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"
  json="$(curl --fail --location --proto '=https' --tlsv1.2 --retry 3 --retry-connrefused --silent --show-error "${api_url}")"
  tag="$(extract_json_field "${json}" "tag_name")"
  if [ -z "${tag}" ]; then
    fail "failed to resolve latest release tag from ${api_url}"
  fi
  printf '%s' "${tag}"
}

install_source_fallback() {
  local tag source_archive archive_root source_dir wrapper_content
  local source_url

  ensure_bun_runtime
  tag="$(latest_release_tag)"
  source_url="https://github.com/${GITHUB_REPO}/archive/refs/tags/${tag}.tar.gz"
  source_archive="$(mktemp "${TMPDIR:-/tmp}/bri-source.XXXXXX.tar.gz")"

  info "downloading source bundle ${tag} from ${GITHUB_REPO}..."
  curl --fail --location --proto '=https' --tlsv1.2 --retry 3 --retry-connrefused --silent --show-error "${source_url}" -o "${source_archive}"

  mkdir -p "${SOURCE_ROOT}"
  archive_root="$(tar -tzf "${source_archive}" | head -n1 | cut -d'/' -f1)"
  if [ -z "${archive_root}" ]; then
    rm -f "${source_archive}"
    fail "failed to inspect source archive root"
  fi

  rm -rf "${SOURCE_ROOT:?}/${archive_root}"
  tar -xzf "${source_archive}" -C "${SOURCE_ROOT}"
  rm -f "${source_archive}"

  source_dir="${SOURCE_ROOT}/${archive_root}"
  info "installing source dependencies with bun..."
  (
    cd "${source_dir}"
    bun install --frozen-lockfile --ignore-scripts
  )

  wrapper_content="#!/usr/bin/env bash
set -euo pipefail
if command -v bun >/dev/null 2>&1; then
  exec bun run \"${source_dir}/cli/bri.ts\" \"\$@\"
fi
if [ -x \"${HOME}/.bun/bin/bun\" ]; then
  exec \"${HOME}/.bun/bin/bun\" run \"${source_dir}/cli/bri.ts\" \"\$@\"
fi
echo \"[error] bun runtime not found; rerun installer\" >&2
exit 1
"

  printf '%s' "${wrapper_content}" >"${TARGET}"
  chmod 755 "${TARGET}"
  ok "installed source fallback wrapper at ${TARGET}"
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

if verify_binary; then
  ok "bri installed at ${TARGET}"
  ok "standalone binary installed (no bun runtime required)"
  ensure_path_persisted
  setup_daily_autoupdate
  ok "run: bri --help"
  exit 0
fi

warn "standalone binary failed startup check for ${ASSET_NAME}"
warn "falling back to bun-runtime mode for reliable execution on this system"
rm -f "${TARGET}" >/dev/null 2>&1 || true
install_source_fallback

ensure_path_persisted
setup_daily_reinstall
ok "run: bri --help"
