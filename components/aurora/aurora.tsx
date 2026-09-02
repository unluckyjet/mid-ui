"use client";

import { useEffect, useRef } from "react";
import styles from "./aurora.module.css";

export type AuroraColorSet = readonly [string, string, string];

export type AuroraProps = Readonly<{
  className?: string;
  darkColors?: AuroraColorSet;
  intensity?: number;
  lightColors?: AuroraColorSet;
  motionRate?: number;
  verticalReach?: number;
}>;

type Fold = Readonly<{
  alpha: number;
  anchor: number;
  drift: number;
  phase: number;
  rate: number;
  shade?: boolean;
  tilt: number;
  width: number;
}>;

const DEFAULT_LIGHT_COLORS: AuroraColorSet = [
  "#8ce8bd",
  "#a7d5df",
  "#aa9af4",
];
const DEFAULT_DARK_COLORS: AuroraColorSet = [
  "#24c77e",
  "#6a9fb1",
  "#6846de",
];
const FOLDS: readonly Fold[] = [
  {
    alpha: 0.18,
    anchor: 0.12,
    drift: 0.055,
    phase: 0.4,
    rate: 0.11,
    tilt: -0.1,
    width: 0.13,
  },
  {
    alpha: 0.2,
    anchor: 0.31,
    drift: 0.08,
    phase: 2.2,
    rate: -0.08,
    shade: true,
    tilt: 0.16,
    width: 0.18,
  },
  {
    alpha: 0.16,
    anchor: 0.49,
    drift: 0.07,
    phase: 3.6,
    rate: 0.09,
    tilt: -0.04,
    width: 0.16,
  },
  {
    alpha: 0.18,
    anchor: 0.7,
    drift: 0.06,
    phase: 5.1,
    rate: -0.1,
    shade: true,
    tilt: -0.14,
    width: 0.2,
  },
  {
    alpha: 0.14,
    anchor: 0.88,
    drift: 0.04,
    phase: 1.3,
    rate: 0.08,
    tilt: 0.12,
    width: 0.14,
  },
];

const SEGMENTS = 96;
const FRAME_INTERVAL = 1000 / 30;
const THEME_CHANGE_EVENT = "mid-ui:theme-change";
const THEME_TRANSITION_START_EVENT = "mid-ui:theme-transition-start";
const THEME_TRANSITION_END_EVENT = "mid-ui:theme-transition-end";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function validColor(candidate: string | undefined, fallback: string) {
  return typeof candidate === "string" && CSS.supports("color", candidate)
    ? candidate
    : fallback;
}

