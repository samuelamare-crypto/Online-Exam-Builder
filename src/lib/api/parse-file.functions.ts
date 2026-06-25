import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const SYSTEM_PROMPT = `You are a question extractor. Extract ALL exam questions from the provided text and return ONLY a valid JSON array — no markdown fences, no explanation, nothing else.

Each object must have:
- "type": "multiple_choice" | "short_answer" | "checkbox"
- "text": the question text (string)
- multiple_choice: "options" (string array), "answer" (0-based index of correct option)
- checkbox: "options" (string array), "answers" (array of 0-based indices of correct options)
- short_answer: "answer" (string, or "" if not stated)
Default to multiple_choice when unsure. Preserve every option exactly as written. Return ONLY the JSON array.`;

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs") as any;

  // Point to the local worker file so it works in Node without fetching from CDN
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const workerPath = resolve(
    __dirname,
    "../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

  const data = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => item.str).join(" ") + "\n";
  }
  return text;
}

async function callClaude(text: string): Promise<any[]> {
  // Try with API key first (set in Lovable Secrets as ANTHROPIC_API_KEY)
  // If not set, fall through to the no-key proxy path that Lovable provides
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Extract all exam questions from this document:\n\n${text.slice(0, 14000)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const result = await response.json();
  if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));

  const raw = (result.content || [])
    .map((b: { text?: string }) => b.text || "")
    .join("")
    .trim();

  const clean = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error(`AI response was not valid JSON: ${clean.slice(0, 300)}`);
  }
}

export const parseFileQuestions = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      base64: z.string().min(1),
      ext: z.enum(["pdf", "docx"]),
    })
  )
  .handler(async ({ data }) => {
    const buffer = Buffer.from(data.base64, "base64");

    let text = "";
    if (data.ext === "docx") {
      text = await extractDocxText(buffer);
    } else {
      text = await extractPdfText(buffer);
    }

    if (!text || text.trim().length < 20) {
      throw new Error(
        "Could not extract readable text from the file. " +
        "Make sure the document is not a scanned image-only file."
      );
    }

    const questions = await callClaude(text);
    return { questions };
  });
