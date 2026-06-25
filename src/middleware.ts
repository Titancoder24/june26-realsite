import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRouteMinRole, hasRole } from "@/lib/auth/rbac";
import type { UserRole } from "@/types/domain";

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];
const AUTH_ROUTES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => path.startsWith(p));
  const isPublicAdmin = path === "/admin/login" || path === "/admin/setup";

  if (isProtected && !user && !isPublicAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = path.startsWith("/admin") ? "/admin/login" : "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile?.role as UserRole) ?? "viewer";
    url.pathname = role === "platform_admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && (isProtected || path.startsWith("/admin")) && !isPublicAdmin) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (profile?.role as UserRole) ?? "viewer";

    if (path.startsWith("/admin") && role !== "platform_admin") {
      const publicAdminPaths = ["/admin/login", "/admin/setup"];
      if (!publicAdminPaths.some((p) => path === p || path.startsWith(p + "/"))) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/login";
        url.searchParams.set("redirect", path);
        return NextResponse.redirect(url);
      }
    }

    if (role === "platform_admin" && path.startsWith("/dashboard")) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    const minRole = getRouteMinRole(path);
    if (minRole && !hasRole(role, minRole)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.searchParams.set("forbidden", "1");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/signup"],
};
