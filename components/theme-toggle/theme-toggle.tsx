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
    const root = document.documentElement;

    function syncFromDocument() {
      const currentTheme = root.dataset.theme;

      if (isTheme(currentTheme)) {
        syncToggleState(buttonRef.current, currentTheme);
      }
    }

    root.dataset.theme = theme;
    syncToggleState(buttonRef.current, theme);

    const themeObserver = new MutationObserver(syncFromDocument);

    themeObserver.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    window.addEventListener(THEME_CHANGE_EVENT, syncFromDocument);

    return () => {
      themeObserver.disconnect();
      window.removeEventListener(THEME_CHANGE_EVENT, syncFromDocument);
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
      <span className={styles.sky} aria-hidden="true">
        <span className={styles.dayMark} />
        <span className={styles.stars} />
        <span className={styles.horizon} />
      </span>
      <span className={styles.lens} aria-hidden="true">
        <svg className={`${styles.glyph} ${styles.sun}`} viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="2.7" />
          <path d="M10 3.1v1.3M10 15.6v1.3M3.1 10h1.3M15.6 10h1.3M5.12 5.12l.92.92M13.96 13.96l.92.92M14.88 5.12l-.92.92M6.04 13.96l-.92.92" />
        </svg>
        <svg className={`${styles.glyph} ${styles.moon}`} viewBox="0 0 20 20">
          <path d="M14.82 12.42A5.72 5.72 0 0 1 7.58 5.18a5.84 5.84 0 1 0 7.24 7.24Z" />
        </svg>
      </span>
    </button>
  );
}
