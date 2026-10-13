# Therapy AI

A simple Next.js app where you can hop on a live voice call with **Sage**, a calm, supportive AI talk-therapy companion. It uses the OpenAI Realtime API over WebRTC for low-latency, natural back-and-forth conversation, with a live transcript and an optional text box.

> Therapy AI is not a licensed therapist and is not a substitute for professional care. If you are in crisis, contact your local emergency number or a crisis line (988 in the US, 116 123 in the UK & Ireland, or [findahelpline.com](https://findahelpline.com)).

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your OpenAI API key:

   ```bash
   cp .env.example .env.local
   # then edit .env.local and set OPENAI_API_KEY
   ```

3. Run the dev server and open [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

4. Click **Start session**, allow microphone access, and start talking.

## How it works

- `src/app/api/session/route.ts` uses your server-side `OPENAI_API_KEY` to mint a short-lived Realtime client secret, configured with the therapist instructions, voice, and transcription. Your real key never reaches the browser.
- `src/hooks/useRealtimeCall.ts` opens a WebRTC connection straight to OpenAI with that ephemeral key, streams your microphone, plays the AI's voice, and listens on a data channel for transcript and speaking-state events.
- `src/lib/therapist.ts` holds the therapist persona and safety boundaries. Edit it to change how Sage behaves.
- `src/components/TherapySession.tsx` renders the call UI: the reactive voice orb, mute/end controls, call timer, live transcript, and text input.
