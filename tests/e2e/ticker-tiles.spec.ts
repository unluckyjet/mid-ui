import { expect, test, type Page } from "@playwright/test";

const ROUTE = "/components/ticker-tiles";

function ticker(page: Page) {
  return page.locator("[data-ticker-tiles]");
}

function livePhrase(page: Page) {
  return page.locator("[data-ticker-live]");
}

async function setFastTiming(
  page: Page,
  options: Readonly<{
    changeTime?: string;
    stepTime?: string;
    cascade?: string;
  }> = {},
) {
  await page
    .getByTestId("change-time-input")
    .fill(options.changeTime ?? "400");
  await page
    .getByTestId("step-time-input")
    .fill(options.stepTime ?? "32");
  await page
    .getByTestId("cascade-input")
    .fill(options.cascade ?? "0");
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await page.addInitScript(() => localStorage.removeItem("mid-ui-theme"));
  await page.goto(ROUTE);
});

test("announces only settled phrases and leaves unchanged slots still", async ({
  page,
}) => {
  await setFastTiming(page, { stepTime: "80", cascade: "40" });
  await page.getByRole("button", { name: "Restart sequence" }).click();

  const root = ticker(page);
  const live = livePhrase(page);

  await expect(root.locator("ol")).toHaveAttribute("aria-hidden", "true");
  await expect(live).toHaveAttribute("aria-live", "polite");
  await expect(live).toHaveText("MADE BY HAND");
  await expect(root.locator("[data-slot]")).toHaveCount(12);

  await page.evaluate(() => {
    const liveRegion = document.querySelector("[data-ticker-live]");

    document.documentElement.dataset.tickerAnnouncements = "[]";
    new MutationObserver(() => {
      const values = JSON.parse(
        document.documentElement.dataset.tickerAnnouncements ?? "[]",
      ) as string[];
      const value = liveRegion?.textContent ?? "";

      if (value && values.at(-1) !== value) {
        values.push(value);
        document.documentElement.dataset.tickerAnnouncements =
          JSON.stringify(values);
      }
    }).observe(liveRegion!, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  });

  await expect
    .poll(() => root.locator('[data-changing="true"]').count())
    .toBeGreaterThan(0);

  for (let index = 0; index < 5; index += 1) {
    const slot = root.locator(`[data-slot="${index}"]`);

    await expect(slot).toHaveAttribute("data-changing", "false");
  }

  await expect(live).toHaveText("MADE TO MOVE");
  expect(
    await page.evaluate(() =>
      JSON.parse(
        document.documentElement.dataset.tickerAnnouncements ?? "[]",
      ),
    ),
  ).toEqual(["MADE TO MOVE"]);
});

test("replays the same deterministic intermediate glyph sequence", async ({
  page,
}) => {
  await page.getByTestId("ticker-phrases").fill("AAAA\nBBBB");
  await setFastTiming(page, { stepTime: "64", cascade: "0" });
  await page.getByTestId("repeat-input").uncheck();

  async function captureSequence() {
    await page.evaluate(() => {
      const slot = document.querySelector('[data-slot="0"]');

      document.documentElement.dataset.tickerGlyphs = "[]";
      new MutationObserver(() => {
        const values = JSON.parse(
          document.documentElement.dataset.tickerGlyphs ?? "[]",
        ) as string[];
        const value = slot?.getAttribute("data-character") ?? "";

        if (value && values.at(-1) !== value) {
          values.push(value);
          document.documentElement.dataset.tickerGlyphs =
            JSON.stringify(values);
        }
      }).observe(slot!, {
        attributes: true,
        attributeFilter: ["data-character"],
      });
    });

    await expect(livePhrase(page)).toHaveText("BBBB");

    return page.evaluate(
      () =>
        JSON.parse(
          document.documentElement.dataset.tickerGlyphs ?? "[]",
        ) as string[],
    );
  }

  await page.getByRole("button", { name: "Restart sequence" }).click();
  const firstSequence = await captureSequence();

  await page.getByRole("button", { name: "Restart sequence" }).click();
  await expect(livePhrase(page)).toHaveText("AAAA");
  const secondSequence = await captureSequence();

  expect(firstSequence.length).toBeGreaterThan(2);
  expect(secondSequence).toEqual(firstSequence);
});

test("walks every step of a seven-glyph custom alphabet and preserves spaces", async ({
  page,
}) => {
  await page.getByTestId("ticker-phrases").fill("  X  \n  Y  ");
  await page.getByTestId("ticker-alphabet").fill("ABCDEFG");
  await setFastTiming(page, { stepTime: "64", cascade: "0" });
  await page.getByTestId("repeat-input").uncheck();
  await page.getByRole("button", { name: "Restart sequence" }).click();

  await expect
    .poll(() => livePhrase(page).evaluate((element) => element.textContent))
    .toBe("  X  ");
  await page.evaluate(() => {
    const slot = document.querySelector('[data-slot="2"]');

    document.documentElement.dataset.customAlphabetGlyphs = "[]";
    new MutationObserver(() => {
      const values = JSON.parse(
        document.documentElement.dataset.customAlphabetGlyphs ?? "[]",
      ) as string[];
      const value = slot?.getAttribute("data-character") ?? "";

      if (value && values.at(-1) !== value) {
        values.push(value);
        document.documentElement.dataset.customAlphabetGlyphs =
          JSON.stringify(values);
      }
    }).observe(slot!, {
      attributes: true,
      attributeFilter: ["data-character"],
    });
  });

  await expect
    .poll(() => livePhrase(page).evaluate((element) => element.textContent))
    .toBe("  Y  ");
  const intermediateGlyphs = await page.evaluate(
    () =>
      JSON.parse(
        document.documentElement.dataset.customAlphabetGlyphs ?? "[]",
      ) as string[],
  );
  const visitedAlphabetGlyphs = new Set(
    intermediateGlyphs.filter((glyph) => "ABCDEFG".includes(glyph)),
  );

  expect(visitedAlphabetGlyphs.size).toBeGreaterThanOrEqual(6);
  await expect(ticker(page).locator('[data-slot="0"]')).toHaveAttribute(
    "data-character",
    " ",
  );
  await expect(ticker(page).locator('[data-slot="4"]')).toHaveAttribute(
    "data-character",
    " ",
  );
});

test("pauses its current timer while the document is hidden", async ({
  page,
}) => {
  await setFastTiming(page);
  await page.getByRole("button", { name: "Restart sequence" }).click();
  await expect(livePhrase(page)).toHaveText("MADE BY HAND");

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(900);
  await expect(livePhrase(page)).toHaveText("MADE BY HAND");

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(livePhrase(page)).toHaveText("MADE TO MOVE");
});

test("settles the complete target immediately when reduced motion begins", async ({
  page,
}) => {
  await setFastTiming(page, { stepTime: "80", cascade: "40" });
  await page.getByRole("button", { name: "Restart sequence" }).click();

  const root = ticker(page);

  await expect
    .poll(() => root.locator('[data-changing="true"]').count())
    .toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await expect(livePhrase(page)).toHaveText("MADE TO MOVE");
  await expect(root.locator('[data-changing="true"]')).toHaveCount(0);
  await expect(root.locator("[data-slot]").first()).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("honors a single run and preserves card geometry across themes", async ({
  page,
}) => {
  await setFastTiming(page);
  await page.getByTestId("repeat-input").uncheck();
  await page.getByRole("button", { name: "Restart sequence" }).click();

  const root = ticker(page);
  const firstTile = root.locator("[data-slot]").first();
  const lightBackground = await firstTile.evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  );
  const slotCount = await root.locator("[data-slot]").count();

  await expect(livePhrase(page)).toHaveText("MADE FOR YOU", {
    timeout: 4_000,
  });
  await page.waitForTimeout(900);
  await expect(livePhrase(page)).toHaveText("MADE FOR YOU");

  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkBackground = await firstTile.evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  );

  expect(darkBackground).not.toBe(lightBackground);
  await expect(root.locator("[data-slot]")).toHaveCount(slotCount);
});

test("fits the maximum slot budget without clipping glyphs on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("ticker-phrases").fill(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
  );

  const root = ticker(page);
  const slots = root.locator("[data-slot]");

  await expect(slots).toHaveCount(32);
  expect(
    await slots.evaluateAll((elements) =>
      elements.some((element) => {
        const tileBounds = element.getBoundingClientRect();
        const glyphBounds = element
          .querySelector("span")
          ?.getBoundingClientRect();

        return (glyphBounds?.width ?? 0) > tileBounds.width + 0.5;
      }),
    ),
  ).toBe(false);

  const rootBounds = await root.boundingBox();

  expect(rootBounds?.width ?? 0).toBeLessThanOrEqual(390);
});

