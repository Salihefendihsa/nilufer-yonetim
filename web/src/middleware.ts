import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// "Şifremi Unuttum" akışı kimliksiz erişilebilir olmalı (henüz giriş
// yapamıyor olmaları zaten sorunun kendisi).
const PUBLIC_PATHS = new Set(["/giris", "/sifremi-unuttum", "/sifre-sifirla"]);

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const isPublicPage = PUBLIC_PATHS.has(request.nextUrl.pathname);

  if (!token && !isPublicPage) {
    return NextResponse.redirect(new URL("/giris", request.url));
  }

  if (token && request.nextUrl.pathname === "/giris") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
