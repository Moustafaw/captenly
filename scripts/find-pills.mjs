import fs from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";
const S = path.join(process.cwd(), "Screens");
for (const kind of ["Screan Desktop", "Screan Phone"]) {
  for (const name of fs.readdirSync(path.join(S, kind))) {
    const f = path.join(S, kind, name, "code.html");
    if (!fs.existsSync(f)) continue;
    const root = parse(fs.readFileSync(f, "utf8"));
    const out = new Set();
    root.querySelectorAll("div, span, p").forEach((el) => {
      const c = el.getAttribute("class") || "";
      if (!/rounded-full/.test(c)) return;
      if (!/bg-(lime-tint|deep-carbon|dark-slate|primary-fixed|surface-container)/.test(c)) return;
      const t = el.textContent.replace(/\s+/g, " ").trim();
      if (t.length < 14 || t.length > 90) return;
      if (/(موثق|معتمد|بوابة|مجتمع|الأمان|الأول|المحتوى|منصة|رسمي|ضمان)/.test(t)) out.add(t);
    });
    if (out.size) console.log(`${kind}/${name}: ` + [...out].join(" | "));
  }
}
