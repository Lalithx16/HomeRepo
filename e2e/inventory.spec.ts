import { expect, test, type Page } from "@playwright/test";

/**
 * Full user journey against a real Supabase project.
 * Requires E2E_USER_EMAIL / E2E_USER_PASSWORD for a confirmed test account
 * (see README → Testing). Skipped automatically when they're not set.
 */
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe.configure({ mode: "serial" });
test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated tests");

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password", { exact: false }).first().fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  if (page.url().includes("/onboarding")) {
    await page.getByLabel("Household name").fill("E2E Home");
    await page.getByRole("button", { name: "Create household" }).click();
    await page.waitForURL((url) => url.pathname === "/");
  }
}

test("add an item, change its quantity and shop for it", async ({ page }) => {
  const name = `E2E Oats ${Date.now()}`;
  await signIn(page);

  // Add item
  await page.goto("/inventory/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Quantity").fill("3");
  const location = page.getByLabel("Storage location");
  const firstLocation = await location.locator("option").nth(1).getAttribute("value");
  await location.selectOption(firstLocation!);
  await page.getByLabel("Minimum to keep").fill("2");
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Use some via the stepper (goes through the offline queue and syncs)
  await page.getByRole("button", { name: new RegExp(`^Use 1 piece of ${name}`) }).first().click();
  await expect(page.getByText(/2\s+pieces/).first()).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`^Use 1 piece of ${name}`) }).first().click();
  await page.reload();
  await expect(page.getByText("Low stock").first()).toBeVisible();

  // Add to shopping list and check it off
  await page.getByRole("button", { name: "Add to list" }).click();
  await page.goto("/shopping");
  const checkbox = page.getByRole("checkbox", { name: `Check off ${name}` });
  await checkbox.click();
  await expect(page.getByRole("checkbox", { name: `Uncheck ${name}` })).toBeVisible();

  // Search finds it
  await page.keyboard.press("Control+K");
  await page.getByPlaceholder("Search items, brands, categories, locations…").fill(name.slice(0, 10));
  await expect(page.getByRole("option", { name: new RegExp(name) })).toBeVisible();
  await page.keyboard.press("Escape");

  // Clean up
  await page.goto("/inventory?q=" + encodeURIComponent(name));
  await page.getByRole("button", { name: `Actions for ${name}` }).first().click();
  await page.getByRole("menuitem", { name: "Delete item" }).click();
  await page.getByRole("button", { name: "Delete item" }).click();
  await expect(page).toHaveURL(/\/inventory/);
});

test("quantity changes made offline sync when back online", async ({ page, context }) => {
  const name = `E2E Offline ${Date.now()}`;
  await signIn(page);
  await page.goto("/inventory/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Quantity").fill("5");
  const location = page.getByLabel("Storage location");
  await location.selectOption((await location.locator("option").nth(1).getAttribute("value"))!);
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await context.setOffline(true);
  await page.getByRole("button", { name: new RegExp(`^Use 1 piece of ${name}`) }).first().click();
  await expect(page.getByText("Pending sync").first()).toBeVisible();
  await expect(page.getByText(/Offline/).first()).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("Pending sync")).toHaveCount(0, { timeout: 15_000 });
  await page.reload();
  await expect(page.getByText(/4\s+pieces/).first()).toBeVisible();

  await page.getByRole("button", { name: `Actions for ${name}` }).first().click();
  await page.getByRole("menuitem", { name: "Delete item" }).click();
  await page.getByRole("button", { name: "Delete item" }).click();
});
