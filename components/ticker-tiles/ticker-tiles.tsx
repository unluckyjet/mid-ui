"use client";

import {
  useLayoutEffect,
  useState,
  type CSSProperties,
} from "react";
import styles from "./ticker-tiles.module.css";

const DEFAULT_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&+?—";
const MAX_PHRASES = 24;
const MAX_SLOTS = 32;

type DisplayState = Readonly<{
  characters: readonly string[];
  changing: readonly boolean[];
  phase: 0 | 1;
}>;

type PausableTimer = {
  callback: (() => void) | null;
  id: number | null;
  remaining: number;
  startedAt: number;
};

export type TickerTilesProps = {
  phrases: readonly string[];
  alphabet?: string;
  changeTime?: number;
  stepTime?: number;
  cascade?: number;
  minimumSlots?: number;
  repeat?: boolean;
  className?: string;
};

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

function splitGraphemes(value: string) {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });

    return Array.from(segmenter.segment(value), ({ segment }) => segment);
  }

  return Array.from(value);
}

function normalizePhrases(phrases: readonly string[]) {
  const normalized = phrases.slice(0, MAX_PHRASES).map((phrase) => {
    const authored = String(phrase).replace(/\r\n?|\n|\t/g, " ");

    return splitGraphemes(authored).slice(0, MAX_SLOTS).join("");
  });

  return normalized.length > 0 ? normalized : [""];
}

function normalizeAlphabet(alphabet: string) {
  const glyphs = splitGraphemes(alphabet).filter(
    (glyph, index, values) =>
      glyph.trim().length > 0 && values.indexOf(glyph) === index,
  );

  return glyphs.length > 0 ? glyphs : splitGraphemes(DEFAULT_ALPHABET);
}

function padPhrase(phrase: string, slotCount: number) {
  const characters = splitGraphemes(phrase).slice(0, slotCount);

  while (characters.length < slotCount) {
    characters.push(" ");
  }

  return characters;
}

function createSettledDisplay(
  phrase: string,
  slotCount: number,
): DisplayState {
  return {
    characters: padPhrase(phrase, slotCount),
    changing: Array.from({ length: slotCount }, () => false),
    phase: 0,
  };
}

