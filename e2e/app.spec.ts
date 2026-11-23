import { expect, test } from "@playwright/test";

const SHOTS = process.env.SHOT_DIR;

async function shot(page: import("@playwright/test").Page, name: string, project: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${project}-${name}.png`, fullPage: true });
}

test("scan → review → edit → report → delete", async ({ page }, info) => {
  const p = info.project.name;
  const customer = `E2E Customer ${p} ${Date.now()}`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Document verification" })).toBeVisible();
  await page.waitForTimeout(1200); // let entry animations settle
  await shot(page, "home", p);

  await page.goto("/scan");
  await expect(page.getByText("Drag files here")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles("samples/invoice.png");
  await expect(page.getByText(/Uploaded|Reading|Extracted|Validating/).first()).toBeVisible();
  await shot(page, "scan-progress", p);
  await expect(page.getByText("Sharma Electronics Pvt Ltd")).toBeVisible({ timeout: 90_000 });
  await shot(page, "scan-done", p);

  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page.getByRole("heading", { name: "invoice.png" })).toBeVisible();
  await expect(page.locator("input.field").first()).toHaveValue("INV-2024-0457");
  await page.waitForTimeout(1000);
  await shot(page, "detail", p);

  await page.locator("label", { hasText: "Customer" }).locator("input").fill(customer);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Saved/)).toBeVisible();

  const reportHref = await page.getByRole("link", { name: "Download PDF report" }).getAttribute("href");
  const res = await page.request.get(reportHref!);
  expect(res.headers()["content-type"]).toBe("application/pdf");

  await page.goto("/documents");
  await page.getByPlaceholder("Search names, numbers, text").fill(customer);
  await expect(page.getByText("Sharma Electronics Pvt Ltd").first()).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, "library", p);

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Summary reports" })).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, "reports", p);

  // clean up everything this test created
  await page.goto("/documents");
  await page.getByPlaceholder("Search names, numbers, text").fill(customer);
  await page.getByText("Sharma Electronics Pvt Ltd").first().click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/documents$/);

  expect(errors).toEqual([]);
});
