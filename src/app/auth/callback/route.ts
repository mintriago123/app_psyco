import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

function redirectWithCookies(
  destination: URL,
  response: NextResponse,
): NextResponse {
  const redirectResponse = NextResponse.redirect(destination);
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  for (const name of ["Cache-Control", "Expires", "Pragma"]) {
    const value = response.headers.get(name);
    if (value) redirectResponse.headers.set(name, value);
  }
  return redirectResponse;
}

function getSafeDestination(next: string, request: NextRequest): URL {
  try {
    const destination = new URL(next, request.url);
    return destination.origin === request.nextUrl.origin
      ? destination
      : new URL("/", request.url);
  } catch {
    return new URL("/", request.url);
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";
  const destination = getSafeDestination(next, request);
  const errorUrl = new URL("/login?error=auth-code-error", request.url);
  let response = NextResponse.next({ request });

  if (!code && !(token_hash && type)) {
    return redirectWithCookies(errorUrl, response);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return redirectWithCookies(errorUrl, response);
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  try {
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: token_hash!,
          type: type as EmailOtpType,
        });

    return redirectWithCookies(
      error ? errorUrl : destination,
      response,
    );
  } catch {
    return redirectWithCookies(errorUrl, response);
  }
}
