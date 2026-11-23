import { expect, test, type Page } from "@playwright/test";
import { textPdf } from "../tests/helpers/fixtures";
import { ELECTRICITY_BILL, GST_CERTIFICATE } from "../tests/helpers/kwx-fixtures";

const SHOTS = process.env.SHOT_DIR;
async function shot(page: Page, name: string, project: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${project}-kwx-${name}.png`, fullPage: true });
}

/** dd-mm-yyyy, `days` ago — keeps the bill inside the 60-day window whenever the test runs. */
function daysAgo(days: number) {
  const d = new Date(Date.now() - days * 86_400_000);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

test("electricity bill is verified; wrong document goes to review and is resolved", async ({ page }, info) => {
  const p = info.project.name;
  const consumer = String(Date.now()).slice(-9);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const bill = ELECTRICITY_BILL.map((l) =>
    l.startsWith("Consumer No") ? `Consumer No: ${consumer}` : l.startsWith("Bill Date") ? `Bill Date: ${daysAgo(10)}` : l,
  );

  // 1. Upload a bill as "Electricity bill" with the customer's details.
  await page.goto("/scan");
  await page.getByRole("radio", { name: "Electricity bill" }).click();
  await page.getByPlaceholder("CUST-1042").fill(`E2E-${p}`);
  await page.getByPlaceholder("ABC Industries", { exact: true }).fill("ABC Industries Pvt Ltd");
  await page.getByPlaceholder("123456789").fill(consumer);
  await page.locator('input[type="file"]').setInputFiles({ name: `bill-${p}.pdf`, mimeType: "application/pdf", buffer: await textPdf(bill) });
  await expect(page.getByText("Verified").first()).toBeVisible({ timeout: 90_000 });
  await shot(page, "scan-verified", p);

  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page.getByRole("heading", { name: `bill-${p}.pdf` })).toBeVisible();
  await page.getByRole("tab", { name: /^Checks/ }).click();
  await expect(page.getByText("Bill within 60 days")).toBeVisible();
  await expect(page.getByText("Consumer number matches customer details")).toBeVisible();
  await shot(page, "detail-checks", p);
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText("Validating").first()).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/documents$/);

  // 2. Upload a GST certificate but claim it is an electricity bill → manual review.
  await page.goto("/scan");
  await page.getByRole("radio", { name: "Electricity bill" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: `wrong-${p}.pdf`, mimeType: "application/pdf", buffer: await textPdf(GST_CERTIFICATE) });
  await expect(page.getByText("Needs review").first()).toBeVisible({ timeout: 90_000 });
  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page.getByText("Needs manual review")).toBeVisible();
  await page.getByRole("tab", { name: /^Checks/ }).click();
  await shot(page, "detail-review", p);

  // Rejecting needs a note; approving doesn't.
  await page.getByRole("button", { name: "Request re-upload" }).click();
  // First hit compiles the review route in dev, so allow extra time.
  await expect(page.getByText("A note is required")).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder(/Review note/).fill("Please upload the electricity bill");
  await page.getByRole("button", { name: "Request re-upload" }).click();
  await expect(page.getByText("Re-upload requested").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Last reviewed by admin/)).toBeVisible();

  // Review queue on the library page.
  await page.goto("/documents?status=failed");
  await expect(page.getByText(`wrong-${p}.pdf`).first()).toBeVisible();
  await page.getByText(`wrong-${p}.pdf`).first().click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/documents$/);

  expect(errors).toEqual([]);
});
