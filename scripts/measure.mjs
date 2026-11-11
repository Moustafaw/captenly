import { spawn } from "node:child_process";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const chrome = spawn(CHROME, [
  "--headless=new",
  "--remote-debugging-port=9225",
  "--disable-gpu",
  "--window-size=1440,3000",
]);
await new Promise((r) => setTimeout(r, 1500));

try {
  const tabs = await (await fetch("http://127.0.0.1:9225/json/new?http://localhost:3000", { method: "PUT" })).json();
  const ws = new WebSocket(tabs.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 1;
  const send = (method, params = {}) =>
    new Promise((res) => {
      const cur = id++;
      const h = (e) => {
        const m = JSON.parse(e.data);
        if (m.id === cur) {
          ws.removeEventListener("message", h);
          res(m.result);
        }
      };
      ws.addEventListener("message", h);
      ws.send(JSON.stringify({ id: cur, method, params }));
    });

  await send("Page.enable");
  await new Promise((r) => setTimeout(r, 2000));
  const res = await send("Runtime.evaluate", {
    expression: `JSON.stringify({
      classList: Array.from(document.querySelectorAll('main')[1].classList),
      matchedCSSRules: Array.from(document.styleSheets).map(s => {
        try {
          return Array.from(s.cssRules).filter(r => r.selectorText && r.selectorText.includes('pt-')).map(r => r.cssText);
        } catch(e) { return []; }
      }).flat().slice(0, 5)
    })`,
  });
  console.log("MEASUREMENTS:", res.result.value);
  ws.close();
} finally {
  chrome.kill();
}
