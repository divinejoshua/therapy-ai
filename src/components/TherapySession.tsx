"use client";

import { useEffect, useRef, useState } from "react";
import { useRealtimeCall } from "@/hooks/useRealtimeCall";
import { THERAPIST_NAME } from "@/lib/therapist";
import { VoiceOrb } from "./VoiceOrb";

function formatDuration(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function useElapsed(startedAt: number | null) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt ? formatDuration(Math.max(0, now - startedAt)) : "00:00";
}

export function TherapySession() {
  const call = useRealtimeCall();
  const elapsed = useElapsed(call.startedAt);
  const [draft, setDraft] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const live = call.status === "live";
  const connecting = call.status === "connecting";
  const visibleMessages = call.messages.filter((m) => m.text || m.pending);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [call.messages]);

  const statusLabel = connecting
    ? "Connecting…"
    : live
      ? call.aiSpeaking
        ? `${THERAPIST_NAME} is speaking`
        : call.muted
          ? "You're muted"
          : call.userSpeaking
            ? "Listening…"
            : "Your turn — speak whenever you're ready"
      : call.status === "ended"
        ? "Session ended. Take care of yourself."
        : `Start a voice session with ${THERAPIST_NAME}`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 lg:flex-row lg:py-10">
      <section className="flex flex-1 flex-col items-center justify-between rounded-3xl border border-white/60 bg-white/60 p-6 shadow-sm backdrop-blur-xl sm:p-10">
        <div className="flex w-full items-center justify-between text-sm text-stone-500">
          <span className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500 animate-pulse" : connecting ? "bg-amber-400 animate-pulse" : "bg-stone-300"}`}
            />
            {live ? "Live" : connecting ? "Connecting" : "Offline"}
          </span>
          <span className="font-mono tabular-nums">{elapsed}</span>
        </div>

        <div className="flex flex-col items-center gap-6 py-10">
          <VoiceOrb active={live} getLevels={call.getLevels} />
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-stone-800">{THERAPIST_NAME}</h2>
            <p className="mt-1 min-h-6 text-stone-500">{statusLabel}</p>
          </div>
          {call.error && (
            <p className="max-w-sm rounded-xl bg-rose-50 px-4 py-2 text-center text-sm text-rose-700">
              {call.error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {live || connecting ? (
            <>
              <button
                onClick={call.toggleMute}
                disabled={!live}
                aria-label={call.muted ? "Unmute microphone" : "Mute microphone"}
                className={`flex h-14 w-14 items-center justify-center rounded-full border transition disabled:opacity-40 ${
                  call.muted
                    ? "border-stone-800 bg-stone-800 text-white"
                    : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                }`}
              >
                <MicIcon off={call.muted} />
              </button>
              <button
                onClick={call.end}
                aria-label="End session"
                className="flex h-14 items-center gap-2 rounded-full bg-rose-500 px-6 font-medium text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-600"
              >
                <PhoneIcon className="rotate-[135deg]" />
                End
              </button>
            </>
          ) : (
            <button
              onClick={call.start}
              className="flex h-14 items-center gap-2 rounded-full bg-teal-600 px-8 font-medium text-white shadow-lg shadow-teal-600/30 transition hover:bg-teal-700"
            >
              <PhoneIcon />
              {call.status === "idle" ? "Start session" : "Start new session"}
            </button>
          )}
        </div>
      </section>

      <section className="flex max-h-[70vh] flex-col rounded-3xl border border-white/60 bg-white/60 shadow-sm backdrop-blur-xl lg:max-h-none lg:w-[420px]">
        <header className="border-b border-stone-200/70 px-6 py-4">
          <h3 className="font-medium text-stone-800">Conversation</h3>
          <p className="text-xs text-stone-500">Live transcript of your session</p>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {visibleMessages.length === 0 ? (
            <p className="pt-10 text-center text-sm text-stone-400">
              {live ? "Say hello — the transcript will appear here." : "Your conversation will appear here."}
            </p>
          ) : (
            visibleMessages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-teal-600 text-white"
                      : "rounded-bl-sm bg-stone-100 text-stone-800"
                  }`}
                >
                  {m.text || <span className="opacity-60">…</span>}
                </div>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            call.sendText(draft);
            setDraft("");
          }}
          className="flex gap-2 border-t border-stone-200/70 p-4"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!live}
            placeholder={live ? "Prefer typing? Write here…" : "Start a session to chat"}
            className="flex-1 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-teal-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!live || !draft.trim()}
            className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-900 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </section>
    </div>
  );
}

function MicIcon({ off }: { off: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

function PhoneIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
