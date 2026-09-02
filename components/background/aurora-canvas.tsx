"use client";

import { useEffect, useRef } from "react";
import styles from "./background.module.css";

type Curtain = Readonly<{
  alpha: number;
  amplitude: number;
  base: number;
  center: number;
  curvature: number;
  drift: number;
  frequency: number;
  phase: number;
}>;

const CURTAINS: readonly Curtain[] = [
  {
    alpha: 0.9,
    amplitude: 0.046,
    base: 0.52,
    center: 0.22,
    curvature: 0.12,
    drift: 0.21,
    frequency: 1.35,
    phase: 0.3,
  },
  {
    alpha: 0.68,
    amplitude: 0.056,
    base: 0.44,
    center: 0.58,
    curvature: 0.15,
    drift: -0.16,
    frequency: 1.8,
    phase: 2.1,
  },
  {
    alpha: 0.52,
    amplitude: 0.04,
    base: 0.58,
    center: 0.82,
    curvature: 0.11,
    drift: 0.12,
    frequency: 1.1,
    phase: 4.4,
  },
];

const SEGMENTS = 84;
const FRAME_INTERVAL = 1000 / 30;
const THEME_CHANGE_EVENT = "mid-ui:theme-change";
const THEME_TRANSITION_START_EVENT = "mid-ui:theme-transition-start";
const THEME_TRANSITION_END_EVENT = "mid-ui:theme-transition-end";

function cssValue(style: CSSStyleDeclaration, name: string, fallback: string) {
  return style.getPropertyValue(name).trim() || fallback;
}

export function AuroraCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });

    if (!canvas || !context) {
      return;
    }

    const activeCanvas = canvas;
    const activeContext = context;
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let lastFrame = 0;
    let lastTheme = "";
    let transitionPaused = false;
    let width = 1;
    let height = 1;
    let palette = ["#49d6ad", "#38aee6", "#6674dc"];
    let strength = 0.2;
    let compositeOperation: GlobalCompositeOperation = "source-over";

    function readPalette() {
      const style = getComputedStyle(activeCanvas);

      palette = [
        cssValue(style, "--aurora-color-one", "#49d6ad"),
        cssValue(style, "--aurora-color-two", "#38aee6"),
        cssValue(style, "--aurora-color-three", "#6674dc"),
      ];

      const parsedStrength = Number.parseFloat(
        style.getPropertyValue("--aurora-strength"),
      );

      strength = Number.isFinite(parsedStrength) ? parsedStrength : 0.2;
      lastTheme = document.documentElement.dataset.theme ?? "";
      compositeOperation = lastTheme === "dark" ? "lighter" : "source-over";
    }

    function currentTime() {
      return motionQuery.matches ? 0 : lastFrame || performance.now();
    }

    function buildCurve(time: number, curtain: Curtain) {
      const fillPath = new Path2D();
      const movingCenter =
        curtain.center + Math.sin(time * curtain.drift + curtain.phase) * 0.13;

      fillPath.moveTo(0, 0);
      fillPath.lineTo(width, 0);

      for (let index = SEGMENTS; index >= 0; index -= 1) {
        const normalizedX = index / SEGMENTS;
        const x = normalizedX * width;
        const parabola =
          curtain.curvature * (normalizedX - movingCenter) ** 2;
        const primaryWave =
          Math.sin(
            normalizedX * Math.PI * 2 * curtain.frequency +
              time * 0.2 +
              curtain.phase,
          ) * curtain.amplitude;
        const secondaryWave =
          Math.sin(
            normalizedX * Math.PI * 3.2 -
              time * 0.11 +
              curtain.phase * 0.7,
          ) *
          curtain.amplitude *
          0.34;
        const y =
          height * (curtain.base + parabola + primaryWave + secondaryWave);

        fillPath.lineTo(x, y);
      }

      fillPath.closePath();

      return fillPath;
    }

    function draw(timestamp: number) {
      const time = timestamp * 0.001;

      activeContext.clearRect(0, 0, width, height);
      activeContext.lineCap = "round";
      activeContext.lineJoin = "round";
      activeContext.globalCompositeOperation = compositeOperation;

      CURTAINS.forEach((curtain, index) => {
        const fillPath = buildCurve(time, curtain);
        const gradient = activeContext.createLinearGradient(0, 0, width, 0);

        gradient.addColorStop(0, palette[index % palette.length]);
        gradient.addColorStop(0.48, palette[(index + 1) % palette.length]);
        gradient.addColorStop(1, palette[(index + 2) % palette.length]);

        activeContext.globalAlpha = strength * curtain.alpha;
        activeContext.fillStyle = gradient;
        activeContext.fill(fillPath);
      });

      activeContext.globalAlpha = 1;
      activeContext.globalCompositeOperation = "source-over";
    }

    function scheduleFrame() {
      if (
        animationFrame ||
        transitionPaused ||
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
      const pixelRatio = Math.min(devicePixelRatio || 1, 1);

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

      readPalette();
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

    readPalette();
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
  }, []);

  return <canvas ref={canvasRef} className={styles.skyCanvas} />;
}
