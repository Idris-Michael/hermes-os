// Voice transcription via Gemini 2.0 Flash (audio input).
// Used by the Telegram gateway to turn voice notes into text before passing
// them into the orchestrator.

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  const base64Audio = audioBuffer.toString("base64");
  const r = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "Transcribe this audio verbatim. Return ONLY the transcript text, no preamble, no commentary, no quotes." },
          { inlineData: { mimeType, data: base64Audio } },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 1000 },
    }),
  });
  const data = await r.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };
  if (data.error) throw new Error(`Gemini: ${data.error.message ?? "unknown error"}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

export async function downloadTelegramFile(fileId: string, botToken: string): Promise<{ buffer: Buffer; mimeType: string }> {
  // Step 1: get the file path
  const meta = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const metaJson = await meta.json() as { ok: boolean; result?: { file_path?: string }; description?: string };
  if (!metaJson.ok || !metaJson.result?.file_path) {
    throw new Error(`Telegram getFile failed: ${metaJson.description ?? "no file_path"}`);
  }
  // Step 2: download the file
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${metaJson.result.file_path}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error(`Telegram file download failed: ${fileRes.status}`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  // Telegram voice messages are opus in ogg container — Gemini accepts audio/ogg
  const ext = metaJson.result.file_path.split(".").pop()?.toLowerCase() ?? "";
  const mimeType =
    ext === "oga" || ext === "ogg" ? "audio/ogg" :
    ext === "mp3" ? "audio/mp3" :
    ext === "m4a" ? "audio/mp4" :
    ext === "wav" ? "audio/wav" :
    "audio/ogg";
  return { buffer, mimeType };
}
