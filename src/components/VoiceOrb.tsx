"use client";

import { useEffect, useRef } from "react";

type Props = {
  active: boolean;
  getLevels: () => { user: number; ai: number };
};

export function VoiceOrb({ active, getLevels }: Props) {
  const coreRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let smoothAi = 0;
    let smoothUser = 0;

    const tick = () => {
      const { user, ai } = getLevels();
      smoothAi += (ai - smoothAi) * 0.2;
      smoothUser += (user - smoothUser) * 0.2;
      if (coreRef.current) coreRef.current.style.transform = `scale(${1 + smoothAi * 0.25})`;
      if (haloRef.current) {
        haloRef.current.style.transform = `scale(${1.1 + smoothUser * 0.35})`;
        haloRef.current.style.opacity = `${0.25 + smoothUser * 0.6}`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, getLevels]);

  return (
    <div className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
      <div
        ref={haloRef}
        className="absolute inset-0 rounded-full bg-sky-300/40 blur-2xl transition-opacity"
        style={{ opacity: 0.25, transform: "scale(1.1)" }}
      />
      <div
        className={`absolute inset-6 rounded-full bg-emerald-200/50 blur-xl ${active ? "animate-breathe" : ""}`}
      />
      <div
        ref={coreRef}
        className="relative h-36 w-36 rounded-full bg-gradient-to-br from-emerald-300 via-teal-400 to-sky-500 shadow-[0_20px_60px_-15px_rgba(13,148,136,0.6)] sm:h-40 sm:w-40"
      >
        <div className="absolute inset-3 rounded-full bg-gradient-to-tr from-white/0 to-white/40" />
      </div>
    </div>
  );
}
