import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { requestSpeech, type SpeechConfig } from "@/lib/speech/speech-request.server";

// Turns an agent's text reply into natural speech through Lovable AI.
// Signed-in Dyad users only; streams PCM audio events back to the browser.
export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "Please sign in." }, { status: 401 });
        const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_PUBLISHABLE_KEY']!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: auth } = await sb.auth.getUser(token);
        if (!auth.user) return Response.json({ error: "Please sign in." }, { status: 401 });

        const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        if (!text || text.length > 4000) {
          return Response.json({ error: "Text must be 1–4000 characters." }, { status: 400 });
        }
        const apiKey = process.env['LOVABLE_API_KEY'];
        if (!apiKey) return Response.json({ error: "Voice isn't configured." }, { status: 500 });

        const config: SpeechConfig = {
          baseURL: "https://ai.gateway.lovable.dev",
          apiKey,
          model: "google/gemini-3.1-flash-tts-preview",
          format: "gemini",
          voice: "Kore",
        };
        try {
          const upstream = await requestSpeech(
            config,
            `Say calmly and warmly: ${text}`,
            false,
            request.signal,
          );
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              "Content-Type": upstream.headers.get("content-type") ?? "text/event-stream",
              "Cache-Control": "no-cache",
            },
          });
        } catch (e) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          throw e;
        }
      },
    },
  },
});
