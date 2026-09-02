"use client";

import { useState } from "react";
import { SceneType } from "../../../components/scene-type";
import styles from "./scene-type-demo.module.css";

const ENTRANCES = ["settle", "rise", "none"] as const;
const PHRASES = ["FIELD NOTES", "OPEN SIGNAL"] as const;

export function SceneTypeDemo() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [entranceIndex, setEntranceIndex] = useState(0);
  const [pointerDepth, setPointerDepth] = useState(14);
  const [idleRange, setIdleRange] = useState(4);
  const [sourceKind, setSourceKind] = useState<"image" | "video">("image");
  const [mounted, setMounted] = useState(true);
  const entrance = ENTRANCES[entranceIndex];

  return (
    <>
      <div className={styles.controls} role="group" aria-label="Scene Type controls">
        <button
          type="button"
          data-testid="scene-change-phrase"
          onClick={() => setPhraseIndex((current) => (current + 1) % PHRASES.length)}
        >
          Phrase <span>{phraseIndex + 1}/2</span>
        </button>
        <button
          type="button"
          data-testid="scene-change-entrance"
          onClick={() =>
            setEntranceIndex((current) => (current + 1) % ENTRANCES.length)
          }
        >
          Entrance <span>{entrance}</span>
        </button>
        <button
          type="button"
          data-testid="scene-change-source"
          onClick={() =>
            setSourceKind((current) => (current === "image" ? "video" : "image"))
          }
        >
          Source <span>{sourceKind}</span>
        </button>
        <button
          type="button"
          data-testid="scene-toggle-depth"
          aria-pressed={pointerDepth > 0}
          onClick={() => setPointerDepth((current) => (current > 0 ? 0 : 14))}
        >
          Pointer depth <span>{pointerDepth > 0 ? "on" : "off"}</span>
        </button>
        <button
          type="button"
          data-testid="scene-toggle-drift"
          aria-pressed={idleRange > 0}
          onClick={() => setIdleRange((current) => (current > 0 ? 0 : 4))}
        >
          Idle drift <span>{idleRange > 0 ? "on" : "off"}</span>
        </button>
        <button
          type="button"
          data-testid="scene-toggle-mounted"
          aria-pressed={mounted}
          onClick={() => setMounted((current) => !current)}
        >
          Specimen <span>{mounted ? "mounted" : "hidden"}</span>
        </button>
      </div>

      <div className={styles.stage} data-testid="scene-stage">
        <span className={styles.index} aria-hidden="true">ST—02 / 1200</span>
        {mounted ? (
          <div className={styles.component} data-testid="scene-type-component">
            <SceneType
              as="h2"
              source={
                sourceKind === "image"
                  ? "/scene-type-atmosphere.svg"
                  : "/scene-type-atmosphere.webm"
              }
              sourceKind={sourceKind}
              entrance={entrance}
              pointerDepth={pointerDepth}
              idleRange={idleRange}
            >
              {PHRASES[phraseIndex]}
            </SceneType>
          </div>
        ) : (
          <p className={styles.empty}>Specimen unmounted</p>
        )}
        <span className={styles.exposure} aria-hidden="true">+0.7 EV</span>
      </div>

      <p className={styles.caption} aria-live="polite">
        {sourceKind} · {entrance} · depth {pointerDepth} · drift {idleRange}
      </p>
    </>
  );
}
