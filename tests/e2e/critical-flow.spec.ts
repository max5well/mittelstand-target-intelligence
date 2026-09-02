import { expect, test } from "@playwright/test";

test("authenticated workspace can open and filter companies", async ({
  page,
}) => {
  await page.goto("/companies");
  await expect(
    page.getByRole("heading", { name: "Unternehmen", exact: true }),
  ).toBeVisible();
  await page
    .getByPlaceholder("Unternehmen, Stadt, Eigentümer oder Register-ID suchen…")
    .fill("Nicht vorhandenes Ziel");
  await expect(
    page.getByText(/Keine .*Unternehmen entsprechen den Filtern/),
  ).toBeVisible();
});

test("saved search shows cost-aware builder", async ({ page }) => {
  await page.goto("/searches");
  await page.getByRole("button", { name: "Klimatechnik einrichten" }).click();
  await expect(
    page.getByRole("dialog", { name: "Gespeicherte Suche erstellen" }),
  ).toBeVisible();
  await expect(page.getByText("Geschätzte Anbieternutzung")).toBeVisible();
  await page.getByRole("radio", { name: /Täglich wiederholen/ }).check();
  await expect(page.getByText("Monatliche Schätzung · 30 Tage")).toBeVisible();
});
