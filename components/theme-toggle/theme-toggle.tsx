"use client";

import { useLayoutEffect, useRef } from "react";
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
const THEME_CHANGE_EVENT = "mid-ui:theme-change";
const THEME_TRANSITION_START_EVENT = "mid-ui:theme-transition-start";
const THEME_TRANSITION_END_EVENT = "mid-ui:theme-transition-end";

function isTheme(value: string | undefined | null): value is Theme {
  return value === "light" || value === "dark";
}

function resolveTheme(): Theme {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    if (isTheme(savedTheme)) {
      return savedTheme;
    }
  } catch {
    // Fall through to the DOM and system preferences.
  }

  const documentTheme = document.documentElement.dataset.theme;

  if (isTheme(documentTheme)) {
    return documentTheme;
  }

  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function syncToggleState(button: HTMLButtonElement | null, theme: Theme) {
  if (!button) {
    return;
  }

  const targetTheme = theme === "dark" ? "light" : "dark";

  button.setAttribute("aria-checked", String(theme === "dark"));
  button.title = `Switch to ${targetTheme} theme`;
}

function applyTheme(theme: Theme, button: HTMLButtonElement | null) {
  document.documentElement.dataset.theme = theme;
  syncToggleState(button, theme);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));

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
    return 500;
  }

  return value.endsWith("ms") ? duration : duration * 1000;
}

function readWaveEasing() {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--theme-wave-easing")
      .trim() || "cubic-bezier(0.4, 0, 1, 1)"
  );
}

export function ThemeToggle() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isTransitioningRef = useRef(false);
  const waveAnimationRef = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const theme = resolveTheme();

    document.documentElement.dataset.theme = theme;
    syncToggleState(buttonRef.current, theme);

    return () => {
      waveAnimationRef.current?.cancel();
      waveAnimationRef.current = null;
      isTransitioningRef.current = false;
    };
  }, []);

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

    if (prefersReducedMotion || !transitionDocument.startViewTransition) {
      applyTheme(nextTheme, button);
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
    waveAnimationRef.current?.cancel();
    waveAnimationRef.current = null;
    window.dispatchEvent(new Event(THEME_TRANSITION_START_EVENT));

    let transition: ViewTransitionLike;

    try {
      transition = transitionDocument.startViewTransition(() => {
        applyTheme(nextTheme, button);
      });
    } catch {
      window.dispatchEvent(new Event(THEME_TRANSITION_END_EVENT));
      isTransitioningRef.current = false;
      applyTheme(nextTheme, button);
      return;
    }

    void transition.ready
      .then(() => {
        const options: ViewTransitionAnimationOptions = {
          duration: readWaveDuration(),
          easing: readWaveEasing(),
          fill: "none",
          pseudoElement: "::view-transition-new(root)",
        };

        waveAnimationRef.current = root.animate(
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

    const finishTransition = () => {
      waveAnimationRef.current?.cancel();
      waveAnimationRef.current = null;
      isTransitioningRef.current = false;
      window.dispatchEvent(new Event(THEME_TRANSITION_END_EVENT));
    };

    void transition.finished.then(
      finishTransition,
      finishTransition,
    );
  }

  return (
    <button
      ref={buttonRef}
      className={styles.toggle}
      type="button"
      role="switch"
      aria-label="Dark mode"
      aria-checked="false"
      title="Switch color theme"
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
  );
}
