import { spawn } from "node:child_process";
import { networkInterfaces, platform } from "node:os";

const DEFAULT_TELEMETRY_TIMEOUT_MS = 800;
const MAX_COMMAND_OUTPUT_BYTES = 64 * 1024;
const MAX_LOCAL_IPS = 5;

export async function formatStatus({
  cameraStatus,
  photoStatus,
  alarmStatus = { active: false, available: false },
  startedAtMs = Date.now(),
  now = () => new Date(),
  collectHostTelemetry = collectDefaultHostTelemetry,
} = {}) {
  const responseTime = now();
  const hostTelemetry = await safeCollectHostTelemetry(collectHostTelemetry, responseTime);
  const mediaActive = Boolean(cameraStatus?.activeCapture || photoStatus?.activeCapture);
  const alarmLine = alarmStatus.available
    ? `Alarm: ${alarmStatus.active ? "active" : "idle"}`
    : "Alarm: unavailable";

  return [
    "Home watch Bot is running.",
    `Response timestamp: ${responseTime.toISOString()}`,
    `Bot uptime: ${formatDuration(responseTime.getTime() - startedAtMs)}`,
    `Camera command: ${cameraStatus?.enabled ? "enabled" : "disabled"}`,
    `Camera config: ${cameraStatus?.configValid ? "valid" : "invalid"}`,
    `Photo command: ${photoStatus?.enabled ? "enabled" : "disabled"}`,
    `Photo config: ${photoStatus?.configValid ? "valid" : "invalid"}`,
    `Media capture: ${mediaActive ? "active" : "idle"}`,
    alarmLine,
    `Battery level: ${hostTelemetry.batteryLevel}`,
    `Power source: ${hostTelemetry.powerSource}`,
    `Local IPs: ${hostTelemetry.localIps.length > 0 ? hostTelemetry.localIps.join(", ") : "unavailable"}`,
    `Disk available: ${hostTelemetry.diskAvailable}`,
  ].join("\n");
}

async function safeCollectHostTelemetry(collectHostTelemetry, responseTime) {
  try {
    return normalizeHostTelemetry(await collectHostTelemetry({ now: responseTime }));
  } catch {
    return unavailableHostTelemetry();
  }
}

function normalizeHostTelemetry(hostTelemetry) {
  return {
    batteryLevel: hostTelemetry?.batteryLevel || "unavailable",
    powerSource: hostTelemetry?.powerSource || "unavailable",
    localIps: Array.isArray(hostTelemetry?.localIps) ? hostTelemetry.localIps.slice(0, MAX_LOCAL_IPS) : [],
    diskAvailable: hostTelemetry?.diskAvailable || "unavailable",
  };
}

function unavailableHostTelemetry() {
  return {
    batteryLevel: "unavailable",
    powerSource: "unavailable",
    localIps: [],
    diskAvailable: "unavailable",
  };
}

export async function collectDefaultHostTelemetry(options = {}) {
  const [power, disk] = await Promise.all([
    collectMacPowerTelemetry(options),
    collectDiskTelemetry(options),
  ]);
  return {
    batteryLevel: power.batteryLevel,
    powerSource: power.powerSource,
    localIps: collectPrivateLocalIps(options.networkInterfacesImpl?.() ?? networkInterfaces()),
    diskAvailable: disk.diskAvailable,
  };
}

export async function collectMacPowerTelemetry({
  platformValue = platform(),
  timeoutMs = DEFAULT_TELEMETRY_TIMEOUT_MS,
  runCommand = runBoundedCommand,
} = {}) {
  if (platformValue !== "darwin") {
    return { batteryLevel: "unavailable", powerSource: "unavailable" };
  }
  const result = await runCommand("pmset", ["-g", "batt"], { timeoutMs });
  if (!result.ok) {
    return { batteryLevel: "unavailable", powerSource: "unavailable" };
  }
  return parsePmsetBattery(result.stdout);
}

export async function collectDiskTelemetry({
  cwd = process.cwd(),
  timeoutMs = DEFAULT_TELEMETRY_TIMEOUT_MS,
  runCommand = runBoundedCommand,
} = {}) {
  const result = await runCommand("df", ["-k", cwd], { timeoutMs });
  if (!result.ok) {
    return { diskAvailable: "unavailable" };
  }
  return { diskAvailable: parseDfAvailable(result.stdout) };
}

export function parsePmsetBattery(stdout) {
  const text = String(stdout ?? "");
  const powerMatch = text.match(/Now drawing from '([^']+)'/);
  const percentMatch = text.match(/(\d{1,3})%;/);
  const stateMatch = text.match(/\d{1,3}%;\s*([^;]+);/);
  const batteryLevel = percentMatch ? `${Math.min(Number(percentMatch[1]), 100)}%` : "unavailable";
  const powerState = stateMatch ? stateMatch[1].trim() : "";
  const powerSource = powerMatch
    ? [powerMatch[1].trim(), powerState].filter(Boolean).join(", ")
    : powerState || "unavailable";
  return { batteryLevel, powerSource };
}

export function parseDfAvailable(stdout) {
  const lines = String(stdout ?? "").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return "unavailable";
  }
  const fields = lines.at(-1).trim().split(/\s+/);
  const availableKiB = Number(fields[3]);
  if (!Number.isFinite(availableKiB) || availableKiB < 0) {
    return "unavailable";
  }
  return formatBytes(availableKiB * 1024);
}

export function collectPrivateLocalIps(interfaces = networkInterfaces()) {
  const entries = [];
  for (const [name, addresses] of Object.entries(interfaces ?? {})) {
    for (const address of addresses ?? []) {
      if (address?.internal || typeof address.address !== "string") {
        continue;
      }
      if (address.family === "IPv4" && isPrivateIpv4(address.address)) {
        entries.push(`${name}:${address.address}`);
      } else if (address.family === "IPv6" && isPrivateIpv6(address.address)) {
        entries.push(`${name}:${address.address}`);
      }
      if (entries.length >= MAX_LOCAL_IPS) {
        return entries;
      }
    }
  }
  return entries;
}

export function runBoundedCommand(command, args, { timeoutMs = DEFAULT_TELEMETRY_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      resolve({ ok: false, stdout: "", timedOut: false });
      return;
    }

    let settled = false;
    let stdout = "";
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, ...result });
    };
    const appendStdout = (chunk) => {
      if (stdout.length < MAX_COMMAND_OUTPUT_BYTES) {
        stdout += chunk.toString("utf8").slice(0, MAX_COMMAND_OUTPUT_BYTES - stdout.length);
      }
    };
    child.stdout?.on("data", appendStdout);
    child.stderr?.on("data", () => {});
    child.on("error", () => finish({ ok: false, timedOut: false }));
    child.on("close", (code) => finish({ ok: code === 0, timedOut: false }));

    const timer = setTimeout(() => {
      if (typeof child.kill === "function") {
        child.kill("SIGTERM");
      }
      finish({ ok: false, timedOut: true });
    }, timeoutMs);
  });
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatBytes(bytes) {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = Number(bytes);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function isPrivateIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase();
  return normalized.startsWith("fc") || normalized.startsWith("fd");
}
