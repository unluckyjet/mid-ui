"use client";

import { useEffect, useRef } from "react";
import styles from "./liquid-type.module.css";

export type LiquidTypeProps = Readonly<{
  children: string;
  className?: string;
  colorFringe?: number;
  distortion?: number;
  driftRate?: number;
  fieldScale?: number;
  lensRange?: number;
  lensStrength?: number;
}>;

type Palette = Readonly<{
  fringeA: string;
  fringeB: string;
  main: string;
}>;

type RasterSet = Readonly<{
  fringeA: HTMLCanvasElement;
  fringeB: HTMLCanvasElement;
  main: HTMLCanvasElement;
}>;

const FRAME_INTERVAL = 1000 / 30;
const MAX_CELL_COUNT = 6_000;
const MAX_DPR = 1.5;
const MAX_RASTER_PIXELS = 2_000_000;
const THEME_CHANGE_EVENT = "mid-ui:theme-change";
const THEME_TRANSITION_START_EVENT = "mid-ui:theme-transition-start";
const THEME_TRANSITION_END_EVENT = "mid-ui:theme-transition-end";
const LIGHT_PALETTE: Palette = {
  fringeA: "#5976b9",
  fringeB: "#b17a38",
  main: "#171a1f",
};
const DARK_PALETTE: Palette = {
  fringeA: "#8fa4ff",
  fringeB: "#74c6aa",
  main: "#f3f1e8",
};

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function readPalette(): Palette {
  return document.documentElement.dataset.theme === "dark"
    ? DARK_PALETTE
    : LIGHT_PALETTE;
}

