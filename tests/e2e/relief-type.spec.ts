import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __reliefFrames?: { requested: number; cancelled: number };
    __reliefObserverDisconnects?: number;
  }
}

const root = (page: Page) => page.locator("[data-mid-ui='relief-type']");
const motion = (page: Page) => page.getByTestId("relief-motion");

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    localStorage.removeItem("mid-ui-theme");
    window.__reliefFrames = { requested: 0, cancelled: 0 };
    window.__reliefObserverDisconnects = 0;
    const nativeRequest = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    const NativeIntersectionObserver = window.IntersectionObserver;

    window.requestAnimationFrame = (callback) => {
      if (window.__reliefFrames) window.__reliefFrames.requested += 1;
      return nativeRequest(callback);
    };
    window.cancelAnimationFrame = (handle) => {
      if (window.__reliefFrames) window.__reliefFrames.cancelled += 1;
      return nativeCancel(handle);
    };
    window.IntersectionObserver = class TrackingObserver extends NativeIntersectionObserver {
      disconnect() {
        window.__reliefObserverDisconnects = (window.__reliefObserverDisconnects ?? 0) + 1;
        super.disconnect();
      }
    };
  });
  await page.goto("/components/relief-type");
});

test("renders a bounded nonlinear depth stack with one semantic heading", async ({ page }) => {
  const component = root(page);
  const layers = component.locator("[data-layer]");

  await expect(component).toHaveAttribute("data-layer-count", "9");
  await expect(layers).toHaveCount(9);
  await expect(component.locator("[data-terminal='true']")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "CUT DEEP", level: 2 })).toHaveCount(1);
  await expect(motion(page)).toHaveAttribute("aria-hidden", "true");

  const offsets = await layers.evaluateAll((nodes) =>
    nodes.map((node) => Number.parseFloat((node as HTMLElement).style.getPropertyValue("--layer-x"))),
  );
  expect(offsets).toHaveLength(9);
  expect(offsets[8]).toBeGreaterThan(offsets[7]);
  expect(offsets[7] - offsets[6]).toBeGreaterThan(offsets[1] - offsets[0]);
});

test("rerenders phrase, layers, step, and shadow on the same root", async ({ page }) => {
  const component = root(page);
  await component.evaluate((element) => { element.setAttribute("data-identity", "retained"); });

  await page.getByTestId("relief-layers").fill("14");
  await expect(component).toHaveAttribute("data-layer-count", "14");
  await expect(component.locator("[data-layer]")).toHaveCount(14);
  await page.getByTestId("relief-step").fill("5");
  await expect(component.locator("[data-terminal='true']")).toHaveCSS("transform", /matrix/);
  await page.getByTestId("relief-phrase").click();
  await expect(page.getByRole("heading", { name: "RAISED INK", level: 2 })).toHaveCount(1);
  await expect(component).toHaveAttribute("data-identity", "retained");

  const terminal = component.locator("[data-terminal='true']");
  await expect(terminal).not.toHaveCSS("text-shadow", "none");
  await page.getByTestId("relief-shadow").click();
  await expect(terminal).toHaveCSS("text-shadow", "none");
});

test("smooths pointer tilt and fully stops after exit or cancellation with orbit disabled", async ({ page }) => {
  await page.getByTestId("relief-orbit").fill("0");
  const component = root(page);
  const bounds = await component.boundingBox();
  expect(bounds).not.toBeNull();

  await page.mouse.move((bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.9, (bounds?.y ?? 0) + 4);
  await expect.poll(async () => Number(await motion(page).getAttribute("data-motion-x"))).toBeGreaterThan(0.25);
  await expect.poll(async () => Number(await motion(page).getAttribute("data-motion-y"))).toBeLessThan(-0.25);
  await expect(motion(page)).not.toHaveCSS("transform", "none");

  await page.waitForTimeout(1200);
  const heldFrames = await component.getAttribute("data-frame-count");
  await page.waitForTimeout(350);
  await expect(component).toHaveAttribute("data-frame-count", heldFrames ?? "");

  await component.dispatchEvent("pointercancel");
  await expect(motion(page)).toHaveAttribute("data-motion-x", "0.000", { timeout: 3000 });
  await expect(motion(page)).toHaveAttribute("data-motion-y", "0.000", { timeout: 3000 });
  const settledFrames = await component.getAttribute("data-frame-count");
  await page.waitForTimeout(1100);
  await expect(component).toHaveAttribute("data-frame-count", settledFrames ?? "");
});

test("uses a fixed two-tone relief for initial and runtime reduced motion", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.reload();
  const component = root(page);

  await expect(component).toHaveAttribute("data-motion", "reduced");
  await expect(component).toHaveAttribute("data-reduced-motion", "true");
  await expect(motion(page)).toHaveCSS("transform", "none");
  const hiddenLayers = await component.locator("[data-layer]:not([data-terminal='true'])").evaluateAll((nodes) =>
    nodes.every((node) => getComputedStyle(node).display === "none"),
  );
  expect(hiddenLayers).toBe(true);
  const fixedTransform = await motion(page).getAttribute("style");
  const frameCount = await page.evaluate(() => window.__reliefFrames?.requested ?? 0);
  await page.mouse.move(260, 560);
  await page.waitForTimeout(250);
  expect(await motion(page).getAttribute("style")).toBe(fixedTransform);
  expect(await page.evaluate(() => window.__reliefFrames?.requested ?? 0)).toBe(frameCount);

  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await expect(component).toHaveAttribute("data-motion", "active");
  await page.mouse.move(270, 570);
  await expect.poll(async () => Math.abs(Number(await motion(page).getAttribute("data-motion-x")))).toBeGreaterThan(0.05);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await expect(component).toHaveAttribute("data-motion", "reduced");
  await expect(motion(page)).toHaveAttribute("data-motion-x", "0.000");
  await expect(motion(page)).toHaveAttribute("data-motion-y", "0.000");
});

