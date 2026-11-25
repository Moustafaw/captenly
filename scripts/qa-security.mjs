import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPORT_DIR = path.join(process.cwd(), "qa-reports", "security");
fs.mkdirSync(REPORT_DIR, { recursive: true });

function resolveWinGetExe(packagePrefix, exeName) {
  if (process.platform !== "win32" || !process.env.LOCALAPPDATA) return exeName;
  const pkgsDir = path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Packages");
  if (fs.existsSync(pkgsDir)) {
    const matchDir = fs
      .readdirSync(pkgsDir)
      .find((d) => d.toLowerCase().startsWith(packagePrefix.toLowerCase()));
    if (matchDir) {
      const candidate = path.join(pkgsDir, matchDir, exeName);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  const winAppsCandidate = path.join(
    process.env.LOCALAPPDATA,
    "Microsoft",
    "WindowsApps",
    exeName
  );
  return fs.existsSync(winAppsCandidate) ? winAppsCandidate : exeName;
}

function runBin(title, binPath, args, useShell = false, timeoutMs = 180_000) {
  console.log(`\n=== ${title} ===`);
  const res = spawnSync(binPath, args, {
    encoding: "utf8",
    shell: useShell,
    input: "",
    timeout: timeoutMs,
    env: { ...process.env },
  });
  return {
    title,
    status: res.status,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
    error: res.error ? String(res.error) : null,
  };
}

const gitleaksBin = resolveWinGetExe("Gitleaks.Gitleaks", "gitleaks.exe");
const osvBin = resolveWinGetExe("Google.OSVScanner", "osv-scanner.exe");

const gitleaksDirReport = path.join(REPORT_DIR, "gitleaks-src.json");
const gitleaksGitReport = path.join(REPORT_DIR, "gitleaks-git.json");
const osvReport = path.join(REPORT_DIR, "osv-scanner.json");
const npmAuditReport = path.join(REPORT_DIR, "npm-audit.json");

const gDir = runBin("Gitleaks Working Tree (src/)", gitleaksBin, [
  "dir",
  "src",
  "--report-format",
  "json",
  "--report-path",
  gitleaksDirReport,
  "--no-banner",
]);
console.log(`gitleaks dir exit=${gDir.status} ${gDir.error || ""}`.trim());
if (gDir.stderr) console.log(gDir.stderr.trim());

const gGit = runBin("Gitleaks Git History", gitleaksBin, [
  "git",
  ".",
  "--max-target-megabytes=5",
  "--report-format",
  "json",
  "--report-path",
  gitleaksGitReport,
  "--no-banner",
]);
console.log(`gitleaks git exit=${gGit.status} ${gGit.error || ""}`.trim());
if (gGit.stderr) console.log(gGit.stderr.trim());

const osvRes = runBin("OSV-Scanner (package-lock.json)", osvBin, [
  "scan",
  "source",
  "-L",
  "package-lock.json",
  "--format=json",
  "--output-file",
  osvReport,
], false, 240_000);
console.log(`osv-scanner exit=${osvRes.status} ${osvRes.error || ""}`.trim());
if (osvRes.stderr) console.log(osvRes.stderr.trim());

const npmCmd = process.platform === "win32" ? "cmd.exe" : "npm";
const npmArgs = process.platform === "win32" ? ["/c", "npm", "audit", "--json"] : ["audit", "--json"];
const auditRes = runBin("NPM Audit", npmCmd, npmArgs, false);
fs.writeFileSync(npmAuditReport, auditRes.stdout || "{}", "utf8");
console.log(`npm audit exit=${auditRes.status}`);
