import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import lighthouse from "lighthouse";

const PORT = Number(process.env.LH_PORT || 3198);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPORT_DIR = path.join(process.cwd(), "qa-reports", "lighthouse");

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const server = spawn(
    process.platform === "win32" ? "cmd.exe" : "npx",
    process.platform === "win32" ? ["/c", "npx", "next", "start", "-p", String(PORT)] : ["next", "start", "-p", String(PORT)],
    { stdio: "ignore", detached: false }
  );

  try {
    const ready = await waitForServer(BASE_URL);
    if (!ready) {
      throw new Error(`Next.js server did not become ready on ${BASE_URL}`);
    }

    const executablePath = chromium.executablePath();
    const browser = await chromium.launch({
      headless: true,
      executablePath: fs.existsSync(executablePath) ? executablePath : undefined,
      args: ["--remote-debugging-port=9222", "--no-sandbox"],
    });

    try {
      const routes = [
        { name: "home", url: `${BASE_URL}/` },
        { name: "explore", url: `${BASE_URL}/explore` },
        { name: "facility-gate", url: `${BASE_URL}/dashboard/facility/gate` },
      ];

      const summary = [];
      for (const target of routes) {
        const runnerResult = await lighthouse(target.url, {
          port: 9222,
          output: ["json", "html"],
          logLevel: "error",
          onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        });

        if (!runnerResult) continue;
        const { lhr, report } = runnerResult;
        const [jsonReport, htmlReport] = Array.isArray(report) ? report : [report, ""];

        if (jsonReport) {
          fs.writeFileSync(path.join(REPORT_DIR, `${target.name}.json`), jsonReport, "utf8");
        }
        if (htmlReport) {
          fs.writeFileSync(path.join(REPORT_DIR, `${target.name}.html`), htmlReport, "utf8");
        }

        const scores = {
          route: target.name,
          performance: Math.round((lhr.categories.performance?.score ?? 0) * 100),
          accessibility: Math.round((lhr.categories.accessibility?.score ?? 0) * 100),
          bestPractices: Math.round((lhr.categories["best-practices"]?.score ?? 0) * 100),
          seo: Math.round((lhr.categories.seo?.score ?? 0) * 100),
        };
        summary.push(scores);
        console.log(JSON.stringify(scores));
      }

      fs.writeFileSync(path.join(REPORT_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
    } finally {
      await browser.close();
    }
  } finally {
    if (server.pid) {
      if (process.platform === "win32") {
        const { spawnSync } = await import("node:child_process");
        spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        server.kill();
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
