import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __midUiDetachedInkAnimations?: Animation[];
    __midUiResolveInkFonts?: () => void;
    __midUiInkObserverDisconnects?: {
      intersection: number;
      resize: number;
    };
    __midUiMotionQueries?: MediaQueryList[];
  }
}

const ROUTE = "/components/ink-trace";

function inkTrace(page: Page) {
  return page.locator("[data-mid-ui='ink-trace']");
}

async function setFastTiming(page: Page) {
  await page.getByTestId("trace-time-input").fill("180");
  await page.getByTestId("letter-delay-input").fill("0");
  await page.getByTestId("fill-wait-input").fill("0");
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await page.addInitScript(() => {
    localStorage.removeItem("mid-ui-theme");
    window.__midUiInkObserverDisconnects = {
      intersection: 0,
      resize: 0,
    };
    window.__midUiMotionQueries = [];

    const originalMatchMedia = window.matchMedia.bind(window);
    const NativeIntersectionObserver = window.IntersectionObserver;
    const NativeResizeObserver = window.ResizeObserver;

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
        if (window.__midUiInkObserverDisconnects) {
          window.__midUiInkObserverDisconnects.intersection += 1;
        }
        super.disconnect();
      }
    };
    window.ResizeObserver = class TrackingResizeObserver
      extends NativeResizeObserver {
      disconnect() {
        if (window.__midUiInkObserverDisconnects) {
          window.__midUiInkObserverDisconnects.resize += 1;
        }
        super.disconnect();
      }
    };
  });
  await page.goto(ROUTE);
});

test("traces measured SVG outlines, pools the fill, and exposes one heading", async ({
  page,
}) => {
  const root = inkTrace(page);
  const svg = root.locator("svg");
  const outlines = root.locator("[data-ink-outline]");

  await expect(root).toHaveAttribute("data-ready", "true");
  await expect(root).toHaveAttribute("data-unit-count", "15");
  await expect(svg).toHaveAttribute("aria-hidden", "true");
  await expect(root.getByRole("heading", { level: 2 })).toHaveText(
    "MARK THE MOMENT",
  );
  await expect(outlines).toHaveCount(15);
  await expect
    .poll(() =>
      outlines.evaluateAll((elements) =>
        elements.every(
          (element) => Number(element.getAttribute("data-trace-length")) >= 180,
        ),
      ),
    )
    .toBe(true);
  await expect(root).toHaveAttribute("data-phase", "complete", {
    timeout: 4_000,
  });

  await expect(root.locator("[data-ink-fill]")).toHaveCount(15);
  await expect(root.locator("[data-ink-pool]")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("rerenders phrase and sequencing in place with true reverse delays", async ({
  page,
}) => {
  const root = inkTrace(page);
  const svg = root.locator("svg");

  await root.evaluate((element) => {
    element.setAttribute("data-instance-proof", "retained");
  });
  await svg.evaluate((element) => {
    element.setAttribute("data-svg-proof", "retained");
  });
  await page.getByTestId("ink-trace-phrase").fill("INK");

  await expect(root.getByRole("heading", { level: 2 })).toHaveText("INK");
  await expect(root).toHaveAttribute("data-unit-count", "3");
  await expect(root).toHaveAttribute("data-instance-proof", "retained");
  await expect(svg).toHaveAttribute("data-svg-proof", "retained");

  await page.getByTestId("trace-time-input").fill("900");
  await page.getByTestId("letter-delay-input").fill("120");
  await page.getByTestId("sequence-input").selectOption("reverse");
  await expect(root).toHaveAttribute("data-phase", "running");
  const reverseDelays = await root.locator("[data-ink-outline]").evaluateAll(
    (elements) =>
      elements.map((element) => {
        const animation = element.getAnimations()[0];

        return Number(animation?.effect?.getTiming().delay ?? -1);
      }),
  );

  expect(reverseDelays).toEqual([240, 120, 0]);
  await page.getByTestId("sequence-input").selectOption("forward");
  await expect(root).toHaveAttribute("data-instance-proof", "retained");
  const forwardDelays = await root.locator("[data-ink-outline]").evaluateAll(
    (elements) =>
      elements.map((element) => {
        const animation = element.getAnimations()[0];

        return Number(animation?.effect?.getTiming().delay ?? -1);
      }),
  );

  expect(forwardDelays).toEqual([0, 120, 240]);
});

test("replays only on hover and again after the prior proof completes", async ({
  page,
}) => {
  await page.getByTestId("start-when-input").selectOption("hover");
  await setFastTiming(page);

  const root = inkTrace(page);

  await expect(root).toHaveAttribute("data-phase", "complete");
  await expect(root).toHaveAttribute("data-run", "0");
  await expect(root.locator("[data-ink-outline]").first()).toHaveCSS(
    "stroke-dashoffset",
    "0px",
  );
  await root.hover();
  await expect(root).toHaveAttribute("data-run", "1");
  await expect(root).toHaveAttribute("data-phase", "complete");

  await page.mouse.move(1, 1);
  await root.hover();
  await expect(root).toHaveAttribute("data-run", "2");
  await expect(root).toHaveAttribute("data-phase", "complete");
});

test("keeps hover mode readable without pointer access", async ({ page }) => {
  await page.getByTestId("start-when-input").focus();
  await page.getByTestId("start-when-input").selectOption("hover");
  await page.keyboard.press("Tab");

  const root = inkTrace(page);

  await expect(root).toHaveAttribute("data-phase", "complete");
  await expect(root).toHaveAttribute("data-run", "0");
  await expect(root.locator("[data-ink-outline]").first()).toHaveCSS(
    "stroke-dashoffset",
    "0px",
  );
  await expect(root.locator("[data-ink-fill]").first()).toHaveCSS(
    "opacity",
    "1",
  );
});

test("replays an early hover after delayed fonts become ready", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const delayedFonts = new Promise<void>((resolve) => {
      window.__midUiResolveInkFonts = resolve;
    });

    Object.defineProperty(document.fonts, "ready", {
      configurable: true,
      get: () => delayedFonts,
    });
  });
  await page.reload();
  await page.getByTestId("start-when-input").selectOption("hover");

  const root = inkTrace(page);

  await expect(root).toHaveAttribute("data-phase", "complete");
  await root.hover();
  await expect(root).toHaveAttribute("data-run", "0");
  await page.evaluate(() => window.__midUiResolveInkFonts?.());
  await expect(root).toHaveAttribute("data-run", "1");
  await expect(root).toHaveAttribute("data-phase", "complete", {
    timeout: 4_000,
  });
});

