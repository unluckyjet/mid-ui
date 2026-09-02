"use client";

import { useEffect, useRef } from "react";
import styles from "./flow-field.module.css";

export type FlowFieldPalette = readonly [string, string, string];

export type FlowFieldProps = Readonly<{
  className?: string;
  curvature?: number;
  darkColors?: FlowFieldPalette;
  driftRate?: number;
  lightColors?: FlowFieldPalette;
  lineCount?: number;
}>;

const DEFAULT_LIGHT_COLORS: FlowFieldPalette = ["#4f5966", "#6676d9", "#2f9475"];
const DEFAULT_DARK_COLORS: FlowFieldPalette = ["#dce2ea", "#91a5ff", "#72dfbd"];
const FRAME_INTERVAL = 1000 / 30;
const SEGMENTS = 88;
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

function bell(distanceSquared: number, radius: number) {
  return Math.exp(-distanceSquared / (radius * radius));
}

export function FlowField({
  className,
  curvature = 1,
  darkColors = DEFAULT_DARK_COLORS,
  driftRate = 1,
  lightColors = DEFAULT_LIGHT_COLORS,
  lineCount = 48,
}: FlowFieldProps) {
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

    if (!canvas || !context) return;

    const activeCanvas = canvas;
    const activeContext = context;
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const safeCurvature = clamp(finiteOr(curvature, 1), 0, 2.25);
    const safeDriftRate = clamp(finiteOr(driftRate, 1), 0, 3);
    const safeLineCount = Math.round(clamp(finiteOr(lineCount, 48), 12, 96));
    const resolvedLightColors: FlowFieldPalette = [
      validColor(lightColorOne, DEFAULT_LIGHT_COLORS[0]),
      validColor(lightColorTwo, DEFAULT_LIGHT_COLORS[1]),
      validColor(lightColorThree, DEFAULT_LIGHT_COLORS[2]),
    ];
    const resolvedDarkColors: FlowFieldPalette = [
      validColor(darkColorOne, DEFAULT_DARK_COLORS[0]),
      validColor(darkColorTwo, DEFAULT_DARK_COLORS[1]),
      validColor(darkColorThree, DEFAULT_DARK_COLORS[2]),
    ];
    let animationFrame = 0;
    let darkMode = false;
    let height = 1;
    let lastFrame = 0;
    let lastTheme = "";
    let palette: FlowFieldPalette = resolvedLightColors;
    let transitionPaused = false;
    let width = 1;

    function syncPalette() {
      lastTheme = document.documentElement.dataset.theme ?? "";
      darkMode = lastTheme === "dark";
      palette = darkMode ? resolvedDarkColors : resolvedLightColors;
    }

    function currentTime() {
      return motionQuery.matches ? 0 : lastFrame || performance.now();
    }

    function displacedY(
      baseY: number,
      normalizedX: number,
      time: number,
      pocketOneX: number,
      pocketOneY: number,
      pocketTwoX: number,
      pocketTwoY: number,
    ) {
      const normalizedY = baseY / height;
      const broadCurrent = Math.sin(normalizedX * Math.PI * 2.15 + time * 0.19) * 0.045;
      const crossCurrent = Math.cos(
        normalizedX * Math.PI * 4.6 - time * 0.13 + normalizedY * 2.8,
      ) * 0.018;
      const deltaOneX = normalizedX - pocketOneX;
      const deltaOneY = normalizedY - pocketOneY;
      const deltaTwoX = normalizedX - pocketTwoX;
      const deltaTwoY = normalizedY - pocketTwoY;
      const pocketOne = Math.sign(deltaOneY || 1)
        * bell(deltaOneX ** 2 + deltaOneY ** 2, 0.19) * 0.078;
      const pocketTwo = Math.sign(deltaTwoY || 1)
        * bell(deltaTwoX ** 2 + deltaTwoY ** 2, 0.24) * 0.062;

      return baseY + height * safeCurvature
        * (broadCurrent + crossCurrent + pocketOne + pocketTwo);
    }

    function draw(timestamp: number) {
      const time = timestamp * 0.001 * safeDriftRate;
      const pocketOneX = 0.32 + Math.sin(time * 0.08) * 0.08;
      const pocketOneY = 0.44 + Math.cos(time * 0.1) * 0.1;
      const pocketTwoX = 0.73 + Math.cos(time * 0.065 + 1.2) * 0.09;
      const pocketTwoY = 0.58 + Math.sin(time * 0.075 + 0.5) * 0.11;

      activeContext.clearRect(0, 0, width, height);
      activeContext.lineCap = "round";
      activeContext.lineJoin = "round";

      for (let lineIndex = 0; lineIndex < safeLineCount; lineIndex += 1) {
        const normalizedLine = (lineIndex + 0.5) / safeLineCount;
        const baseY = normalizedLine * height;
        const accentOne = lineIndex % 13 === 4;
        const accentTwo = lineIndex % 17 === 9;
        const lineColor = accentOne ? palette[1] : accentTwo ? palette[2] : palette[0];
        const edgeFade = Math.sin(normalizedLine * Math.PI);

        activeContext.beginPath();

        for (let segment = 0; segment <= SEGMENTS; segment += 1) {
          const normalizedX = segment / SEGMENTS;
          const x = normalizedX * width;
          const y = displacedY(
            baseY,
            normalizedX,
            time,
            pocketOneX,
            pocketOneY,
            pocketTwoX,
            pocketTwoY,
          );

          if (segment === 0) activeContext.moveTo(x, y);
          else activeContext.lineTo(x, y);
        }

        activeContext.globalAlpha = (darkMode ? 0.17 : 0.13)
          + edgeFade * (darkMode ? 0.31 : 0.18);
        activeContext.lineWidth = accentOne || accentTwo ? 1.35 : 0.75;
        activeContext.strokeStyle = lineColor;
        activeContext.stroke();
      }

      activeContext.globalAlpha = 1;
    }

    function scheduleFrame() {
      if (animationFrame || transitionPaused || safeCurvature === 0
        || safeDriftRate === 0
        || motionQuery.matches || document.visibilityState !== "visible") return;
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
      const pixelRatio = Math.min(devicePixelRatio || 1, 1.25);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      activeCanvas.width = Math.round(width * pixelRatio);
      activeCanvas.height = Math.round(height * pixelRatio);
      activeContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw(currentTime());
    }

    function syncTheme() {
      const nextTheme = document.documentElement.dataset.theme ?? "";
      if (nextTheme === lastTheme) return;
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
      } else scheduleFrame();
    }

    function syncVisibility() {
      if (document.visibilityState === "visible") scheduleFrame();
      else {
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
    window.addEventListener(THEME_TRANSITION_START_EVENT, pauseForThemeTransition);
    window.addEventListener(THEME_TRANSITION_END_EVENT, resumeAfterThemeTransition);
    scheduleFrame();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      motionQuery.removeEventListener("change", syncMotionPreference);
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
      window.removeEventListener(THEME_TRANSITION_START_EVENT, pauseForThemeTransition);
      window.removeEventListener(THEME_TRANSITION_END_EVENT, resumeAfterThemeTransition);
    };
  }, [curvature, darkColorOne, darkColorThree, darkColorTwo, driftRate,
    lightColorOne, lightColorThree, lightColorTwo, lineCount]);

  const classNames = [styles.root, className].filter(Boolean).join(" ");

  return (
    <span className={classNames} aria-hidden="true" data-mid-ui="flow-field">
      <canvas ref={canvasRef} className={styles.canvas} />
    </span>
  );
}
