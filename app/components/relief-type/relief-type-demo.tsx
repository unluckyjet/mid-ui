"use client";

import { useState } from "react";
import { ReliefType } from "../../../components/relief-type";
import styles from "./relief-type-demo.module.css";

const PHRASES = ["CUT DEEP", "RAISED INK", "SOLID TYPE"] as const;

export function ReliefTypeDemo() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [layers, setLayers] = useState(9);
  const [step, setStep] = useState(2.2);
  const [tilt, setTilt] = useState(8);
  const [response, setResponse] = useState(150);
  const [orbit, setOrbit] = useState(4);
  const [shadow, setShadow] = useState(true);
  const [mounted, setMounted] = useState(true);

  return (
    <section className={styles.proof} aria-label="Relief Type configurator">
      <div className={styles.stage} data-testid="relief-stage">
        <span className={styles.mark}>DEPTH STUDY 010</span>
        {mounted ? (
          <h2 className={styles.specimen} data-testid="relief-component">
            <ReliefType
              layers={layers}
              step={step}
              tiltRange={tilt}
              response={response}
              idleOrbit={orbit}
              shadow={shadow}
            >
              {PHRASES[phraseIndex]}
            </ReliefType>
          </h2>
        ) : (
          <p className={styles.empty}>Plate lifted</p>
        )}
        <span className={styles.scale} aria-hidden="true">0&nbsp;&nbsp;5&nbsp;&nbsp;10&nbsp;&nbsp;15 MM</span>
      </div>

      <div className={styles.controls}>
        <div className={styles.controlHeader}>
          <div><span>Plate controls</span><strong>{PHRASES[phraseIndex]}</strong></div>
          <button type="button" data-testid="relief-phrase" onClick={() => setPhraseIndex((value) => (value + 1) % PHRASES.length)}>New proof</button>
        </div>

        <label>Layers <output>{layers}</output>
          <input data-testid="relief-layers" type="range" min="2" max="14" value={layers} onChange={(event) => setLayers(Number(event.target.value))} />
        </label>
        <label>Layer step <output>{step.toFixed(1)} px</output>
          <input data-testid="relief-step" type="range" min="0.5" max="5" step="0.1" value={step} onChange={(event) => setStep(Number(event.target.value))} />
        </label>
        <label>Tilt <output>{tilt}°</output>
          <input data-testid="relief-tilt" type="range" min="0" max="18" value={tilt} onChange={(event) => setTilt(Number(event.target.value))} />
        </label>
        <label>Response <output>{response} ms</output>
          <input data-testid="relief-response" type="range" min="45" max="500" step="5" value={response} onChange={(event) => setResponse(Number(event.target.value))} />
        </label>
        <label>Idle orbit <output>{orbit}°</output>
          <input data-testid="relief-orbit" type="range" min="0" max="12" value={orbit} onChange={(event) => setOrbit(Number(event.target.value))} />
        </label>

        <div className={styles.actions}>
          <button type="button" data-testid="relief-shadow" aria-pressed={shadow} onClick={() => setShadow((value) => !value)}>Cast shadow <span>{shadow ? "on" : "off"}</span></button>
          <button type="button" data-testid="relief-mounted" aria-pressed={mounted} onClick={() => setMounted((value) => !value)}>Plate <span>{mounted ? "set" : "lifted"}</span></button>
        </div>
      </div>
    </section>
  );
}