test("supports pool, fade, and outline-only final states", async ({ page }) => {
  const root = inkTrace(page);

  await setFastTiming(page);
  await expect(root).toHaveAttribute("data-phase", "complete");
  await expect(root.locator("[data-ink-fill]")).toHaveCount(15);
  await expect(root.locator("[data-ink-fill]").first()).toHaveCSS(
    "opacity",
    "1",
  );

  await page.getByTestId("fill-style-input").selectOption("fade");
  await expect(root).toHaveAttribute("data-fill", "fade");
  await expect(root).toHaveAttribute("data-phase", "complete");
  await expect(root.locator("[data-ink-fill]").first()).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(root.locator(`g[mask]`)).toHaveCount(0);

  await page.getByTestId("fill-style-input").selectOption("none");
  await expect(root).toHaveAttribute("data-fill", "none");
  await expect(root).toHaveAttribute("data-phase", "complete");
  await expect(root.locator("[data-ink-fill]")).toHaveCount(0);
  await expect(root.locator("[data-ink-outline]")).toHaveCount(15);
});

test("caps visual DOM for long copy without changing semantic text", async ({
  page,
}) => {
  const phrase = "INK ".repeat(20).trim();
  const root = inkTrace(page);

  await page.getByTestId("ink-trace-phrase").fill(phrase);
  await expect(root.getByRole("heading", { level: 2 })).toHaveText(phrase);
  await expect(root).toHaveAttribute("data-unit-count", "1");
  await expect(root.locator("[data-ink-outline]")).toHaveCount(1);
  await expect(root.locator("[data-ink-fill]")).toHaveCount(1);
});

test("omits empty semantic and visual text when copy is cleared", async ({
  page,
}) => {
  const root = inkTrace(page);

  await page.getByTestId("ink-trace-phrase").fill("");
  await expect(root).toHaveAttribute("data-unit-count", "0");
  await expect(root.getByRole("heading")).toHaveCount(0);
  await expect(root.locator("[data-ink-outline]")).toHaveCount(0);
  await expect(root.locator("[data-ink-fill]")).toHaveCount(0);
});

test("renders the final requested state immediately for reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();

  const root = inkTrace(page);

  await expect(root).toHaveAttribute("data-ready", "true");
  await expect(root).toHaveAttribute("data-phase", "reduced");
  await expect(root.locator("[data-ink-outline]").first()).toHaveCSS(
    "stroke-dashoffset",
    "0px",
  );
  expect(
    await root.evaluate((element) =>
      element.getAnimations({ subtree: true }).length,
    ),
  ).toBe(0);
});

test("settles an active proof when reduced motion begins at runtime", async ({
  page,
}) => {
  const root = inkTrace(page);

  await page.getByTestId("trace-time-input").fill("1600");
  await page.getByTestId("letter-delay-input").fill("120");
  await page.getByRole("button", { name: "Pull new proof" }).click();
  await expect(root).toHaveAttribute("data-phase", "running");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    for (const query of window.__midUiMotionQueries ?? []) {
      query.dispatchEvent(new Event("change"));
    }
  });
  await expect(root).toHaveAttribute("data-phase", "reduced");
  await expect(root.locator("[data-ink-outline]").last()).toHaveCSS(
    "stroke-dashoffset",
    "0px",
  );
  expect(
    await root.evaluate((element) =>
      element.getAnimations({ subtree: true }).length,
    ),
  ).toBe(0);
});

