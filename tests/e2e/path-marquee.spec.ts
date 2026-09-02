import { expect, test, type Locator, type Page } from "@playwright/test";

const ROUTE = "/components/path-marquee";

function specimen(page: Page) {
  return page.getByTestId("marquee-component");
}

function root(page: Page) {
  return specimen(page).locator(":scope > div");
}

function primaryCopy(page: Page) {
  return specimen(page).locator("textPath").first();
}

async function offset(copy: Locator) {
  return Number.parseFloat((await copy.getAttribute("startOffset")) ?? "NaN");
}

async function expectMoving(copy: Locator) {
  const before = await offset(copy);

  await expect
    .poll(async () => Math.abs((await offset(copy)) - before), {
      timeout: 2_000,
    })
    .toBeGreaterThan(0.08);
}

async function expectStill(copy: Locator) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const before = await offset(copy);
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(await offset(copy)).toBeCloseTo(before, 3);
}

async function expectExactGeometry(page: Page) {
  const path = specimen(page).locator("defs path");
  const renderedText = specimen(page).locator("g text").first();

  await expect
    .poll(async () => Number(await renderedText.getAttribute("textLength")), {
      timeout: 3_000,
    })
    .toBeGreaterThan(1);

  const pathLength = await path.evaluate((element) =>
    (element as SVGPathElement).getTotalLength(),
  );
  const textLength = Number(await renderedText.getAttribute("textLength"));

  expect(textLength).toBeCloseTo(pathLength, 5);
}

test("measures live contours and restarts cleanly after content changes", async ({
  page,
}) => {
  await page.goto(ROUTE);
  await expectExactGeometry(page);
  await expectMoving(primaryCopy(page));

  await page.getByTestId("change-phrase").click();
  expect(Math.abs(await offset(primaryCopy(page)))).toBeLessThan(1);
  await expectMoving(primaryCopy(page));

  await page.getByTestId("change-contour").click();
  expect(Math.abs(await offset(primaryCopy(page)))).toBeLessThan(1);
  await expectExactGeometry(page);
  await expectMoving(primaryCopy(page));

  const [first, second] = await specimen(page)
    .locator("textPath")
    .evaluateAll((copies) =>
      copies.slice(0, 2).map((copy) =>
        Number.parseFloat(copy.getAttribute("startOffset") ?? "NaN"),
      ),
    );
  expect(second - first).toBeCloseTo(100, 5);
});

test("does not retain stale hover state when motion controls change", async ({
  page,
}) => {
  await page.goto(ROUTE);
  await expectMoving(primaryCopy(page));

  await root(page).hover();
  await expectStill(primaryCopy(page));

  await page.getByTestId("toggle-motion").evaluate((button: HTMLElement) =>
    button.click(),
  );
  await page.mouse.move(8, 8);
  await page.getByTestId("toggle-motion").evaluate((button: HTMLElement) =>
    button.click(),
  );
  await expectMoving(primaryCopy(page));

  await root(page).hover();
  await expectStill(primaryCopy(page));
  await page
    .getByTestId("toggle-hover-pause")
    .evaluate((button: HTMLElement) => button.click());
  await expectMoving(primaryCopy(page));

  await page.mouse.move(8, 8);
  await page
    .getByTestId("toggle-hover-pause")
    .evaluate((button: HTMLElement) => button.click());
  await expectMoving(primaryCopy(page));
});

test("honors reduced motion and resumes when the preference changes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(ROUTE);

  await expect(root(page)).not.toHaveAttribute("tabindex", "0");
  await expect(specimen(page).locator("g text").nth(1)).toHaveCSS(
    "display",
    "none",
  );
  await expectStill(primaryCopy(page));
  expect(await offset(primaryCopy(page))).toBeCloseTo(0, 5);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(root(page)).toHaveAttribute("tabindex", "0");
  await expectMoving(primaryCopy(page));
});

test("pauses offscreen and restarts after a full remount", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 250 });
  await page.goto(ROUTE);

  await expectStill(primaryCopy(page));
  await root(page).scrollIntoViewIfNeeded();
  await expectMoving(primaryCopy(page));

  await page.getByTestId("toggle-mounted").evaluate((button: HTMLElement) =>
    button.click(),
  );
  await expect(specimen(page)).toHaveCount(0);

  await page.getByTestId("toggle-mounted").evaluate((button: HTMLElement) =>
    button.click(),
  );
  await expect(specimen(page)).toHaveCount(1);
  await expectMoving(primaryCopy(page));
});
