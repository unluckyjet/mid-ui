"use client";

import { useEffect, useRef } from "react";
import styles from "./constellation-type.module.css";

export type ConstellationTypeProps = Readonly<{
  children: string;
  className?: string;
  dispersion?: number;
  gatherTime?: number;
  pointSize?: number;
  pointerForce?: number;
  pointerRange?: number;
  restMotion?: number;
  spacing?: number;
}>;

type PointField = {
  anchor: Uint8Array;
  color: Uint8Array;
  count: number;
  phase: Float32Array;
  size: Float32Array;
  targetX: Float32Array;
  targetY: Float32Array;
  velocityX: Float32Array;
  velocityY: Float32Array;
  x: Float32Array;
  y: Float32Array;
};

const ACTIVE_FRAME_INTERVAL = 1000 / 30;
const IDLE_FRAME_INTERVAL = 1000 / 12;
const MAX_POINTS = 720;
const THEME_CHANGE_EVENT = "mid-ui:theme-change";
const THEME_TRANSITION_START_EVENT = "mid-ui:theme-transition-start";
const THEME_TRANSITION_END_EVENT = "mid-ui:theme-transition-end";
const LIGHT_PALETTE = ["#303640", "#656ca6", "#55745f"] as const;
const DARK_PALETTE = ["#dce1ec", "#aab7ff", "#83d5b3"] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function randomFrom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createPointField(
  candidates: readonly number[],
  width: number,
  height: number,
  dispersion: number,
  pointSize: number,
  seed: number,
) {
  const candidateCount = candidates.length / 2;
  const areaBudget = Math.round(clamp((width * height) / 660, 96, MAX_POINTS));
  const count = Math.min(candidateCount, areaBudget, MAX_POINTS);
  const field: PointField = {
    anchor: new Uint8Array(count),
    color: new Uint8Array(count),
    count,
    phase: new Float32Array(count),
    size: new Float32Array(count),
    targetX: new Float32Array(count),
    targetY: new Float32Array(count),
    velocityX: new Float32Array(count),
    velocityY: new Float32Array(count),
    x: new Float32Array(count),
    y: new Float32Array(count),
  };
  const random = randomFrom(seed || 1);
  const bucketSize = candidateCount / Math.max(count, 1);
  const spread = Math.max(width, height) * dispersion;

  for (let index = 0; index < count; index += 1) {
    const candidateIndex = Math.min(
      candidateCount - 1,
      Math.floor((index + random()) * bucketSize),
    );
    const targetX = candidates[candidateIndex * 2] ?? width / 2;
    const targetY = candidates[candidateIndex * 2 + 1] ?? height / 2;
    const angle = random() * Math.PI * 2;
    const distance = spread * (0.18 + random() * 0.82);
    const anchor = random() > 0.88;

    field.targetX[index] = targetX;
    field.targetY[index] = targetY;
    field.x[index] = targetX + Math.cos(angle) * distance;
    field.y[index] = targetY + Math.sin(angle) * distance;
    field.phase[index] = random() * Math.PI * 2;
    field.anchor[index] = anchor ? 1 : 0;
    field.color[index] = anchor ? 1 + (index % 2) : index % 7 === 0 ? 2 : 0;
    field.size[index] = pointSize * (anchor ? 1.62 : 0.72 + random() * 0.42);
  }

  return field;
}

function createConnections(field: PointField, spacing: number) {
  const pairs: number[] = [];
  const maximumDistanceSquared = (spacing * 2.45) ** 2;
  const maximumConnections = Math.min(220, Math.floor(field.count * 0.46));

  for (let index = 0; index < field.count && pairs.length / 2 < maximumConnections; index += 1) {
    if (!field.anchor[index] && index % 5 !== 0) continue;

    let nearestIndex = -1;
    let nearestDistanceSquared = maximumDistanceSquared;

    for (let candidate = index + 1; candidate < field.count; candidate += 1) {
      const deltaX = field.targetX[candidate] - field.targetX[index];
      const deltaY = field.targetY[candidate] - field.targetY[index];
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;

      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared;
        nearestIndex = candidate;
      }
    }

    if (nearestIndex >= 0) {
      pairs.push(index, nearestIndex);
    }
  }

  return Int32Array.from(pairs);
}

