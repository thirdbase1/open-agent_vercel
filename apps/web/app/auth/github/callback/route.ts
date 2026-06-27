import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/api/auth/callback/github";
  return NextResponse.redirect(url);
}