test("rerenders phrases in place and cancels timer work on unmount", async ({
  page,
}) => {
  const root = ticker(page);

  await root.evaluate((element) => {
    element.setAttribute("data-instance-proof", "preserved");
  });
  await page.getByTestId("ticker-phrases").fill("ALPHA\nOMEGA");
  await setFastTiming(page, { stepTime: "64", cascade: "0" });
  await expect(root).toHaveAttribute("data-instance-proof", "preserved");
  await expect(livePhrase(page)).toHaveText("ALPHA");
  await page.getByRole("button", { name: "Restart sequence" }).click();
  await expect
    .poll(() => root.locator('[data-changing="true"]').count())
    .toBeGreaterThan(0);

  await root.evaluate((element) => {
    document.documentElement.dataset.detachedTickerMutations = "0";
    const observer = new MutationObserver(() => {
      const current = Number.parseInt(
        document.documentElement.dataset.detachedTickerMutations ?? "0",
        10,
      );
      document.documentElement.dataset.detachedTickerMutations = String(
        current + 1,
      );
    });

    observer.observe(element, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  });
  await page.getByRole("button", { name: "Unmount" }).click();
  await expect(ticker(page)).toHaveCount(0);
  const mutationsAfterUnmount = await page.evaluate(
    () => document.documentElement.dataset.detachedTickerMutations ?? "0",
  );

  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(900);
  expect(
    await page.evaluate(
      () => document.documentElement.dataset.detachedTickerMutations ?? "0",
    ),
  ).toBe(mutationsAfterUnmount);
});
