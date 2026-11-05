import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ensureSchema, sql, type MealCard, type Message, type MessageMeta, type SymptomCard } from "@/lib/db";
import { interpret, sumItems, type ChatResult, type RecentMeal } from "@/lib/ai";

export const maxDuration = 120;

const MSG_COLS = "id, role, content, image_url, meta, created_at";

export async function GET() {
  await ensureSchema();
  const rows = (await sql()`
    SELECT * FROM (
      SELECT id, role, content, image_url, meta, created_at FROM messages
      ORDER BY created_at DESC, id DESC LIMIT 200
    ) t ORDER BY created_at ASC, id ASC
  `) as Message[];
  return NextResponse.json({ messages: rows });
}

type ImageType = "image/jpeg" | "image/png" | "image/webp";

function parseDataUrl(url: unknown): { mediaType: ImageType; base64: string } | null {
  if (typeof url !== "string") return null;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url);
  if (!m) return null;
  return { mediaType: m[1] as ImageType, base64: m[2] };
}

function ts(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function POST(req: Request) {
  await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const text = typeof body.content === "string" ? body.content.trim().slice(0, 4000) : "";
  const image = parseDataUrl(body.image);
  const thumb = parseDataUrl(body.thumb) ? (body.thumb as string) : null;
  const timeZone =
    typeof body.timeZone === "string" && /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(body.timeZone)
      ? body.timeZone
      : "Asia/Kolkata";
  if (!text && !image) return NextResponse.json({ error: "empty message" }, { status: 400 });

  const db = sql();

  const [user] = (await db.query(
    `INSERT INTO messages (role, content, image_url) VALUES ('user', $1, $2) RETURNING ${MSG_COLS}`,
    [text, thumb],
  )) as Message[];

  const history = (
    (await db`
      SELECT role, content, image_url FROM messages WHERE id < ${user.id}
      ORDER BY id DESC LIMIT 16
    `) as { role: "user" | "assistant"; content: string; image_url: string | null }[]
  )
    .reverse()
    .map((m) => ({ role: m.role, content: m.content || (m.image_url ? "(sent a food photo)" : "") }))
    .filter((m) => m.content);

  const recentMeals = (await db`
    SELECT id, eaten_at, description, location_type, place, amount_spent, calories
    FROM meals WHERE eaten_at > now() - interval '24 hours' ORDER BY eaten_at
  `) as RecentMeal[];

  let result: ChatResult;
  try {
    result = await interpret({ history, text, image: image ?? undefined, timeZone, recentMeals });
  } catch (e) {
    console.error("interpret failed", e);
    const msg =
      e instanceof Anthropic.AuthenticationError
        ? "My API key isn't working. Check ANTHROPIC_API_KEY in Vercel."
        : e instanceof Anthropic.RateLimitError
          ? "I'm being rate-limited. Try again in a minute."
          : "Something went wrong reading that. Please try again.";
    const [assistant] = (await db.query(
      `INSERT INTO messages (role, content) VALUES ('assistant', $1) RETURNING ${MSG_COLS}`,
      [msg],
    )) as Message[];
    return NextResponse.json({ messages: [user, assistant] });
  }

  const meta: MessageMeta = { meals: [], symptoms: [] };
  const validIds = new Set(recentMeals.map((m) => m.id));

  for (const m of result.new_meals) {
    const t = sumItems(m.items);
    const [row] = (await db`
      INSERT INTO meals (eaten_at, description, location_type, place, amount_spent, currency, photo_url,
        items, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, micros, message_id)
      VALUES (COALESCE(${ts(m.eaten_at)}::timestamptz, now()), ${m.description},
        ${m.location_type === "outside" ? "outside" : "home"}, ${m.place}, ${m.amount_spent},
        ${m.amount_spent != null ? (m.currency ?? "INR") : m.currency}, ${thumb},
        ${JSON.stringify(m.items)}::jsonb, ${t.calories}, ${t.protein_g}, ${t.carbs_g}, ${t.fat_g}, ${t.fiber_g},
        ${m.micros.sugar_g}, ${JSON.stringify(m.micros)}::jsonb, ${user.id})
      RETURNING id
    `) as { id: number }[];
    meta.meals!.push({
      id: row.id,
      description: m.description,
      location_type: m.location_type,
      place: m.place,
      amount_spent: m.amount_spent,
      currency: m.amount_spent != null ? (m.currency ?? "INR") : null,
      ...t,
    });
  }

  for (const u of result.meal_updates) {
    if (!validIds.has(u.meal_id)) continue;
    if (u.delete) {
      await db`DELETE FROM meals WHERE id = ${u.meal_id}`;
      const old = recentMeals.find((r) => r.id === u.meal_id)!;
      meta.meals!.push({
        id: u.meal_id, description: old.description, location_type: old.location_type, place: null,
        amount_spent: null, currency: null, calories: null, protein_g: null, carbs_g: null, fat_g: null,
        fiber_g: null, deleted: true,
      });
      continue;
    }
    const t = u.replace_items ? sumItems(u.replace_items) : null;
    const [row] = (await db`
      UPDATE meals SET
        description = COALESCE(${u.description}, description),
        eaten_at = COALESCE(${ts(u.eaten_at)}::timestamptz, eaten_at),
        location_type = COALESCE(${u.location_type === "home" || u.location_type === "outside" ? u.location_type : null}, location_type),
        place = COALESCE(${u.place}, place),
        amount_spent = COALESCE(${u.amount_spent}, amount_spent),
        currency = COALESCE(${u.currency ?? (u.amount_spent != null ? "INR" : null)}, currency),
        items = COALESCE(${u.replace_items ? JSON.stringify(u.replace_items) : null}::jsonb, items),
        micros = COALESCE(${u.replace_micros ? JSON.stringify(u.replace_micros) : null}::jsonb, micros),
        sugar_g = COALESCE(${u.replace_micros?.sugar_g ?? null}, sugar_g),
        calories = CASE WHEN ${!!t}::boolean THEN ${t?.calories ?? null}::numeric ELSE calories END,
        protein_g = CASE WHEN ${!!t}::boolean THEN ${t?.protein_g ?? null}::numeric ELSE protein_g END,
        carbs_g = CASE WHEN ${!!t}::boolean THEN ${t?.carbs_g ?? null}::numeric ELSE carbs_g END,
        fat_g = CASE WHEN ${!!t}::boolean THEN ${t?.fat_g ?? null}::numeric ELSE fat_g END,
        fiber_g = CASE WHEN ${!!t}::boolean THEN ${t?.fiber_g ?? null}::numeric ELSE fiber_g END
      WHERE id = ${u.meal_id}
      RETURNING id, description, location_type, place, amount_spent, currency, calories, protein_g, carbs_g, fat_g, fiber_g
    `) as Record<string, unknown>[];
    if (row) meta.meals!.push(toCard(row));
  }

  for (const s of result.new_symptoms) {
    const sev = s.severity == null ? null : Math.min(5, Math.max(1, s.severity));
    const [row] = (await db`
      INSERT INTO symptoms (occurred_at, kind, severity, notes, message_id)
      VALUES (COALESCE(${ts(s.occurred_at)}::timestamptz, now()), ${s.kind.toLowerCase()}, ${sev}, ${s.notes}, ${user.id})
      RETURNING id
    `) as { id: number }[];
    meta.symptoms!.push({ id: row.id, kind: s.kind.toLowerCase(), severity: sev } satisfies SymptomCard);
  }

  const hasMeta = meta.meals!.length || meta.symptoms!.length;
  const [assistant] = (await db.query(
    `INSERT INTO messages (role, content, meta) VALUES ('assistant', $1, $2) RETURNING ${MSG_COLS}`,
    [result.reply, hasMeta ? JSON.stringify(meta) : null],
  )) as Message[];

  return NextResponse.json({ messages: [user, assistant] });
}

function n(v: unknown) {
  return v == null ? null : Number(v);
}

function toCard(r: Record<string, unknown>): MealCard {
  return {
    id: r.id as number,
    description: r.description as string,
    location_type: r.location_type as string,
    place: (r.place as string) ?? null,
    amount_spent: n(r.amount_spent),
    currency: (r.currency as string) ?? null,
    calories: n(r.calories),
    protein_g: n(r.protein_g),
    carbs_g: n(r.carbs_g),
    fat_g: n(r.fat_g),
    fiber_g: n(r.fiber_g),
  };
}
