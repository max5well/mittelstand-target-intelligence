import { expect, test } from "@playwright/test";

test("mock admin can review and filter fictional targets", async ({ page }) => {
  await page.goto("/companies");
  await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible();
  await page
    .getByPlaceholder("Search company, city, owner, register ID…")
    .fill("Hanseatic");
  await expect(
    page.getByRole("link", { name: /Hanseatic Präzisionstechnik/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Hanseatic Präzisionstechnik/ }).click();
  await expect(
    page.getByRole("heading", { name: /Hanseatic Präzisionstechnik/ }),
  ).toBeVisible();
  await expect(page.getByText("Ownership & management")).toBeVisible();
});

test("saved search shows cost-aware builder", async ({ page }) => {
  await page.goto("/searches");
  await page.getByRole("button", { name: "New saved search" }).click();
  await expect(page.getByText("Estimated provider usage")).toBeVisible();
  await expect(page.getByText("Monthly estimate · 30 days")).toBeVisible();
});
