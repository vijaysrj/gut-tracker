"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, checkLogin, makeSessionToken } from "@/lib/auth";

export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const email = await checkLogin(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!email) return { error: "Wrong email or password" };
  (await cookies()).set(SESSION_COOKIE, await makeSessionToken(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/");
}
