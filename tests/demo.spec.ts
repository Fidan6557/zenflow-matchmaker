import { test, expect, type Page } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function ready(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start simulation", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Behavioral risk over time" }),
  ).toBeVisible();
}

test("desktop loads real inference, healthy console, screenshot and responsive layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      errors.push(message.text());
  });
  await ready(page);
  await expect(page).toHaveTitle("Zen-Flow Matchmaker");
  await expect(
    page.getByText("SIMULATED ENVIRONMENT", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".recharts-surface")).toBeVisible();
  await expect(page.locator(".avatar-large img")).toBeVisible();
  expect(
    await page
      .locator(".avatar-large img")
      .evaluate((el) => (el as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await page.screenshot({
    path: join(tmpdir(), "zen-flow-desktop.png"),
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("simulation advances, pauses, applies recovery and resets exactly", async ({
  page,
}) => {
  await ready(page);
  const initial = Number(await page.getByTestId("risk-score").innerText());
  await page
    .getByRole("button", { name: "Start simulation", exact: true })
    .click();
  await expect(page.getByTestId("tick")).not.toHaveText("Window 11");
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Step +15s" })).toBeEnabled();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("tick")).toHaveText("Window 11");
  await page.getByLabel("Scenario", { exact: true }).selectOption("recovery");
  for (let i = 0; i < 8; i++) {
    await page.getByRole("button", { name: "Step +15s" }).click();
    await expect(page.getByTestId("tick")).toHaveText(`Window ${12 + i}`);
    await expect(page.getByRole("button", { name: "Step +15s" })).toBeEnabled();
  }
  expect(Number(await page.getByTestId("risk-score").innerText())).toBeLessThan(
    initial - 30,
  );
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("risk-score")).toHaveText(String(initial));
  await expect(page.getByTestId("tick")).toHaveText("Window 11");
});

test("chat classifier updates profile, filter and player selection work", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Toxic", exact: true }).click();
  await page.getByRole("button", { name: "Analyze message" }).click();
  await expect(page.getByTestId("chat-result")).toContainText("NOVA: toxic");
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByTestId("event-feed")).toContainText(
    "my teammates are trash",
  );
  await page.getByLabel("Select player", { exact: true }).selectOption("p03");
  await expect(page.locator(".profile-identity h3")).toHaveText("SAGE");
  await page.getByRole("button", { name: "Supportive", exact: true }).click();
  await page.getByRole("button", { name: "Analyze message" }).click();
  await expect(page.getByTestId("chat-result")).toContainText("SAGE: neutral");
  await page.getByLabel("Filter players by risk").selectOption("High");
  expect(await page.locator(".queue-row").count()).toBeGreaterThan(0);
  expect(await page.locator(".queue-row").count()).toBeLessThan(20);
});

test("matchmaking explains fair constraint, applies cap and exports actual decisions", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Compare teams" }).click();
  await expect(
    page.getByRole("heading", { name: "Zen-Flow recommendation" }),
  ).toBeVisible();
  await expect(page.getByTestId("optimized-pairs")).toHaveText("1");
  await expect(page.locator(".team-player")).toHaveCount(40);
  await page.getByLabel("Maximum team MMR gap").fill("0");
  await expect(page.getByRole("status")).toContainText("Recompute");
  await page.getByRole("button", { name: "Recompute", exact: true }).click();
  await expect(
    page.getByText("Configured limit: 0 MMR", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export decision" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("zen-flow-window-11.json");
  await page.screenshot({
    path: join(tmpdir(), "zen-flow-matchmaking.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Model lab", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Real models. Synthetic evidence." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Evidence boundaries" }),
  ).toBeVisible();
  await expect(page.getByText("0.863", { exact: true })).toBeVisible();
  await page.screenshot({
    path: join(tmpdir(), "zen-flow-model-lab.png"),
    fullPage: true,
  });
});

test("mobile navigation, controls, charts and team layouts do not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.screenshot({
    path: join(tmpdir(), "zen-flow-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Step +15s" }).click();
  await expect(page.getByTestId("tick")).toHaveText("Window 12");
  await page.getByRole("button", { name: "Matchmaking", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A fairer next game." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Model lab", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Evidence boundaries" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("API failure is visible and does not fabricate inference", async ({
  page,
}) => {
  await ready(page);
  await page.route("**/api/sessions/*/step", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Inference temporarily unavailable" }),
    }),
  );
  await page.getByRole("button", { name: "Step +15s" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Inference temporarily unavailable",
  );
  await expect(page.getByTestId("tick")).toHaveText("Window 11");
});

for (const width of [375, 768, 1024, 1440]) {
  test(`client and squad composition remain usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1024 });
    await ready(page);
    await page
      .getByLabel("Select player", { exact: true })
      .selectOption({ label: "SPECTRE" });
    await expect(page.locator(".profile-identity h3")).toHaveText("SPECTRE");
    const identity = await page.locator(".profile-identity h3").boundingBox();
    const risk = await page.locator(".profile-risk").boundingBox();
    expect(identity!.x + identity!.width).toBeLessThan(risk!.x);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page
      .getByRole("button", { name: "Matchmaking", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Inspect KAIZEN", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Why this recommendation for KAIZEN?",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.getByRole("button", { name: "Model lab", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Evidence boundaries" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
}

test("keyboard navigation has visible focus and reduced motion stops the live indicator", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Zen-Flow home" }),
  ).toBeFocused();
  expect(
    await page
      .getByRole("button", { name: "Zen-Flow home" })
      .evaluate((el) => getComputedStyle(el).outlineStyle),
  ).toBe("solid");
  await page
    .getByRole("button", { name: "Start simulation", exact: true })
    .click();
  expect(
    await page
      .locator(".live-label .dot")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Step +15s" })).toBeEnabled();
});
