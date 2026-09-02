import { expect, test, type Locator, type Page } from "@playwright/test";

const ROUTE = "/components/scene-type";

function specimen(page: Page) {
  return page.getByTestId("scene-type-component");
}

function root(page: Page) {
  return specimen(page).locator(":scope > div");
}

function media(page: Page) {
  return page.getByTestId("scene-type-media");
}

async function mediaOffset(target: Locator) {
  const transform = (await target.getAttribute("transform")) ?? "";
  const match = transform.match(/translate\(([-\d.]+) ([-\d.]+)\)/);

  return {
    x: Number(match?.[1] ?? Number.NaN),
    y: Number(match?.[2] ?? Number.NaN),
  };
}

async function expectMediaMoving(target: Locator) {
  const before = await target.getAttribute("transform");

  await expect
    .poll(() => target.getAttribute("transform"), { timeout: 2_000 })
    .not.toBe(before);
}

async function expectMediaStill(target: Locator) {
  await new Promise((resolve) => setTimeout(resolve, 180));
  const before = await target.getAttribute("transform");
  await new Promise((resolve) => setTimeout(resolve, 380));
  expect(await target.getAttribute("transform")).toBe(before);
}

test("keeps semantic text while clipping the scene into a decorative SVG", async ({
  page,
}) => {
  await page.goto(ROUTE);

  await expect(page.getByRole("heading", { level: 2 })).toHaveText("FIELD NOTES");
  await expect(root(page)).toHaveAttribute("data-entered", "true");
  await expect(root(page).locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(root(page).locator("clipPath text")).toHaveText("FIELD NOTES");
  await expect(root(page).locator("image")).toHaveAttribute(
    "href",
    "/scene-type-atmosphere.svg",
  );
  await expect(root(page).locator("clipPath")).toHaveCount(1);
  await expectMediaMoving(media(page));
});

test("reconciles phrase, entrance, pointer depth, and idle drift controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalSetAttribute = Element.prototype.setAttribute;

    Object.defineProperty(window, "__sceneTransformWrites", {
      configurable: true,
      writable: true,
      value: 0,
    });
    Element.prototype.setAttribute = function setAttribute(name, value) {
      if (
        name === "transform" &&
        this.getAttribute("data-testid") === "scene-type-media"
      ) {
        (window as typeof window & { __sceneTransformWrites: number })
          .__sceneTransformWrites += 1;
      }

      return originalSetAttribute.call(this, name, value);
    };
  });
  await page.goto(ROUTE);
  await root(page).scrollIntoViewIfNeeded();

  const initialBounds = await root(page).boundingBox();
  await page.mouse.move(
    (initialBounds?.x ?? 0) + (initialBounds?.width ?? 0) * 0.82,
    (initialBounds?.y ?? 0) + (initialBounds?.height ?? 0) * 0.24,
  );
  await page.getByTestId("scene-toggle-depth").evaluate((button: HTMLElement) =>
    button.click(),
  );
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const driftWritesBefore = await page.evaluate(
    () =>
      (window as typeof window & { __sceneTransformWrites: number })
        .__sceneTransformWrites,
  );
  await new Promise((resolve) => setTimeout(resolve, 320));
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __sceneTransformWrites: number })
          .__sceneTransformWrites,
    ),
  ).toBeGreaterThan(driftWritesBefore);
  await page.getByTestId("scene-toggle-depth").evaluate((button: HTMLElement) =>
    button.click(),
  );

  await page.getByTestId("scene-toggle-drift").click();
  await expect(root(page)).toHaveAttribute("data-entered", "true");
  await expect
    .poll(async () => {
      const current = await mediaOffset(media(page));
      return Math.hypot(current.x, current.y);
    })
    .toBeLessThan(0.08);

  const bounds = await root(page).boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(
    (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.88,
    (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.22,
  );
  await expect
    .poll(async () => {
      const current = await mediaOffset(media(page));
      return Math.hypot(current.x, current.y);
    })
    .toBeGreaterThan(2);

  await page.getByTestId("scene-toggle-depth").evaluate((button: HTMLElement) =>
    button.click(),
  );
  await expect(root(page)).toHaveAttribute("data-entered", "true");
  await expect
    .poll(async () => {
      const current = await mediaOffset(media(page));
      return Math.hypot(current.x, current.y);
    })
    .toBeLessThan(0.08);

  await expect
    .poll(async () => {
      const before = await page.evaluate(
        () =>
          (window as typeof window & { __sceneTransformWrites: number })
            .__sceneTransformWrites,
      );
      await new Promise((resolve) => setTimeout(resolve, 140));
      const after = await page.evaluate(
        () =>
          (window as typeof window & { __sceneTransformWrites: number })
            .__sceneTransformWrites,
      );

      return after - before;
    })
    .toBe(0);

  await page.getByTestId("scene-change-phrase").click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("OPEN SIGNAL");
  await expect(root(page).locator("clipPath text")).toHaveText("OPEN SIGNAL");

  await page.getByTestId("scene-change-entrance").click();
  await expect(root(page)).toHaveAttribute("data-entrance", "rise");
  await expect(root(page)).toHaveAttribute("data-entered", "true");
});

