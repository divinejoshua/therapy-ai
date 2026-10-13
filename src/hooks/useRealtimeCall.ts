"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CallStatus = "idle" | "connecting" | "live" | "ended" | "error";

export type TranscriptMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending: boolean;
};

type ServerEvent = {
  type: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  error?: { message?: string };
};

function createAnalyser(ctx: AudioContext, stream: MediaStream) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  ctx.createMediaStreamSource(stream).connect(analyser);
  return analyser;
}

function readLevel(analyser: AnalyserNode | null, buffer: Uint8Array<ArrayBuffer>) {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (const v of buffer) {
    const n = (v - 128) / 128;
    sum += n * n;
  }
  return Math.min(1, Math.sqrt(sum / buffer.length) * 4);
}

export function useRealtimeCall() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [muted, setMuted] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const aiAnalyserRef = useRef<AnalyserNode | null>(null);
  const levelBufferRef = useRef(new Uint8Array(256));

  const upsertMessage = useCallback(
    (id: string, role: TranscriptMessage["role"], update: (prev: string) => string, pending: boolean) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === id);
        if (idx === -1) return [...prev, { id, role, text: update(""), pending }];
        const next = [...prev];
        next[idx] = { ...next[idx], text: update(next[idx].text), pending };
        return next;
      });
    },
    [],
  );

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      switch (event.type) {
        case "input_audio_buffer.speech_started":
          setUserSpeaking(true);
          break;
        case "input_audio_buffer.speech_stopped":
          setUserSpeaking(false);
          break;
        case "input_audio_buffer.committed":
          if (event.item_id) upsertMessage(event.item_id, "user", (t) => t, true);
          break;
        case "conversation.item.input_audio_transcription.delta":
          if (event.item_id) upsertMessage(event.item_id, "user", (t) => t + (event.delta ?? ""), true);
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (event.item_id) upsertMessage(event.item_id, "user", () => event.transcript?.trim() ?? "", false);
          break;
        case "response.output_audio_transcript.delta":
        case "response.audio_transcript.delta":
          if (event.item_id) upsertMessage(event.item_id, "assistant", (t) => t + (event.delta ?? ""), true);
          break;
        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done":
          if (event.item_id) upsertMessage(event.item_id, "assistant", (t) => event.transcript ?? t, false);
          break;
        case "output_audio_buffer.started":
          setAiSpeaking(true);
          break;
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
          setAiSpeaking(false);
          break;
        case "error":
          setError(event.error?.message ?? "Something went wrong during the call.");
          break;
      }
    },
    [upsertMessage],
  );

  const cleanup = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    micRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    if (audioElRef.current) audioElRef.current.srcObject = null;
    dcRef.current = null;
    pcRef.current = null;
    micRef.current = null;
    audioCtxRef.current = null;
    micAnalyserRef.current = null;
    aiAnalyserRef.current = null;
    setAiSpeaking(false);
    setUserSpeaking(false);
  }, []);

  const start = useCallback(async () => {
    if (pcRef.current) return;
    setStatus("connecting");
    setError(null);
    setMessages([]);
    setMuted(false);

    try {
      const sessionRes = await fetch("/api/session", { method: "POST" });
      const session = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(session.error ?? "Could not start a session.");

      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micRef.current = mic;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      micAnalyserRef.current = createAnalyser(audioCtx, mic);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      if (!audioElRef.current) {
        audioElRef.current = new Audio();
        audioElRef.current.autoplay = true;
      }
      pc.ontrack = (e) => {
        const [remote] = e.streams;
        audioElRef.current!.srcObject = remote;
        aiAnalyserRef.current = createAnalyser(audioCtx, remote);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setError("The call connection was lost.");
          setStatus("error");
          cleanup();
        }
      };

      mic.getAudioTracks().forEach((track) => pc.addTrack(track, mic));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (e) => handleEvent(JSON.parse(e.data));
      dc.onopen = () => {
        setStatus("live");
        setStartedAt(Date.now());
        dc.send(JSON.stringify({ type: "response.create" }));
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(session.model)}`,
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${session.clientSecret}`,
            "Content-Type": "application/sdp",
          },
        },
      );
      if (!sdpRes.ok) throw new Error(`Realtime connection failed (${sdpRes.status}).`);

      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
    } catch (err) {
      cleanup();
      setStatus("error");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser settings to start a call."
          : err instanceof Error
            ? err.message
            : "Could not start the call.",
      );
    }
  }, [cleanup, handleEvent]);

  const end = useCallback(() => {
    cleanup();
    setStatus("ended");
    setStartedAt(null);
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    micRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const sendText = useCallback((text: string) => {
    const dc = dcRef.current;
    const trimmed = text.trim();
    if (!dc || dc.readyState !== "open" || !trimmed) return;

    const id = `text-${crypto.randomUUID()}`;
    setMessages((prev) => [...prev, { id, role: "user", text: trimmed, pending: false }]);
    dc.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text: trimmed }] },
      }),
    );
    dc.send(JSON.stringify({ type: "response.create" }));
  }, []);

  const getLevels = useCallback(
    () => ({
      user: muted ? 0 : readLevel(micAnalyserRef.current, levelBufferRef.current),
      ai: readLevel(aiAnalyserRef.current, levelBufferRef.current),
    }),
    [muted],
  );

  useEffect(() => cleanup, [cleanup]);

  return {
    status,
    error,
    messages,
    muted,
    aiSpeaking,
    userSpeaking,
    startedAt,
    start,
    end,
    toggleMute,
    sendText,
    getLevels,
  };
}
