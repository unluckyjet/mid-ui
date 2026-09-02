"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent,
} from "react";
import styles from "./relief-type.module.css";

export type ReliefTypeProps = {
  children: string;
  layers?: number;
  step?: number;
  tiltRange?: number;
  response?: number;
  idleOrbit?: number;
  shadow?: boolean;
  className?: string;
};

const THEME_TRANSITION_START_EVENT = "mid-ui:theme-transition-start";
const THEME_TRANSITION_END_EVENT = "mid-ui:theme-transition-end";

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

function cx(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export function ReliefType({
  children,
  layers = 9,
  step = 2.2,
  tiltRange = 8,
  response = 150,
  idleOrbit = 4,
  shadow = true,
  className,
}: ReliefTypeProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const motionRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<number | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerInsideRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const lastFrameRef = useRef(0);
  const idleReadyRef = useRef(false);
  const intersectingRef = useRef(true);
  const themeTransitionRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const requestFrameRef = useRef<() => void>(() => undefined);

  const safeLayers = Math.round(clamp(layers, 2, 14));
  const safeStep = clamp(step, 0.5, 5);
  const safeTilt = clamp(tiltRange, 0, 18);
  const safeResponse = clamp(response, 45, 500);
  const safeOrbit = clamp(idleOrbit, 0, 12);
  const cleanText = children.trim();
  const layerData = useMemo(
    () =>
      Array.from({ length: safeLayers }, (_, index) => {
        const progress = (index + 1) / safeLayers;
        const offset = Math.pow(progress, 1.42) * safeLayers * safeStep;
        return { index, offset };
      }),
    [safeLayers, safeStep],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    const motion = motionRef.current;
    if (!root || !motion || cleanText.length === 0) return;

    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const motionNode = motion;
    let observer: IntersectionObserver | null = null;

    const stopFrame = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    const clearIdleTimer = () => {
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const canMove = () =>
      !reducedMotionRef.current &&
      !document.hidden &&
      intersectingRef.current &&
      !themeTransitionRef.current;

    const render = (x: number, y: number) => {
      motionNode.style.setProperty("--relief-x", x.toFixed(3));
      motionNode.style.setProperty("--relief-y", y.toFixed(3));
      motionNode.style.setProperty("--relief-rotate-x", `${(-y * safeTilt).toFixed(3)}deg`);
      motionNode.style.setProperty("--relief-rotate-y", `${(x * safeTilt).toFixed(3)}deg`);
      motionNode.dataset.motionX = x.toFixed(3);
      motionNode.dataset.motionY = y.toFixed(3);
    };

    const targetAt = (timestamp: number) => {
      if (pointerInsideRef.current) return pointerRef.current;
      if (!idleReadyRef.current || safeOrbit === 0) return { x: 0, y: 0 };
      return {
        x: Math.sin(timestamp / 2600) * (safeOrbit / 12),
        y: Math.cos(timestamp / 3100) * (safeOrbit / 14),
      };
    };

    const startFrame = () => {
      if (frameRef.current !== null || !canMove()) return;
      lastFrameRef.current = performance.now();

      const stepFrame = (timestamp: number) => {
        frameRef.current = null;
        if (!canMove()) return;
        root.dataset.frameCount = String(Number(root.dataset.frameCount ?? "0") + 1);

        const elapsed = Math.min(timestamp - lastFrameRef.current, 64);
        const smoothing = 1 - Math.exp(-elapsed / safeResponse);
        const target = targetAt(timestamp);
        const current = currentRef.current;
        current.x += (target.x - current.x) * smoothing;
        current.y += (target.y - current.y) * smoothing;
        lastFrameRef.current = timestamp;

        const distance = Math.hypot(target.x - current.x, target.y - current.y);
        if (!pointerInsideRef.current && !idleReadyRef.current && distance < 0.001) {
          current.x = 0;
          current.y = 0;
        }
        render(current.x, current.y);

        if (
          (idleReadyRef.current && safeOrbit > 0) ||
          distance >= 0.001
        ) {
          frameRef.current = requestAnimationFrame(stepFrame);
        }
      };

      frameRef.current = requestAnimationFrame(stepFrame);
    };

    const armIdleOrbit = () => {
      clearIdleTimer();
      idleReadyRef.current = false;
      if (safeOrbit === 0) {
        startFrame();
        return;
      }
      idleTimerRef.current = setTimeout(() => {
        idleTimerRef.current = null;
        idleReadyRef.current = true;
        startFrame();
      }, 900);
    };

    const syncMotion = () => {
      reducedMotionRef.current = motionQuery.matches;
      root.dataset.reducedMotion = String(motionQuery.matches);
      root.dataset.motion = motionQuery.matches
        ? "reduced"
        : canMove()
          ? "active"
          : "paused";
      if (reducedMotionRef.current) {
        stopFrame();
        clearIdleTimer();
        currentRef.current = { x: 0, y: 0 };
        render(0, 0);
        return;
      }
      if (!canMove()) {
        stopFrame();
        clearIdleTimer();
        return;
      }
      if (!pointerInsideRef.current && !idleReadyRef.current) armIdleOrbit();
      startFrame();
    };

    const handleVisibility = () => syncMotion();
    const handleThemeStart = () => {
      themeTransitionRef.current = true;
      syncMotion();
    };
    const handleThemeEnd = () => {
      themeTransitionRef.current = false;
      syncMotion();
    };

    requestFrameRef.current = startFrame;
    root.dataset.layerCount = String(safeLayers);
    root.dataset.reducedMotion = String(motionQuery.matches);
    render(0, 0);
    motionQuery.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener(THEME_TRANSITION_START_EVENT, handleThemeStart);
    window.addEventListener(THEME_TRANSITION_END_EVENT, handleThemeEnd);

    observer = new IntersectionObserver(
      ([entry]) => {
        intersectingRef.current = Boolean(entry?.isIntersecting);
        syncMotion();
      },
      { threshold: 0.08 },
    );
    observer.observe(root);
    syncMotion();

    return () => {
      stopFrame();
      clearIdleTimer();
      observer?.disconnect();
      motionQuery.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener(THEME_TRANSITION_START_EVENT, handleThemeStart);
      window.removeEventListener(THEME_TRANSITION_END_EVENT, handleThemeEnd);
      requestFrameRef.current = () => undefined;
    };
  }, [cleanText, safeLayers, safeOrbit, safeResponse, safeTilt]);

  const handlePointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (!cleanText) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerInsideRef.current = true;
    idleReadyRef.current = false;
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    pointerRef.current = {
      x: clamp((event.clientX - rect.left) / Math.max(rect.width, 1) * 2 - 1, -1, 1),
      y: clamp((event.clientY - rect.top) / Math.max(rect.height, 1) * 2 - 1, -1, 1),
    };
    requestFrameRef.current();
  };

  const handlePointerLeave = () => {
    if (!cleanText) return;
    pointerInsideRef.current = false;
    idleReadyRef.current = false;
    if (idleTimerRef.current !== null) clearTimeout(idleTimerRef.current);
    if (safeOrbit === 0) {
      idleTimerRef.current = null;
      requestFrameRef.current();
      return;
    }
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      idleReadyRef.current = true;
      requestFrameRef.current();
    }, 900);
    requestFrameRef.current();
  };

  return (
    <span
      ref={rootRef}
      className={cx(styles.root, shadow && styles.withShadow, className)}
      data-mid-ui="relief-type"
      data-layer-count={safeLayers}
      data-frame-count="0"
      data-motion="active"
      data-reduced-motion="false"
      style={{
        "--relief-terminal-x": `${(safeLayers * safeStep).toFixed(2)}px`,
        "--relief-terminal-y": `${(safeLayers * safeStep * 0.72).toFixed(2)}px`,
      } as CSSProperties}
      onPointerMove={cleanText ? handlePointerMove : undefined}
      onPointerLeave={cleanText ? handlePointerLeave : undefined}
      onPointerCancel={cleanText ? handlePointerLeave : undefined}
    >
      {cleanText ? <span className={styles.semantic}>{children}</span> : null}
      {cleanText ? (
        <span ref={motionRef} className={styles.motion} aria-hidden="true" data-testid="relief-motion">
          <span className={styles.stack}>
            {layerData.map(({ index, offset }) => (
              <span
                key={index}
                className={cx(styles.layer, index === safeLayers - 1 && styles.terminal)}
                data-layer={index}
                data-terminal={index === safeLayers - 1 ? "true" : "false"}
                style={{
                  "--layer-x": `${offset.toFixed(3)}px`,
                  "--layer-y": `${(offset * 0.72).toFixed(3)}px`,
                  "--layer-tone": index % 3,
                } as CSSProperties}
              >
                {children}
              </span>
            ))}
            <span className={styles.face} data-testid="relief-face">{children}</span>
          </span>
        </span>
      ) : null}
    </span>
  );
}
