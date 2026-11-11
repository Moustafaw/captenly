import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempProfile = path.join(os.tmpdir(), "chrome-cdp-insp-" + Date.now());
fs.mkdirSync(tempProfile, { recursive: true });

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const chrome = spawn(CHROME, [
  "--headless=new",
  "--remote-debugging-port=9223",
  `--user-data-dir=${tempProfile}`,
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1440,1200",
]);

for (let i = 0; i < 20; i++) {
  try {
    const res = await fetch("http://127.0.0.1:9223/json/version");
    if (res.ok) break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}

try {
  const tabs = await (await fetch(`http://127.0.0.1:9223/json/new?http://localhost:3000`, { method: "PUT" })).json();
  const ws = new WebSocket(tabs.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let id = 1;
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const cur = id++;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === cur) {
          ws.removeEventListener("message", handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id: cur, method, params }));
    });

  await send("Page.enable");
  await new Promise((r) => setTimeout(r, 2500));

  const evalRes = await send("Runtime.evaluate", {
    expression: `(() => {
      const hero = document.querySelector('section.bg-dark-slate');
      if (!hero) return "NO HERO FOUND";
      const rect = hero.getBoundingClientRect();
      const h1 = hero.querySelector('h1');
      const h1Styles = h1 ? window.getComputedStyle(h1) : null;
      return {
        heroRect: { top: rect.top, height: rect.height, width: rect.width },
        h1FontSize: h1Styles ? h1Styles.fontSize : null,
        h1LineHeight: h1Styles ? h1Styles.lineHeight : null,
      };
    })()`,
    returnByValue: true
  });

  console.log("HERO EVAL RES:", JSON.stringify(evalRes, null, 2));
  ws.close();
} finally {
  chrome.kill();
  try {
    fs.rmSync(tempProfile, { recursive: true, force: true });
  } catch {}
}
