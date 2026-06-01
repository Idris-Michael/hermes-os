import https from "https";
import { spawn } from "child_process";
import path from "path";
import { enqueueTask, getQueueStatus } from "./jobQueue.js";

function log(line: string): void {
  process.stdout.write(`${new Date().toISOString()} ${line}\n`);
}

const getBotToken = (): string => process.env.TELEGRAM_BOT_TOKEN ?? "";
const getChatId = (): string => process.env.TELEGRAM_CHAT_ID ?? "";
const getWebhookSecret = (): string => process.env.TELEGRAM_WEBHOOK_SECRET ?? "";

// ── Poll health state (exported for /api/health) ──────────────────────────────
let _pollingActive = false;
let _lastPollAt = 0;
let _pollErrors = 0;
let _pollStarted = false;

export function getPollingHealth(): { active: boolean; lastPollAt: number; errors: number } {
  return { active: _pollingActive, lastPollAt: _lastPollAt, errors: _pollErrors };
}

// ── Allowed chat IDs ──────────────────────────────────────────────────────────
const ALLOWED_CHATS = new Set<string>();

export function allowChat(chatId: string): void {
  ALLOWED_CHATS.add(chatId);
}

export function validateChatId(chatId: number | string): boolean {
  const owner = getChatId();
  if (owner) ALLOWED_CHATS.add(owner);
  return ALLOWED_CHATS.has(String(chatId));
}

export function validateWebhookSecret(header: string | undefined): boolean {
  const secret = getWebhookSecret();
  if (!secret) return true;
  return header === secret;
}

// ── Telegram HTTPS request ────────────────────────────────────────────────────
export async function telegramRequest(
  method: string,
  body: Record<string, unknown>
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${getBotToken()}/${method}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch {
          reject(new Error(`Telegram returned non-JSON: ${data.slice(0, 100)}`));
        }
      });
    });
    req.on("error", (err) => reject(err));
    req.setTimeout(35000, () => req.destroy(new Error("request timeout")));
    req.write(payload);
    req.end();
  });
}

