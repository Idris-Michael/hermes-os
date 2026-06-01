# Google AI Pro (Gemini Omni) — n8n Setup

You're on the **Google AI Pro plan**, which gives you Gemini Omni (multimodal) with no per-generation cost — only concurrent throughput limits (60 RPM on Flash, 5 RPM on Pro).

This doc shows how to wire it into n8n once so every workflow can call it.

---

## 1. Get your API key (one-time, ~2 minutes)

1. Go to https://aistudio.google.com/apikey
2. Sign in with the Google account that holds your AI Pro subscription
3. Click **Create API key** → **Create API key in new project**
4. Copy the key (starts with `AIza...`)
5. Paste into `.env.local`:
   ```
   GEMINI_API_KEY=AIza...
   ```

---

## 2. Add Gemini as an n8n credential (one-time)

Two options — pick based on which n8n nodes you want to use.

### Option A — LangChain Gemini node (recommended for chat/reasoning)

Used by: any future workflow that needs Gemini as a chat model.

1. n8n → **Settings → Credentials → Add credential**
2. Search: **Google Gemini (PaLM) API**
3. Paste your `GEMINI_API_KEY`
4. Save as: `Gemini Omni — AI Pro`

Now any `@n8n/n8n-nodes-langchain.lmChatGoogleGemini` node can pick this credential from a dropdown.

### Option B — HTTP Request with env var (used by workflow 09)

Workflow 09 (`sc-vision-analyze`) calls Gemini via raw HTTP because it needs video URL ingestion via `file_data` — which the LangChain node doesn't expose yet.

For HTTP mode, the credential is just an n8n variable:

1. n8n → **Settings → Variables → Add variable**
2. Name: `GEMINI_API_KEY`
3. Value: paste your key
4. Save

The workflow then references it as `{{ $env.GEMINI_API_KEY }}` in the URL query string.

---

## 3. Model selection cheat sheet

| Task | Model | Why |
|------|-------|-----|
| Video / image analysis (multimodal) | `gemini-2.5-flash` | Multimodal in/out, ingests `file_data` URIs; current production default |
| Long-context reasoning (large prompts) | `gemini-2.5-pro` | 2M token context, slower, higher quality |
| TTS / voiceover generation | `gemini-2.5-flash-preview-tts` | Native TTS, multi-voice + multi-language |
| Image generation (Nano Banana) | `gemini-2.5-flash-image` | Generate / edit images in-pipeline |
| Quick chat / classification | `gemini-2.5-flash` | Fastest in latency terms |
| Latest preview (try before prod) | `gemini-3.1-flash-lite-preview` | Gemini 3.1 family, cheaper than 3 Pro |
| Embeddings (semantic search) | `text-embedding-004` | Used by knowledge-base / memory layer |

**On the AI Pro plan, all of these are flat-rate** — pick by latency + quality, not cost.

---

## 4. Workflows currently using Gemini

| Workflow | Purpose | Model |
|----------|---------|-------|
| `09-sc-vision-analyze.json` | Competitor reel → JSON hooks | `gemini-2.5-flash` |
| (planned) `10-sc-script-from-vision.json` | Vision JSON → 3 script variants | `gemini-2.0-pro-exp` |
| (planned) `11-sc-pillar-batch-vision.json` | 5 competitor URLs → comparison table | `gemini-2.5-flash` |

---

## 5. Test your setup

After adding `GEMINI_API_KEY` to n8n Variables, test from your terminal first to confirm the key works:

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hello in 5 words."}]}]}'
```

You should get a JSON response with `candidates[0].content.parts[0].text` containing 5 words.

If that works, n8n workflow 09 will work — it uses the same key, same endpoint, just with a `file_data` part added for video ingestion.

---

## 6. Rate limits (AI Pro plan)

| Model | RPM | TPM (tokens/min) | Daily |
|-------|-----|------------------|-------|
| `gemini-2.5-flash` | 60 | 1,000,000 | unlimited |
| `gemini-2.0-pro-exp` | 5 | 32,000 | 50 |

For Severus volume (5–10 vision analyses/day, 10–20 script generations/day), you're nowhere near the ceiling.

**If you hit the Pro 50/day cap:** route long-context jobs to Flash with chunking. Flash handles 1M context, which is more than enough for reel scripts.

---

## 7. Cost reality check

Google AI Pro plan: **£18.99/month** (UK) — flat rate, no per-token billing.

Equivalent pay-as-you-go usage at Severus volume:
- 200 vision analyses × ~0.01 USD = $2
- 400 script generations × ~0.003 USD = $1.20
- 100 long-context jobs × ~0.05 USD = $5
- **Total PAYG: ~$8/month**

So the Pro plan is slightly more expensive than PAYG for current volume — but gives you:
- Predictable monthly cost (no surprise spike if a workflow loops)
- Higher rate limits than free tier
- Access to experimental models (Omni, Veo, Imagen) as they roll out

Worth it if you'll scale past 10 reels/day or start using Veo for video generation.
