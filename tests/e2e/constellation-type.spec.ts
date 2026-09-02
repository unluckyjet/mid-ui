import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __midUiAnimationFrames?: { cancelled: number; requested: number };
    __midUiCanvasClears?: number;
    __midUiObserverDisconnects?: {
      intersection: number;
      mutation: number;
      resize: number;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    localStorage.removeItem("mid-ui-theme");
    window.__midUiAnimationFrames = { cancelled: 0, requested: 0 };
    window.__midUiCanvasClears = 0;
    window.__midUiObserverDisconnects = {
      intersection: 0,
      mutation: 0,
      resize: 0,
    };
    const originalClearRect = CanvasRenderingContext2D.prototype.clearRect;
    const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const originalCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    const NativeIntersectionObserver = window.IntersectionObserver;
    const NativeMutationObserver = window.MutationObserver;
    const NativeResizeObserver = window.ResizeObserver;

    CanvasRenderingContext2D.prototype.clearRect = function clearRect(...args) {
      if (this.canvas.closest("[data-mid-ui='constellation-type']")) {
        window.__midUiCanvasClears = (window.__midUiCanvasClears ?? 0) + 1;
      }
      return originalClearRect.apply(this, args);
    };
    window.requestAnimationFrame = (callback) => {
      if (window.__midUiAnimationFrames) {
        window.__midUiAnimationFrames.requested += 1;
      }
      return originalRequestAnimationFrame(callback);
    };
    window.cancelAnimationFrame = (handle) => {
      if (window.__midUiAnimationFrames) {
        window.__midUiAnimationFrames.cancelled += 1;
      }
      return originalCancelAnimationFrame(handle);
    };
    window.IntersectionObserver = class TrackingIntersectionObserver
      extends NativeIntersectionObserver {
      disconnect() {
        if (window.__midUiObserverDisconnects) {
          window.__midUiObserverDisconnects.intersection += 1;
        }
        super.disconnect();
      }
    };
    window.MutationObserver = class TrackingMutationObserver extends NativeMutationObserver {
      disconnect() {
        if (window.__midUiObserverDisconnects) {
          window.__midUiObserverDisconnects.mutation += 1;
        }
        super.disconnect();
      }
    };
    window.ResizeObserver = class TrackingResizeObserver extends NativeResizeObserver {
      disconnect() {
        if (window.__midUiObserverDisconnects) {
          window.__midUiObserverDisconnects.resize += 1;
        }
        super.disconnect();
      }
    };
  });
  await page.goto("/components/constellation-type");
});

async function canvasSnapshot(page: Page) {
  return page.locator("[data-mid-ui='constellation-type'] canvas").evaluate(
    (canvas: HTMLCanvasElement) => canvas.toDataURL(),
  );
}

test("renders a seeded canvas field with one semantic text twin", async ({ page }) => {
  const root = page.locator("[data-mid-ui='constellation-type']");
  const canvas = root.locator("canvas");

  await expect(root).toHaveAttribute("data-ready", "true");
  await expect.poll(async () => Number(await root.getAttribute("data-point-count")))
    .toBeGreaterThan(80);
  await expect(canvas).toHaveAttribute("aria-hidden", "true");
  await expect(root.locator("span").last()).toHaveText("MID UI");
  await expect(page.getByRole("slider", { name: "Lattice gap" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Star size" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Pointer force" })).toBeVisible();

  const initialPointCount = await root.getAttribute("data-point-count");
  await page.getByTestId("rest-motion-input").fill("0");
  await page.getByTestId("dispersion-input").fill("0");
  await expect(root).toHaveAttribute("data-ready", "true");
  const firstSnapshot = await canvasSnapshot(page);

  await page.getByRole("button", { name: "Unmount" }).click();
  await expect(root).toHaveCount(0);
  await page.getByRole("button", { name: "Mount field" }).click();

  const remountedRoot = page.locator("[data-mid-ui='constellation-type']");
  await expect(remountedRoot).toHaveAttribute("data-ready", "true");
  await expect(remountedRoot).toHaveAttribute("data-point-count", initialPointCount ?? "");
  await expect.poll(() => canvasSnapshot(page)).toBe(firstSnapshot);
});

