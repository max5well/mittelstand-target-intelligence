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

test("saved search builder sends the authenticated workspace", async ({
  page,
}) => {
  let previewWorkspaceId: string | undefined;
  let saveWorkspaceId: string | undefined;
  let savedSearch: Record<string, unknown> | undefined;
  await page.route("**/api/providers/openregister/search", async (route) => {
    previewWorkspaceId = route.request().headers()["x-workspace-id"];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ pagination: { total_results: 42 } }),
    });
  });
  await page.route("**/api/searches", async (route) => {
    saveWorkspaceId = route.request().headers()["x-workspace-id"];
    savedSearch = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ searchId: "search-1", run: null }),
    });
  });

  await page.goto("/searches");
  await expect(
    page.getByRole("heading", { name: "Noch keine gespeicherten Suchen" }),
  ).toBeVisible();
  await expect(page.getByText("Klimatechnik")).toHaveCount(0);
  await expect(page.getByText("Dachdecker")).toHaveCount(0);
  await page.getByRole("button", { name: "Neue Suche erstellen" }).click();
  await expect(
    page.getByRole("dialog", { name: "Gespeicherte Suche erstellen" }),
  ).toBeVisible();
  await expect(page.getByLabel("Name der Suche")).toHaveValue("");
  await expect(page.getByLabel("Unternehmensstatus")).toHaveValue("all");
  await expect(
    page.getByRole("checkbox", { name: "GmbH", exact: true }),
  ).not.toBeChecked();
  await expect(page.getByLabel("Umsatz · EUR Minimum")).toHaveValue("");
  await expect(
    page.getByText("Branchen nach Name oder Code auswählen"),
  ).toBeVisible();
  await expect(page.getByText("Alle Bundesländer")).toBeVisible();
  await expect(page.getByText("Geschätzte Anbieternutzung")).toBeVisible();
  await page.getByLabel("Name der Suche").fill("Eigene Zielgruppe");
  await page.getByRole("radio", { name: /Täglich wiederholen/ }).check();
  await expect(page.getByText("Monatliche Schätzung · 30 Tage")).toBeVisible();

  await page
    .getByRole("button", { name: "Treffermenge ermitteln · 10 Credits" })
    .click();
  await expect(
    page.getByText("42 passende Unternehmen laut OpenRegister"),
  ).toBeVisible();
  expect(previewWorkspaceId).toBe("00000000-0000-4000-8000-000000000010");

  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(
    page.getByRole("dialog", { name: "Gespeicherte Suche erstellen" }),
  ).toBeHidden();
  expect(saveWorkspaceId).toBe("00000000-0000-4000-8000-000000000010");
  expect(savedSearch).toMatchObject({
    name: "Eigene Zielgruppe",
    filters: [],
    summary: "Deutschlandweite Suche ohne zusätzliche Filter.",
  });
});
