import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const num = z.number().nullable();

const Item = z.object({
  name: z.string(),
  quantity: z.string().describe("Human portion, e.g. '2 pieces', '1 cup', '150 g'"),
  grams: num,
  calories: num,
  protein_g: num,
  carbs_g: num,
  fat_g: num,
  fiber_g: num,
});

const Micros = z.object({
  sugar_g: num,
  sodium_mg: num,
  potassium_mg: num,
  calcium_mg: num,
  iron_mg: num,
  magnesium_mg: num,
  zinc_mg: num,
  vitamin_a_mcg: num,
  vitamin_c_mg: num,
  vitamin_d_mcg: num,
  vitamin_b12_mcg: num,
  folate_mcg: num,
});

const LocationType = z.enum(["home", "outside", "unknown"]);

export const ChatResult = z.object({
  reply: z.string().describe("Short, friendly chat reply shown to the user"),
  new_meals: z.array(
    z.object({
      description: z.string().describe("Short meal name, e.g. 'Idli, sambar and coconut chutney'"),
      eaten_at: z.string().nullable().describe("ISO 8601 with offset; null means now"),
      location_type: LocationType,
      place: z.string().nullable(),
      amount_spent: num,
      currency: z.string().nullable().describe("ISO code like INR"),
      items: z.array(Item),
      micros: Micros,
    }),
  ),
  meal_updates: z.array(
    z.object({
      meal_id: z.number().int(),
      description: z.string().nullable(),
      eaten_at: z.string().nullable(),
      location_type: LocationType.nullable(),
      place: z.string().nullable(),
      amount_spent: num,
      currency: z.string().nullable(),
      replace_items: z.array(Item).nullable().describe("Full corrected item list, or null to keep"),
      replace_micros: Micros.nullable(),
      delete: z.boolean(),
    }),
  ),
  new_symptoms: z.array(
    z.object({
      kind: z.string().describe("e.g. bloating, gas, acidity, constipation, loose stools, cramps, nausea"),
      severity: z.number().int().nullable().describe("1 (mild) to 5 (severe)"),
      occurred_at: z.string().nullable().describe("ISO 8601 with offset; null means now"),
      notes: z.string().nullable(),
    }),
  ),
});
export type ChatResult = z.infer<typeof ChatResult>;
export type MealItem = z.infer<typeof Item>;
export type MealMicros = z.infer<typeof Micros>;

const SYSTEM = `You are the logging assistant inside Vijay's personal gut-health and food tracker. He chats with you to record what he ate and how his gut feels.

Your job on every message:
1. Work out whether he is logging a new meal, correcting or adding detail to a recent meal, logging a gut symptom, or just chatting/asking.
2. Return structured records for anything to log, plus a short reply.

Meals
- Estimate each item's portion and nutrition realistically. Assume Indian home cooking and Indian portion sizes unless the photo or text says otherwise. From a photo, judge portion size from plate, bowl, utensils and hand size.
- Fill every macro and micro you can reasonably estimate; use null only when you have no basis at all.
- location_type: "home" for home-cooked food, "outside" for restaurant, takeaway, delivery, office canteen or street food. If he didn't say and it isn't obvious, use "unknown" and ask in the reply.
- For outside meals, also capture place and amount_spent if given (currency default INR). If missing, ask once for both in the same question. Don't ask about spending for home meals.
- If a message answers your earlier question (e.g. "outside, A2B, 240"), put it in meal_updates for that meal id instead of creating a new meal.
- Corrections like "it was 3 idlis, not 2" go in meal_updates with replace_items (and replace_micros) holding the full corrected list. "Delete that" sets delete true.
- eaten_at: if he says "for breakfast" or "at 1pm", convert to an ISO timestamp in his timezone; otherwise null (now).

Symptoms
- Log bloating, gas, acidity, reflux, cramps, constipation, loose stools, nausea, etc. Severity 1–5; if he doesn't give one, infer from his words (e.g. "very bloated" ≈ 4) or leave null.

Reply style
- 1–3 short lines, plain text, no markdown headers. For a logged meal, confirm what you logged with approximate calories and protein/carbs/fat, e.g. "Logged idli, sambar, chutney (≈420 kcal · P 12 g · C 70 g · F 9 g) at home."
- Then ask any missing question (home or outside, place, amount).
- You are not a doctor; for questions about patterns you can give general observations, but don't diagnose.`;

let _client: Anthropic | null = null;
function client() {
  if (!_client) _client = new Anthropic();
  return _client;
}

export type RecentMeal = {
  id: number;
  eaten_at: string;
  description: string;
  location_type: string;
  place: string | null;
  amount_spent: string | null;
  calories: string | null;
};

export async function interpret(opts: {
  history: { role: "user" | "assistant"; content: string }[];
  text: string;
  image?: { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };
  timeZone: string;
  recentMeals: RecentMeal[];
}): Promise<ChatResult> {
  const now = new Date();
  const localNow = now.toLocaleString("en-IN", { timeZone: opts.timeZone, dateStyle: "full", timeStyle: "short" });

  const context = [
    `Current time: ${localNow} (timezone ${opts.timeZone}, UTC now ${now.toISOString()}).`,
    opts.recentMeals.length
      ? `Meals logged in the last 24 hours (id: details):\n${opts.recentMeals
          .map(
            (m) =>
              `${m.id}: ${m.description} · ${m.eaten_at} · ${m.location_type}${m.place ? ` · ${m.place}` : ""}${
                m.amount_spent ? ` · spent ${m.amount_spent}` : ""
              }${m.calories ? ` · ${Math.round(Number(m.calories))} kcal` : ""}`,
          )
          .join("\n")}`
      : "No meals logged in the last 24 hours.",
  ].join("\n\n");

  const userContent: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (opts.image) {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.base64 },
    });
  }
  userContent.push({ type: "text", text: `${context}\n\nVijay's message: ${opts.text || "(photo only)"}` });

  // Earlier turns as plain text; the API requires the first message to be from the user.
  const history = [...opts.history];
  while (history.length && history[0].role !== "user") history.shift();

  const response = await client().beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ChatResult) },
    system: SYSTEM,
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userContent },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    return {
      reply: "Sorry, I couldn't process that one. Could you describe the meal in words?",
      new_meals: [],
      meal_updates: [],
      new_symptoms: [],
    };
  }
  return response.parsed_output;
}

export function sumItems(items: MealItem[]) {
  const total = (k: keyof MealItem) => {
    const vals = items.map((i) => i[k]).filter((v): v is number => typeof v === "number");
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) * 10) / 10 : null;
  };
  return {
    calories: total("calories"),
    protein_g: total("protein_g"),
    carbs_g: total("carbs_g"),
    fat_g: total("fat_g"),
    fiber_g: total("fiber_g"),
  };
}