test("pauses for theme transitions, document visibility, and offscreen state", async ({ page }) => {
  const component = root(page);
  await expect(component).toHaveAttribute("data-motion", "active");
  const bounds = await component.boundingBox();
  await page.mouse.move((bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.8, (bounds?.y ?? 0) + 5);
  await expect.poll(async () => Math.abs(Number(await motion(page).getAttribute("data-motion-x")))).toBeGreaterThan(0.15);
  await page.evaluate(() => window.dispatchEvent(new Event("mid-ui:theme-transition-start")));
  await expect(component).toHaveAttribute("data-motion", "paused");
  const frozenStyle = await motion(page).getAttribute("style");
  await page.waitForTimeout(220);
  expect(await motion(page).getAttribute("style")).toBe(frozenStyle);
  await page.evaluate(() => window.dispatchEvent(new Event("mid-ui:theme-transition-end")));
  await expect(component).toHaveAttribute("data-motion", "active");

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(component).toHaveAttribute("data-motion", "paused");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(component).toHaveAttribute("data-motion", "active");

  await component.evaluate((element) => { (element as HTMLElement).style.transform = "translateY(1800px)"; });
  await expect(component).toHaveAttribute("data-motion", "paused");
  await component.evaluate((element) => { (element as HTMLElement).style.transform = ""; });
  await expect(component).toHaveAttribute("data-motion", "active");
});

test("cleans animation and observer work across a full unmount", async ({ page }) => {
  const component = root(page);
  const bounds = await component.boundingBox();
  await page.mouse.move((bounds?.x ?? 0) + 12, (bounds?.y ?? 0) + 8);
  await expect.poll(async () => page.evaluate(() => window.__reliefFrames?.requested ?? 0)).toBeGreaterThan(0);
  const disconnects = await page.evaluate(() => window.__reliefObserverDisconnects ?? 0);
  const cancelled = await page.evaluate(() => window.__reliefFrames?.cancelled ?? 0);

  await page.getByTestId("relief-mounted").click();
  await expect(component).toHaveCount(0);
  expect(await page.evaluate(() => window.__reliefObserverDisconnects ?? 0)).toBeGreaterThan(disconnects);
  expect(await page.evaluate(() => window.__reliefFrames?.cancelled ?? 0)).toBeGreaterThan(cancelled);
  const requestedAfterUnmount = await page.evaluate(() => window.__reliefFrames?.requested ?? 0);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("mid-ui:theme-transition-start"));
    window.dispatchEvent(new Event("mid-ui:theme-transition-end"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(1100);
  expect(await page.evaluate(() => window.__reliefFrames?.requested ?? 0)).toBe(requestedAfterUnmount);
});

test("switches theme palette without changing geometry and contains the mobile proof", async ({ page }) => {
  await page.getByTestId("relief-orbit").fill("0");
  const component = root(page);
  const lightGeometry = await component.locator("[data-layer]").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).style.cssText),
  );
  const lightFace = await page.getByTestId("relief-face").evaluate((node) => getComputedStyle(node).color);

  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  const darkFace = await page.getByTestId("relief-face").evaluate((node) => getComputedStyle(node).color);
  const darkGeometry = await component.locator("[data-layer]").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).style.cssText),
  );
  expect(darkFace).not.toBe(lightFace);
  expect(darkGeometry).toEqual(lightGeometry);

  await page.setViewportSize({ width: 390, height: 844 });
  const stageBox = await page.getByTestId("relief-stage").boundingBox();
  const componentBox = await component.boundingBox();
  expect(stageBox).not.toBeNull();
  expect(componentBox).not.toBeNull();
  expect((componentBox?.x ?? 0) + (componentBox?.width ?? 0)).toBeLessThanOrEqual((stageBox?.x ?? 0) + (stageBox?.width ?? 0) + 1);
  expect(componentBox?.x ?? 0).toBeGreaterThanOrEqual((stageBox?.x ?? 0) - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
