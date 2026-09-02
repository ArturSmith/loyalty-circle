import { z } from "zod";

export const DEFAULT_CARD_TERMS =
  "Stamps and rewards have no cash value and are not transferable. Rewards are subject to availability. The issuing business may change or end this loyalty program where permitted by law";

/** The editable card data used by both onboarding and the card wizard. */
export const cardDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().nullable(),
  corner_title: z.string().nullable(),
  total_steps: z.number().int().min(0).max(32),
  shape: z.enum(["rounded", "square", "ticket"]),
  stamp_shape: z.enum(["circle", "square", "diamond", "heart"]).optional(),
  step_size: z.string().optional(),
  bg_color: z.string(),
  accent_color: z.string(),
  text_color: z.string(),
  stamp_icon: z.enum([
    "scissors",
    "coffee",
    "sparkles",
    "star",
    "heart",
    "flame",
    "cookie",
    "wine",
  ]),
  logo_url: z.string().nullable(),
  rewards: z.array(
    z.object({ step: z.number().int().min(1).max(32), label: z.string().trim().min(1) }),
  ),
  active: z.boolean(),
  grid_cols: z.number().int().min(1).max(8).nullable(),
  terms_and_conditions: z.string().trim().min(10).max(20000),
});

export type CardDraft = z.infer<typeof cardDraftSchema>;
