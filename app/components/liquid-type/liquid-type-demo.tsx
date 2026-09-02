"use client";

import { useState } from "react";
import { LiquidType } from "../../../components/liquid-type";
import styles from "./liquid-type-demo.module.css";

type LiquidTypeDemoProps = Readonly<{
  displayClassName: string;
}>;

export function LiquidTypeDemo({
  displayClassName,
}: LiquidTypeDemoProps) {
  const [colorFringe, setColorFringe] = useState(2.4);
  const [alternateTypeface, setAlternateTypeface] = useState(false);
  const [distortion, setDistortion] = useState(18);
  const [driftRate, setDriftRate] = useState(0.72);
  const [fieldScale, setFieldScale] = useState(52);
  const [lensRange, setLensRange] = useState(180);
  const [lensStrength, setLensStrength] = useState(1.05);
  const [mounted, setMounted] = useState(true);
  const [phrase, setPhrase] = useState("MID LIQUID");
  const [revision, setRevision] = useState(0);

  return (
    <div className={styles.demo}>
      <div className={styles.instrument}>
        <div className={styles.instrumentHeader} aria-hidden="true">
          <span>Lens table / LT-05</span>
          <span>Canvas 2D · 30 fps</span>
        </div>

        <div className={styles.stage} data-testid="liquid-stage">
          <span className={styles.lensMarkerA} aria-hidden="true" />
          <span className={styles.lensMarkerB} aria-hidden="true" />
          <span className={styles.axisHorizontal} aria-hidden="true" />
          <span className={styles.axisVertical} aria-hidden="true" />
          {mounted ? (
            <LiquidType
              key={revision}
              className={`${displayClassName} ${styles.liquid} ${
                alternateTypeface ? styles.alternateTypeface : ""
              }`}
              colorFringe={colorFringe}
              distortion={distortion}
              driftRate={driftRate}
              fieldScale={fieldScale}
              lensRange={lensRange}
              lensStrength={lensStrength}
            >
              {phrase}
            </LiquidType>
          ) : (
            <p className={styles.unmounted}>Optical field offline</p>
          )}
        </div>

        <div className={styles.instrumentFooter} aria-hidden="true">
          <span>Broad cell array</span>
          <span>Pointer wake enabled</span>
          <span>DPR ≤ 1.5</span>
        </div>
      </div>

      <form
        className={styles.controls}
        onSubmit={(event) => event.preventDefault()}
      >
        <div className={styles.controlsHeading}>
          <div>
            <p>Lens controls</p>
            <span>Live optical field</span>
          </div>
          <span className={styles.status} data-active={mounted}>
            {mounted ? "Drifting" : "Offline"}
          </span>
        </div>

        <label className={styles.textControl}>
          <span>Phrase</span>
          <input
            data-testid="liquid-phrase"
            maxLength={120}
            value={phrase}
            onChange={(event) => setPhrase(event.target.value.toUpperCase())}
          />
        </label>

        <div className={styles.rangeGrid}>
          <label className={styles.rangeControl}>
            <span>
              Distortion <output>{distortion}px</output>
            </span>
            <input
              aria-label="Distortion"
              data-testid="distortion-input"
              type="range"
              min="0"
              max="36"
              step="1"
              value={distortion}
              onChange={(event) => setDistortion(Number(event.target.value))}
            />
          </label>

          <label className={styles.rangeControl}>
            <span>
              Field scale <output>{fieldScale}</output>
            </span>
            <input
              aria-label="Field scale"
              data-testid="field-scale-input"
              type="range"
              min="20"
              max="100"
              step="2"
              value={fieldScale}
              onChange={(event) => setFieldScale(Number(event.target.value))}
            />
          </label>

          <label className={styles.rangeControl}>
            <span>
              Drift <output>{driftRate.toFixed(2)}</output>
            </span>
            <input
              aria-label="Drift rate"
              data-testid="drift-rate-input"
              type="range"
              min="0"
              max="1.8"
              step="0.06"
              value={driftRate}
              onChange={(event) => setDriftRate(Number(event.target.value))}
            />
          </label>

          <label className={styles.rangeControl}>
            <span>
              Lens reach <output>{lensRange}px</output>
            </span>
            <input
              aria-label="Lens reach"
              data-testid="lens-range-input"
              type="range"
              min="60"
              max="360"
              step="10"
              value={lensRange}
              onChange={(event) => setLensRange(Number(event.target.value))}
            />
          </label>

          <label className={styles.rangeControl}>
            <span>
              Lens power <output>{lensStrength.toFixed(2)}</output>
            </span>
            <input
              aria-label="Lens power"
              data-testid="lens-strength-input"
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={lensStrength}
              onChange={(event) => setLensStrength(Number(event.target.value))}
            />
          </label>

          <label className={styles.rangeControl}>
            <span>
              Color edge <output>{colorFringe.toFixed(1)}px</output>
            </span>
            <input
              aria-label="Color edge"
              data-testid="color-fringe-input"
              type="range"
              min="0"
              max="7"
              step="0.2"
              value={colorFringe}
              onChange={(event) => setColorFringe(Number(event.target.value))}
            />
          </label>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => setAlternateTypeface((value) => !value)}
          >
            Swap typeface
          </button>
          <button type="button" onClick={() => setRevision((value) => value + 1)}>
            Recalibrate
          </button>
          <button type="button" onClick={() => setMounted((value) => !value)}>
            {mounted ? "Unmount" : "Mount field"}
          </button>
        </div>
      </form>
    </div>
  );
}
