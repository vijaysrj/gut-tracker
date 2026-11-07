import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionUser } from "./auth";

/** Signed-in email for the current request. Throws if not signed in. */
export async function requireUser(): Promise<string> {
  const email = await sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  if (!email) throw new Error("unauthorized");
  return email;
}
