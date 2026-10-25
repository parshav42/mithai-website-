"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { INTRO_REPLAY_EVENT } from "@/components/intro-replay-button";

const INTRO_DURATION = 4_000;
const INTRO_STORAGE_KEY = "mithai-house-intro-complete";
const CRUMBS = Array.from({ length: 10 }, (_, index) => index + 1);
const SPARKLES = Array.from({ length: 8 }, (_, index) => index + 1);

export function LaddooIntro() {
  const [isVisible, setIsVisible] = useState(false);
  const skipButtonRef = useRef<HTMLButtonElement>(null);
  const startTimerRef = useRef<number | null>(null);
  const introTimerRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);

  const finishIntro = useCallback(() => {
    if (introTimerRef.current !== null) {
      window.clearTimeout(introTimerRef.current);
      introTimerRef.current = null;
    }

    try {
      window.sessionStorage.setItem(INTRO_STORAGE_KEY, "true");
    } catch (error) {
      console.warn("Could not save the Mithai House intro preference.", error);
    }

    setIsVisible(false);
    document.getElementById("home-hero-heading")?.focus();
    document.body.classList.add("laddoo-intro-revealed");

    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
    }

    revealTimerRef.current = window.setTimeout(() => {
      document.body.classList.remove("laddoo-intro-revealed");
      revealTimerRef.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    try {
      if (window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "true") {
        return;
      }
    } catch (error) {
      console.warn("Could not read the Mithai House intro preference.", error);
      return;
    }

    startTimerRef.current = window.setTimeout(() => {
      setIsVisible(true);
      introTimerRef.current = window.setTimeout(finishIntro, INTRO_DURATION);
    }, 0);

    return () => {
      if (startTimerRef.current !== null) {
        window.clearTimeout(startTimerRef.current);
      }
      if (introTimerRef.current !== null) {
        window.clearTimeout(introTimerRef.current);
      }
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
      }
      document.body.classList.remove("laddoo-intro-revealed");
    };
  }, [finishIntro]);

  useEffect(() => {
    const handleReplay = () => {
      if (introTimerRef.current !== null) {
        window.clearTimeout(introTimerRef.current);
      }
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }

      document.body.classList.remove("laddoo-intro-revealed");
      setIsVisible(true);
      introTimerRef.current = window.setTimeout(finishIntro, INTRO_DURATION);
    };

    window.addEventListener(INTRO_REPLAY_EVENT, handleReplay);
    return () => window.removeEventListener(INTRO_REPLAY_EVENT, handleReplay);
  }, [finishIntro]);

  useEffect(() => {
    if (isVisible) {
      skipButtonRef.current?.focus();
    }
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      aria-labelledby="laddoo-intro-title"
      aria-modal="true"
      className="laddoo-intro"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          finishIntro();
        } else if (event.key === "Tab") {
          event.preventDefault();
          skipButtonRef.current?.focus();
        }
      }}
      role="dialog"
    >
      <div aria-hidden="true" className="laddoo-intro__frame" />

      <button
        ref={skipButtonRef}
        className="laddoo-intro__skip"
        onClick={finishIntro}
        type="button"
      >
        Skip intro
      </button>

      <div className="laddoo-intro__brand">
        <span aria-hidden="true" className="laddoo-intro__monogram">M</span>
        <h2 id="laddoo-intro-title" className="laddoo-intro__brand-name">
          Mithai House
        </h2>
        <span className="laddoo-intro__brand-caption">A tradition of sweetness</span>
      </div>

      <div aria-hidden="true" className="laddoo-intro__stage">
        <span className="laddoo-intro__shadow" />
        <span className="laddoo-intro__powder" />
        <span className="laddoo-intro__laddoo">
          <Image
            alt=""
            className="laddoo-intro__image"
            fill
            priority
            sizes="(max-width: 640px) 112px, 144px"
            src="/images/ladoo.jpg"
          />
          <span className="laddoo-intro__shine" />
        </span>
        {CRUMBS.map((crumb) => (
          <span
            key={crumb}
            className={`laddoo-intro__crumb laddoo-intro__crumb--${crumb}`}
          />
        ))}
        {SPARKLES.map((sparkle) => (
          <span
            key={sparkle}
            className={`laddoo-intro__sparkle laddoo-intro__sparkle--${sparkle}`}
          />
        ))}
      </div>

      <p aria-hidden="true" className="laddoo-intro__tagline">
        A little sweetness, a lot of happiness.
      </p>
    </div>
  );
}
