import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  let body: any = null;

  // Veryfi may send JSON or form data depending on their config
  if (contentType.includes("application/json")) {
    body = await req.json();
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    body = Object.fromEntries(new URLSearchParams(text));
  } else {
    // fallback
    body = await req.text();
  }

  // Common places a "secret" might live
  const secret =
    body?.secret ||
    body?.webhook_secret ||
    body?.challenge ||
    body?.token ||
    null;

  // Log it so you can copy from Vercel logs
  console.log("VERYFI WEBHOOK VERIFICATION BODY:", body);
  console.log("VERYFI WEBHOOK SECRET:", secret);

  // Some services require echoing it back
  return NextResponse.json(
    { ok: true, secretReceived: secret ?? "NOT_FOUND", body },
    { status: 200 }
  );
}
