"use client";

import { useId, useLayoutEffect, useMemo, useRef } from "react";
import styles from "./ink-trace.module.css";

export type InkTraceProps = Readonly<{
  as?: "h1" | "h2" | "h3" | "p";
  children: string;
  className?: string;
  fillStyle?: "pool" | "fade" | "none";
  fillWait?: number;
  letterDelay?: number;
  sequence?: "forward" | "reverse";
  startWhen?: "mount" | "visible" | "hover";
  traceTime?: number;
}>;

const MAX_ANIMATED_UNITS = 64;
const THEME_TRANSITION_START_EVENT = "mid-ui:theme-transition-start";
const THEME_TRANSITION_END_EVENT = "mid-ui:theme-transition-end";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function segmentText(value: string) {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });

    return Array.from(segmenter.segment(value), ({ segment }) => segment);
  }

  return Array.from(value);
}

export function InkTrace({
  as = "h2",
  children,
  className,
  fillStyle = "pool",
  fillWait = 140,
  letterDelay = 58,
  sequence = "forward",
  startWhen = "visible",
  traceTime = 760,
}: InkTraceProps) {
  const instanceId = useId().replaceAll(":", "");
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const graphemes = useMemo(() => segmentText(children), [children]);
  const visualUnits = useMemo(
    () =>
      graphemes.length > MAX_ANIMATED_UNITS ? [children] : graphemes,
    [children, graphemes],
  );
  const SemanticTag = as;
  const classNames = [styles.root, className].filter(Boolean).join(" ");
  const maskId = `ink-trace-pool-${instanceId}`;
  const filterId = `ink-trace-grain-${instanceId}`;
  const gradientId = `ink-trace-fill-${instanceId}`;

  useLayoutEffect(() => {
    const root = rootRef.current!;
    const svg = svgRef.current!;

    if (!root || !svg) {
      return;
    }

    const safeTraceTime = clamp(finiteOr(traceTime, 760), 120, 4_000);
    const safeFillWait = clamp(finiteOr(fillWait, 140), 0, 3_000);
    const safeLetterDelay = clamp(finiteOr(letterDelay, 58), 0, 400);
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const outlines = Array.from(
      svg.querySelectorAll<SVGTextElement>("[data-ink-outline]"),
    );
    const fills = Array.from(
      svg.querySelectorAll<SVGTextElement>("[data-ink-fill]"),
    );
    const pool = svg.querySelector<SVGPathElement>("[data-ink-pool]");
    const visualGroups = Array.from(
      svg.querySelectorAll<SVGGElement>("[data-ink-group]"),
    );
    let animations: Animation[] = [];
    let disposed = false;
    let hasRun = false;
    let intersecting = startWhen !== "visible";
    let pendingHoverTrigger = false;
    let runNumber = 0;
    let themeTransitionPaused = false;
    let waitingForFonts = true;

    function canPlay() {
      return (
        !disposed &&
        !motionQuery.matches &&
        document.visibilityState === "visible" &&
        intersecting &&
        !themeTransitionPaused
      );
    }

    function cancelAnimations() {
      for (const animation of animations) {
        animation.cancel();
      }

      animations = [];
    }

    function orderedIndex(index: number) {
      return sequence === "reverse" ? outlines.length - index - 1 : index;
    }

    function measure() {
      if (visualGroups.length === 0 || outlines.length === 0) {
        root.dataset.ready = "true";
        return;
      }

      for (const visualGroup of visualGroups) {
        visualGroup.removeAttribute("transform");
      }
      const firstOutline = outlines[0];
      const fontSize = Number.parseFloat(getComputedStyle(firstOutline).fontSize) || 220;
      const gap = fontSize * -0.035;
      const widths = outlines.map((outline) => {
        const measured = outline.getComputedTextLength();

        return Math.max(measured, /^\s+$/u.test(outline.textContent ?? "") ? fontSize * 0.3 : 1);
      });
      const totalWidth = Math.max(
        1,
        widths.reduce((sum, width) => sum + width, 0) +
          gap * Math.max(0, widths.length - 1),
      );
      const horizontalScale = Math.min(1, 1_080 / totalWidth);
      const startX = (1_200 - totalWidth * horizontalScale) / 2;
      let cursor = 0;

      for (const visualGroup of visualGroups) {
        visualGroup.setAttribute(
          "transform",
          `translate(${startX} 0) scale(${horizontalScale} 1)`,
        );
      }

      outlines.forEach((outline, index) => {
        const fill = fills[index];
        const x = cursor;

        outline.setAttribute("x", String(x));
        fill?.setAttribute("x", String(x));
        cursor += widths[index] + gap;

        const bounds = outline.getBBox();
        const traceLength = Math.max(
          180,
          Math.ceil((bounds.width + bounds.height) * 2.65),
        );

        outline.dataset.traceLength = String(traceLength);
        outline.style.strokeDasharray = String(traceLength);
        outline.style.strokeDashoffset = String(traceLength);
      });

      root.dataset.ready = "true";
      root.dataset.unitCount = String(outlines.length);
    }

    function applyInitialState() {
      cancelAnimations();

      for (const outline of outlines) {
        const length = outline.dataset.traceLength ?? "180";

        outline.style.strokeDasharray = length;
        outline.style.strokeDashoffset = length;
      }

      for (const fill of fills) {
        fill.style.opacity = "0";
      }

      if (pool) {
        pool.style.transform = "translateY(330px)";
      }

      root.dataset.phase = "idle";
    }

    function applyFinalState() {
      cancelAnimations();

      for (const outline of outlines) {
        outline.style.strokeDashoffset = "0";
      }

      for (const fill of fills) {
        fill.style.opacity = fillStyle === "none" ? "0" : "1";
      }

      if (pool) {
        pool.style.transform = "translateY(0)";
      }

      hasRun = true;
      root.dataset.phase = motionQuery.matches ? "reduced" : "complete";
    }

    function pauseAnimations() {
      const activeAnimations = animations.filter(
        (animation) => animation.playState === "running",
      );

      for (const animation of activeAnimations) {
        animation.pause();
      }

      if (activeAnimations.length > 0) {
        root.dataset.phase = "paused";
      }
    }

    function resumeAnimations() {
      if (!canPlay()) {
        return;
      }

      const pausedAnimations = animations.filter(
        (animation) => animation.playState === "paused",
      );

      for (const animation of pausedAnimations) {
        animation.play();
      }

      if (pausedAnimations.length > 0) {
        root.dataset.phase = "running";
      }
    }

    function run() {
      if (disposed || waitingForFonts || children.length === 0) {
        return;
      }

      if (motionQuery.matches) {
        applyFinalState();
        return;
      }

      applyInitialState();
      hasRun = true;
      runNumber += 1;
      root.dataset.run = String(runNumber);
      root.dataset.phase = canPlay() ? "running" : "paused";

      outlines.forEach((outline, index) => {
        const traceLength = outline.dataset.traceLength ?? "180";
        const animation = outline.animate(
          [
            { strokeDashoffset: traceLength },
            { strokeDashoffset: "0" },
          ],
          {
            delay: orderedIndex(index) * safeLetterDelay,
            duration: safeTraceTime,
            easing: "cubic-bezier(0.33, 0.03, 0.2, 1)",
            fill: "both",
          },
        );

        animations.push(animation);
      });

      const traceEnd =
        safeTraceTime + Math.max(0, outlines.length - 1) * safeLetterDelay;
      const fillStart = traceEnd + safeFillWait;
      const fillDuration = Math.max(240, safeTraceTime * 0.68);

      if (fillStyle === "pool" && pool) {
        animations.push(
          pool.animate(
            [
              { transform: "translateY(330px)" },
              { transform: "translateY(0)" },
            ],
            {
              delay: fillStart,
              duration: fillDuration,
              easing: "cubic-bezier(0.2, 0.74, 0.24, 1)",
              fill: "both",
            },
          ),
        );

        fills.forEach((fill) => {
          fill.style.opacity = "1";
        });
      } else if (fillStyle === "fade") {
        fills.forEach((fill, index) => {
          animations.push(
            fill.animate([{ opacity: 0 }, { opacity: 1 }], {
              delay:
                fillStart + orderedIndex(index) * Math.min(40, safeLetterDelay * 0.45),
              duration: fillDuration,
              easing: "ease-out",
              fill: "both",
            }),
          );
        });
      }

      if (!canPlay()) {
        pauseAnimations();
      }

      const currentRun = runNumber;

      void Promise.all(animations.map((animation) => animation.finished))
        .then(() => {
          if (!disposed && currentRun === runNumber) {
            root.dataset.phase = "complete";
          }
        })
        .catch(() => {
          // Cancelling a replay or unmount rejects finished promises by design.
        });
    }

    function syncMotionPreference() {
      if (motionQuery.matches) {
        applyFinalState();
      } else if (hasRun) {
        applyFinalState();
      } else {
        applyInitialState();
      }
    }

    function syncPlayback() {
      if (canPlay()) {
        resumeAnimations();
      } else {
        pauseAnimations();
      }
    }

    function handleHoverTrigger() {
      if (
        startWhen === "hover" &&
        (root.dataset.phase === "idle" || root.dataset.phase === "complete")
      ) {
        if (waitingForFonts) {
          pendingHoverTrigger = true;
          return;
        }

        run();
      }
    }

    function pauseForThemeTransition() {
      themeTransitionPaused = true;
      syncPlayback();
    }

    function resumeAfterThemeTransition() {
      themeTransitionPaused = false;
      syncPlayback();
    }

    const resizeObserver = new ResizeObserver(() => {
      const phase = root.dataset.phase;

      measure();
      if (phase === "complete" || phase === "reduced") {
        applyFinalState();
      }
    });
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? true;

      if (startWhen === "visible" && intersecting && !hasRun) {
        run();
      }

      syncPlayback();
    });

    root.dataset.fill = fillStyle;
    root.dataset.phase = "loading";
    root.dataset.ready = "false";
    root.dataset.run = "0";
    root.dataset.unitCount = String(outlines.length);
    resizeObserver.observe(root);
    intersectionObserver.observe(root);
    motionQuery.addEventListener("change", syncMotionPreference);
    document.addEventListener("visibilitychange", syncPlayback);
    root.addEventListener("pointerenter", handleHoverTrigger, {
      passive: true,
    });
    window.addEventListener(
      THEME_TRANSITION_START_EVENT,
      pauseForThemeTransition,
    );
    window.addEventListener(
      THEME_TRANSITION_END_EVENT,
      resumeAfterThemeTransition,
    );

    measure();
    if (motionQuery.matches || startWhen === "hover") {
      applyFinalState();
    } else {
      applyInitialState();
    }
    void document.fonts.ready.then(() => {
      if (disposed) {
        return;
      }

      waitingForFonts = false;
      measure();

      if (motionQuery.matches) {
        applyFinalState();
      } else if (startWhen === "hover") {
        applyFinalState();

        if (pendingHoverTrigger || root.matches(":hover")) {
          pendingHoverTrigger = false;
          run();
        }
      } else if (startWhen === "mount") {
        applyInitialState();
        run();
      } else if (startWhen === "visible" && intersecting) {
        applyInitialState();
        run();
      } else {
        applyInitialState();
      }
    });

    return () => {
      disposed = true;
      cancelAnimations();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      motionQuery.removeEventListener("change", syncMotionPreference);
      document.removeEventListener("visibilitychange", syncPlayback);
      root.removeEventListener("pointerenter", handleHoverTrigger);
      window.removeEventListener(
        THEME_TRANSITION_START_EVENT,
        pauseForThemeTransition,
      );
      window.removeEventListener(
        THEME_TRANSITION_END_EVENT,
        resumeAfterThemeTransition,
      );
    };
  }, [
    children,
    className,
    fillStyle,
    fillWait,
    letterDelay,
    sequence,
    startWhen,
    traceTime,
    visualUnits,
  ]);

  return (
    <div
      ref={rootRef}
      className={classNames}
      data-fill={fillStyle}
      data-mid-ui="ink-trace"
      data-phase="loading"
      data-ready="false"
      data-run="0"
      data-unit-count={visualUnits.length}
    >
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox="0 0 1200 360"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop className={styles.fillStart} offset="0" />
            <stop className={styles.fillMiddle} offset="0.56" />
            <stop className={styles.fillEnd} offset="1" />
          </linearGradient>
          <filter id={filterId} x="-4%" y="-8%" width="108%" height="116%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.19"
              numOctaves="1"
              seed="17"
              result="grain"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="grain"
              scale="0.72"
              xChannelSelector="R"
              yChannelSelector="B"
            />
          </filter>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="360">
            <path
              data-ink-pool
              className={styles.pool}
              d="M0 42 C105 18 206 58 314 34 C438 8 518 59 642 31 C760 4 866 62 974 33 C1060 10 1132 41 1200 24 L1200 360 L0 360 Z"
            />
          </mask>
        </defs>

        {fillStyle !== "none" ? (
          <g
            className={styles.fillGroup}
            mask={fillStyle === "pool" ? `url(#${maskId})` : undefined}
          >
            <g data-ink-group className={styles.visualGroup}>
              {visualUnits.map((unit, index) => (
                <text
                  key={`fill-${index}-${unit}`}
                  data-ink-fill
                  className={styles.fillText}
                  x="0"
                  y="245"
                  fill={`url(#${gradientId})`}
                >
                  {unit}
                </text>
              ))}
            </g>
          </g>
        ) : null}

        <g
          data-ink-group
          className={`${styles.visualGroup} ${styles.outlineGroup}`}
          filter={`url(#${filterId})`}
        >
          {visualUnits.map((unit, index) => (
            <text
              key={`outline-${index}-${unit}`}
              data-ink-outline
              className={styles.outlineText}
              x="0"
              y="245"
            >
              {unit}
            </text>
          ))}
        </g>
      </svg>

      {children.trim().length > 0 ? (
        <SemanticTag className={styles.semantic}>{children}</SemanticTag>
      ) : null}
    </div>
  );
}
