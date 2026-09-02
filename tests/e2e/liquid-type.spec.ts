import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __midUiLiquidDraws?: number;
    __midUiLiquidObserverDisconnects?: {
      intersection: number;
      mutation: number;
      resize: number;
    };
    __midUiMotionQueries?: MediaQueryList[];
  }
}

const ROUTE = "/components/liquid-type";

function liquidType(page: Page) {
  return page.locator("[data-mid-ui='liquid-type']");
}

async function canvasSnapshot(page: Page) {
  return liquidType(page)
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
}

async function renderCount(page: Page) {
  return Number.parseInt(
    (await liquidType(page).getAttribute("data-render-count")) ?? "0",
    10,
  );
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await page.addInitScript(() => {
    localStorage.removeItem("mid-ui-theme");
    window.__midUiLiquidDraws = 0;
    window.__midUiLiquidObserverDisconnects = {
      intersection: 0,
      mutation: 0,
      resize: 0,
    };
    window.__midUiMotionQueries = [];

    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    const originalMatchMedia = window.matchMedia.bind(window);
    const NativeIntersectionObserver = window.IntersectionObserver;
    const NativeMutationObserver = window.MutationObserver;
    const NativeResizeObserver = window.ResizeObserver;

    CanvasRenderingContext2D.prototype.drawImage = function drawImage(
      image: CanvasImageSource,
      ...args: number[]
    ) {
      if (this.canvas.closest("[data-mid-ui='liquid-type']")) {
        window.__midUiLiquidDraws = (window.__midUiLiquidDraws ?? 0) + 1;
      }

      return (
        originalDrawImage as (
          image: CanvasImageSource,
          ...values: number[]
        ) => void
      ).call(this, image, ...args);
    };
    window.matchMedia = (query) => {
      const result = originalMatchMedia(query);

      if (query === "(prefers-reduced-motion: reduce)") {
        window.__midUiMotionQueries?.push(result);
      }

      return result;
    };

    window.IntersectionObserver = class TrackingIntersectionObserver
      extends NativeIntersectionObserver {
      disconnect() {
        if (window.__midUiLiquidObserverDisconnects) {
          window.__midUiLiquidObserverDisconnects.intersection += 1;
        }
        super.disconnect();
      }
    };
    window.MutationObserver = class TrackingMutationObserver
      extends NativeMutationObserver {
      disconnect() {
        if (window.__midUiLiquidObserverDisconnects) {
          window.__midUiLiquidObserverDisconnects.mutation += 1;
        }
        super.disconnect();
      }
    };
    window.ResizeObserver = class TrackingResizeObserver
      extends NativeResizeObserver {
      disconnect() {
        if (window.__midUiLiquidObserverDisconnects) {
          window.__midUiLiquidObserverDisconnects.resize += 1;
        }
        super.disconnect();
      }
    };
  });
  await page.goto(ROUTE);
});

test("renders one semantic text twin and caps its canvas workload", async ({
  page,
}) => {
  const root = liquidType(page);
  const canvas = root.locator("canvas");

  await expect(root).toHaveAttribute("data-ready", "true");
  await expect(root).toHaveAttribute("data-motion", "active");
  await expect(canvas).toHaveAttribute("aria-hidden", "true");
  await expect(root.locator("span").last()).toHaveText("MID LIQUID");

  const dimensions = await canvas.evaluate((element: HTMLCanvasElement) => {
    const bounds = element.getBoundingClientRect();

    return {
      cssHeight: bounds.height,
      cssWidth: bounds.width,
      pixelHeight: element.height,
      pixelWidth: element.width,
    };
  });

  expect(dimensions.pixelWidth).toBeLessThanOrEqual(
    Math.ceil(dimensions.cssWidth * 1.5) + 1,
  );
  expect(dimensions.pixelHeight).toBeLessThanOrEqual(
    Math.ceil(dimensions.cssHeight * 1.5) + 1,
  );
  await expect
    .poll(async () => Number(await root.getAttribute("data-raster-pixels")))
    .toBeGreaterThan(0);
  expect(Number(await root.getAttribute("data-raster-pixels"))).toBeLessThanOrEqual(
    2_000_000,
  );
  await expect
    .poll(async () => Number(await root.getAttribute("data-cell-count")))
    .toBeGreaterThan(0);
  expect(Number(await root.getAttribute("data-cell-count"))).toBeLessThanOrEqual(
    6_000,
  );

  const firstCount = await renderCount(page);
  await page.waitForTimeout(1_100);
  const renderedFrames = (await renderCount(page)) - firstCount;

  expect(renderedFrames).toBeGreaterThanOrEqual(20);
  expect(renderedFrames).toBeLessThanOrEqual(36);
});

