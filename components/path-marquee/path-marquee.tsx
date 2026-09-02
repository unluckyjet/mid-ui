"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styles from "./path-marquee.module.css";

export type PathMarqueeContour = "swell" | "halo" | "orbit" | "straight";

export type PathMarqueeProps = {
  phrase: string;
  divider?: string;
  contour?: PathMarqueeContour;
  pace?: number;
  travel?: "forward" | "reverse";
  band?: boolean;
  pauseWhenHovered?: boolean;
  className?: string;
};

const CONTOURS: Record<PathMarqueeContour, string> = {
  swell: "M -60 176 C 124 68 300 54 494 139 S 886 250 1260 82",
  halo: "M 70 144 C 70 43 300 15 600 15 C 900 15 1130 43 1130 144 C 1130 245 900 273 600 273 C 300 273 70 245 70 144 Z",
  orbit: "M 75 190 C 228 18 916 -13 1125 114 C 1010 281 306 315 75 190 Z",
  straight: "M -60 144 C 280 144 920 144 1260 144",
};

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

export function PathMarquee({
  phrase,
  divider = "✦",
  contour = "swell",
  pace = 1,
  travel = "forward",
  band = true,
  pauseWhenHovered = true,
  className,
}: PathMarqueeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const measureTextRef = useRef<SVGTextElement>(null);
  const firstCopiesRef = useRef<Array<SVGTextPathElement | null>>([]);
  const secondCopiesRef = useRef<Array<SVGTextPathElement | null>>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const progressRef = useRef(0);
  const prefersReducedMotionRef = useRef(false);
  const intersectingRef = useRef(true);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [geometry, setGeometry] = useState({
    pathLength: 1,
    repeatCount: 1,
  });
  const pathId = `path-marquee-${useId().replaceAll(":", "")}`;
  const cleanPhrase = phrase.trim();
  const cleanDivider = divider.trim() || "·";
  const phraseUnit = `${cleanPhrase} ${cleanDivider} `;
  const repeatedPhrase = phraseUnit.repeat(geometry.repeatCount);
  const contourLength = geometry.pathLength;
  const safePace = clamp(pace, 0, 3);
  const duration = safePace === 0 ? 0 : (22 / safePace) * 1000;
  const isAnimated =
    safePace > 0 && geometry.pathLength > 1 && cleanPhrase.length > 0;
  const canPause = pauseWhenHovered && isAnimated && !prefersReducedMotion;

  const renderOffsets = useCallback(
    (progress: number) => {
      const firstOffset = travel === "forward" ? -progress * 100 : progress * 100;
      const secondOffset =
        travel === "forward" ? 100 - progress * 100 : -100 + progress * 100;

      firstCopiesRef.current.forEach((copy) => {
        copy?.setAttribute("startOffset", `${firstOffset}%`);
      });
      secondCopiesRef.current.forEach((copy) => {
        copy?.setAttribute("startOffset", `${secondOffset}%`);
      });
    },
    [travel],
  );

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;

    stopAnimation();
    progressRef.current = 0;
    renderOffsets(0);

    function measureGeometry() {
      const path = pathRef.current;
      const measureText = measureTextRef.current;

      if (cancelled || !path || !measureText || !cleanPhrase) {
        return;
      }

      const pathLength = path.getTotalLength();
      const phraseWidth = measureText.getComputedTextLength();
      const repeatCount = Math.max(
        1,
        Math.ceil(pathLength / Math.max(phraseWidth, 1)),
      );

      setGeometry((current) => {
        if (
          Math.abs(current.pathLength - pathLength) < 0.01 &&
          current.repeatCount === repeatCount
        ) {
          return current;
        }

        return { pathLength, repeatCount };
      });
    }

    measureGeometry();
    void document.fonts.ready.then(measureGeometry);

    return () => {
      cancelled = true;
    };
  }, [cleanPhrase, contour, phraseUnit, renderOffsets, stopAnimation]);

  const startAnimation = useCallback(() => {
    if (!isAnimated || animationFrameRef.current !== null) {
      return;
    }

    lastFrameTimeRef.current = performance.now();

    function step(timestamp: number) {
      const elapsed = Math.min(timestamp - lastFrameTimeRef.current, 64);

      lastFrameTimeRef.current = timestamp;
      progressRef.current = (progressRef.current + elapsed / duration) % 1;
      renderOffsets(progressRef.current);
      animationFrameRef.current = requestAnimationFrame(step);
    }

    animationFrameRef.current = requestAnimationFrame(step);
  }, [duration, isAnimated, renderOffsets]);

  const syncAnimationState = useCallback(() => {
    const isInteractionPaused =
      pauseWhenHovered && (hoveredRef.current || focusedRef.current);
    const shouldPause =
      !isAnimated ||
      document.hidden ||
      !intersectingRef.current ||
      prefersReducedMotionRef.current ||
      isInteractionPaused;

    if (shouldPause) {
      stopAnimation();
      return;
    }

    startAnimation();
  }, [isAnimated, pauseWhenHovered, startAnimation, stopAnimation]);

  useLayoutEffect(() => {
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const root = rootRef.current;

    function handleMotionPreference() {
      prefersReducedMotionRef.current = motionQuery.matches;
      setPrefersReducedMotion(motionQuery.matches);

      if (motionQuery.matches) {
        progressRef.current = 0;
        renderOffsets(0);
      }

      syncAnimationState();
    }

    renderOffsets(progressRef.current);
    handleMotionPreference();
    motionQuery.addEventListener("change", handleMotionPreference);
    document.addEventListener("visibilitychange", syncAnimationState);

    const intersectionObserver = root
      ? new IntersectionObserver(([entry]) => {
          intersectingRef.current = entry?.isIntersecting ?? true;
          syncAnimationState();
        })
      : null;

    if (root && intersectionObserver) {
      intersectionObserver.observe(root);
    }

    return () => {
      stopAnimation();
      intersectionObserver?.disconnect();
      motionQuery.removeEventListener("change", handleMotionPreference);
      document.removeEventListener("visibilitychange", syncAnimationState);
    };
  }, [
    cleanPhrase,
    contour,
    geometry.pathLength,
    geometry.repeatCount,
    phraseUnit,
    renderOffsets,
    stopAnimation,
    syncAnimationState,
  ]);

  useLayoutEffect(() => {
    const root = rootRef.current;

    if (!canPause) {
      hoveredRef.current = false;
      focusedRef.current = false;
    } else {
      hoveredRef.current = root?.matches(":hover") ?? false;
      focusedRef.current = document.activeElement === root;
    }

    syncAnimationState();
  }, [canPause, syncAnimationState]);

  function pauseForPointer() {
    hoveredRef.current = true;
    syncAnimationState();
  }

  function resumeFromPointer() {
    hoveredRef.current = false;
    syncAnimationState();
  }

  function pauseForFocus() {
    focusedRef.current = true;
    syncAnimationState();
  }

  function resumeFromFocus() {
    focusedRef.current = false;
    syncAnimationState();
  }

  if (!cleanPhrase) {
    return null;
  }

  const instructionId = `${pathId}-instruction`;

  return (
    <div
      ref={rootRef}
      className={`${styles.root}${className ? ` ${className}` : ""}`}
      role={canPause ? "group" : undefined}
      aria-label={canPause ? cleanPhrase : undefined}
      aria-describedby={canPause ? instructionId : undefined}
      tabIndex={canPause ? 0 : undefined}
      onPointerEnter={canPause ? pauseForPointer : undefined}
      onPointerLeave={canPause ? resumeFromPointer : undefined}
      onFocus={canPause ? pauseForFocus : undefined}
      onBlur={canPause ? resumeFromFocus : undefined}
    >
      <span className={styles.semanticText}>{cleanPhrase}</span>
      {canPause ? (
        <span id={instructionId} className={styles.semanticText}>
          Moving text. Hover or focus pauses the animation.
        </span>
      ) : null}
      <svg
        className={styles.canvas}
        viewBox="0 0 1200 288"
        role="presentation"
        aria-hidden="true"
      >
        <defs>
          <path ref={pathRef} id={pathId} d={CONTOURS[contour]} />
        </defs>
        <text ref={measureTextRef} className={styles.measureText} x="0" y="-100">
          {phraseUnit}
        </text>

        {band ? (
          <g className={styles.bandLayers}>
            <use className={styles.bandShadow} href={`#${pathId}`} />
            <use className={styles.bandSurface} href={`#${pathId}`} />
            <use className={styles.bandKeyline} href={`#${pathId}`} />
            <use className={styles.registrationMarks} href={`#${pathId}`} />
          </g>
        ) : null}

        <g className={styles.typeLayers}>
          <text className={styles.typeShadow} textLength={contourLength} lengthAdjust="spacing">
            <textPath
              ref={(node) => {
                firstCopiesRef.current[0] = node;
              }}
              href={`#${pathId}`}
              startOffset="0%"
            >
              {repeatedPhrase}
            </textPath>
          </text>
          {isAnimated ? (
            <text
              className={`${styles.typeShadow} ${styles.secondaryCopy}`}
              textLength={contourLength}
              lengthAdjust="spacing"
            >
              <textPath
                ref={(node) => {
                  secondCopiesRef.current[0] = node;
                }}
                href={`#${pathId}`}
                startOffset={travel === "forward" ? "100%" : "-100%"}
              >
                {repeatedPhrase}
              </textPath>
            </text>
          ) : null}
          <text className={styles.typeFace} textLength={contourLength} lengthAdjust="spacing">
            <textPath
              ref={(node) => {
                firstCopiesRef.current[1] = node;
              }}
              href={`#${pathId}`}
              startOffset="0%"
            >
              {repeatedPhrase}
            </textPath>
          </text>
          {isAnimated ? (
            <text
              className={`${styles.typeFace} ${styles.secondaryCopy}`}
              textLength={contourLength}
              lengthAdjust="spacing"
            >
              <textPath
                ref={(node) => {
                  secondCopiesRef.current[1] = node;
                }}
                href={`#${pathId}`}
                startOffset={travel === "forward" ? "100%" : "-100%"}
              >
                {repeatedPhrase}
              </textPath>
            </text>
          ) : null}
        </g>
      </svg>
    </div>
  );
}
