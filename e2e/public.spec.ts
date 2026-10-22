import { expect, test } from "@playwright/test";

// These run without credentials against `npm run build && npm run start` (or E2E_BASE_URL).

test("signed-out visitors are redirected to sign in", async ({ page }) => {
  await page.goto("/inventory");
  await expect(page).toHaveURL(/\/login\?next=%2Finventory/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("sign-in form shows inline validation", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
});

test("API routes reject anonymous requests", async ({ request }) => {
  const search = await request.get("/api/search?q=rice");
  expect(search.status()).toBe(401);
  const sync = await request.post("/api/sync", { data: { mutations: [] } });
  expect(sync.status()).toBe(401);
});

test("PWA manifest and offline page are served", async ({ request, page }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const json = await manifest.json();
  expect(json.name).toBe("Homebase");
  expect(json.display).toBe("standalone");
  expect(json.icons.length).toBeGreaterThanOrEqual(3);
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
});

test("no horizontal scrolling on the sign-in page", async ({ page }) => {
  await page.goto("/login");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
