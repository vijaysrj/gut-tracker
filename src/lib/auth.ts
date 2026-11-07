// Small fixed set of users, each signing in with email + password.
//
// - The owner signs in with OWNER_EMAIL (default vijay.srj@gmail.com) and APP_PASSWORD.
// - More people are listed in APP_USERS as "email:password" pairs separated by commas,
//   e.g. APP_USERS="catherinejiji@gmail.com:some-password".
//
// The session cookie is "<email>.<HMAC(email)>" keyed by AUTH_SECRET, so it can be
// checked in the proxy without a database call. Every table row carries user_email,
// and every query filters on the signed-in email, so each person's data stays separate.

export const SESSION_COOKIE = "gt_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function ownerEmail() {
  return normalizeEmail(process.env.OWNER_EMAIL || "vijay.srj@gmail.com");
}

/** email -> password for everyone allowed to sign in. */
function users(): Map<string, string> {
  const map = new Map<string, string>();
  const ownerPw = process.env.APP_PASSWORD;
  if (ownerPw) map.set(ownerEmail(), ownerPw);
  for (const pair of (process.env.APP_USERS ?? "").split(",")) {
    const i = pair.indexOf(":");
    if (i <= 0) continue;
    const email = normalizeEmail(pair.slice(0, i));
    const pw = pair.slice(i + 1).trim();
    if (email && pw) map.set(email, pw);
  }
  return map;
}

export async function makeSessionToken(email: string) {
  return `${email}.${await hmac(secret(), `user:${email}`)}`;
}

/** Returns the signed-in email for a session cookie, or null. */
export async function sessionUser(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  // Cookies issued before multi-user sign-in belong to the owner.
  if (same(token, await hmac(secret(), "gut-tracker-owner"))) return ownerEmail();
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const email = token.slice(0, dot);
  if (!users().has(email)) return null; // removed users lose access
  return same(token.slice(dot + 1), await hmac(secret(), `user:${email}`)) ? email : null;
}

/** Returns the normalized email if the email/password pair is valid, else null. */
export async function checkLogin(emailInput: string, password: string): Promise<string | null> {
  const email = normalizeEmail(emailInput);
  const expected = users().get(email);
  // Compare HMACs so timing doesn't leak the password length or content.
  const [a, b] = await Promise.all([hmac(secret(), password), hmac(secret(), expected ?? "\0no-user")]);
  return expected !== undefined && a === b ? email : null;
}
