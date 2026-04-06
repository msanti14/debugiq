import { test, expect } from "@playwright/test";
import { registerAndStoreTokens } from "./helpers/auth";

test("unauthenticated user visiting /dashboard is redirected to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test("user can log in with valid credentials and reach /dashboard", async ({ page }) => {
  const { email, password } = await registerAndStoreTokens(page);

  // Clear the tokens that registerAndStoreTokens injected — we want to test the form flow.
  // Do this BEFORE the next navigation so auth doesn't see them on reload.
  await page.evaluate((key) => localStorage.removeItem(key), "diq:tokens");

  // Navigate to /dashboard with no auth so it redirects to /login.
  // Going via the redirect means auth is already resolved when LoginPage mounts,
  // which avoids a React hooks-order error caused by the loading guard in the page.
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  expect(page.url()).toContain("/dashboard");
});

test("login form shows error on wrong password", async ({ page }) => {
  // Navigate via /dashboard redirect so auth is resolved before LoginPage mounts.
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);
  await page.fill('input[type="email"]', "nobody@example.com");
  await page.fill('input[type="password"]', "wrongpassword123");
  await page.click('button[type="submit"]');

  await expect(page.locator('form [role="alert"]')).toBeVisible();
});

test("already-authenticated user visiting /login is redirected to /dashboard", async ({ page }) => {
  await registerAndStoreTokens(page);
  await page.goto("/login");
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  expect(page.url()).toContain("/dashboard");
});

test("authenticated user can reach /dashboard and sees the app, not the login form", async ({ page }) => {
  await registerAndStoreTokens(page);
  await page.goto("/dashboard");
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  expect(page.url()).toContain("/dashboard");
  await expect(page.locator('input[type="email"]')).not.toBeVisible();
});
