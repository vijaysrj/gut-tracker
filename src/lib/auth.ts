// Single-user auth: one password (APP_PASSWORD) unlocks the app.
// The session cookie is an HMAC of a fixed label keyed by AUTH_SECRET,
// so it can be checked in the proxy without a database call.

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

export async function makeSessionToken() {
  return hmac(secret(), "gut-tracker-owner");
}

export async function isValidSession(token: string | undefined) {
  if (!token) return false;
  const expected = await makeSessionToken();
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(input: string) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) throw new Error("APP_PASSWORD is not set");
  // Compare HMACs so timing doesn't leak the password length or content.
  const [a, b] = await Promise.all([hmac(secret(), input), hmac(secret(), pw)]);
  return a === b;
}
