export const runtime = "nodejs";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: body.max_tokens || 1000,
        messages: [
          { role: "system", content: body.system },
          ...body.messages,
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error?.message }, { status: res.status });

    return NextResponse.json({
      content: [{ text: data.choices[0].message.content }]
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}