import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "AI output video is currently disabled. Use /api/ai/ai-function for JSON smash timestamps.",
    },
    { status: 404 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "AI output video is currently disabled. Use /api/ai/ai-function for JSON smash timestamps.",
    },
    { status: 404 }
  );
}