// ── Long-poll loop ─────────────────────────────────────────────────────────────
export async function startPolling(): Promise<void> {
  // Guard: only one polling loop ever
  if (_pollStarted) {
    log("[telegram] startPolling called again — ignoring duplicate");
    return;
  }
  _pollStarted = true;
  _pollingActive = true;

  const token = getBotToken();
  if (!token) {
    log("[telegram] TELEGRAM_BOT_TOKEN not set — polling disabled");
    _pollingActive = false;
    return;
  }

  const ownerChat = getChatId();
  if (ownerChat) ALLOWED_CHATS.add(ownerChat);

  await telegramRequest("deleteWebhook", {}).catch(() => {});
  log(`[telegram] long-poll started — token=...${token.slice(-6)} allowlist=[${[...ALLOWED_CHATS].join(",")}]`);

  let offset = 0;
  let cycle = 0;
  let backoff = 1000; // ms — doubles on consecutive errors, resets on success

  const poll = async (): Promise<void> => {
    cycle++;
    try {
      const data = await telegramRequest("getUpdates", {
        offset,
        timeout: 10,
        allowed_updates: ["message", "callback_query"],
      }) as { ok: boolean; result?: Array<{ update_id: number; message?: TelegramUpdate["message"] }>; description?: string };

      _lastPollAt = Date.now();

      // Explicit ok:false check — log and back off instead of silent skip
      if (!data.ok) {
        _pollErrors++;
        log(`[telegram] getUpdates returned ok=false: ${data.description ?? JSON.stringify(data)}`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 60000);
        setTimeout(poll, 100);
        return;
      }

      // Success — reset backoff and log periodically
      backoff = 1000;
      _pollErrors = 0;

      if (cycle <= 3 || (data.result?.length ?? 0) > 0) {
        log(`[telegram] poll #${cycle} updates=${data.result?.length ?? 0} offset=${offset}`);
      }

      for (const update of data.result ?? []) {
        // Advance offset before dispatch so a crash doesn't re-process the same message
        offset = update.update_id + 1;
        if (update.message) {
          const chatId = String(update.message.chat.id);
          if (update.message.chat.type === "group" || update.message.chat.type === "supergroup") {
            allowChat(chatId);
          }
          log(`[telegram] msg chat_id=${chatId} text="${(update.message.text ?? "").slice(0, 60)}"`);
          dispatchUpdate({ message: update.message }).catch((e) =>
            log(`[telegram] dispatch error: ${(e as Error)?.message ?? e}`)
          );
        }
      }
    } catch (err) {
      _pollErrors++;
      log(`[telegram] poll error (attempt ${_pollErrors}): ${(err as Error)?.message ?? err}`);
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 60000); // cap at 60s
    }

    setTimeout(poll, 100);
  };

  // Wrap initial invocation so a sync throw doesn't silently kill polling
  poll().catch((err) => {
    log(`[telegram] FATAL poll crash: ${(err as Error)?.message ?? err}`);
    _pollingActive = false;
    // Restart polling after 5s
    setTimeout(() => {
      _pollStarted = false;
      startPolling().catch(console.error);
    }, 5000);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Message sending ────────────────────────────────────────────────────────────
function chunkForTelegram(text: string, max = 3800): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > max) {
    let cut = remaining.lastIndexOf("\n\n", max);
    if (cut < max * 0.5) cut = remaining.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = max;
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function sendMessage(text: string, chatId?: string): Promise<void> {
  const target = chatId ?? getChatId();
  const parts = chunkForTelegram(text);
  for (let i = 0; i < parts.length; i++) {
    const body = parts.length > 1 ? `${parts[i]}\n\n<i>— part ${i + 1}/${parts.length}</i>` : parts[i];
    await telegramRequest("sendMessage", {
      chat_id: target,
      text: body,
      parse_mode: "HTML",
    });
  }
}

export async function registerWebhook(publicUrl: string): Promise<void> {
  const url = `${publicUrl}/telegram/webhook`;
  const result = (await telegramRequest("setWebhook", {
    url,
    secret_token: getWebhookSecret() || undefined,
    allowed_updates: ["message", "callback_query"],
  })) as { ok: boolean; description?: string };
  if (!result.ok) {
    console.error("[telegram] webhook registration failed:", result.description);
  } else {
    console.log(`[telegram] webhook registered → ${url}`);
  }
}

// ── Pipeline runner ────────────────────────────────────────────────────────────
interface PipelineDef { cmd: string; args: string[]; cwd: string }
const ALLOWED_PIPELINES: Record<string, PipelineDef> = {
  heartbeat: { cmd: "npm", args: ["run", "heartbeat"], cwd: "../severus-social" },
  score:     { cmd: "npm", args: ["run", "score"],     cwd: "../severus-social" },
  insights:  { cmd: "npm", args: ["run", "pull-insights"], cwd: "../severus-social" },
  feedback:  { cmd: "npm", args: ["run", "feedback"],  cwd: "../severus-social" },
};

async function triggerPipeline(name: string, chatId: string): Promise<void> {
  const entry = ALLOWED_PIPELINES[name];
  if (!entry) {
    await sendMessage(`❌ Unknown pipeline <b>${name}</b>. Available: ${Object.keys(ALLOWED_PIPELINES).join(", ")}`, chatId);
    return;
  }
  await sendMessage(`🚀 Triggering <b>${name}</b> pipeline…`, chatId);
  const cwd = path.resolve(process.cwd(), entry.cwd);
  const child = spawn(entry.cmd, entry.args, { cwd, shell: true, env: { ...process.env } });
  let output = "";
  child.stdout.on("data", (data: Buffer) => (output += data.toString()));
  child.stderr.on("data", (data: Buffer) => (output += data.toString()));
  child.on("close", async (code) => {
    const tail = output.slice(-800);
    await sendMessage(`✅ <b>${name}</b> exited (${code})\n<pre>${tail}</pre>`, chatId);
  });
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface TelegramUpdate {
  message?: {
    chat: { id: number; title?: string; type?: string };
    text?: string;
    voice?: { file_id: string; duration: number; mime_type?: string };
    audio?: { file_id: string; duration: number; mime_type?: string };
    from?: { id: number; username?: string };
  };
}

// ── Agent shortcut commands ────────────────────────────────────────────────────
type AgentShortcut = { agent: string; brief: (args: string[]) => string; guarded?: boolean };
const AGENT_COMMANDS: Record<string, AgentShortcut> = {
  "/audit_upwork":  { agent: "jack-of-diamonds",  brief: () => "Audit Upwork profile vs Upwork_Agentic_AI_Jobs_May2026.md feed. Compare to triple-threat bio (Upwork_Bio_2026.md). Output: 3 minified proposal responses." },
  "/audit_linkedin":{ agent: "queen-of-diamonds", brief: () => "Audit LinkedIn page vs MikeB BusinessBrain.md. Cross-ref GA4 Architecture + Next.js Engineering skill maps. Output: updated bio copy aligned to platform focus." },
  "/render_reel":   { agent: "queen-of-hearts",   brief: (args) => { const [pillar, ...topic] = args; return `Render IG reel — pillar=${pillar ?? "transformation"} topic="${topic.join(" ") || "auto"}". Use 5 hook frameworks. HF PRO + Hyperframes.`; }, guarded: true },
  "/audit_ga4":     { agent: "king-of-clubs",     brief: (args) => `GA4 audit for ${args.join(" ") || "current client"}. Check events, conversions, attribution model, tag wiring.` },
  "/audit_meta":    { agent: "queen-of-spades",   brief: (args) => `Meta Ads audit for ${args.join(" ") || "current account"}. Check Pixel/CAPI, EMQ, creative diversity, learning phase, Advantage+.` },
  "/audit_google":  { agent: "king-of-spades",    brief: (args) => `Google Ads audit for ${args.join(" ") || "current account"}. Check conversion tracking, wasted spend, Quality Score, PMax health.` },
  "/write_ads":     { agent: "king-of-hearts",    brief: (args) => `Write ad copy for ${args.join(" ") || "current brief"}. Output headlines, primary text, descriptions, CTAs per platform.` },
  "/strategy":      { agent: "ace-of-spades",     brief: (args) => `Campaign strategy brief: ${args.join(" ") || "request details"}. Output: positioning, audience, funnel, channel mix.` },
  "/build":         { agent: "jack-of-clubs",     brief: (args) => `Build feature: ${args.join(" ") || "request details"}. Output implementation plan + first commit.` },
  "/automate":      { agent: "ace-of-clubs",      brief: (args) => `Automate flow: ${args.join(" ") || "request details"}. Output: n8n workflow + cron schedule.` },
  "/biz_dev":       { agent: "ace-of-diamonds",   brief: (args) => `Biz dev — prospect: ${args.join(" ") || "current pipeline"}. Output outreach sequence + ICP fit score.` },
  "/creative":      { agent: "ace-of-hearts",     brief: (args) => `Creative direction: ${args.join(" ") || "current brief"}. Output mood, palette, type, reference set.` },
  "/ugc":           { agent: "queen-of-hearts",   brief: (args) => `UGC brief: ${args.join(" ") || "request details"}. Output script, shot list, talent ask.`, guarded: true },
  "/track":         { agent: "king-of-clubs",     brief: (args) => `Tracking issue: ${args.join(" ") || "describe"}. Diagnose attribution + propose fix.` },
  "/shopping":      { agent: "king-of-diamonds",  brief: (args) => `Shopping/eComm ad plan for ${args.join(" ") || "current client"}. Output feed health + campaign structure.` },
  "/a11y":          { agent: "queen-of-clubs",    brief: (args) => `Accessibility review: ${args.join(" ") || "current page"}. WCAG 2.2 audit + remediation list.` },
  "/bundle":        { agent: "jack-of-spades",    brief: (args) => `Bundle orchestration: ${args.join(" ") || "current project"}. Plan deliverable stack + dependencies.` },
};

function summarize(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : flat.slice(0, max - 1) + "…";
}

// ── Dispatch incoming messages ─────────────────────────────────────────────────
export async function dispatchUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message;
  if (!msg) return;

  const chatId = String(msg.chat.id);
  if (!validateChatId(chatId)) return;

  // Voice / audio → transcribe → re-dispatch as text
  if (msg.voice || msg.audio) {
    const fileId = (msg.voice ?? msg.audio)!.file_id;
    const duration = (msg.voice ?? msg.audio)!.duration;
    log(`[telegram] voice note chat_id=${chatId} duration=${duration}s`);
    try {
      const { downloadTelegramFile, transcribeAudio } = await import("./transcribe.js");
      const botToken = getBotToken();
      if (!botToken) { await sendMessage("⚠️ Voice notes need TELEGRAM_BOT_TOKEN configured.", chatId); return; }
      const { buffer, mimeType } = await downloadTelegramFile(fileId, botToken);
      const transcript = await transcribeAudio(buffer, mimeType);
      if (!transcript) { await sendMessage("⚠️ Could not transcribe — try again or type it.", chatId); return; }
      await sendMessage(`<i>🎙️ "${transcript}"</i>`, chatId);
      await dispatchUpdate({ message: { chat: msg.chat, text: transcript, from: msg.from } });
    } catch (err) {
      await sendMessage(`⚠️ Voice transcription failed: ${(err as Error).message}`, chatId);
    }
    return;
  }

  if (!msg.text) return;

  log(`[telegram] dispatch chat_id=${chatId} text="${msg.text.slice(0, 40)}"`);

  const text = msg.text.trim();
  const [cmd, ...args] = text.split(/\s+/);

  switch (cmd.toLowerCase()) {
    case "/status": {
      const status = getQueueStatus();
      const health = getPollingHealth();
      const pollAge = health.lastPollAt ? Math.floor((Date.now() - health.lastPollAt) / 1000) : -1;
      await sendMessage(
        `🔧 <b>Hermes Hub Status</b>\n` +
        `Queued: ${status.queued} · In progress: ${status.inProgress} · Done today: ${status.completedToday}\n` +
        `Uptime: ${Math.floor(process.uptime() / 60)}m\n` +
        `Telegram: ${health.active ? "✅ polling" : "❌ down"} · last poll ${pollAge}s ago · errors: ${health.errors}`,
        chatId
      );
      break;
    }

    case "/task": {
      const [agent, ...rest] = args;
      if (!agent || rest.length === 0) { await sendMessage("Usage: /task &lt;agent&gt; &lt;instruction&gt;", chatId); return; }
      const id = enqueueTask(agent, rest.join(" "));
      await sendMessage(`✅ #${id} → <b>${agent}</b>: ${summarize(rest.join(" "))}`, chatId);
      break;
    }

    case "/trigger": {
      const [pipeline] = args;
      if (!pipeline) { await sendMessage(`Usage: /trigger &lt;pipeline&gt;\nAvailable: ${Object.keys(ALLOWED_PIPELINES).join(", ")}`, chatId); return; }
      await triggerPipeline(pipeline, chatId);
      break;
    }

    case "/approve": {
      const [slotId, variantId] = args;
      if (!slotId || !variantId) { await sendMessage("Usage: /approve &lt;slot_id&gt; &lt;variant_id&gt;", chatId); return; }
      await sendMessage(`✅ Approval recorded for slot <b>${slotId}</b> variant <b>${variantId}</b>`, chatId);
      break;
    }

    case "/reject": {
      const [slotId] = args;
      if (!slotId) { await sendMessage("Usage: /reject &lt;slot_id&gt;", chatId); return; }
      await sendMessage(`❌ Slot <b>${slotId}</b> rejected.`, chatId);
      break;
    }

    case "/help": {
      await sendMessage(
        `<b>Hermes Hub — Mobile Commands</b>\n\n` +
        `<b>Core</b>\n/status · /task &lt;agent&gt; &lt;brief&gt; · /trigger &lt;pipe&gt;\n/approve &lt;slot&gt; &lt;variant&gt; · /reject &lt;slot&gt;\n\n` +
        `<b>Hermes Command 🃏</b>\n/audit_upwork · /audit_linkedin · /strategy · /biz_dev · /bundle\n\n` +
        `<b>Ads &amp; Growth 📈</b>\n/audit_ga4 · /audit_meta · /audit_google · /shopping · /track\n\n` +
        `<b>Creative &amp; Content 🎨</b>\n/render_reel &lt;pillar&gt; &lt;topic&gt; · /ugc · /creative · /write_ads · /a11y\n\n` +
        `<b>Build &amp; Systems 🔧</b>\n/build · /automate`,
        chatId
      );
      break;
    }

    default: {
      const shortcut = AGENT_COMMANDS[cmd.toLowerCase()];
      if (shortcut) {
        if (shortcut.guarded) {
          const q = getQueueStatus();
          if (q.inProgress > 0) { await sendMessage(`⏸ Pipeline busy (${q.inProgress} in progress). Try /status.`, chatId); return; }
        }
        const brief = shortcut.brief(args);
        const id = enqueueTask(shortcut.agent, brief);
        await sendMessage(`✅ #${id} → <b>${shortcut.agent}</b>: ${summarize(brief)}`, chatId);
        return;
      }

      if (text.startsWith("/")) { await sendMessage(`Unknown command. Send /help, or just type a question.`, chatId); return; }

      // Natural language → /api/chat
      try {
        const res = await fetch("http://localhost:3000/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text, chat_id: chatId }),
        });
        const data = await res.json() as { reply?: string; tool_calls?: Array<{ tool: string; error?: string }>; error?: string };
        if (data.error) {
          await sendMessage(`⚠️ ${data.error}`, chatId);
        } else {
          const tools = data.tool_calls ?? [];
          const trace = tools.length > 0 ? `<i>🔧 ${tools.map((t) => t.tool + (t.error ? "❌" : "")).join(" → ")}</i>\n\n` : "";
          await sendMessage(trace + (data.reply ?? "(no reply)"), chatId);
        }
      } catch (err) {
        await sendMessage(`⚠️ Hermes is offline: ${(err as Error).message}`, chatId);
      }
    }
  }
}