test("rerenders true prop changes without replacing its canvas", async ({
  page,
}) => {
  const root = liquidType(page);
  const canvas = root.locator("canvas");

  await page.getByTestId("drift-rate-input").fill("0");
  await canvas.evaluate((element) => {
    element.dataset.identity = "retained";
  });
  const firstSnapshot = await canvasSnapshot(page);

  await page.getByTestId("liquid-phrase").fill("REFRACT");
  await expect(root.locator("span").last()).toHaveText("REFRACT");
  await expect(canvas).toHaveAttribute("data-identity", "retained");
  await expect.poll(() => canvasSnapshot(page)).not.toBe(firstSnapshot);

  const drawsBeforeFieldChange = await page.evaluate(
    () => window.__midUiLiquidDraws ?? 0,
  );
  await page.getByTestId("field-scale-input").fill("92");
  await expect(canvas).toHaveAttribute("data-identity", "retained");
  await expect
    .poll(() => page.evaluate(() => window.__midUiLiquidDraws ?? 0))
    .toBeGreaterThan(drawsBeforeFieldChange);

  const beforeTypeface = await canvasSnapshot(page);
  await page.getByRole("button", { name: "Swap typeface" }).click();
  await expect(canvas).toHaveAttribute("data-identity", "retained");
  await expect.poll(() => canvasSnapshot(page)).not.toBe(beforeTypeface);

  const longPhrase = "LIQUID ".repeat(13).trim();
  await page.getByTestId("liquid-phrase").fill(longPhrase);
  await expect(root.locator("span").last()).toHaveText(longPhrase);

  await page.getByTestId("liquid-phrase").fill("");
  await expect(root.locator("span").last()).toHaveText("");
  await expect(root).toHaveAttribute("data-motion", "idle");
  const emptyCount = await renderCount(page);
  const emptySnapshot = await canvasSnapshot(page);
  await page.waitForTimeout(300);

  expect(await renderCount(page)).toBe(emptyCount);
  expect(await canvasSnapshot(page)).toBe(emptySnapshot);
});

test("bounds raster memory and draw calls for an oversized surface", async ({
  page,
}) => {
  const root = liquidType(page);

  await root.evaluate((element) => {
    Object.assign((element as HTMLElement).style, {
      display: "block",
      height: "2160px",
      maxWidth: "none",
      width: "3840px",
    });
  });
  await expect
    .poll(() =>
      root.locator("canvas").evaluate((canvas) => canvas.style.width),
    )
    .toBe("3840px");
  await expect
    .poll(async () => Number(await root.getAttribute("data-raster-pixels")))
    .toBeGreaterThan(0);
  expect(Number(await root.getAttribute("data-raster-pixels"))).toBeLessThanOrEqual(
    2_000_000,
  );
  await expect
    .poll(async () => Number(await root.getAttribute("data-cell-count")))
    .toBeGreaterThan(0);
  expect(Number(await root.getAttribute("data-cell-count"))).toBeLessThanOrEqual(
    6_000,
  );

  const firstFrame = await renderCount(page);
  const firstDrawCount = await page.evaluate(
    () => window.__midUiLiquidDraws ?? 0,
  );
  await expect.poll(() => renderCount(page)).toBeGreaterThan(firstFrame);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("mid-ui:theme-transition-start"));
  });
  const renderedFrames = (await renderCount(page)) - firstFrame;
  const drawCalls =
    (await page.evaluate(() => window.__midUiLiquidDraws ?? 0)) -
    firstDrawCount;

  expect(drawCalls / renderedFrames).toBeLessThanOrEqual(6_002);
});

