import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const targetUrl = process.argv[2] || "http://localhost:3000";
const targetOutput = process.argv[3] || "public/current_view.png";
const vpWidth = Number(process.argv[4] || 1440);
const vpHeight = vpWidth <= 480 ? 844 : 1200;

const tempProfile = path.join(os.tmpdir(), "chrome-cdp-" + Date.now());
fs.mkdirSync(tempProfile, { recursive: true });

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const chrome = spawn(CHROME, [
  "--headless=new",
  "--remote-debugging-port=9222",
  `--user-data-dir=${tempProfile}`,
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--window-size=${vpWidth},${vpHeight}`,
]);

// Wait up to 10s for Chrome to become responsive on port 9222
let connected = false;
for (let i = 0; i < 20; i++) {
  try {
    const res = await fetch("http://127.0.0.1:9222/json/version");
    if (res.ok) {
      connected = true;
      break;
    }
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}

if (!connected) {
  chrome.kill();
  console.error("Could not connect to Chrome debugging port 9222");
  process.exit(1);
}

try {
  const tabs = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(targetUrl)}`, { method: "PUT" })).json();
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
  await send("Page.navigate", { url: targetUrl });
  await new Promise((r) => setTimeout(r, 3000));

  let data;
  try {
    const res = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    data = res?.data;
  } catch (e) {
    console.log("Fallback to viewport screenshot:", e.message);
  }
  if (!data) {
    const res = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    data = res?.data;
  }
  fs.writeFileSync(targetOutput, Buffer.from(data, "base64"));
  console.log(`Screenshot saved to ${targetOutput}!`);
  ws.close();
} finally {
  chrome.kill();
  try {
    fs.rmSync(tempProfile, { recursive: true, force: true });
  } catch {}
}

