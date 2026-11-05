import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

export default async function proxy(req: NextRequest) {
  const ok = await isValidSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Signed-out visitors to the home page see the landing page; anything deeper goes to login.
  const target = req.nextUrl.pathname === "/" ? "/welcome" : "/login";
  return NextResponse.redirect(new URL(target, req.url));
}

export const config = {
  // Everything except the landing and login pages, Next internals, and PWA assets.
  matcher: [
    "/((?!welcome|login|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)",
  ],
};
