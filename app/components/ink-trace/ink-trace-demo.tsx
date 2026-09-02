"use client";

import { useState } from "react";
import {
  InkTrace,
  type InkTraceProps,
} from "../../../components/ink-trace";
import styles from "./ink-trace-demo.module.css";

type InkTraceDemoProps = Readonly<{
  displayClassName: string;
}>;

export function InkTraceDemo({ displayClassName }: InkTraceDemoProps) {
  const [fillStyle, setFillStyle] = useState<
    NonNullable<InkTraceProps["fillStyle"]>
  >("pool");
  const [fillWait, setFillWait] = useState(140);
  const [letterDelay, setLetterDelay] = useState(58);
  const [mounted, setMounted] = useState(true);
  const [phrase, setPhrase] = useState("MARK THE MOMENT");
  const [revision, setRevision] = useState(0);
  const [sequence, setSequence] = useState<
    NonNullable<InkTraceProps["sequence"]>
  >("forward");
  const [startWhen, setStartWhen] = useState<
    NonNullable<InkTraceProps["startWhen"]>
  >("visible");
  const [traceTime, setTraceTime] = useState(760);

  return (
    <div className={styles.demo}>
      <div className={styles.press}>
        <div className={styles.pressRail} aria-hidden="true">
          <span>Proof / 009</span>
          <span>Native SVG</span>
          <span>Dry trace → wet fill</span>
        </div>

        <div className={styles.sheet} data-testid="ink-trace-stage">
          <span className={styles.registrationTop} aria-hidden="true" />
          <span className={styles.registrationBottom} aria-hidden="true" />
          <p className={styles.sheetLabel} aria-hidden="true">
            Edition of one
          </p>
          {mounted ? (
            <InkTrace
              key={revision}
              as="h2"
              className={`${displayClassName} ${styles.trace}`}
              fillStyle={fillStyle}
              fillWait={fillWait}
              letterDelay={letterDelay}
              sequence={sequence}
              startWhen={startWhen}
              traceTime={traceTime}
            >
              {phrase}
            </InkTrace>
          ) : (
            <p className={styles.unmounted}>Plate lifted from press</p>
          )}
          <div className={styles.sheetFooter} aria-hidden="true">
            <span>1200 × 360 field</span>
            <span>Ink pool mask</span>
          </div>
        </div>
      </div>

      <form
        className={styles.controls}
        onSubmit={(event) => event.preventDefault()}
      >
        <div className={styles.controlsHeading}>
          <div>
            <p>Press settings</p>
            <span>Live proof controls</span>
          </div>
          <span className={styles.status} data-active={mounted}>
            {mounted ? "Plate ready" : "Offline"}
          </span>
        </div>

        <label className={styles.field}>
          <span>Copy</span>
          <input
            data-testid="ink-trace-phrase"
            maxLength={90}
            value={phrase}
            onChange={(event) => setPhrase(event.target.value.toUpperCase())}
          />
        </label>

        <div className={styles.selectGrid}>
          <label className={styles.field}>
            <span>Trigger</span>
            <select
              aria-label="Trigger"
              data-testid="start-when-input"
              value={startWhen}
              onChange={(event) =>
                setStartWhen(
                  event.target.value as NonNullable<
                    InkTraceProps["startWhen"]
                  >,
                )
              }
            >
              <option value="mount">Mount</option>
              <option value="visible">Visible</option>
              <option value="hover">Hover</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Fill</span>
            <select
              aria-label="Fill style"
              data-testid="fill-style-input"
              value={fillStyle}
              onChange={(event) =>
                setFillStyle(
                  event.target.value as NonNullable<
                    InkTraceProps["fillStyle"]
                  >,
                )
              }
            >
              <option value="pool">Pool</option>
              <option value="fade">Fade</option>
              <option value="none">Outline only</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Sequence</span>
            <select
              aria-label="Sequence"
              data-testid="sequence-input"
              value={sequence}
              onChange={(event) =>
                setSequence(
                  event.target.value as NonNullable<
                    InkTraceProps["sequence"]
                  >,
                )
              }
            >
              <option value="forward">Forward</option>
              <option value="reverse">Reverse</option>
            </select>
          </label>
        </div>

        <div className={styles.rangeGrid}>
          <label className={styles.rangeField}>
            <span>
              Trace <output>{traceTime}ms</output>
            </span>
            <input
              aria-label="Trace time"
              data-testid="trace-time-input"
              type="range"
              min="180"
              max="1600"
              step="20"
              value={traceTime}
              onChange={(event) => setTraceTime(Number(event.target.value))}
            />
          </label>

          <label className={styles.rangeField}>
            <span>
              Letter gap <output>{letterDelay}ms</output>
            </span>
            <input
              aria-label="Letter delay"
              data-testid="letter-delay-input"
              type="range"
              min="0"
              max="180"
              step="2"
              value={letterDelay}
              onChange={(event) => setLetterDelay(Number(event.target.value))}
            />
          </label>

          <label className={styles.rangeField}>
            <span>
              Fill wait <output>{fillWait}ms</output>
            </span>
            <input
              aria-label="Fill wait"
              data-testid="fill-wait-input"
              type="range"
              min="0"
              max="900"
              step="10"
              value={fillWait}
              onChange={(event) => setFillWait(Number(event.target.value))}
            />
          </label>
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={() => setRevision((value) => value + 1)}>
            Pull new proof
          </button>
          <button type="button" onClick={() => setMounted((value) => !value)}>
            {mounted ? "Lift plate" : "Set plate"}
          </button>
        </div>
      </form>
    </div>
  );
}
