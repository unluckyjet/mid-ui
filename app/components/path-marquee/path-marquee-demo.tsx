"use client";

import { useState } from "react";
import {
  PathMarquee,
  type PathMarqueeContour,
} from "../../../components/path-marquee";
import styles from "./path-marquee-demo.module.css";

const PHRASES = ["Designed in motion", "Purpose in motion"] as const;
const CONTOURS: readonly PathMarqueeContour[] = [
  "swell",
  "halo",
  "orbit",
  "straight",
];

export function PathMarqueeDemo() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [contourIndex, setContourIndex] = useState(0);
  const [pace, setPace] = useState(0.82);
  const [pauseWhenHovered, setPauseWhenHovered] = useState(true);
  const [mounted, setMounted] = useState(true);
  const phrase = PHRASES[phraseIndex];
  const contour = CONTOURS[contourIndex];

  return (
    <>
      <div className={styles.controls} aria-label="Path Marquee controls">
        <button
          type="button"
          data-testid="change-phrase"
          onClick={() => setPhraseIndex((current) => (current + 1) % PHRASES.length)}
        >
          Phrase
          <span>{phraseIndex + 1}/2</span>
        </button>
        <button
          type="button"
          data-testid="change-contour"
          onClick={() =>
            setContourIndex((current) => (current + 1) % CONTOURS.length)
          }
        >
          Contour
          <span>{contour}</span>
        </button>
        <button
          type="button"
          data-testid="toggle-motion"
          aria-pressed={pace !== 0}
          onClick={() => setPace((current) => (current === 0 ? 0.82 : 0))}
        >
          Motion
          <span>{pace === 0 ? "off" : "on"}</span>
        </button>
        <button
          type="button"
          data-testid="toggle-hover-pause"
          aria-pressed={pauseWhenHovered}
          onClick={() => setPauseWhenHovered((current) => !current)}
        >
          Hover pause
          <span>{pauseWhenHovered ? "on" : "off"}</span>
        </button>
        <button
          type="button"
          data-testid="toggle-mounted"
          aria-pressed={mounted}
          onClick={() => setMounted((current) => !current)}
        >
          Specimen
          <span>{mounted ? "mounted" : "hidden"}</span>
        </button>
      </div>

      <div className={styles.stage} data-testid="marquee-stage">
        {mounted ? (
          <div className={styles.component} data-testid="marquee-component">
            <PathMarquee
              phrase={phrase}
              divider="✦"
              contour={contour}
              pace={pace}
              pauseWhenHovered={pauseWhenHovered}
            />
          </div>
        ) : (
          <p className={styles.empty}>Specimen unmounted</p>
        )}
      </div>

      <p className={styles.caption} aria-live="polite">
        {contour} · forward · {pace === 0 ? "still" : `${pace} pace`}
      </p>
    </>
  );
}
