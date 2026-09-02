"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import styles from "./scene-type.module.css";

type SceneTypeElement = "h1" | "h2" | "h3" | "p";
type SceneTypeSourceKind = "image" | "video";
type SceneTypeEntrance = "rise" | "settle" | "none";

export type SceneTypeProps = {
  children: string;
  as?: SceneTypeElement;
  source: string;
  sourceKind?: SceneTypeSourceKind;
  entrance?: SceneTypeEntrance;
  pointerDepth?: number;
  idleRange?: number;
  className?: string;
};

const FALLBACK_POSTER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='500' viewBox='0 0 1200 500'%3E%3Cdefs%3E%3ClinearGradient id='g' x2='1' y2='1'%3E%3Cstop stop-color='%23245872'/%3E%3Cstop offset='.52' stop-color='%23d96f4c'/%3E%3Cstop offset='1' stop-color='%23e8c26b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1200' height='500' fill='url(%23g)'/%3E%3C/svg%3E";

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

export function SceneType({
  children,
  as: Element = "h2",
  source,
  sourceKind = "image",
  entrance = "settle",
  pointerDepth = 12,
  idleRange = 3,
  className,
}: SceneTypeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mediaGroupRef = useRef<SVGGElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const requestMotionFrameRef = useRef<() => void>(() => undefined);
  const lastFrameRef = useRef(0);
  const enteredRef = useRef(entrance === "none");
  const intersectingRef = useRef(true);
  const pointerInsideRef = useRef(false);
  const pointerPositionRef = useRef({ x: 0, y: 0 });
  const currentOffsetRef = useRef({ x: 0, y: 0 });
  const reducedMotionRef = useRef(false);
  const [entered, setEntered] = useState(entrance === "none");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const clipId = `scene-type-${useId().replaceAll(":", "")}`;
  const cleanText = children.trim();
  const safePointerDepth = clamp(pointerDepth, 0, 30);
  const safeIdleRange = clamp(idleRange, 0, 18);
  const glyphSize = clamp(1120 / Math.max(cleanText.length * 0.56, 4.5), 88, 246);

  useLayoutEffect(() => {
    const root = rootRef.current;

    if (!root || !cleanText) {
      return;
    }

    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    let entranceObserver: IntersectionObserver | null = null;

    function reveal() {
      if (!root || enteredRef.current) {
        return;
      }

      enteredRef.current = true;
      setEntered(true);
      root.dataset.entered = "true";
      entranceObserver?.disconnect();
      entranceObserver = null;
    }

    function syncPreference() {
      reducedMotionRef.current = motionQuery.matches;

      if (motionQuery.matches || entrance === "none") {
        reveal();
      }
    }

    root.dataset.entered = String(enteredRef.current);
    syncPreference();

    if (!enteredRef.current) {
      entranceObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            reveal();
          }
        },
        { threshold: 0.3 },
      );
      entranceObserver.observe(root);
    }

    motionQuery.addEventListener("change", syncPreference);

    return () => {
      entranceObserver?.disconnect();
      motionQuery.removeEventListener("change", syncPreference);
    };
  }, [cleanText, entrance]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const mediaGroup = mediaGroupRef.current;
    const video = videoRef.current;

    if (!root || !mediaGroup || !cleanText) {
      return;
    }

    const motionRoot = root;
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");

    function stopAnimation() {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    function renderOffset(x: number, y: number) {
      mediaGroup?.setAttribute(
        "transform",
        `translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(1.035)`,
      );
    }

    function readTarget(timestamp: number) {
      if (pointerInsideRef.current && safePointerDepth > 0) {
        return {
          x: pointerPositionRef.current.x * safePointerDepth * -2,
          y: pointerPositionRef.current.y * safePointerDepth * -2,
          continuous: false,
        };
      }

      return {
        x: Math.sin(timestamp / 2600) * safeIdleRange,
        y: Math.cos(timestamp / 3100) * safeIdleRange * 0.7,
        continuous: safeIdleRange > 0,
      };
    }

    function needsMotionFrame(timestamp: number) {
      const target = readTarget(timestamp);
      const current = currentOffsetRef.current;

      return (
        target.continuous ||
        Math.hypot(target.x - current.x, target.y - current.y) > 0.01
      );
    }

    function startAnimation() {
      if (
        animationFrameRef.current !== null ||
        reducedMotionRef.current ||
        document.hidden ||
        !intersectingRef.current ||
        !needsMotionFrame(performance.now())
      ) {
        return;
      }

      lastFrameRef.current = performance.now();

      function step(timestamp: number) {
        animationFrameRef.current = null;
        const elapsed = Math.min(timestamp - lastFrameRef.current, 64);
        const smoothing = 1 - Math.exp(-elapsed / 105);
        const target = readTarget(timestamp);
        const current = currentOffsetRef.current;

        current.x += (target.x - current.x) * smoothing;
        current.y += (target.y - current.y) * smoothing;

        if (
          !target.continuous &&
          Math.hypot(target.x - current.x, target.y - current.y) <= 0.01
        ) {
          current.x = target.x;
          current.y = target.y;
        }

        renderOffset(current.x, current.y);
        lastFrameRef.current = timestamp;

        if (target.continuous || needsMotionFrame(timestamp)) {
          animationFrameRef.current = requestAnimationFrame(step);
        }
      }

      animationFrameRef.current = requestAnimationFrame(step);
    }

    function syncVideoPlayback(shouldPause: boolean) {
      if (!video) {
        return;
      }

      if (shouldPause) {
        video.pause();
        return;
      }

      void video.play().catch(() => {
        // The poster remains visible if autoplay is unavailable or the source fails.
      });
    }

    function syncAnimation() {
      reducedMotionRef.current = motionQuery.matches;
      setPrefersReducedMotion(motionQuery.matches);
      motionRoot.dataset.reducedMotion = String(motionQuery.matches);
      const shouldPause =
        reducedMotionRef.current || document.hidden || !intersectingRef.current;

      syncVideoPlayback(shouldPause);

      if (shouldPause) {
        stopAnimation();

        if (reducedMotionRef.current) {
          currentOffsetRef.current = { x: 0, y: 0 };
          renderOffset(0, 0);
        }

        return;
      }

      startAnimation();
    }

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      intersectingRef.current = entry?.isIntersecting ?? true;
      syncAnimation();
    });

    intersectionObserver.observe(motionRoot);
    requestMotionFrameRef.current = startAnimation;
    motionQuery.addEventListener("change", syncAnimation);
    document.addEventListener("visibilitychange", syncAnimation);
    syncAnimation();

    return () => {
      stopAnimation();
      video?.pause();
      requestMotionFrameRef.current = () => undefined;
      intersectionObserver.disconnect();
      motionQuery.removeEventListener("change", syncAnimation);
      document.removeEventListener("visibilitychange", syncAnimation);
    };
  }, [cleanText, safeIdleRange, safePointerDepth, source, sourceKind]);

  if (!cleanText) {
    return null;
  }

  function trackPointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const normalizedX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const normalizedY = (event.clientY - bounds.top) / bounds.height - 0.5;

    pointerInsideRef.current = true;
    pointerPositionRef.current = { x: normalizedX, y: normalizedY };
    requestMotionFrameRef.current();
  }

  function releasePointer() {
    pointerInsideRef.current = false;
    pointerPositionRef.current = { x: 0, y: 0 };
    requestMotionFrameRef.current();
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.root}${className ? ` ${className}` : ""}`}
      data-entered={String(entered)}
      data-entrance={entrance}
      data-reduced-motion={String(prefersReducedMotion)}
      onPointerMove={trackPointer}
      onPointerLeave={releasePointer}
    >
      <Element className={styles.semanticText}>{cleanText}</Element>
      <svg
        className={styles.visual}
        viewBox="0 0 1200 360"
        role="presentation"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${clipId}-fallback`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#245872" />
            <stop offset="0.5" stopColor="#d96f4c" />
            <stop offset="1" stopColor="#e8c26b" />
          </linearGradient>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <text
              className={styles.clipText}
              x="600"
              y="238"
              textAnchor="middle"
              fontSize={glyphSize}
              textLength="1060"
              lengthAdjust="spacingAndGlyphs"
            >
              {cleanText}
            </text>
          </clipPath>
        </defs>

        <g className={styles.mediaWindow} clipPath={`url(#${clipId})`}>
          <rect x="0" y="0" width="1200" height="360" fill={`url(#${clipId}-fallback)`} />
          <g ref={mediaGroupRef} data-testid="scene-type-media">
            {sourceKind === "video" ? (
              <>
                <image
                  className={styles.videoPoster}
                  href={FALLBACK_POSTER}
                  x="-80"
                  y="-60"
                  width="1360"
                  height="480"
                  preserveAspectRatio="xMidYMid slice"
                />
                <foreignObject x="-80" y="-60" width="1360" height="480">
                  <video
                    ref={videoRef}
                    className={styles.video}
                    src={source}
                    poster={FALLBACK_POSTER}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    tabIndex={-1}
                  />
                </foreignObject>
              </>
            ) : (
              <image
                href={source}
                x="-80"
                y="-60"
                width="1360"
                height="480"
                preserveAspectRatio="xMidYMid slice"
              />
            )}
          </g>
          <rect className={styles.mediaWash} x="0" y="0" width="1200" height="360" />
        </g>

        <text
          className={styles.innerKeyline}
          x="600"
          y="238"
          textAnchor="middle"
          fontSize={glyphSize}
          textLength="1060"
          lengthAdjust="spacingAndGlyphs"
        >
          {cleanText}
        </text>

        <g className={styles.cropMarks}>
          <path d="M48 96H104M76 68V124M1096 96H1152M1124 68V124" />
          <path d="M48 264H104M76 236V292M1096 264H1152M1124 236V292" />
        </g>
      </svg>
    </div>
  );
}