function createTextRaster(
  width: number,
  height: number,
  dpr: number,
  text: string,
  color: string,
  computedStyle: CSSStyleDeclaration,
) {
  const raster = document.createElement("canvas");
  const context = raster.getContext("2d");

  raster.width = Math.max(1, Math.floor(width * dpr));
  raster.height = Math.max(1, Math.floor(height * dpr));

  if (!context) {
    return raster;
  }

  const maximumWidth = width * 0.92;
  const startingSize = Math.max(
    12,
    Number.parseFloat(computedStyle.fontSize) || height * 0.5,
  );
  const fontPrefix = [
    computedStyle.fontStyle,
    computedStyle.fontWeight,
  ].join(" ");
  const fontFamily = computedStyle.fontFamily;

  context.scale(dpr, dpr);
  context.font = `${fontPrefix} ${startingSize}px ${fontFamily}`;
  const measuredWidth = context.measureText(text).width;
  const fittedSize =
    measuredWidth > maximumWidth
      ? startingSize * (maximumWidth / measuredWidth)
      : startingSize;

  context.clearRect(0, 0, width, height);
  context.fillStyle = color;
  context.font = `${fontPrefix} ${fittedSize}px ${fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, width / 2, height * 0.515);

  return raster;
}

export function LiquidType({
  children,
  className,
  colorFringe = 2.4,
  distortion = 18,
  driftRate = 0.72,
  fieldScale = 52,
  lensRange = 180,
  lensStrength = 1.05,
}: LiquidTypeProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current!;
    const canvas = canvasRef.current!;
    const fallback = fallbackRef.current!;

    if (!root || !canvas || !fallback) {
      return;
    }

    const context = canvas.getContext("2d")!;

    if (!context) {
      root.dataset.ready = "false";
      root.dataset.motion = "unsupported";
      return;
    }

    const cleanText = children;
    const safeDistortion = clamp(finiteOr(distortion, 18), 0, 42);
    const safeFieldScale = clamp(finiteOr(fieldScale, 52), 18, 120);
    const safeDriftRate = clamp(finiteOr(driftRate, 0.72), 0, 2.4);
    const safeLensRange = clamp(finiteOr(lensRange, 180), 40, 520);
    const safeLensStrength = clamp(finiteOr(lensStrength, 1.05), 0, 2.4);
    const safeColorFringe = clamp(finiteOr(colorFringe, 2.4), 0, 9);
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let animationTimer = 0;
    let disposed = false;
    let dpr = 1;
    let height = 0;
    let intersecting = true;
    let lastDrawAt = 0;
    let palette = readPalette();
    let pointerCurrentX = 0;
    let pointerCurrentY = 0;
    let pointerInfluence = 0;
    let pointerInside = false;
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    let rasters: RasterSet | null = null;
    let renderCount = 0;
    let themeTransitionPaused = false;
    let width = 0;

    function clearScheduledFrame() {
      if (animationTimer !== 0) {
        window.clearTimeout(animationTimer);
        animationTimer = 0;
      }

      if (animationFrame !== 0) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    }

    function canAnimate() {
      return (
        !disposed &&
        !motionQuery.matches &&
        document.visibilityState === "visible" &&
        intersecting &&
        !themeTransitionPaused &&
        cleanText.length > 0
      );
    }

    function shouldContinue() {
      return (
        safeDistortion > 0 &&
        (safeDriftRate > 0 || pointerInfluence > 0.002 || pointerInside)
      );
    }

    function drawCrisp() {
      if (!rasters || width <= 0 || height <= 0) {
        return;
      }

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(rasters.main, 0, 0);
      renderCount += 1;
      root.dataset.cellCount = "0";
      root.dataset.renderCount = String(renderCount);
      root.dataset.ready = "true";
    }

    function drawWarp(timestamp: number) {
      if (!rasters || width <= 0 || height <= 0) {
        return;
      }

      const pixelWidth = canvas.width;
      const pixelHeight = canvas.height;
      const time = timestamp * 0.001 * safeDriftRate;
      const fringe = safeColorFringe * dpr;
      const desiredCellSize = clamp(safeFieldScale * 0.18, 5, 11) * dpr;
      const cellBudgetColumns = Math.max(
        1,
        Math.floor(
          Math.sqrt(MAX_CELL_COUNT * (pixelWidth / pixelHeight)),
        ),
      );
      const cellBudgetRows = Math.max(
        1,
        Math.floor(MAX_CELL_COUNT / cellBudgetColumns),
      );
      const budgetedCellSize =
        Math.max(
        pixelWidth / cellBudgetColumns,
        pixelHeight / cellBudgetRows,
        ) * 1.001;
      const cellSize = Math.max(desiredCellSize, budgetedCellSize);
      const cellCount =
        Math.ceil(pixelWidth / cellSize) *
        Math.ceil(pixelHeight / cellSize);
      const fieldRatio = clamp(52 / safeFieldScale, 0.45, 2.8);
      const distortionPixels = safeDistortion * dpr;
      const lensRangePixels = safeLensRange * dpr;
      const pointerX = pointerCurrentX * dpr;
      const pointerY = pointerCurrentY * dpr;
      const lensOneX = 0.24 + Math.sin(time * 0.43) * 0.12;
      const lensOneY = 0.44 + Math.cos(time * 0.37) * 0.14;
      const lensTwoX = 0.7 + Math.cos(time * 0.31 + 1.4) * 0.13;
      const lensTwoY = 0.56 + Math.sin(time * 0.41 + 0.8) * 0.12;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, pixelWidth, pixelHeight);

      if (fringe > 0) {
        context.globalAlpha = 0.2;
        context.drawImage(
          rasters.fringeA,
          Math.sin(time * 0.73) * fringe - fringe * 0.45,
          Math.cos(time * 0.51) * fringe * 0.28,
        );
        context.globalAlpha = 0.16;
        context.drawImage(
          rasters.fringeB,
          Math.cos(time * 0.61) * fringe + fringe * 0.48,
          Math.sin(time * 0.47) * fringe * 0.24,
        );
      }

      context.globalAlpha = 1;

      for (let sourceY = 0; sourceY < pixelHeight; sourceY += cellSize) {
        const drawHeight = Math.min(cellSize + 1, pixelHeight - sourceY);
        const normalizedY = (sourceY + drawHeight * 0.5) / pixelHeight;

        for (let sourceX = 0; sourceX < pixelWidth; sourceX += cellSize) {
          const drawWidth = Math.min(cellSize + 1, pixelWidth - sourceX);
          const centerX = sourceX + drawWidth * 0.5;
          const centerY = sourceY + drawHeight * 0.5;
          const normalizedX = centerX / pixelWidth;
          const deltaOneX = normalizedX - lensOneX;
          const deltaOneY = normalizedY - lensOneY;
          const deltaTwoX = normalizedX - lensTwoX;
          const deltaTwoY = normalizedY - lensTwoY;
          const lensOne = Math.exp(
            -(
              deltaOneX * deltaOneX * 6.8 * fieldRatio +
              deltaOneY * deltaOneY * 9.2 * fieldRatio
            ),
          );
          const lensTwo = Math.exp(
            -(
              deltaTwoX * deltaTwoX * 8.1 * fieldRatio +
              deltaTwoY * deltaTwoY * 6.4 * fieldRatio
            ),
          );
          const crossWave = Math.sin(
            normalizedX * 9.4 * fieldRatio +
              normalizedY * 5.7 * fieldRatio +
              time * 0.9 +
              Math.sin(
                normalizedY * 7.1 * fieldRatio - time * 0.42,
              ),
          );
          let offsetX =
            (deltaOneY * lensOne * 1.4 -
              deltaTwoY * lensTwo * 1.1 +
              crossWave * 0.12) *
            distortionPixels;
          let offsetY =
            (-deltaOneX * lensOne * 0.72 +
              deltaTwoX * lensTwo * 0.64 +
              Math.cos(
                normalizedY * 8.2 * fieldRatio - time * 0.66,
              ) *
                0.06) *
            distortionPixels;

          if (pointerInfluence > 0.001 && safeLensStrength > 0) {
            const pointerDeltaX = centerX - pointerX;
            const pointerDeltaY = centerY - pointerY;
            const pointerDistance = Math.hypot(
              pointerDeltaX,
              pointerDeltaY,
            );
            const normalizedDistance =
              pointerDistance / Math.max(lensRangePixels, 1);
            const pointerFalloff =
              Math.exp(-normalizedDistance * normalizedDistance * 2.8) *
              pointerInfluence;

            if (pointerFalloff > 0.001) {
              const inverseDistance = 1 / Math.max(pointerDistance, 1);
              const wake =
                Math.sin(pointerDistance / Math.max(10 * dpr, 1) - time * 5.2) *
                0.38;
              const pointerPush =
                distortionPixels *
                safeLensStrength *
                pointerFalloff *
                (0.62 + wake);

              offsetX += pointerDeltaX * inverseDistance * pointerPush;
              offsetY += pointerDeltaY * inverseDistance * pointerPush * 0.58;
            }
          }

          context.drawImage(
            rasters.main,
            sourceX,
            sourceY,
            drawWidth,
            drawHeight,
            sourceX + offsetX,
            sourceY + offsetY,
            drawWidth + 0.75,
            drawHeight + 0.75,
          );
        }
      }

      renderCount += 1;
      root.dataset.cellCount = String(cellCount);
      root.dataset.renderCount = String(renderCount);
      root.dataset.ready = "true";
    }

    function step(timestamp: number) {
      animationFrame = 0;

      if (!canAnimate()) {
        return;
      }

      const elapsed = Math.max(1, timestamp - lastDrawAt);
      const smoothing = 1 - Math.exp(-elapsed / 95);
      const influenceSmoothing = 1 - Math.exp(-elapsed / 165);

      pointerCurrentX +=
        (pointerTargetX - pointerCurrentX) * smoothing;
      pointerCurrentY +=
        (pointerTargetY - pointerCurrentY) * smoothing;
      pointerInfluence +=
        ((pointerInside ? 1 : 0) - pointerInfluence) * influenceSmoothing;
      drawWarp(timestamp);
      lastDrawAt = timestamp;

      if (shouldContinue()) {
        scheduleFrame();
      } else {
        root.dataset.motion = "idle";
      }
    }

    function scheduleFrame() {
      if (
        animationTimer !== 0 ||
        animationFrame !== 0 ||
        !canAnimate() ||
        !shouldContinue()
      ) {
        return;
      }

      const delay = Math.max(
        0,
        FRAME_INTERVAL - (performance.now() - lastDrawAt),
      );

      animationTimer = window.setTimeout(() => {
        animationTimer = 0;

        if (canAnimate()) {
          animationFrame = requestAnimationFrame(step);
        }
      }, delay);
    }

    function rebuild(drawImmediately = false) {
      const bounds = root.getBoundingClientRect();

      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const nativeDpr = clamp(window.devicePixelRatio || 1, 1, MAX_DPR);
      const pixelBudgetScale = Math.sqrt(
        MAX_RASTER_PIXELS / (width * height),
      );

      dpr = Math.min(nativeDpr, pixelBudgetScale);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      root.dataset.rasterPixels = String(canvas.width * canvas.height);
      palette = readPalette();

      const computedStyle = getComputedStyle(fallback);

      rasters = {
        fringeA: createTextRaster(
          width,
          height,
          dpr,
          cleanText,
          palette.fringeA,
          computedStyle,
        ),
        fringeB: createTextRaster(
          width,
          height,
          dpr,
          cleanText,
          palette.fringeB,
          computedStyle,
        ),
        main: createTextRaster(
          width,
          height,
          dpr,
          cleanText,
          palette.main,
          computedStyle,
        ),
      };

      if (!cleanText) {
        clearScheduledFrame();
        context.clearRect(0, 0, canvas.width, canvas.height);
        root.dataset.cellCount = "0";
        root.dataset.ready = "true";
        root.dataset.motion = motionQuery.matches ? "reduced" : "idle";
        return;
      }

      if (
        motionQuery.matches ||
        safeDistortion === 0 ||
        drawImmediately
      ) {
        drawCrisp();
      } else {
        drawWarp(performance.now());
      }

      if (!motionQuery.matches && shouldContinue()) {
        root.dataset.motion = canAnimate() ? "active" : "paused";
        scheduleFrame();
      } else if (!motionQuery.matches) {
        root.dataset.motion = "idle";
      }
    }

    function syncTheme() {
      rebuild(themeTransitionPaused || motionQuery.matches);
    }

    function syncMotionPreference() {
      clearScheduledFrame();

      if (motionQuery.matches) {
        root.dataset.motion = "reduced";
        pointerInfluence = 0;
        drawCrisp();
      } else {
        lastDrawAt = 0;
        drawWarp(performance.now());

        if (shouldContinue()) {
          root.dataset.motion = canAnimate() ? "active" : "paused";
          scheduleFrame();
        } else {
          root.dataset.motion = "idle";
        }
      }
    }

    function syncVisibility() {
      if (document.visibilityState === "visible" && intersecting) {
        lastDrawAt = 0;

        if (motionQuery.matches) {
          root.dataset.motion = "reduced";
          drawCrisp();
        } else if (shouldContinue()) {
          root.dataset.motion = "active";
          scheduleFrame();
        } else {
          root.dataset.motion = "idle";
        }
      } else {
        root.dataset.motion = "paused";
        clearScheduledFrame();
      }
    }

    function pauseForThemeTransition() {
      themeTransitionPaused = true;
      root.dataset.motion = "paused";
      clearScheduledFrame();
    }

    function resumeAfterThemeTransition() {
      themeTransitionPaused = false;
      syncTheme();
      syncVisibility();
    }

    function updatePointer(event: PointerEvent) {
      const bounds = root.getBoundingClientRect();

      pointerTargetX = event.clientX - bounds.left;
      pointerTargetY = event.clientY - bounds.top;
      pointerInside = true;

      if (safeDistortion > 0 && canAnimate()) {
        root.dataset.motion = "active";
      }

      scheduleFrame();
    }

    function releasePointer() {
      pointerInside = false;
      scheduleFrame();
    }

    const resizeObserver = new ResizeObserver(() => rebuild(true));
    const themeObserver = new MutationObserver(syncTheme);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? true;
      syncVisibility();
    });

    root.dataset.motion = motionQuery.matches ? "reduced" : "active";
    resizeObserver.observe(root);
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });
    intersectionObserver.observe(root);
    motionQuery.addEventListener("change", syncMotionPreference);
    document.addEventListener("visibilitychange", syncVisibility);
    root.addEventListener("pointerenter", updatePointer, { passive: true });
    root.addEventListener("pointermove", updatePointer, { passive: true });
    root.addEventListener("pointerleave", releasePointer, { passive: true });
    root.addEventListener("pointercancel", releasePointer, { passive: true });
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    window.addEventListener(
      THEME_TRANSITION_START_EVENT,
      pauseForThemeTransition,
    );
    window.addEventListener(
      THEME_TRANSITION_END_EVENT,
      resumeAfterThemeTransition,
    );

    rebuild(true);
    void document.fonts.ready.then(() => {
      if (!disposed) {
        rebuild(true);
      }
    });

    return () => {
      disposed = true;
      clearScheduledFrame();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      intersectionObserver.disconnect();
      motionQuery.removeEventListener("change", syncMotionPreference);
      document.removeEventListener("visibilitychange", syncVisibility);
      root.removeEventListener("pointerenter", updatePointer);
      root.removeEventListener("pointermove", updatePointer);
      root.removeEventListener("pointerleave", releasePointer);
      root.removeEventListener("pointercancel", releasePointer);
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
    children,
    className,
    colorFringe,
    distortion,
    driftRate,
    fieldScale,
    lensRange,
    lensStrength,
  ]);

  const classNames = [styles.root, className].filter(Boolean).join(" ");

  return (
    <span
      ref={rootRef}
      className={classNames}
      data-mid-ui="liquid-type"
      data-cell-count="0"
      data-motion="loading"
      data-raster-pixels="0"
      data-ready="false"
    >
      <span ref={fallbackRef} className={styles.fallback} aria-hidden="true">
        {children}
      </span>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <span className={styles.semantic}>{children}</span>
    </span>
  );
}
