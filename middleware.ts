import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const pathname = nextUrl.pathname;

  // Public routes
  if (pathname === "/login" || pathname.startsWith("/login/") || pathname === "/") {
    if (session?.user) {
      const role = session.user.role;
      if (role === "ADMIN")   return NextResponse.redirect(new URL("/admin", req.url));
      if (role === "DOCENT")  return NextResponse.redirect(new URL("/docent", req.url));
      if (role === "LEERLING") return NextResponse.redirect(new URL("/leerling", req.url));
      if (role === "OUDER")   return NextResponse.redirect(new URL("/ouder", req.url));
    }
    if (pathname === "/") return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.next();
  }

  // Protected routes — require authentication
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = session.user.role;

  if (pathname.startsWith("/admin")   && role !== "ADMIN")   return NextResponse.redirect(new URL("/login", req.url));
  if (pathname.startsWith("/docent")  && role !== "DOCENT")  return NextResponse.redirect(new URL("/login", req.url));
  if (pathname.startsWith("/leerling") && role !== "LEERLING") return NextResponse.redirect(new URL("/login", req.url));
  if (pathname.startsWith("/ouder")   && role !== "OUDER")   return NextResponse.redirect(new URL("/login", req.url));

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
