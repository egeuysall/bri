import "server-only";
import { appendFile, lstat, mkdir, readdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const MAX_CURL_BYTES = 24_000;
const CURL_TIMEOUT_MS = 5_000;
const publicHosts = new Set(["ibx.egeuysal.com", "bri.fyi", "egeuysal.com", "www.egeuysal.com"]);

function withinWorkspace(home: string, relativePath: string) {
  if (isAbsolute(relativePath) || /^[a-z]:[\\/]/i.test(relativePath) || relativePath.split(/[\\/]+/).includes("..")) {
    throw new Error("path must stay inside the demo workspace");
  }
  const resolved = resolve(home, relativePath || ".");
  const fromHome = relative(home, resolved);
  if (fromHome === ".." || fromHome.startsWith(`..${sep}`) || isAbsolute(fromHome)) {
    throw new Error("path must stay inside the demo workspace");
  }
  return resolved;
}

async function verifyWorkspacePath(home: string, target: string) {
  const root = await realpath(home);
  const actual = await realpath(target);
  if (actual !== root && !actual.startsWith(`${root}${sep}`)) {
    throw new Error("path must stay inside the demo workspace");
  }
  return actual;
}

async function verifyWorkspaceParent(home: string, target: string) {
  const root = await realpath(home);
  let parent = dirname(target);
  while (parent !== root) {
    const actual = await realpath(parent).catch(() => null);
    if (actual) {
      if (actual !== root && !actual.startsWith(`${root}${sep}`)) throw new Error("path must stay inside the demo workspace");
      return;
    }
    const next = dirname(parent);
    if (next === parent) throw new Error("path must stay inside the demo workspace");
    parent = next;
  }
}

function formatPrintf(args: string[]) {
  const [format = "", ...values] = args;
  let valueIndex = 0;
  return format.replace(/%[sdif]/g, () => values[valueIndex++] ?? "")
    .replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "\r");
}

function parseCurl(args: string[]) {
  const options = { fail: false, includeHeaders: false, head: false, follow: false };
  const urls: string[] = [];
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") return { help: true as const, options, urls };
    if (arg === "--version" || arg === "-V") return { version: true as const, options, urls };
    if (arg.startsWith("-")) {
      if (arg === "--location") { options.follow = true; continue; }
      if (arg === "--fail") { options.fail = true; continue; }
      if (arg === "--include") { options.includeHeaders = true; continue; }
      if (arg === "--head") { options.head = true; continue; }
      if (arg.startsWith("--")) return { error: `curl: unsupported option: ${arg}` };
      for (const flag of arg.slice(1)) {
        if (flag === "f") options.fail = true;
        else if (flag === "i") options.includeHeaders = true;
        else if (flag === "I") { options.head = true; options.includeHeaders = true; }
        else if (flag === "L") options.follow = true;
        else if (flag === "s" || flag === "S") { /* output is always compact */ }
        else return { error: `curl: unsupported option: -${flag}` };
      }
      continue;
    }
    urls.push(arg);
  }
  return { options, urls };
}

function validateCurlUrl(rawUrl: string, origin: string) {
  const normalizedUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const url = new URL(normalizedUrl);
  const localDevelopmentUrl = process.env.NODE_ENV === "development" && url.origin === origin && url.protocol === "http:";
  if ((url.protocol !== "https:" && !localDevelopmentUrl) || url.username || url.password) {
    throw new Error("curl: only https URLs without embedded credentials are allowed");
  }
  const sameOriginDevelopmentRequest = process.env.NODE_ENV === "development" && url.origin === origin;
  if (!sameOriginDevelopmentRequest && !publicHosts.has(url.hostname.toLowerCase())) {
    throw new Error("curl: this public terminal can only reach ibx.egeuysal.com, bri.fyi, and egeuysal.com");
  }
  return url;
}

async function curl(args: string[], origin: string) {
  const parsed = parseCurl(args);
  if ("error" in parsed) return parsed.error;
  if ("help" in parsed && parsed.help) {
    return "usage: curl [-fsSLiI] <https-url>\nfetch a public ibx or bri URL (GET or HEAD). redirects stay on the approved sites.";
  }
  if ("version" in parsed && parsed.version) return "curl 8.0.0 (landing demo fetch client) https only";
  if (!parsed.urls.length) return "curl: no URL specified. try 'curl --help' for usage.";
  if (parsed.urls.length !== 1) return "curl: this demo accepts one URL at a time.";

  let url: URL;
  try { url = validateCurlUrl(parsed.urls[0]!, origin); }
  catch (error) { return error instanceof Error ? error.message : "curl: invalid URL"; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CURL_TIMEOUT_MS);
  try {
    let response = await fetch(url, {
      method: parsed.options.head ? "HEAD" : "GET",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: { "User-Agent": "bri-landing-terminal/1.0", "Accept-Encoding": "identity" },
    });
    let redirects = 0;
    while (parsed.options.follow && response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects++ >= 3) return "curl: too many or invalid redirects.";
      try { url = validateCurlUrl(new URL(location, url).toString(), origin); }
      catch (error) { return error instanceof Error ? error.message : "curl: redirect rejected"; }
      response = await fetch(url, {
        method: parsed.options.head ? "HEAD" : "GET",
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
        headers: { "User-Agent": "bri-landing-terminal/1.0", "Accept-Encoding": "identity" },
      });
    }

    let text = "";
    if (!parsed.options.head && response.body) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (size < MAX_CURL_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        const part = value.subarray(0, MAX_CURL_BYTES - size);
        chunks.push(part);
        size += part.length;
        if (part.length < value.length) break;
      }
      await reader.cancel().catch(() => undefined);
      text = new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
      if (size >= MAX_CURL_BYTES) text += "\n[response truncated at 24 kb]";
    }
    const headerText = parsed.options.includeHeaders
      ? `HTTP/${response.status}\n${[...response.headers.entries()].map(([key, value]) => `${key}: ${value}`).join("\n")}\n\n`
      : "";
    if (parsed.options.fail && !response.ok) return `curl: (22) the requested URL returned HTTP ${response.status}`;
    return `${headerText}${text || (parsed.options.head ? "" : `HTTP ${response.status} ${response.statusText}`)}`;
  } catch (error) {
    return error instanceof Error && error.name === "AbortError" ? "curl: operation timed out after 5 seconds" : "curl: request failed";
  } finally {
    clearTimeout(timer);
  }
}

