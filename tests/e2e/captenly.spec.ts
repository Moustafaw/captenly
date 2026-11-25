import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const REPORT_DIR = path.join(process.cwd(), "qa-reports", "axe");

function recordAxeViolations(name: string, project: string, violations: unknown[]) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const filePath = path.join(REPORT_DIR, `${name}-${project}.json`);
  fs.writeFileSync(filePath, JSON.stringify({ route: name, project, violations }, null, 2), "utf8");
}

test.describe("Captenly Public Flows, Auth Gates & Accessibility", () => {
  test("Public routes render Arabic RTL cleanly without uncaught errors", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    for (const route of ["/", "/explore", "/coaches", "/auth/login"]) {
      const resp = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(resp?.status(), `Route ${route} HTTP status`).toBeLessThan(400);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator("body")).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 4
      );
      expect(hasHorizontalOverflow, `Horizontal overflow on ${route} (${testInfo.project.name})`).toBeFalsy();
    }

    expect(errors, `Uncaught page errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("Login page renders interactive form & guest mode", async ({ page }) => {
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator("input:visible").first().waitFor({ state: "visible", timeout: 15_000 });
    expect(await page.locator("input:visible").count()).toBeGreaterThan(0);
    await expect(page.locator("button:visible").first()).toBeVisible();
  });

  test("Protected dashboards show login gate and API routes reject unauthenticated calls", async ({
    page,
    request,
  }) => {
    for (const dashRoute of [
      "/dashboard/facility",
      "/dashboard/facility/gate",
      "/dashboard/coach",
      "/dashboard/ledger",
    ]) {
      const resp = await page.goto(dashRoute, { waitUntil: "domcontentloaded" });
      expect(resp?.status()).toBe(200);
      await expect(page.locator("body")).toBeVisible();
    }

    const getLinks = await request.get("/api/supabase/facility-links?facilityId=fac-1");
    expect(getLinks.status()).toBe(401);

    const postLinks = await request.post("/api/supabase/facility-links", {
      data: { action: "request_link", facilityId: "fac-1" },
    });
    expect(postLinks.status()).toBe(401);

    const postLedgers = await request.post("/api/supabase/session-ledgers", {
      data: { ledger: {} },
    });
    expect(postLedgers.status()).toBe(401);
  });

  test("Accessibility (axe-core WCAG A/AA) audit captures report cleanly", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const routes = [
      { key: "home", path: "/" },
      { key: "explore", path: "/explore" },
      { key: "login", path: "/auth/login" },
      { key: "facility-gate", path: "/dashboard/facility/gate" },
    ];

    const summary: {
      key: string;
      critical: number;
      serious: number;
      moderate: number;
      minor: number;
      rules: string[];
    }[] = [];

    for (const r of routes) {
      await page.goto(r.path, { waitUntil: "domcontentloaded" });
      await page.locator("main").first().waitFor({ state: "visible", timeout: 15_000 });
      await page.locator("main h1, main form").first().waitFor({ state: "visible", timeout: 15_000 });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      recordAxeViolations(r.key, testInfo.project.name, results.violations);

      const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
      const rules: string[] = [];
      for (const v of results.violations) {
        rules.push(`${v.id}(${v.impact}:${v.nodes.length})`);
        if (v.impact === "critical") counts.critical += 1;
        else if (v.impact === "serious") counts.serious += 1;
        else if (v.impact === "moderate") counts.moderate += 1;
        else counts.minor += 1;
      }
      summary.push({ key: r.key, ...counts, rules });
    }

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(REPORT_DIR, `summary-${testInfo.project.name}.json`),
      JSON.stringify(summary, null, 2),
      "utf8"
    );
    console.log(`AXE_SUMMARY_${testInfo.project.name}:`, JSON.stringify(summary));

    const criticalCount = summary.reduce((s, item) => s + item.critical, 0);
    expect(criticalCount, `Critical a11y violations found: ${JSON.stringify(summary)}`).toBe(0);
  });
});
