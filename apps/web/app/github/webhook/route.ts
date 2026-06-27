import { NextResponse, type NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/api/github/webhook";
  // 307 preserves the POST method
  return NextResponse.redirect(url, 307);
}
