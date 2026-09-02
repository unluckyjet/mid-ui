"use client";

import { useState } from "react";
import { TickerTiles } from "../../../components/ticker-tiles";
import styles from "./ticker-tiles-demo.module.css";

const DEFAULT_PHRASES = ["MADE BY HAND", "MADE TO MOVE", "MADE FOR YOU"];

type TickerTilesDemoProps = Readonly<{
  displayClassName: string;
}>;

export function TickerTilesDemo({
  displayClassName,
}: TickerTilesDemoProps) {
  const [alphabet, setAlphabet] = useState(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&+?—",
  );
  const [cascade, setCascade] = useState(46);
  const [changeTime, setChangeTime] = useState(1600);
  const [minimumSlots, setMinimumSlots] = useState(12);
  const [mounted, setMounted] = useState(true);
  const [phraseDraft, setPhraseDraft] = useState(DEFAULT_PHRASES.join("\n"));
  const [repeat, setRepeat] = useState(true);
  const [revision, setRevision] = useState(0);
  const [stepTime, setStepTime] = useState(72);
  const phrases = phraseDraft
    .split("\n")
    .map((phrase) => phrase.toUpperCase())
    .filter((phrase) => phrase.trim().length > 0)
    .slice(0, 6);

  return (
    <div className={styles.demo}>
      <div className={styles.machine}>
        <div className={styles.machineHeader} aria-hidden="true">
          <span>Composition desk / 04</span>
          <span>Sequence {String(revision + 1).padStart(2, "0")}</span>
        </div>

        <div className={styles.stage} data-testid="ticker-stage">
          <span className={styles.paperRail} aria-hidden="true" />
          {mounted ? (
            <TickerTiles
              key={revision}
              alphabet={alphabet}
              cascade={cascade}
              changeTime={changeTime}
              className={`${displayClassName} ${styles.ticker}`}
              minimumSlots={minimumSlots}
              phrases={phrases}
              repeat={repeat}
              stepTime={stepTime}
            />
          ) : (
            <p className={styles.unmounted}>Mechanism removed</p>
          )}
        </div>

        <div className={styles.machineFooter} aria-hidden="true">
          <span>Deterministic order</span>
          <span>Paper stock 240 gsm</span>
          <span>{repeat ? "Continuous run" : "Single run"}</span>
        </div>
      </div>

      <form
        className={styles.controls}
        onSubmit={(event) => event.preventDefault()}
      >
        <div className={styles.controlsHeading}>
          <div>
            <p>Compositor</p>
            <span>One phrase per line</span>
          </div>
          <span className={styles.status} data-active={mounted}>
            {mounted ? (repeat ? "Looping" : "One pass") : "Offline"}
          </span>
        </div>

        <label className={styles.phraseControl}>
          <span>Phrases</span>
          <textarea
            data-testid="ticker-phrases"
            maxLength={120}
            rows={4}
            value={phraseDraft}
            onChange={(event) => setPhraseDraft(event.target.value)}
          />
        </label>

        <label className={styles.alphabetControl}>
          <span>Cycle alphabet</span>
          <input
            data-testid="ticker-alphabet"
            maxLength={64}
            value={alphabet}
            onChange={(event) => setAlphabet(event.target.value.toUpperCase())}
          />
        </label>

        <div className={styles.rangeGrid}>
          <label className={styles.rangeControl}>
            <span>
              Hold <output>{changeTime}ms</output>
            </span>
            <input
              aria-label="Phrase hold"
              data-testid="change-time-input"
              type="range"
              min="400"
              max="4000"
              step="100"
              value={changeTime}
              onChange={(event) => setChangeTime(Number(event.target.value))}
            />
          </label>

          <label className={styles.rangeControl}>
            <span>
              Step <output>{stepTime}ms</output>
            </span>
            <input
              aria-label="Glyph step"
              data-testid="step-time-input"
              type="range"
              min="32"
              max="160"
              step="8"
              value={stepTime}
              onChange={(event) => setStepTime(Number(event.target.value))}
            />
          </label>

          <label className={styles.rangeControl}>
            <span>
              Cascade <output>{cascade}ms</output>
            </span>
            <input
              aria-label="Slot cascade"
              data-testid="cascade-input"
              type="range"
              min="0"
              max="140"
              step="2"
              value={cascade}
              onChange={(event) => setCascade(Number(event.target.value))}
            />
          </label>

          <label className={styles.rangeControl}>
            <span>
              Minimum slots <output>{minimumSlots}</output>
            </span>
            <input
              aria-label="Minimum slots"
              data-testid="minimum-slots-input"
              type="range"
              min="6"
              max="18"
              step="1"
              value={minimumSlots}
              onChange={(event) => setMinimumSlots(Number(event.target.value))}
            />
          </label>
        </div>

        <label className={styles.repeatControl}>
          <span>
            Repeat sequence
            <small>Stop after the final phrase when disabled.</small>
          </span>
          <input
            data-testid="repeat-input"
            type="checkbox"
            checked={repeat}
            onChange={(event) => setRepeat(event.target.checked)}
          />
        </label>

        <div className={styles.actions}>
          <button type="button" onClick={() => setRevision((value) => value + 1)}>
            Restart sequence
          </button>
          <button type="button" onClick={() => setMounted((value) => !value)}>
            {mounted ? "Unmount" : "Mount mechanism"}
          </button>
        </div>
      </form>
    </div>
  );
}