test("pauses and resumes video media with visibility and motion preferences", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 260 });
  await page.goto(ROUTE);
  await page.getByTestId("scene-change-source").evaluate((button: HTMLElement) =>
    button.click(),
  );

  const video = root(page).locator("video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute("src", "/scene-type-atmosphere.webm");
  await expect(video).toHaveAttribute("poster", /^data:image\/svg\+xml/);
  expect(
    await video.evaluate((element: HTMLVideoElement) => ({
      autoPlay: element.autoplay,
      loop: element.loop,
      muted: element.muted,
      playsInline: element.playsInline,
    })),
  ).toEqual({ autoPlay: true, loop: true, muted: true, playsInline: true });

  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(true);
  await root(page).scrollIntoViewIfNeeded();
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(false);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(root(page)).toHaveAttribute("data-reduced-motion", "true");
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(true);
  await expect(video).toHaveCSS("opacity", "0");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(root(page)).toHaveAttribute("data-reduced-motion", "false");
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(false);

  await page.evaluate(() => scrollTo(0, 0));
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(true);
});

test("renders a sharp, static final composition for reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(ROUTE);

  await expect(root(page)).toHaveAttribute("data-entered", "true");
  await expect(root(page).locator("svg")).toHaveCSS("transform", "none");
  await expect(root(page).locator("svg")).toHaveCSS("transition-duration", "0s");

  const bounds = await root(page).boundingBox();
  await page.mouse.move(
    (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.9,
    (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.1,
  );
  await expectMediaStill(media(page));
  expect(await mediaOffset(media(page))).toEqual({ x: 0, y: 0 });
});

test("pauses outside the viewport and restarts after a complete remount", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalCancel = window.cancelAnimationFrame.bind(window);
    const originalDisconnect = IntersectionObserver.prototype.disconnect;

    Object.defineProperty(window, "__sceneCleanup", {
      configurable: true,
      value: { cancels: 0, disconnects: 0 },
    });
    window.cancelAnimationFrame = (handle: number) => {
      (window as typeof window & {
        __sceneCleanup: { cancels: number; disconnects: number };
      }).__sceneCleanup.cancels += 1;
      originalCancel(handle);
    };
    IntersectionObserver.prototype.disconnect = function disconnect() {
      (window as typeof window & {
        __sceneCleanup: { cancels: number; disconnects: number };
      }).__sceneCleanup.disconnects += 1;
      return originalDisconnect.call(this);
    };
  });
  await page.setViewportSize({ width: 900, height: 260 });
  await page.goto(ROUTE);

  await expectMediaStill(media(page));
  await root(page).scrollIntoViewIfNeeded();
  await expectMediaMoving(media(page));

  const cleanupBefore = await page.evaluate(
    () =>
      (window as typeof window & {
        __sceneCleanup: { cancels: number; disconnects: number };
      }).__sceneCleanup,
  );

  await page.getByTestId("scene-toggle-mounted").evaluate((button: HTMLElement) =>
    button.click(),
  );
  await expect(specimen(page)).toHaveCount(0);
  const cleanupAfter = await page.evaluate(
    () =>
      (window as typeof window & {
        __sceneCleanup: { cancels: number; disconnects: number };
      }).__sceneCleanup,
  );
  expect(cleanupAfter.cancels).toBeGreaterThan(cleanupBefore.cancels);
  expect(cleanupAfter.disconnects).toBeGreaterThan(cleanupBefore.disconnects);

  await page.getByTestId("scene-toggle-mounted").evaluate((button: HTMLElement) =>
    button.click(),
  );
  await expect(specimen(page)).toHaveCount(1);
  await root(page).scrollIntoViewIfNeeded();
  await expectMediaMoving(media(page));
});
