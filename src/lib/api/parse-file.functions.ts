import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYSTEM_PROMPT = `You are a question extractor. Extract ALL exam questions from the provided text and return ONLY a valid JSON array — no markdown fences, no explanation, nothing else.

Each object must have:
- "type": "multiple_choice" | "short_answer" | "checkbox"
- "text": the question text (string)
- multiple_choice: "options" (string array), "answer" (0-based index of correct option)
- checkbox: "options" (string array), "answers" (array of 0-based indices of correct options)
- short_answer: "answer" (string, or "" if not stated)
Default to multiple_choice when unsure. Preserve every option exactly as written. Return ONLY the JSON array.`;

// 8 MB raw-file cap. Generous for text-based docx/pdf exam papers, small
// enough to avoid pinning memory/CPU on a single request.
const MAX_FILE_BYTES = 8 * 1024 * 1024;

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjsLib = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as any;

  // IMPORTANT: do NOT point GlobalWorkerOptions.workerSrc at a node_modules
  // file path here. A previous version resolved it via
  // resolve(__dirname, "../../../node_modules/pdfjs-dist/...") — that only
  // happened to work in local `vite build` output (where the directory
  // depth lined up by coincidence) and breaks completely once this function
  // is bundled for a serverless/edge target (e.g. the Cloudflare Workers
  // build this project ships with by default), because there is no
  // node_modules directory on disk at runtime there.
  //
  // pdfjs-dist's "legacy" build already falls back to running its worker
  // logic synchronously, in-process, whenever no `Worker` global is
  // available (true for Node and for Workers/edge runtimes) — so we simply
  // leave workerSrc unset and let that fallback kick in. This is what makes
  // PDF parsing portable across dev, Node hosting, and Cloudflare.
  const data = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => item.str).join(" ") + "\n";
  }
  return text;
}

async function callClaude(text: string): Promise<any[]> {
  // Required for DOCX/PDF AI extraction to work at all, anywhere this app
  // is hosted *outside* the Lovable editor/preview (Lovable injects this
  // for you there). Set it as a real secret on your hosting platform, or
  // in a local .env file when running `vite dev` — see .env.example.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI document parsing isn't configured: the ANTHROPIC_API_KEY environment " +
      "variable is missing on this server. Add it as a secret/env var (see " +
      ".env.example) and redeploy, or import questions via .json/.csv instead."
    );
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
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
    if (response.status === 401) {
      throw new Error(
        "AI document parsing failed: the configured ANTHROPIC_API_KEY was rejected. " +
        "Double-check the key value on your hosting platform."
      );
    }
    if (response.status === 429) {
      throw new Error("AI document parsing failed: rate limit reached. Please try again shortly.");
    }
    throw new Error(`Anthropic API error ${response.status}: ${body.slice(0, 300)}`);
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
  .validator(
    z.object({
      base64: z.string().min(1),
      ext: z.enum(["pdf", "docx"]),
    })
  )
  .handler(async ({ data }) => {
    const buffer = Buffer.from(data.base64, "base64");

    if (buffer.byteLength > MAX_FILE_BYTES) {
      throw new Error(
        `File is too large (${(buffer.byteLength / (1024 * 1024)).toFixed(1)} MB). ` +
        `Please upload a file under ${MAX_FILE_BYTES / (1024 * 1024)} MB.`
      );
    }

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