test("pauses active timelines for theme transitions and document visibility", async ({
  page,
}) => {
  const root = inkTrace(page);

  await page.getByTestId("trace-time-input").fill("1600");
  await page.getByTestId("letter-delay-input").fill("120");
  await page.getByRole("button", { name: "Pull new proof" }).click();
  await expect(root).toHaveAttribute("data-phase", "running");

  await page.evaluate(() => {
    window.dispatchEvent(new Event("mid-ui:theme-transition-start"));
  });
  await expect(root).toHaveAttribute("data-phase", "paused");
  const pausedTimes = await root.evaluate((element) =>
    element
      .getAnimations({ subtree: true })
      .map((animation) => animation.currentTime),
  );
  await page.waitForTimeout(250);
  expect(
    await root.evaluate((element) =>
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.currentTime),
    ),
  ).toEqual(pausedTimes);

  await page.evaluate(() => {
    window.dispatchEvent(new Event("mid-ui:theme-transition-end"));
  });
  await expect(root).toHaveAttribute("data-phase", "running");

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(root).toHaveAttribute("data-phase", "paused");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(root).toHaveAttribute("data-phase", "running");
});

test("runs visible mode once, pauses offscreen, and cleans up on unmount", async ({
  page,
}) => {
  await page.getByTestId("trace-time-input").fill("1600");
  await page.getByTestId("letter-delay-input").fill("80");
  await page.getByRole("button", { name: "Lift plate" }).click();
  const stage = page.getByTestId("ink-trace-stage");

  await stage.evaluate((element) => {
    element.style.transform = "translateY(1800px)";
  });
  await page.getByRole("button", { name: "Set plate" }).click();

  const root = inkTrace(page);

  await expect(root).toHaveAttribute("data-ready", "true");
  await expect(root).toHaveAttribute("data-run", "0");
  await stage.evaluate((element) => {
    element.style.transform = "";
  });
  await expect(root).toHaveAttribute("data-phase", "running");
  await expect(root).toHaveAttribute("data-run", "1");

  await stage.evaluate((element) => {
    element.style.transform = "translateY(1800px)";
  });
  await expect(root).toHaveAttribute("data-phase", "paused");
  await stage.evaluate((element) => {
    element.style.transform = "";
  });
  await expect(root).toHaveAttribute("data-phase", "running");
  await expect(root).toHaveAttribute("data-run", "1");

  const disconnectsBefore = await page.evaluate(
    () => window.__midUiInkObserverDisconnects,
  );
  await root.evaluate((element) => {
    window.__midUiDetachedInkAnimations = element.getAnimations({
      subtree: true,
    });
  });
  await page.getByRole("button", { name: "Lift plate" }).click();
  await expect(root).toHaveCount(0);
  const disconnectsAfter = await page.evaluate(
    () => window.__midUiInkObserverDisconnects,
  );

  expect(disconnectsAfter?.intersection ?? 0).toBeGreaterThan(
    disconnectsBefore?.intersection ?? 0,
  );
  expect(disconnectsAfter?.resize ?? 0).toBeGreaterThan(
    disconnectsBefore?.resize ?? 0,
  );
  expect(
    await page.evaluate(() =>
      (window.__midUiDetachedInkAnimations ?? []).every(
        (animation) => animation.playState === "idle",
      ),
    ),
  ).toBe(true);

  await page.evaluate(() => {
    window.dispatchEvent(new Event("mid-ui:theme-transition-start"));
    window.dispatchEvent(new Event("mid-ui:theme-transition-end"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
});

test("changes palette without changing SVG geometry and stays inside mobile", async ({
  page,
}) => {
  const root = inkTrace(page);
  const outline = root.locator("[data-ink-outline]").first();
  const geometry = await outline.evaluate((element: SVGTextElement) => ({
    traceLength: element.dataset.traceLength,
    x: element.getAttribute("x"),
    y: element.getAttribute("y"),
  }));
  const lightStroke = await outline.evaluate(
    (element) => getComputedStyle(element).stroke,
  );

  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkStroke = await outline.evaluate(
    (element) => getComputedStyle(element).stroke,
  );

  expect(darkStroke).not.toBe(lightStroke);
  expect(
    await outline.evaluate((element: SVGTextElement) => ({
      traceLength: element.dataset.traceLength,
      x: element.getAttribute("x"),
      y: element.getAttribute("y"),
    })),
  ).toEqual(geometry);

  await page.setViewportSize({ width: 390, height: 844 });
  const rootBounds = await root.boundingBox();
  const stageBounds = await page.getByTestId("ink-trace-stage").boundingBox();

  expect(rootBounds?.width ?? 0).toBeLessThanOrEqual(stageBounds?.width ?? 0);
  expect(rootBounds?.x ?? 0).toBeGreaterThanOrEqual(stageBounds?.x ?? 0);
});