test("rebuilds true prop changes without replacing the canvas element", async ({ page }) => {
  const root = page.locator("[data-mid-ui='constellation-type']");
  const canvas = root.locator("canvas");

  await canvas.evaluate((element) => {
    element.dataset.identity = "retained";
  });
  await page.getByTestId("phrase-input").fill("ORBIT");
  await expect(root.locator("span").last()).toHaveText("ORBIT");
  await expect(canvas).toHaveAttribute("data-identity", "retained");

  await page.getByTestId("rest-motion-input").fill("0");
  await page.getByTestId("dispersion-input").fill("0");
  const compactSnapshot = await canvasSnapshot(page);
  await page.getByTestId("spacing-input").fill("13");
  await expect.poll(() => canvasSnapshot(page)).not.toBe(compactSnapshot);
  await expect(canvas).toHaveAttribute("data-identity", "retained");

  await page.getByTestId("phrase-input").fill("");
  await expect(root).toHaveAttribute("data-point-count", "0");
  await expect(canvas).toHaveAttribute("data-identity", "retained");
  const emptyClearCount = await page.evaluate(() => window.__midUiCanvasClears ?? 0);
  const emptyFrameCount = await page.evaluate(
    () => window.__midUiAnimationFrames?.requested ?? 0,
  );
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__midUiCanvasClears ?? 0)).toBe(emptyClearCount);
  expect(
    await page.evaluate(() => window.__midUiAnimationFrames?.requested ?? 0),
  ).toBe(emptyFrameCount);
});

