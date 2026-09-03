import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  businessName: z.string().trim().max(200).default(""),
  title: z.string().trim().max(200).default(""),
  subtitle: z.string().trim().max(200).nullable().default(null),
  totalSteps: z.number().int().min(0).max(32),
  rewards: z
    .array(z.object({ step: z.number().int().min(1).max(32), label: z.string().trim().max(200) }))
    .max(32)
    .default([]),
});

/** Generates customer-facing terms text from the card the owner just designed. */
export const generateCardTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const rewardLines = data.rewards.length
      ? data.rewards
          .sort((a, b) => a.step - b.step)
          .map((r) => `- step ${r.step}: "${r.label}"`)
          .join("\n")
      : "- no reward steps defined";

    const prompt = [
      "Write the terms and conditions text for a digital loyalty stamp card.",
      "",
      `Business: ${data.businessName || "the business"}`,
      `Card name: ${data.title || "Loyalty card"}`,
      data.subtitle ? `Card subtitle: ${data.subtitle}` : "",
      `Total stamps on the card: ${data.totalSteps}`,
      "Reward steps:",
      rewardLines,
      "",
      "Requirements:",
      "- Plain English, friendly but precise, addressed to the customer.",
      "- 120-220 words, short paragraphs or bullet points, no markdown headings, no bold markers.",
      "- Explain concretely how stamps are collected (staff scans the customer QR, one stamp per qualifying visit), which stamp numbers unlock which reward, and that each reward becomes a voucher redeemed by scanning.",
      "- Mention that stamps and vouchers have no cash value, are not transferable, rewards are subject to availability, and the business may change or end the programme where permitted by law.",
      "- Output only the terms text, nothing else.",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        input: prompt,
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
      }),
    });

    if (!res.ok || !res.body) {
      const message = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI is busy right now. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
      throw new Error(message || "Could not generate terms right now.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
            text += event.delta;
          } else if (event.type === "response.completed" && !text && event.response?.output_text) {
            text = event.response.output_text;
          }
        } catch {
          /* Ignore keep-alive and partial frames. */
        }
      }
    }

    const terms = text.trim();
    if (terms.length < 10) throw new Error("The AI returned an empty result. Please try again.");
    return { terms };
  });
