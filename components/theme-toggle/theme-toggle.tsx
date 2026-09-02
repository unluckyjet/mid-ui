"use client";

import { useRef } from "react";
import styles from "./theme-toggle.module.css";

type Theme = "light" | "dark";

type ViewTransitionLike = {
  finished: Promise<unknown>;
  ready: Promise<unknown>;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionLike;
};

type ViewTransitionAnimationOptions = KeyframeAnimationOptions & {
  pseudoElement: string;
};

const THEME_STORAGE_KEY = "mid-ui-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme switching should still work when storage is unavailable.
  }
}

function readWaveDuration() {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--theme-wave-duration")
    .trim();
  const duration = Number.parseFloat(value);

  if (!Number.isFinite(duration)) {
    return 650;
  }

  return value.endsWith("ms") ? duration : duration * 1000;
}

function readWaveEasing() {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--ease-smooth-out")
      .trim() || "cubic-bezier(0.22, 1, 0.36, 1)"
  );
}

export function ThemeToggle() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const waveRef = useRef<HTMLSpanElement>(null);
  const isTransitioningRef = useRef(false);

  function runFallbackWave(
    nextTheme: Theme,
    originX: number,
    originY: number,
    radius: number,
  ) {
    const wave = waveRef.current;

    if (!wave) {
      applyTheme(nextTheme);
      return;
    }

    const duration = readWaveDuration();
    wave.dataset.targetTheme = nextTheme;
    wave.style.setProperty("--wave-origin-x", `${originX}px`);
    wave.style.setProperty("--wave-origin-y", `${originY}px`);
    wave.style.setProperty("--wave-radius", `${radius}`);
    void wave.offsetWidth;
    wave.classList.add(styles.waveActive);

    window.setTimeout(() => {
      applyTheme(nextTheme);
      wave.classList.remove(styles.waveActive);
      delete wave.dataset.targetTheme;
      isTransitioningRef.current = false;
    }, duration);
  }

  function toggleTheme() {
    const button = buttonRef.current;

    if (!button || isTransitioningRef.current) {
      return;
    }

    const root = document.documentElement;
    const nextTheme: Theme = root.dataset.theme === "dark" ? "light" : "dark";
    const prefersReducedMotion = matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const transitionDocument = document as ViewTransitionDocument;

    if (prefersReducedMotion) {
      applyTheme(nextTheme);
      return;
    }

    const bounds = button.getBoundingClientRect();
    const originX = bounds.left + bounds.width / 2;
    const originY = bounds.top + bounds.height / 2;
    const radius = Math.hypot(
      Math.max(originX, innerWidth - originX),
      Math.max(originY, innerHeight - originY),
    );

    isTransitioningRef.current = true;

    if (!transitionDocument.startViewTransition) {
      runFallbackWave(nextTheme, originX, originY, radius);
      return;
    }

    const transition = transitionDocument.startViewTransition(() => {
      applyTheme(nextTheme);
    });

    void transition.ready
      .then(() => {
        const options: ViewTransitionAnimationOptions = {
          duration: readWaveDuration(),
          easing: readWaveEasing(),
          fill: "both",
          pseudoElement: "::view-transition-new(root)",
        };

        root.animate(
          {
            clipPath: [
              `circle(0px at ${originX}px ${originY}px)`,
              `circle(${radius}px at ${originX}px ${originY}px)`,
            ],
          },
          options,
        );
      })
      .catch(() => {
        // The theme has already been applied; no recovery is needed.
      });

    void transition.finished.then(
      () => {
        isTransitioningRef.current = false;
      },
      () => {
        isTransitioningRef.current = false;
      },
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        className={styles.toggle}
        type="button"
        aria-label="Toggle color theme"
        title="Toggle color theme"
        onClick={toggleTheme}
      >
        <span className={styles.iconFrame} aria-hidden="true">
          <svg className={`${styles.icon} ${styles.sun}`} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3.25" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.28 5.28l1.42 1.42M17.3 17.3l1.42 1.42M18.72 5.28 17.3 6.7M6.7 17.3l-1.42 1.42" />
          </svg>
          <svg className={`${styles.icon} ${styles.moon}`} viewBox="0 0 24 24">
            <path d="M19.3 15.15A8.2 8.2 0 0 1 8.85 4.7 8.2 8.2 0 1 0 19.3 15.15Z" />
          </svg>
        </span>
      </button>
      <span ref={waveRef} className={styles.wave} aria-hidden="true" />
    </>
  );
}
