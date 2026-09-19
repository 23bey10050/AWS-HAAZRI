import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { ok, err } from "../lib/http.js";

const client = new BedrockRuntimeClient({});

const SYSTEM_PROMPT = `You are a data extraction engine for a construction worker attendance system in India. You receive raw voice transcriptions in Hindi, English, or mixed Hindi-English (Hinglish).

Rules:
1. Return ONLY valid JSON. No markdown, no code fences, no explanation.
2. If a field cannot be determined, set it to null.
3. Worksite names often include the contractor's name (e.g., "Sharma ji ka site").
4. task_type must be one of: painting, plumbing, electrical, masonry, loading, digging, welding, carpentry, cleaning, gardening, farming, driving, tile_work, plastering, demolition, other, null.
5. shift_type must be one of: morning, afternoon, night, full_day, unknown.
6. If the transcript is too vague to extract anything reliable, return all fields null with confidence 0.0.

Output schema (exact keys, no extras):
{"worksite_name": string|null, "task_type": string|null, "contractor_name": string|null, "shift_type": string, "language_detected": string, "confidence": number}`;

const FALLBACK = {
  worksite_name: null,
  task_type: null,
  contractor_name: null,
  shift_type: "unknown",
  language_detected: "unknown",
  confidence: 0.0,
};

const stripFences = (text) => text.replace(/```json\s*|```/g, "").trim();

export const handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return err(400, "Invalid JSON body");
  }

  const { transcript } = body;
  if (!transcript || transcript.trim().length < 5) {
    return err(400, "Transcript too short");
  }

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: `Transcription: "${transcript}"` }] }],
  };

  try {
    const response = await client.send(
      new InvokeModelCommand({
        modelId: process.env.BEDROCK_MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
      })
    );
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const rawText = responseBody.content?.[0]?.text || "";
    const structured = JSON.parse(stripFences(rawText));
    return ok(structured);
  } catch (e) {
    console.error("Bedrock structuring failed, saving raw transcript only:", e);
    return ok(FALLBACK); // never fail the request — the raw transcript is still saved by the caller
  }
};
