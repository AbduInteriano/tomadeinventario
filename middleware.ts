import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

const SUPERVISOR_ROLES = new Set(["SUPERVISOR", "ADMIN_TECNOLOGIA"]);
const CONTEO_ROLES = new Set(["TOMADOR", "SUPERVISOR", "ADMIN_TECNOLOGIA"]);

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = request.nextUrl;
  const role = token?.role as string | undefined;

  if (pathname.startsWith("/login")) {
    if (token) {
      const dest = SUPERVISOR_ROLES.has(role ?? "") ? "/supervisor" : "/tomador";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/tomador")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!CONTEO_ROLES.has(role ?? "")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/supervisor")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!SUPERVISOR_ROLES.has(role ?? "")) {
      return NextResponse.redirect(new URL("/tomador", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/tomador/:path*", "/supervisor/:path*"],
};
