import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.addInitScript(() => localStorage.removeItem("mid-ui-theme"));
  await page.goto("/");
});

test("exposes the active theme and target action", async ({ page }) => {
  const toggle = page.getByRole("switch");

  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(toggle).toHaveAccessibleName("Dark mode");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(toggle).toHaveAccessibleName("Dark mode");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("remains responsive across repeated wave transitions", async ({ page }) => {
  const toggle = page.getByRole("switch");
  const root = page.locator("html");

  await page.evaluate(() => {
    document.documentElement.dataset.completedThemeTransitions = "0";
    window.addEventListener("mid-ui:theme-transition-end", () => {
      const completed = Number.parseInt(
        document.documentElement.dataset.completedThemeTransitions ?? "0",
        10,
      );
      document.documentElement.dataset.completedThemeTransitions = String(
        completed + 1,
      );
    });
  });

  for (const [index, expectedTheme] of [
    "dark",
    "light",
    "dark",
    "light",
  ].entries()) {
    await toggle.click();
    await expect(root).toHaveAttribute("data-theme", expectedTheme);
    await expect(root).toHaveAttribute(
      "data-completed-theme-transitions",
      String(index + 1),
    );
  }

  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(toggle).toHaveAccessibleName("Dark mode");
});

test("switches immediately when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.reload();
  await page.evaluate(() => {
    document.documentElement.dataset.themeTransitionStarted = "false";
    window.addEventListener("mid-ui:theme-transition-start", () => {
      document.documentElement.dataset.themeTransitionStarted = "true";
    });
  });

  const toggle = page.getByRole("switch");
  await toggle.click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-transition-started",
    "false",
  );
  await expect(toggle).toHaveAttribute("aria-checked", "true");
});