test("forms a local pointer wake and settles after the pointer exits", async ({
  page,
}) => {
  const root = liquidType(page);

  await page.getByTestId("drift-rate-input").fill("0");
  await expect(root).toHaveAttribute("data-ready", "true");
  const beforePointer = await canvasSnapshot(page);
  const bounds = await root.boundingBox();

  expect(bounds).not.toBeNull();
  await page.mouse.move(
    (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.62,
    (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.5,
  );
  await page.waitForTimeout(320);
  const duringPointer = await canvasSnapshot(page);

  expect(duringPointer).not.toBe(beforePointer);
  await page.mouse.move(1, 1);
  await page.waitForTimeout(1_800);
  const afterPointer = await canvasSnapshot(page);
  const settledCount = await renderCount(page);

  expect(afterPointer).not.toBe(duringPointer);
  await page.waitForTimeout(300);
  expect(await renderCount(page)).toBe(settledCount);
});

test("draws a crisp static raster whenever reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();

  const root = liquidType(page);

  await expect(root).toHaveAttribute("data-ready", "true");
  await expect(root).toHaveAttribute("data-motion", "reduced");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const firstSnapshot = await canvasSnapshot(page);
  const firstCount = await renderCount(page);
  const bounds = await root.boundingBox();

  await page.mouse.move(
    (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2,
    (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2,
  );
  await page.waitForTimeout(450);

  expect(await canvasSnapshot(page)).toBe(firstSnapshot);
  expect(await renderCount(page)).toBe(firstCount);
});

test("settles immediately when reduced motion begins at runtime", async ({
  page,
}) => {
  const root = liquidType(page);

  await expect(root).toHaveAttribute("data-motion", "active");
  const activeCount = await renderCount(page);
  await expect.poll(() => renderCount(page)).toBeGreaterThan(activeCount);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    for (const query of window.__midUiMotionQueries ?? []) {
      query.dispatchEvent(new Event("change"));
    }
  });
  await expect(root).toHaveAttribute("data-motion", "reduced");
  const runtimeSnapshot = await canvasSnapshot(page);
  const runtimeCount = await renderCount(page);
  await page.waitForTimeout(350);

  expect(await canvasSnapshot(page)).toBe(runtimeSnapshot);
  expect(await renderCount(page)).toBe(runtimeCount);
});

test("pauses for theme transitions and document visibility", async ({ page }) => {
  const root = liquidType(page);

  await expect(root).toHaveAttribute("data-motion", "active");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("mid-ui:theme-transition-start"));
  });
  const transitionCount = await renderCount(page);
  await page.waitForTimeout(250);
  expect(await renderCount(page)).toBe(transitionCount);

  await page.evaluate(() => {
    window.dispatchEvent(new Event("mid-ui:theme-transition-end"));
  });
  await expect.poll(() => renderCount(page)).toBeGreaterThan(transitionCount);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(root).toHaveAttribute("data-motion", "paused");
  const hiddenCount = await renderCount(page);
  await page.waitForTimeout(250);
  expect(await renderCount(page)).toBe(hiddenCount);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(root).toHaveAttribute("data-motion", "active");
  await expect.poll(() => renderCount(page)).toBeGreaterThan(hiddenCount);
});

test("pauses offscreen and releases observers and animation work on unmount", async ({
  page,
}) => {
  const root = liquidType(page);

  await root.evaluate((element) => {
    element.style.transform = "translateY(1600px)";
  });
  await expect(root).toHaveAttribute("data-motion", "paused");
  const pausedCount = await renderCount(page);
  await page.waitForTimeout(350);
  expect(await renderCount(page)).toBe(pausedCount);

  await root.evaluate((element) => {
    element.style.transform = "";
  });
  await expect(root).toHaveAttribute("data-motion", "active");
  await expect.poll(() => renderCount(page)).toBeGreaterThan(pausedCount);

  const disconnectsBefore = await page.evaluate(
    () => window.__midUiLiquidObserverDisconnects,
  );
  await page.getByRole("button", { name: "Unmount" }).click();
  await expect(root).toHaveCount(0);
  const disconnectsAfter = await page.evaluate(
    () => window.__midUiLiquidObserverDisconnects,
  );

  expect(disconnectsAfter?.intersection ?? 0).toBeGreaterThan(
    disconnectsBefore?.intersection ?? 0,
  );
  expect(disconnectsAfter?.mutation ?? 0).toBeGreaterThan(
    disconnectsBefore?.mutation ?? 0,
  );
  expect(disconnectsAfter?.resize ?? 0).toBeGreaterThan(
    disconnectsBefore?.resize ?? 0,
  );

  const drawsAfterUnmount = await page.evaluate(
    () => window.__midUiLiquidDraws ?? 0,
  );
  await page.evaluate(() => {
    window.dispatchEvent(new Event("mid-ui:theme-change"));
    window.dispatchEvent(new Event("mid-ui:theme-transition-start"));
    window.dispatchEvent(new Event("mid-ui:theme-transition-end"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(350);

  expect(await page.evaluate(() => window.__midUiLiquidDraws ?? 0)).toBe(
    drawsAfterUnmount,
  );
});

test("redraws the retained canvas with a distinct dark palette", async ({
  page,
}) => {
  const root = liquidType(page);
  const canvas = root.locator("canvas");

  await page.getByTestId("drift-rate-input").fill("0");
  await canvas.evaluate((element) => {
    element.dataset.identity = "retained";
  });
  const lightSnapshot = await canvasSnapshot(page);

  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(canvas).toHaveAttribute("data-identity", "retained");
  await expect.poll(() => canvasSnapshot(page)).not.toBe(lightSnapshot);
});
