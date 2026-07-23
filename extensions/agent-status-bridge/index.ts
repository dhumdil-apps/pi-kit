import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getSetting } from "../extension-preferences/index.js";

type Endpoint = { url: string; token: string };
type StatusUpdate = Record<string, unknown> & { cwd?: string };
const EXTENSION = "agent-status-bridge";
const TIMEOUT_MS = 750;

export default function agentStatusBridge(pi: ExtensionAPI) {
  pi.events.emit("pi-extension-settings:register", {
    name: EXTENSION,
    settings: [{
      id: "enabled",
      label: "Report display-only agent status",
      description: "Off by default. Reports workflow progress to a configured local observer.",
      defaultValue: "false",
      values: ["false", "true"],
    }],
  });

  if (getSetting(EXTENSION, "enabled", "false") !== "true") return;

  const sessionId = randomUUID();
  let endpoint: Endpoint | undefined;
  let latest: StatusUpdate = {};
  let claimed = false;
  let claimPromise: Promise<void> | undefined;
  let heartbeat: NodeJS.Timeout | undefined;

  const send = async (path: string, value?: Record<string, unknown>) => {
    endpoint ??= resolveEndpoint();
    if (!endpoint) return;
    try {
      const response = await fetch(new URL(path, endpoint.url), {
        method: value ? "POST" : "GET",
        headers: { authorization: `Bearer ${endpoint.token}`, ...(value ? { "content-type": "application/json" } : {}) },
        body: value ? JSON.stringify(value) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch {
      // Reporting is deliberately best-effort and must never affect a Pi turn.
    }
  };

  const claim = (cwd: string) => {
    if (claimed) return claimPromise;
    claimed = true;
    claimPromise = send("/agent/status/claim", { sessionId, pid: process.pid, cwd, label: labelFor(cwd) });
    return claimPromise;
  };
  const post = () => {
    const cwd = typeof latest.cwd === "string" ? latest.cwd : process.cwd();
    void Promise.resolve(claim(cwd)).then(() => send("/agent/status", { ...latest, sessionId, pid: process.pid, cwd, label: labelFor(cwd), ts: Date.now(), connected: true }));
  };

  pi.events.on("agent-status:update", (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    latest = value as StatusUpdate;
    post();
  });
  pi.on("session_start", async (_event, ctx) => {
    latest.cwd = ctx.cwd;
    claim(ctx.cwd);
    heartbeat ??= setInterval(post, 15_000);
    heartbeat.unref();
  });
  pi.on("session_shutdown", async (_event, ctx) => {
    if (heartbeat) clearInterval(heartbeat);
    await send("/agent/status", { ...latest, sessionId, pid: process.pid, cwd: ctx.cwd, label: labelFor(ctx.cwd), ts: Date.now(), connected: false });
    await send("/agent/status/release", { sessionId });
  });
}

function resolveEndpoint(env: NodeJS.ProcessEnv = process.env, discoveryPath?: string): Endpoint | undefined {
  if (env.AGENT_STATUS_URL && env.AGENT_STATUS_TOKEN) return { url: env.AGENT_STATUS_URL, token: env.AGENT_STATUS_TOKEN };
  try {
    const path = discoveryPath || env.AGENT_STATUS_DISCOVERY || join(homedir(), ".wingman", "status.json");
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { url?: string; statusToken?: string };
    if (parsed.url && parsed.statusToken) return { url: parsed.url, token: parsed.statusToken };
  } catch {}
  return undefined;
}

function labelFor(cwd: string): string { return cwd.split(/[\\/]/).filter(Boolean).pop() || "agent"; }

export const testing = { resolveEndpoint, labelFor };
