"use client";

export const INTRO_REPLAY_EVENT = "mithai:replay-intro";

export function IntroReplayButton() {
  return (
    <button
      className="intro-replay-button text-left text-[0.68rem] text-ivory/70 underline decoration-gold/50 underline-offset-4 transition-colors hover:text-gold"
      onClick={() => window.dispatchEvent(new Event(INTRO_REPLAY_EVENT))}
      type="button"
    >
      Replay welcome
    </button>
  );
}
