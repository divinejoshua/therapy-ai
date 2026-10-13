import { TherapySession } from "@/components/TherapySession";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-stone-50 via-emerald-50/60 to-sky-50">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-sky-200/40 blur-3xl" />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-6 sm:px-8">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-300 to-sky-500" />
          <span className="text-lg font-semibold tracking-tight text-stone-800">Therapy AI</span>
        </div>
        <span className="hidden text-sm text-stone-500 sm:block">A safe space to talk things through</span>
      </header>

      <div className="relative flex flex-1 flex-col">
        <TherapySession />
      </div>

      <footer className="relative mx-auto w-full max-w-6xl px-4 pb-6 text-center text-xs leading-relaxed text-stone-500 sm:px-8">
        Therapy AI is an AI companion, not a licensed therapist, and is not a substitute for professional care.
        If you are in crisis or thinking about harming yourself, call your local emergency number or a crisis line
        (988 in the US, 116 123 in the UK &amp; Ireland) or visit{" "}
        <a href="https://findahelpline.com" target="_blank" rel="noreferrer" className="underline">
          findahelpline.com
        </a>
        .
      </footer>
    </main>
  );
}