function hashSeed(source: string) {
  let hash = 2166136261;

  for (const glyph of Array.from(source)) {
    hash ^= glyph.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function readIntermediateGlyph(
  from: string,
  to: string,
  slotIndex: number,
  step: number,
  alphabet: readonly string[],
) {
  const seed = hashSeed(`${from}\u0000${to}\u0000${slotIndex}`);
  let index = (seed + step + slotIndex * 11) % alphabet.length;

  if (alphabet[index] === to && alphabet.length > 1) {
    index = (index + 1) % alphabet.length;
  }

  return alphabet[index] ?? to;
}

export function TickerTiles({
  phrases,
  alphabet = DEFAULT_ALPHABET,
  changeTime = 2400,
  stepTime = 72,
  cascade = 46,
  minimumSlots = 1,
  repeat = true,
  className,
}: TickerTilesProps) {
  const normalizedPhrases = normalizePhrases(phrases);
  const normalizedAlphabet = normalizeAlphabet(alphabet);
  const safeChangeTime = clamp(changeTime, 300, 20_000);
  const safeStepTime = clamp(stepTime, 24, 500);
  const safeCascade = clamp(cascade, 0, 400);
  const safeMinimumSlots = Math.round(clamp(minimumSlots, 1, MAX_SLOTS));
  const slotCount = Math.min(
    MAX_SLOTS,
    Math.max(
      safeMinimumSlots,
      ...normalizedPhrases.map((phrase) => splitGraphemes(phrase).length),
    ),
  );
  const phraseKey = JSON.stringify(normalizedPhrases);
  const alphabetKey = JSON.stringify(normalizedAlphabet);
  const [display, setDisplay] = useState<DisplayState>(() =>
    createSettledDisplay(normalizedPhrases[0] ?? "", slotCount),
  );
  const [settledPhrase, setSettledPhrase] = useState(
    normalizedPhrases[0] ?? "",
  );
  const [settledIndex, setSettledIndex] = useState(0);

  useLayoutEffect(() => {
    const cyclePhrases = JSON.parse(phraseKey) as string[];
    const cycleAlphabet = JSON.parse(alphabetKey) as string[];
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const timer: PausableTimer = {
      callback: null,
      id: null,
      remaining: 0,
      startedAt: 0,
    };
    let cancelled = false;
    let currentIndex = 0;
    let currentCharacters = padPhrase(cyclePhrases[0] ?? "", slotCount);
    let targetIndex: number | null = null;
    let visible = !document.hidden;

    function clearTimer(resetCallback = true) {
      if (timer.id !== null) {
        window.clearTimeout(timer.id);
        timer.id = null;
      }

      if (resetCallback) {
        timer.callback = null;
        timer.remaining = 0;
      }
    }

    function runTimer() {
      const callback = timer.callback;

      timer.id = null;
      timer.callback = null;
      timer.remaining = 0;
      callback?.();
    }

    function armTimer(callback: () => void, delay: number) {
      clearTimer();
      timer.callback = callback;
      timer.remaining = Math.max(0, delay);
      timer.startedAt = performance.now();

      if (visible) {
        timer.id = window.setTimeout(runTimer, timer.remaining);
      }
    }

    function pauseTimer() {
      if (timer.id === null) {
        return;
      }

      window.clearTimeout(timer.id);
      timer.id = null;
      timer.remaining = Math.max(
        0,
        timer.remaining - (performance.now() - timer.startedAt),
      );
    }

    function resumeTimer() {
      if (timer.id !== null || timer.callback === null) {
        return;
      }

      timer.startedAt = performance.now();
      timer.id = window.setTimeout(runTimer, timer.remaining);
    }

    function publish(displayState: DisplayState) {
      if (!cancelled) {
        setDisplay(displayState);
      }
    }

    function hasNextPhrase() {
      return (
        cyclePhrases.length > 1 &&
        (repeat || currentIndex < cyclePhrases.length - 1)
      );
    }

    function readNextIndex() {
      if (currentIndex < cyclePhrases.length - 1) {
        return currentIndex + 1;
      }

      return repeat ? 0 : null;
    }

    function scheduleHold() {
      if (hasNextPhrase()) {
        armTimer(beginTransition, safeChangeTime);
      }
    }

    function settle(index: number) {
      const phrase = cyclePhrases[index] ?? "";

      currentIndex = index;
      targetIndex = null;
      currentCharacters = padPhrase(phrase, slotCount);
      publish({
        characters: currentCharacters,
        changing: Array.from({ length: slotCount }, () => false),
        phase: 0,
      });

      if (!cancelled) {
        setSettledIndex(index);
        setSettledPhrase(phrase);
      }

      scheduleHold();
    }

    function beginTransition() {
      const nextIndex = readNextIndex();

      if (nextIndex === null) {
        return;
      }

      targetIndex = nextIndex;

      if (motionQuery.matches) {
        settle(nextIndex);
        return;
      }

      const targetCharacters = padPhrase(
        cyclePhrases[nextIndex] ?? "",
        slotCount,
      );
      const changedIndices = targetCharacters
        .map((character, index) =>
          character === currentCharacters[index] ? -1 : index,
        )
        .filter((index) => index >= 0);

      if (changedIndices.length === 0) {
        settle(nextIndex);
        return;
      }

      const intermediateSteps = Math.round(
        clamp(420 / safeStepTime, 4, 9),
      );
      const lastChangedIndex = changedIndices.at(-1) ?? 0;
      const cascadeSteps = Math.ceil(
        (lastChangedIndex * safeCascade) / safeStepTime,
      );
      const finalStep = intermediateSteps + cascadeSteps;
      let step = 0;

      function advance() {
        if (targetIndex === null || motionQuery.matches) {
          if (targetIndex !== null) {
            settle(targetIndex);
          }

          return;
        }

        if (step > finalStep) {
          settle(targetIndex);
          return;
        }

        const characters = currentCharacters.map((from, slotIndex) => {
          const to = targetCharacters[slotIndex] ?? " ";
          const localStep =
            step - Math.ceil((slotIndex * safeCascade) / safeStepTime);

          if (from === to || localStep < 0) {
            return from;
          }

          if (localStep >= intermediateSteps) {
            return to;
          }

          return readIntermediateGlyph(
            from,
            to,
            slotIndex,
            localStep,
            cycleAlphabet,
          );
        });
        const changing = currentCharacters.map((from, slotIndex) => {
          const to = targetCharacters[slotIndex] ?? " ";
          const localStep =
            step - Math.ceil((slotIndex * safeCascade) / safeStepTime);

          return (
            from !== to &&
            localStep >= 0 &&
            localStep < intermediateSteps
          );
        });

        publish({ characters, changing, phase: (step % 2) as 0 | 1 });
        step += 1;
        armTimer(advance, safeStepTime);
      }

      advance();
    }

    function syncVisibility() {
      visible = !document.hidden;

      if (visible) {
        resumeTimer();
      } else {
        pauseTimer();
      }
    }

    function syncMotionPreference() {
      if (motionQuery.matches && targetIndex !== null) {
        const pendingTarget = targetIndex;

        clearTimer();
        settle(pendingTarget);
      }
    }

    queueMicrotask(() => {
      publish({
        characters: currentCharacters,
        changing: Array.from({ length: slotCount }, () => false),
        phase: 0,
      });

      if (!cancelled) {
        setSettledIndex(0);
        setSettledPhrase(cyclePhrases[0] ?? "");
      }
    });
    document.addEventListener("visibilitychange", syncVisibility);
    motionQuery.addEventListener("change", syncMotionPreference);
    scheduleHold();

    return () => {
      cancelled = true;
      clearTimer();
      document.removeEventListener("visibilitychange", syncVisibility);
      motionQuery.removeEventListener("change", syncMotionPreference);
    };
  }, [
    alphabetKey,
    phraseKey,
    repeat,
    safeCascade,
    safeChangeTime,
    safeStepTime,
    slotCount,
  ]);

  const rootStyle = {
    "--ticker-slot-count": slotCount,
    "--ticker-step-time": `${safeStepTime}ms`,
  } as CSSProperties;

  return (
    <div
      className={`${styles.root}${className ? ` ${className}` : ""}`}
      data-settled-index={settledIndex}
      data-ticker-tiles=""
      style={rootStyle}
    >
      <ol className={styles.tiles} aria-hidden="true">
        {display.characters.map((character, index) => (
          <li
            className={styles.tile}
            data-character={character}
            data-changing={String(display.changing[index] ?? false)}
            data-phase={display.phase}
            data-slot={index}
            key={index}
          >
            <span className={styles.glyph}>
              {character === " " ? "\u00a0" : character}
            </span>
            <span className={styles.hinge} />
            <span className={styles.registration} />
          </li>
        ))}
      </ol>
      <span
        className={styles.live}
        aria-atomic="true"
        aria-live="polite"
        data-ticker-live=""
      >
        {settledPhrase}
      </span>
    </div>
  );
}
