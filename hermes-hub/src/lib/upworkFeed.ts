// Upwork RSS feed fetcher.
// Pulls latest jobs from saved-search RSS URLs in UPWORK_RSS_URLS (.env.local,
// comma-separated). Writes them into Upwork_Agentic_AI_Jobs_May2026.md between
// the <!-- FEED_START --> / <!-- FEED_END --> markers, deduped by job URL.

import fs from "node:fs";
import path from "node:path";

const FEED_PATH = path.join(
  process.cwd(),
  "..",
  "severus-connects-prompts",
  "Upwork_Agentic_AI_Jobs_May2026.md",
);

interface UpworkJob {
  title: string;
  link: string;          // unique key
  pubDate: string;
  description: string;
  budget?: string;
  hourlyRange?: string;
  country?: string;
}

const START = "<!-- FEED_START -->";
const END = "<!-- FEED_END -->";

function parseRss(xml: string): UpworkJob[] {
  // Lightweight regex-based RSS parser — Upwork's feed is consistent enough not to need a full parser
  const items: UpworkJob[] = [];
  const itemRx = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRx.exec(xml)) !== null) {
    const block = m[1];
    const pick = (tag: string): string => {
      const r = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
      const raw = r?.[1] ?? "";
      return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
    };
    const title = pick("title");
    const link = pick("link");
    if (!title || !link) continue;
    const description = pick("description")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    // Extract budget / hourly from the description block (Upwork includes them)
    const budgetMatch = description.match(/Budget:\s*\$?([\d,]+(?:\.\d+)?)/i);
    const hourlyMatch = description.match(/Hourly Range:\s*\$?([\d.]+)\s*-\s*\$?([\d.]+)/i);
    const countryMatch = description.match(/Country:\s*([A-Za-z ]+)/);
    items.push({
      title,
      link,
      pubDate: pick("pubDate"),
      description,
      budget: budgetMatch?.[1],
      hourlyRange: hourlyMatch ? `$${hourlyMatch[1]}-$${hourlyMatch[2]}/hr` : undefined,
      country: countryMatch?.[1]?.trim(),
    });
  }
  return items;
}

function renderJob(job: UpworkJob): string {
  const lines = [
    `### ${job.title}`,
    `- **Link:** ${job.link}`,
    `- **Posted:** ${job.pubDate}`,
  ];
  if (job.budget) lines.push(`- **Budget:** $${job.budget}`);
  if (job.hourlyRange) lines.push(`- **Hourly:** ${job.hourlyRange}`);
  if (job.country) lines.push(`- **Country:** ${job.country}`);
  lines.push("", job.description.slice(0, 2000));
  return lines.join("\n");
}

function readFeedFile(): { header: string; body: string; footer: string } {
  if (!fs.existsSync(FEED_PATH)) {
    return {
      header: "# Upwork Job Feed\n\n",
      body: "",
      footer: "",
    };
  }
  const text = fs.readFileSync(FEED_PATH, "utf8");
  const startIdx = text.indexOf(START);
  const endIdx = text.indexOf(END);
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
    return { header: text, body: "", footer: "" };
  }
  return {
    header: text.slice(0, startIdx + START.length),
    body: text.slice(startIdx + START.length, endIdx).trim(),
    footer: text.slice(endIdx),
  };
}

export interface FetchResult {
  fetched: number;
  added: number;
  total: number;
  skippedFeeds: Array<{ url: string; error: string }>;
}

export async function fetchUpworkFeeds(): Promise<FetchResult> {
  const urlsCsv = process.env.UPWORK_RSS_URLS ?? "";
  const urls = urlsCsv.split(",").map((u) => u.trim()).filter(Boolean);
  if (urls.length === 0) {
    throw new Error("UPWORK_RSS_URLS not configured in .env.local (comma-separated saved-search RSS URLs)");
  }

  const allJobs: UpworkJob[] = [];
  const skippedFeeds: FetchResult["skippedFeeds"] = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) {
        skippedFeeds.push({ url, error: `HTTP ${r.status}` });
        continue;
      }
      const xml = await r.text();
      allJobs.push(...parseRss(xml));
    } catch (e) {
      skippedFeeds.push({ url, error: (e as Error).message });
    }
  }

  // Dedupe against existing body — match by link
  const { header, body, footer } = readFeedFile();
  const existingLinks = new Set<string>();
  const linkRx = /\*\*Link:\*\*\s*(https?:\/\/[^\s)]+)/g;
  let lm: RegExpExecArray | null;
  while ((lm = linkRx.exec(body)) !== null) existingLinks.add(lm[1]);

  const newJobs = allJobs.filter((j) => !existingLinks.has(j.link));
  // Cap total feed size — keep newest 60 jobs to stop the file growing forever
  const existingBlocks = body.split(/\n---\n/g).filter((b) => b.trim().length > 0);
  const newBlocks = newJobs.map(renderJob);
  const combined = [...newBlocks, ...existingBlocks].slice(0, 60);
  const newBody = "\n" + combined.join("\n\n---\n\n") + "\n";

  fs.writeFileSync(FEED_PATH, header + newBody + footer, "utf8");
  return {
    fetched: allJobs.length,
    added: newJobs.length,
    total: Math.min(allJobs.length + existingBlocks.length, 60),
    skippedFeeds,
  };
}

// Lightweight per-process cron — fires every 2h while the server is running.
// Idempotent: dedupe guard above means safe to call multiple times.
let cronStarted = false;
export function startUpworkCron(): void {
  if (cronStarted) return;
  cronStarted = true;
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  // Initial fetch on boot (after a short delay so server is fully ready)
  setTimeout(() => {
    fetchUpworkFeeds()
      .then((r) => console.log(`[upwork-feed] initial fetch: added=${r.added} fetched=${r.fetched} total=${r.total}`))
      .catch((e) => console.error(`[upwork-feed] initial fetch failed: ${(e as Error).message}`));
  }, 10_000);
  setInterval(() => {
    fetchUpworkFeeds()
      .then((r) => console.log(`[upwork-feed] tick: added=${r.added} fetched=${r.fetched}`))
      .catch((e) => console.error(`[upwork-feed] tick failed: ${(e as Error).message}`));
  }, TWO_HOURS);
}

export function appendManualJob(title: string, jobText: string, link?: string): void {
  const { header, body, footer } = readFeedFile();
  const fakeLink = link ?? `manual://${Date.now()}`;
  const block = [
    `### ${title}`,
    `- **Link:** ${fakeLink}`,
    `- **Posted:** ${new Date().toUTCString()}`,
    `- **Source:** Manual paste via Telegram`,
    "",
    jobText.slice(0, 4000),
  ].join("\n");
  // Normalize separators — if existing body is non-empty, ensure clean \n\n---\n\n join
  const trimmedBody = body.trim();
  const newBody = trimmedBody
    ? "\n" + block + "\n\n---\n\n" + trimmedBody + "\n"
    : "\n" + block + "\n";
  fs.writeFileSync(FEED_PATH, header + newBody + footer, "utf8");
}