export async function runLandingShellCommand(args: string[], home: string, origin: string): Promise<string> {
  const [command, ...rest] = args;
  if (!command) return "";
  try {
    const redirectIndex = rest.findIndex((argument) => argument === ">" || argument === ">>");
    if (redirectIndex >= 0) {
      const operator = rest[redirectIndex];
      const targetName = rest[redirectIndex + 1];
      if (!targetName || redirectIndex + 2 !== rest.length || !["echo", "printf"].includes(command)) {
        return "shell: support redirection as echo/printf <text> > <file> (or >> to append).";
      }
      const output = command === "echo"
        ? `${rest.slice(0, redirectIndex).join(" ")}\n`
        : formatPrintf(rest.slice(0, redirectIndex));
      const target = withinWorkspace(home, targetName);
      await verifyWorkspaceParent(home, target);
      if ((await lstat(target).catch(() => null))?.isSymbolicLink()) throw new Error("symbolic links are not allowed");
      if (!(await stat(dirname(target)).catch(() => null))?.isDirectory()) return `${command}: parent directory does not exist`;
      if (operator === ">>") await appendFile(target, output, { encoding: "utf8", mode: 0o600 });
      else await writeFile(target, output, { encoding: "utf8", mode: 0o600 });
      return "";
    }
    switch (command) {
      case "curl": return (await curl(rest, origin)) ?? "";
      case "pwd": return "/home/demo";
      case "whoami": return "demo";
      case "date": return new Date().toString();
      case "echo": return rest.join(" ");
      case "printf": {
        return formatPrintf(rest);
      }
      case "touch": {
        if (!rest.length) return "touch: provide a path inside the demo workspace.";
        for (const file of rest.filter((arg) => !arg.startsWith("-"))) {
          const target = withinWorkspace(home, file);
          await verifyWorkspaceParent(home, target);
          if (!(await stat(dirname(target)).catch(() => null))?.isDirectory()) return `touch: ${file}: parent directory does not exist`;
          if ((await lstat(target).catch(() => null))?.isSymbolicLink()) throw new Error("symbolic links are not allowed");
          const exists = await stat(target).catch(() => null);
          if (!exists) await writeFile(target, "", { mode: 0o600, flag: "wx" });
          else if (!exists.isFile()) return `touch: ${file}: not a file`;
        }
        return "";
      }
      case "mkdir": {
        const targetArg = rest.find((arg) => !arg.startsWith("-"));
        if (!targetArg) return "mkdir: provide a path inside the demo workspace.";
        const target = withinWorkspace(home, targetArg);
        await verifyWorkspaceParent(home, target);
        await mkdir(target, { recursive: rest.includes("-p"), mode: 0o700 });
        await verifyWorkspacePath(home, target);
        return "";
      }
      case "rm": {
        const files = rest.filter((arg) => !arg.startsWith("-"));
        if (!files.length) return "rm: provide a file path inside the demo workspace.";
        for (const file of files) {
          const target = await verifyWorkspacePath(home, withinWorkspace(home, file));
          if (!(await stat(target)).isFile()) return `rm: ${file}: only files can be removed`;
          await rm(target);
        }
        return "";
      }
      case "ls": {
        const targetArg = rest.find((arg) => !arg.startsWith("-")) ?? ".";
        const target = await verifyWorkspacePath(home, withinWorkspace(home, targetArg));
        if (!(await stat(target)).isDirectory()) return targetArg;
        const names = await readdir(target);
        return names.filter((name) => rest.includes("-a") || !name.startsWith(".")).sort().join("  ") || "(empty)";
      }
      case "cat": {
        if (!rest.length) return "cat: provide a file path inside the demo workspace.";
        const output: string[] = [];
        for (const file of rest.filter((arg) => !arg.startsWith("-"))) {
          const target = await verifyWorkspacePath(home, withinWorkspace(home, file));
          if (!(await stat(target)).isFile()) return `cat: ${file}: not a file`;
          output.push(await readFile(target, "utf8"));
        }
        return output.join("\n").slice(0, MAX_CURL_BYTES);
      }
      default: return `command not found: ${command}. use 'bri --help' for bri commands or 'help' for shell commands.`;
    }
  } catch (error) {
    return error instanceof Error ? `${command}: ${error.message}` : `${command}: command failed`;
  }
}