export function Aurora({
  className,
  darkColors = DEFAULT_DARK_COLORS,
  intensity = 0.82,
  lightColors = DEFAULT_LIGHT_COLORS,
  motionRate = 1,
  verticalReach = 0.59,
}: AuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lightColorOne = lightColors[0];
  const lightColorTwo = lightColors[1];
  const lightColorThree = lightColors[2];
  const darkColorOne = darkColors[0];
  const darkColorTwo = darkColors[1];
  const darkColorThree = darkColors[2];

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });

    if (!canvas || !context) {
      return;
    }

    const activeCanvas = canvas;
    const activeContext = context;
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const safeIntensity = clamp(finiteOr(intensity, 0.82), 0, 1.25);
    const safeMotionRate = clamp(finiteOr(motionRate, 1), 0, 3);
    const safeVerticalReach = clamp(
      finiteOr(verticalReach, 0.59),
      0.32,
      0.78,
    );
    const resolvedLightColors: AuroraColorSet = [
      validColor(lightColorOne, DEFAULT_LIGHT_COLORS[0]),
      validColor(lightColorTwo, DEFAULT_LIGHT_COLORS[1]),
      validColor(lightColorThree, DEFAULT_LIGHT_COLORS[2]),
    ];
    const resolvedDarkColors: AuroraColorSet = [
      validColor(darkColorOne, DEFAULT_DARK_COLORS[0]),
      validColor(darkColorTwo, DEFAULT_DARK_COLORS[1]),
      validColor(darkColorThree, DEFAULT_DARK_COLORS[2]),
    ];
    let animationFrame = 0;
    let darkMode = false;
    let lastFrame = 0;
    let lastTheme = "";
    let palette: AuroraColorSet = resolvedLightColors;
    let transitionPaused = false;
    let width = 1;
    let height = 1;

    function syncPalette() {
      lastTheme = document.documentElement.dataset.theme ?? "";
      darkMode = lastTheme === "dark";
      palette = darkMode ? resolvedDarkColors : resolvedLightColors;
    }

    function currentTime() {
      return motionQuery.matches ? 0 : lastFrame || performance.now();
    }

    function buildCurtain(time: number) {
      const path = new Path2D();
      const movingCenter = 0.48 + Math.sin(time * 0.09 + 0.8) * 0.16;

      path.moveTo(0, 0);
      path.lineTo(width, 0);

      for (let index = SEGMENTS; index >= 0; index -= 1) {
        const normalizedX = index / SEGMENTS;
        const x = normalizedX * width;
        const shallowParabola = 0.08 * (normalizedX - movingCenter) ** 2;
        const longWave =
          Math.sin(normalizedX * Math.PI * 2.16 + time * 0.17) * 0.055;
        const crossWave =
          Math.sin(
            normalizedX * Math.PI * 4.7 - time * 0.12 + 1.85,
          ) * 0.026;
        const fineWave =
          Math.cos(normalizedX * Math.PI * 8.4 + time * 0.075 + 0.4) *
          0.011;
        const y =
          height *
          (safeVerticalReach +
            shallowParabola +
            longWave +
            crossWave +
            fineWave);

        path.lineTo(x, y);
      }

      path.closePath();
      return path;
    }

    function drawEllipticalBloom(
      x: number,
      y: number,
      radiusX: number,
      radiusY: number,
      color: string,
      alpha: number,
    ) {
      activeContext.save();
      activeContext.translate(x, y);
      activeContext.scale(radiusX, radiusY);

      const gradient = activeContext.createRadialGradient(0, 0, 0, 0, 0, 1);

      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgb(0 0 0 / 0%)");
      activeContext.globalAlpha = alpha;
      activeContext.fillStyle = gradient;
      activeContext.fillRect(-1, -1, 2, 2);
      activeContext.restore();
    }

    function drawFold(time: number, fold: Fold) {
      const centerX =
        width *
        (fold.anchor + Math.sin(time * fold.rate + fold.phase) * fold.drift);
      const bandWidth = width * fold.width;

      activeContext.save();
      activeContext.translate(centerX, height * 0.2);
      activeContext.rotate(
        fold.tilt + Math.sin(time * 0.07 + fold.phase) * 0.045,
      );

      const gradient = activeContext.createLinearGradient(
        -bandWidth,
        0,
        bandWidth,
        0,
      );

      gradient.addColorStop(0, "rgb(255 255 255 / 0%)");
      gradient.addColorStop(
        0.5,
        fold.shade ? "rgb(3 8 14 / 78%)" : "rgb(239 250 255 / 68%)",
      );
      gradient.addColorStop(1, "rgb(255 255 255 / 0%)");
      activeContext.globalAlpha =
        safeIntensity * fold.alpha * (darkMode ? 1 : 0.62);
      activeContext.globalCompositeOperation = fold.shade
        ? "multiply"
        : darkMode
          ? "screen"
          : "soft-light";
      activeContext.fillStyle = gradient;
      activeContext.fillRect(
        -bandWidth,
        -height * 0.5,
        bandWidth * 2,
        height * 1.5,
      );
      activeContext.restore();
    }

    function draw(timestamp: number) {
      const time = timestamp * 0.001 * safeMotionRate;
      const curtain = buildCurtain(time);
      const gradient = activeContext.createLinearGradient(0, 0, width, 0);

      gradient.addColorStop(0, palette[0]);
      gradient.addColorStop(0.44, palette[1]);
      gradient.addColorStop(1, palette[2]);
      activeContext.clearRect(0, 0, width, height);
      activeContext.globalAlpha = safeIntensity * (darkMode ? 0.82 : 0.64);
      activeContext.globalCompositeOperation = "source-over";
      activeContext.fillStyle = gradient;
      activeContext.fill(curtain);

      activeContext.save();
      activeContext.clip(curtain);
      activeContext.globalCompositeOperation = darkMode
        ? "screen"
        : "soft-light";
      drawEllipticalBloom(
        width * (0.08 + Math.sin(time * 0.06) * 0.025),
        height * 0.05,
        width * 0.42,
        height * 0.72,
        palette[0],
        safeIntensity * 0.3,
      );
      drawEllipticalBloom(
        width * (0.93 + Math.sin(time * 0.05 + 2) * 0.02),
        height * 0.08,
        width * 0.48,
        height * 0.78,
        palette[2],
        safeIntensity * 0.34,
      );
      FOLDS.forEach((fold) => drawFold(time, fold));
      activeContext.restore();
      activeContext.globalAlpha = 1;
      activeContext.globalCompositeOperation = "source-over";
    }

    function scheduleFrame() {
      if (
        animationFrame ||
        transitionPaused ||
        safeMotionRate === 0 ||
        motionQuery.matches ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      animationFrame = requestAnimationFrame(renderFrame);
    }

    function renderFrame(timestamp: number) {
      animationFrame = 0;

      if (timestamp - lastFrame >= FRAME_INTERVAL) {
        draw(timestamp);
        lastFrame = timestamp;
      }

      scheduleFrame();
    }

    function resize() {
      const bounds = activeCanvas.getBoundingClientRect();
      const pixelRatio = Math.min(devicePixelRatio || 1, 0.75);

      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      activeCanvas.width = Math.round(width * pixelRatio);
      activeCanvas.height = Math.round(height * pixelRatio);
      activeContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw(currentTime());
    }

    function syncTheme() {
      const nextTheme = document.documentElement.dataset.theme ?? "";

      if (nextTheme === lastTheme) {
        return;
      }

      syncPalette();
      draw(currentTime());
    }

    function pauseForThemeTransition() {
      transitionPaused = true;
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }

    function resumeAfterThemeTransition() {
      transitionPaused = false;
      scheduleFrame();
    }

    function syncMotionPreference() {
      if (motionQuery.matches) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        draw(0);
        return;
      }

      scheduleFrame();
    }

    function syncVisibility() {
      if (document.visibilityState === "visible") {
        scheduleFrame();
      } else {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    }

    const resizeObserver = new ResizeObserver(resize);
    const themeObserver = new MutationObserver(syncTheme);

    syncPalette();
    resizeObserver.observe(activeCanvas);
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });
    motionQuery.addEventListener("change", syncMotionPreference);
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    window.addEventListener(
      THEME_TRANSITION_START_EVENT,
      pauseForThemeTransition,
    );
    window.addEventListener(
      THEME_TRANSITION_END_EVENT,
      resumeAfterThemeTransition,
    );
    scheduleFrame();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      motionQuery.removeEventListener("change", syncMotionPreference);
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
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
    darkColorOne,
    darkColorThree,
    darkColorTwo,
    intensity,
    lightColorOne,
    lightColorThree,
    lightColorTwo,
    motionRate,
    verticalReach,
  ]);

  const classNames = [styles.root, className].filter(Boolean).join(" ");

  return (
    <span className={classNames} aria-hidden="true" data-mid-ui="aurora">
      <canvas ref={canvasRef} className={styles.canvas} />
    </span>
  );
}