export function ConstellationType({
  children,
  className,
  dispersion = 0.92,
  gatherTime = 1400,
  pointSize = 1.5,
  pointerForce = 980,
  pointerRange = 92,
  restMotion = 1.25,
  spacing = 7,
}: ConstellationTypeProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });

    if (!root || !canvas || !context) return;

    const activeRoot = root;
    const activeCanvas = canvas;
    const activeContext = context;
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const safeDispersion = clamp(finiteOr(dispersion, 0.92), 0, 1.8);
    const safeGatherTime = clamp(finiteOr(gatherTime, 1400), 220, 5000);
    const safePointSize = clamp(finiteOr(pointSize, 1.5), 0.55, 4);
    const safePointerForce = clamp(finiteOr(pointerForce, 980), 0, 2400);
    const safePointerRange = clamp(finiteOr(pointerRange, 92), 24, 240);
    const safeRestMotion = clamp(finiteOr(restMotion, 1.25), 0, 5);
    const safeSpacing = Math.round(clamp(finiteOr(spacing, 7), 4, 18));
    const seed = hashString(`${children}|${safeSpacing}|${safePointSize}`);
    let animationFrame = 0;
    let connections = new Int32Array();
    let darkMode = document.documentElement.dataset.theme === "dark";
    let disposed = false;
    let field: PointField | null = null;
    let fontMetricsReady = document.fonts.status === "loaded";
    let gatherStartedAt = 0;
    let height = 1;
    let intersecting = true;
    let lastDrawAt = 0;
    let lastTheme = document.documentElement.dataset.theme ?? "";
    let lastUpdateAt = 0;
    let pointerInside = false;
    let pointerX = 0;
    let pointerY = 0;
    let settled = false;
    let transitionPaused = false;
    let width = 1;

    function canAnimate() {
      return !motionQuery.matches
        && !transitionPaused
        && intersecting
        && document.visibilityState === "visible";
    }

    function draw(useTargets = false) {
      if (!field) return;

      const palette = darkMode ? DARK_PALETTE : LIGHT_PALETTE;
      const lineColor = darkMode ? "rgba(170, 183, 255, 0.16)" : "rgba(82, 91, 133, 0.13)";
      const maximumLineDistanceSquared = (safeSpacing * 4.2) ** 2;

      activeContext.clearRect(0, 0, width, height);
      activeContext.lineCap = "round";
      activeContext.lineWidth = 0.72;
      activeContext.strokeStyle = lineColor;
      activeContext.beginPath();

      for (let pairIndex = 0; pairIndex < connections.length; pairIndex += 2) {
        const fromIndex = connections[pairIndex];
        const toIndex = connections[pairIndex + 1];
        const fromX = useTargets ? field.targetX[fromIndex] : field.x[fromIndex];
        const fromY = useTargets ? field.targetY[fromIndex] : field.y[fromIndex];
        const toX = useTargets ? field.targetX[toIndex] : field.x[toIndex];
        const toY = useTargets ? field.targetY[toIndex] : field.y[toIndex];
        const deltaX = toX - fromX;
        const deltaY = toY - fromY;

        if (deltaX * deltaX + deltaY * deltaY > maximumLineDistanceSquared) continue;
        activeContext.moveTo(fromX, fromY);
        activeContext.lineTo(toX, toY);
      }

      activeContext.stroke();

      for (let index = 0; index < field.count; index += 1) {
        const x = useTargets ? field.targetX[index] : field.x[index];
        const y = useTargets ? field.targetY[index] : field.y[index];
        const radius = field.size[index];

        activeContext.fillStyle = palette[field.color[index]];
        activeContext.globalAlpha = field.anchor[index]
          ? darkMode ? 0.96 : 0.88
          : darkMode ? 0.72 : 0.66;
        activeContext.shadowBlur = darkMode && field.anchor[index] ? 5 : 0;
        activeContext.shadowColor = darkMode ? palette[field.color[index]] : "transparent";
        activeContext.beginPath();
        activeContext.arc(x, y, radius, 0, Math.PI * 2);
        activeContext.fill();

        if (field.anchor[index]) {
          activeContext.globalAlpha = darkMode ? 0.35 : 0.23;
          activeContext.lineWidth = 0.65;
          activeContext.strokeStyle = palette[field.color[index]];
          activeContext.beginPath();
          activeContext.moveTo(x - radius * 2.2, y);
          activeContext.lineTo(x + radius * 2.2, y);
          activeContext.moveTo(x, y - radius * 2.2);
          activeContext.lineTo(x, y + radius * 2.2);
          activeContext.stroke();
        }
      }

      activeContext.globalAlpha = 1;
      activeContext.shadowBlur = 0;
      activeRoot.dataset.ready = "true";
    }

    function update(timestamp: number) {
      if (!field) return;

      const deltaTime = lastUpdateAt
        ? clamp((timestamp - lastUpdateAt) / 1000, 0.001, 0.05)
        : 1 / 30;
      const gatherSeconds = safeGatherTime / 1000;
      const spring = 18 / (gatherSeconds * gatherSeconds);
      const damping = Math.exp((-7 * deltaTime) / gatherSeconds);
      const pointerRangeSquared = safePointerRange * safePointerRange;
      const pointerActive = pointerInside && safePointerForce > 0;
      const idleTime = timestamp * 0.001;
      let maximumEnergy = 0;

      lastUpdateAt = timestamp;

      for (let index = 0; index < field.count; index += 1) {
        const idleX = safeRestMotion
          ? Math.sin(idleTime * 0.74 + field.phase[index]) * safeRestMotion
          : 0;
        const idleY = safeRestMotion
          ? Math.cos(idleTime * 0.58 + field.phase[index] * 1.13) * safeRestMotion
          : 0;
        let accelerationX = (field.targetX[index] + idleX - field.x[index]) * spring;
        let accelerationY = (field.targetY[index] + idleY - field.y[index]) * spring;

        if (pointerActive) {
          const pointerDeltaX = field.x[index] - pointerX;
          const pointerDeltaY = field.y[index] - pointerY;
          const distanceSquared = pointerDeltaX * pointerDeltaX + pointerDeltaY * pointerDeltaY;

          if (distanceSquared < pointerRangeSquared) {
            const distance = Math.sqrt(Math.max(distanceSquared, 0.01));
            const influence = 1 - distance / safePointerRange;
            const force = safePointerForce * influence * influence;
            accelerationX += (pointerDeltaX / distance) * force;
            accelerationY += (pointerDeltaY / distance) * force;
          }
        }

        field.velocityX[index] = (field.velocityX[index] + accelerationX * deltaTime) * damping;
        field.velocityY[index] = (field.velocityY[index] + accelerationY * deltaTime) * damping;
        field.x[index] += field.velocityX[index] * deltaTime;
        field.y[index] += field.velocityY[index] * deltaTime;

        const targetDeltaX = field.targetX[index] - field.x[index];
        const targetDeltaY = field.targetY[index] - field.y[index];
        const energy = Math.abs(field.velocityX[index])
          + Math.abs(field.velocityY[index])
          + Math.abs(targetDeltaX) * 0.25
          + Math.abs(targetDeltaY) * 0.25;
        maximumEnergy = Math.max(maximumEnergy, energy);
      }

      settled = timestamp - gatherStartedAt > safeGatherTime
        && maximumEnergy < 2.1
        && !pointerActive;
    }

    function scheduleFrame() {
      if (animationFrame || !canAnimate() || !field || field.count === 0) return;
      if (settled && safeRestMotion === 0 && !(pointerInside && safePointerForce > 0)) return;
      animationFrame = requestAnimationFrame(renderFrame);
    }

    function renderFrame(timestamp: number) {
      animationFrame = 0;
      const frameInterval = settled ? IDLE_FRAME_INTERVAL : ACTIVE_FRAME_INTERVAL;

      if (timestamp - lastDrawAt >= frameInterval) {
        update(timestamp);
        draw();
        lastDrawAt = timestamp;
      }

      scheduleFrame();
    }

    function rebuild(force = false) {
      if (motionQuery.matches && !fontMetricsReady) return;

      const bounds = activeRoot.getBoundingClientRect();
      const nextWidth = Math.max(1, bounds.width);
      const nextHeight = Math.max(1, bounds.height);

      if (!force && Math.abs(nextWidth - width) < 0.5 && Math.abs(nextHeight - height) < 0.5) {
        return;
      }

      width = nextWidth;
      height = nextHeight;
      const pixelRatio = Math.min(devicePixelRatio || 1, 1.5);
      activeCanvas.width = Math.round(width * pixelRatio);
      activeCanvas.height = Math.round(height * pixelRatio);
      activeContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const sampleCanvas = document.createElement("canvas");
      const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });

      if (!sampleContext || !children.trim()) {
        field = createPointField([], width, height, 0, safePointSize, seed);
        connections = new Int32Array();
        activeRoot.dataset.pointCount = "0";
        draw(true);
        return;
      }

      sampleCanvas.width = Math.ceil(width);
      sampleCanvas.height = Math.ceil(height);
      sampleContext.clearRect(0, 0, width, height);
      const computedStyle = getComputedStyle(activeRoot);
      const fontFamily = computedStyle.fontFamily || "sans-serif";
      let fontSize = height * 0.62;
      sampleContext.font = `800 ${fontSize}px ${fontFamily}`;
      sampleContext.letterSpacing = `${fontSize * 0.055}px`;
      const measuredWidth = sampleContext.measureText(children).width;
      const maximumTextWidth = width * 0.88;

      if (measuredWidth > maximumTextWidth) {
        fontSize *= maximumTextWidth / measuredWidth;
      }

      sampleContext.font = `800 ${fontSize}px ${fontFamily}`;
      sampleContext.letterSpacing = `${fontSize * 0.055}px`;
      sampleContext.fillStyle = "#000";
      sampleContext.textAlign = "center";
      sampleContext.textBaseline = "middle";
      sampleContext.fillText(children, width / 2, height / 2 + fontSize * 0.03);

      const imageData = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
      const candidates: number[] = [];
      const offset = Math.floor(safeSpacing / 2);

      for (let y = offset; y < sampleCanvas.height; y += safeSpacing) {
        for (let x = offset; x < sampleCanvas.width; x += safeSpacing) {
          if (imageData.data[(y * sampleCanvas.width + x) * 4 + 3] > 112) {
            candidates.push(x, y);
          }
        }
      }

      field = createPointField(
        candidates,
        width,
        height,
        motionQuery.matches ? 0 : safeDispersion,
        safePointSize,
        seed,
      );
      connections = createConnections(field, safeSpacing);
      activeRoot.dataset.pointCount = String(field.count);
      gatherStartedAt = performance.now();
      lastDrawAt = 0;
      lastUpdateAt = 0;
      settled = motionQuery.matches || safeDispersion === 0;
      draw(motionQuery.matches);

      if (!motionQuery.matches) scheduleFrame();
    }

    function syncTheme() {
      const nextTheme = document.documentElement.dataset.theme ?? "";
      if (nextTheme === lastTheme) return;
      lastTheme = nextTheme;
      darkMode = nextTheme === "dark";
      draw(motionQuery.matches);
    }

    function syncMotionPreference() {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;

      if (motionQuery.matches) {
        settled = true;
        activeRoot.dataset.motion = "reduced";
        draw(true);
      } else {
        activeRoot.dataset.motion = "active";
        rebuild(true);
      }
    }

    function syncVisibility() {
      if (document.visibilityState === "visible") {
        activeRoot.dataset.motion = motionQuery.matches ? "reduced" : "active";
        lastUpdateAt = 0;
        scheduleFrame();
      } else {
        activeRoot.dataset.motion = "paused";
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    }

    function pauseForThemeTransition() {
      transitionPaused = true;
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }

    function resumeAfterThemeTransition() {
      transitionPaused = false;
      draw(motionQuery.matches);
      scheduleFrame();
    }

    function updatePointer(event: PointerEvent) {
      const bounds = activeRoot.getBoundingClientRect();
      pointerX = event.clientX - bounds.left;
      pointerY = event.clientY - bounds.top;
      pointerInside = true;
      settled = false;
      scheduleFrame();
    }

    function releasePointer() {
      pointerInside = false;
      settled = false;
      scheduleFrame();
    }

    const resizeObserver = new ResizeObserver(() => rebuild());
    const themeObserver = new MutationObserver(syncTheme);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? true;
      if (intersecting) {
        activeRoot.dataset.motion = motionQuery.matches ? "reduced" : "active";
        lastUpdateAt = 0;
        scheduleFrame();
      } else {
        activeRoot.dataset.motion = "paused";
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    });

    activeRoot.dataset.motion = motionQuery.matches ? "reduced" : "active";
    resizeObserver.observe(activeRoot);
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });
    intersectionObserver.observe(activeRoot);
    motionQuery.addEventListener("change", syncMotionPreference);
    document.addEventListener("visibilitychange", syncVisibility);
    activeRoot.addEventListener("pointerenter", updatePointer, { passive: true });
    activeRoot.addEventListener("pointermove", updatePointer, { passive: true });
    activeRoot.addEventListener("pointerleave", releasePointer, { passive: true });
    activeRoot.addEventListener("pointercancel", releasePointer, { passive: true });
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    window.addEventListener(THEME_TRANSITION_START_EVENT, pauseForThemeTransition);
    window.addEventListener(THEME_TRANSITION_END_EVENT, resumeAfterThemeTransition);

    if (fontMetricsReady || !motionQuery.matches) rebuild(true);
    if (!fontMetricsReady) {
      void document.fonts.ready.then(() => {
        if (disposed) return;
        fontMetricsReady = true;
        rebuild(true);
      });
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      intersectionObserver.disconnect();
      motionQuery.removeEventListener("change", syncMotionPreference);
      document.removeEventListener("visibilitychange", syncVisibility);
      activeRoot.removeEventListener("pointerenter", updatePointer);
      activeRoot.removeEventListener("pointermove", updatePointer);
      activeRoot.removeEventListener("pointerleave", releasePointer);
      activeRoot.removeEventListener("pointercancel", releasePointer);
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
      window.removeEventListener(THEME_TRANSITION_START_EVENT, pauseForThemeTransition);
      window.removeEventListener(THEME_TRANSITION_END_EVENT, resumeAfterThemeTransition);
    };
  }, [children, dispersion, gatherTime, pointSize, pointerForce, pointerRange,
    restMotion, spacing]);

  const classNames = [styles.root, className].filter(Boolean).join(" ");

  return (
    <span
      ref={rootRef}
      className={classNames}
      data-mid-ui="constellation-type"
      data-motion="loading"
    >
      <span className={styles.fallback} aria-hidden="true">
        {children}
      </span>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <span className={styles.semantic}>{children}</span>
    </span>
  );
}
