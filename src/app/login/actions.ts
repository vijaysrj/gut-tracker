"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, checkPassword, makeSessionToken } from "@/lib/auth";

export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const password = String(form.get("password") ?? "");
  if (!(await checkPassword(password))) return { error: "Wrong password" };
  (await cookies()).set(SESSION_COOKIE, await makeSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/");
}
