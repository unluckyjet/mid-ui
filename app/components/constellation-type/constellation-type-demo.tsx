"use client";

import { useState } from "react";
import { ConstellationType } from "../../../components/constellation-type";
import styles from "./constellation-type-demo.module.css";

type ConstellationTypeDemoProps = Readonly<{
  displayClassName: string;
}>;

export function ConstellationTypeDemo({
  displayClassName,
}: ConstellationTypeDemoProps) {
  const [dispersion, setDispersion] = useState(0.92);
  const [mounted, setMounted] = useState(true);
  const [phrase, setPhrase] = useState("MID UI");
  const [pointSize, setPointSize] = useState(1.5);
  const [pointerForce, setPointerForce] = useState(980);
  const [restMotion, setRestMotion] = useState(1.25);
  const [revision, setRevision] = useState(0);
  const [spacing, setSpacing] = useState(7);

  return (
    <div className={styles.demo}>
      <div className={styles.board}>
        <div className={styles.boardRail} aria-hidden="true">
          <span>Field specimen 03</span>
          <span>N 34° 03′ · W 118° 14′</span>
        </div>

        <div className={styles.stage} data-testid="constellation-stage">
          <span className={styles.axisHorizontal} aria-hidden="true" />
          <span className={styles.axisVertical} aria-hidden="true" />
          {mounted ? (
            <ConstellationType
              key={revision}
              className={`${displayClassName} ${styles.constellation}`}
              dispersion={dispersion}
              gatherTime={1200}
              pointSize={pointSize}
              pointerForce={pointerForce}
              restMotion={restMotion}
              spacing={spacing}
            >
              {phrase}
            </ConstellationType>
          ) : (
            <p className={styles.unmounted}>Field offline</p>
          )}
        </div>

        <div className={styles.boardFooter} aria-hidden="true">
          <span>Seeded lattice</span>
          <span>Canvas 2D / 30 fps</span>
          <span>Pointer spring field</span>
        </div>
      </div>

      <form className={styles.controls} onSubmit={(event) => event.preventDefault()}>
        <div className={styles.controlsHeading}>
          <div>
            <p>Field controls</p>
            <span>Live specimen</span>
          </div>
          <span className={styles.status} data-active={mounted}>
            {mounted ? "Tracking" : "Offline"}
          </span>
        </div>

        <label className={styles.textControl}>
          <span>Phrase</span>
          <input
            data-testid="phrase-input"
            maxLength={18}
            value={phrase}
            onChange={(event) => setPhrase(event.target.value.toUpperCase())}
          />
        </label>

        <label className={styles.rangeControl}>
          <span>
            Lattice gap <output>{spacing}px</output>
          </span>
          <input
            aria-label="Lattice gap"
            data-testid="spacing-input"
            type="range"
            min="4"
            max="13"
            step="1"
            value={spacing}
            onChange={(event) => setSpacing(Number(event.target.value))}
          />
        </label>

        <label className={styles.rangeControl}>
          <span>
            Star size <output>{pointSize.toFixed(1)}</output>
          </span>
          <input
            aria-label="Star size"
            data-testid="point-size-input"
            type="range"
            min="0.7"
            max="2.6"
            step="0.1"
            value={pointSize}
            onChange={(event) => setPointSize(Number(event.target.value))}
          />
        </label>

        <label className={styles.rangeControl}>
          <span>
            Scatter <output>{dispersion.toFixed(2)}</output>
          </span>
          <input
            aria-label="Scatter"
            data-testid="dispersion-input"
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={dispersion}
            onChange={(event) => setDispersion(Number(event.target.value))}
          />
        </label>

        <label className={styles.rangeControl}>
          <span>
            Pointer force <output>{pointerForce}</output>
          </span>
          <input
            aria-label="Pointer force"
            data-testid="pointer-force-input"
            type="range"
            min="0"
            max="2000"
            step="20"
            value={pointerForce}
            onChange={(event) => setPointerForce(Number(event.target.value))}
          />
        </label>

        <label className={styles.rangeControl}>
          <span>
            Rest drift <output>{restMotion.toFixed(2)}</output>
          </span>
          <input
            aria-label="Rest drift"
            data-testid="rest-motion-input"
            type="range"
            min="0"
            max="3"
            step="0.05"
            value={restMotion}
            onChange={(event) => setRestMotion(Number(event.target.value))}
          />
        </label>

        <div className={styles.actions}>
          <button type="button" onClick={() => setRevision((value) => value + 1)}>
            Scatter again
          </button>
          <button type="button" onClick={() => setMounted((value) => !value)}>
            {mounted ? "Unmount" : "Mount field"}
          </button>
        </div>
      </form>
    </div>
  );
}