test("repels around the pointer and springs back after exit", async ({ page }) => {
  const root = page.locator("[data-mid-ui='constellation-type']");
  await page.getByTestId("rest-motion-input").fill("0");
  await page.getByTestId("dispersion-input").fill("0");
  await expect(root).toHaveAttribute("data-ready", "true");
  const beforePointer = await canvasSnapshot(page);
  const bounds = await root.boundingBox();

  expect(bounds).not.toBeNull();
  await page.mouse.move(
    (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2,
    (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2,
  );
  await page.waitForTimeout(320);
  const duringPointer = await canvasSnapshot(page);
  expect(duringPointer).not.toBe(beforePointer);

  await page.mouse.move(1, 1);
  await page.waitForTimeout(1600);
  const afterPointer = await canvasSnapshot(page);
  expect(afterPointer).not.toBe(duringPointer);
});

test("draws one settled field and schedules no ongoing work for reduced motion", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.reload();

  const root = page.locator("[data-mid-ui='constellation-type']");
  await expect(root).toHaveAttribute("data-motion", "reduced");
  await expect(root).toHaveAttribute("data-ready", "true");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const firstClearCount = await page.evaluate(() => window.__midUiCanvasClears ?? 0);
  const firstFrameCount = await page.evaluate(
    () => window.__midUiAnimationFrames?.requested ?? 0,
  );
  const firstSnapshot = await canvasSnapshot(page);
  const bounds = await root.boundingBox();

  expect(firstClearCount).toBeGreaterThan(0);
  expect(firstClearCount).toBeLessThanOrEqual(2);

  await page.mouse.move(
    (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2,
    (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2,
  );
  await page.waitForTimeout(450);

  expect(await page.evaluate(() => window.__midUiCanvasClears ?? 0)).toBe(firstClearCount);
  expect(
    await page.evaluate(() => window.__midUiAnimationFrames?.requested ?? 0),
  ).toBe(firstFrameCount);
  expect(await canvasSnapshot(page)).toBe(firstSnapshot);
});

test("settles immediately when reduced motion is enabled at runtime", async ({ page }) => {
  const root = page.locator("[data-mid-ui='constellation-type']");
  await expect(root).toHaveAttribute("data-motion", "active");
  const bounds = await root.boundingBox();

  await page.mouse.move(
    (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2,
    (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2,
  );
  await page.waitForTimeout(120);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await expect(root).toHaveAttribute("data-motion", "reduced");

  const settledSnapshot = await canvasSnapshot(page);
  const settledClearCount = await page.evaluate(() => window.__midUiCanvasClears ?? 0);
  const settledFrameCount = await page.evaluate(
    () => window.__midUiAnimationFrames?.requested ?? 0,
  );
  await page.waitForTimeout(400);

  expect(await canvasSnapshot(page)).toBe(settledSnapshot);
  expect(await page.evaluate(() => window.__midUiCanvasClears ?? 0)).toBe(
    settledClearCount,
  );
  expect(
    await page.evaluate(() => window.__midUiAnimationFrames?.requested ?? 0),
  ).toBe(settledFrameCount);
});

test("pauses for theme transitions and document visibility", async ({ page }) => {
  const root = page.locator("[data-mid-ui='constellation-type']");
  await expect(root).toHaveAttribute("data-motion", "active");
  const cancellationCount = await page.evaluate(
    () => window.__midUiAnimationFrames?.cancelled ?? 0,
  );

  await page.evaluate(() => window.dispatchEvent(new Event("mid-ui:theme-transition-start")));
  const transitionClearCount = await page.evaluate(() => window.__midUiCanvasClears ?? 0);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__midUiCanvasClears ?? 0)).toBe(
    transitionClearCount,
  );
  expect(
    await page.evaluate(() => window.__midUiAnimationFrames?.cancelled ?? 0),
  ).toBeGreaterThan(cancellationCount);

  await page.evaluate(() => window.dispatchEvent(new Event("mid-ui:theme-transition-end")));
  await expect.poll(async () => page.evaluate(() => window.__midUiCanvasClears ?? 0))
    .toBeGreaterThan(transitionClearCount);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(root).toHaveAttribute("data-motion", "paused");
  const hiddenClearCount = await page.evaluate(() => window.__midUiCanvasClears ?? 0);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__midUiCanvasClears ?? 0)).toBe(hiddenClearCount);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(root).toHaveAttribute("data-motion", "active");
  await expect.poll(async () => page.evaluate(() => window.__midUiCanvasClears ?? 0))
    .toBeGreaterThan(hiddenClearCount);
});

test("pauses offscreen and stops drawing across a complete remount", async ({ page }) => {
  const root = page.locator("[data-mid-ui='constellation-type']");
  await expect(root).toHaveAttribute("data-motion", "active");
  await root.evaluate((element) => {
    element.style.transform = "translateY(1600px)";
  });
  await expect(root).toHaveAttribute("data-motion", "paused");
  const pausedClearCount = await page.evaluate(() => window.__midUiCanvasClears ?? 0);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__midUiCanvasClears ?? 0)).toBe(pausedClearCount);

  await root.evaluate((element) => {
    element.style.transform = "";
  });
  await expect(root).toHaveAttribute("data-motion", "active");
  await expect.poll(async () => page.evaluate(() => window.__midUiCanvasClears ?? 0))
    .toBeGreaterThan(pausedClearCount);

  const disconnectsBeforeUnmount = await page.evaluate(
    () => window.__midUiObserverDisconnects,
  );
  const cancellationsBeforeUnmount = await page.evaluate(
    () => window.__midUiAnimationFrames?.cancelled ?? 0,
  );
  await page.getByRole("button", { name: "Unmount" }).click();
  const unmountedClearCount = await page.evaluate(() => window.__midUiCanvasClears ?? 0);
  const unmountedFrameCount = await page.evaluate(
    () => window.__midUiAnimationFrames?.requested ?? 0,
  );
  const disconnectsAfterUnmount = await page.evaluate(
    () => window.__midUiObserverDisconnects,
  );
  expect(disconnectsAfterUnmount?.intersection ?? 0).toBeGreaterThan(
    disconnectsBeforeUnmount?.intersection ?? 0,
  );
  expect(disconnectsAfterUnmount?.mutation ?? 0).toBeGreaterThan(
    disconnectsBeforeUnmount?.mutation ?? 0,
  );
  expect(disconnectsAfterUnmount?.resize ?? 0).toBeGreaterThan(
    disconnectsBeforeUnmount?.resize ?? 0,
  );
  expect(
    await page.evaluate(() => window.__midUiAnimationFrames?.cancelled ?? 0),
  ).toBeGreaterThan(cancellationsBeforeUnmount);

  await page.evaluate(() => {
    window.dispatchEvent(new Event("mid-ui:theme-transition-start"));
    window.dispatchEvent(new Event("mid-ui:theme-transition-end"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.__midUiCanvasClears ?? 0)).toBe(unmountedClearCount);
  expect(
    await page.evaluate(() => window.__midUiAnimationFrames?.requested ?? 0),
  ).toBe(unmountedFrameCount);

  await page.getByRole("button", { name: "Mount field" }).click();
  const remountedRoot = page.locator("[data-mid-ui='constellation-type']");
  await expect(remountedRoot).toHaveAttribute("data-ready", "true");
  await expect(remountedRoot).toHaveAttribute("data-motion", "active");
});

test("redraws the same lattice with the dark palette", async ({ page }) => {
  const root = page.locator("[data-mid-ui='constellation-type']");
  await page.getByTestId("rest-motion-input").fill("0");
  await page.getByTestId("dispersion-input").fill("0");
  const pointCount = await root.getAttribute("data-point-count");
  const lightSnapshot = await canvasSnapshot(page);

  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveAttribute("data-point-count", pointCount ?? "");
  await expect.poll(() => canvasSnapshot(page)).not.toBe(lightSnapshot);
});
