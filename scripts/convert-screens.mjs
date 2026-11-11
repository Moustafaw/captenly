// Converts the reference screens (Screens/**/code.html) into faithful React (TSX) components.
// Usage: node scripts/convert-screens.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parse, NodeType } from "node-html-parser";

const ROOT = process.cwd();
const SCREENS = path.join(ROOT, "Screens");
const OUT = path.join(ROOT, "src", "screens");
const IMG_DIR = path.join(ROOT, "public", "screens");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(IMG_DIR, { recursive: true });

const LOGO_LOCAL = "/images/logo/Captenly_minimalist_logo_design_785a47d1_2K.jpg";
const LOGO_LOCAL_2 = "/images/logo/Captenly_minimalist_logo_design_90b98823_2K.jpg";

// ---------- link text → route table (order matters) ----------
const ROUTES = [
  [/واتساب|واتس|تواصل/, "WA"],
  [/نسيت كلمة المرور|استعادة كلمة/, "/auth/forgot"],
  [/إرسال رابط الاستعادة/, "/auth/reset"],
  [/تذكرت كلمة المرور|تسجيل الدخول|لديك حساب/, "/auth/login"],
  [/إنشاء حساب|سجل الآن|سجّل الآن|انضم/, "/auth/register"],
  [/تسجيل الخروج/, "/auth"],
  [/مقارنة|قارن/, "/compare"],
  [/احجز|حجز|الاشتراك المباشر|اشترك/, "/booking"],
  [/دفتر الحصص|الجواز الرياضي|كود الحضور|QR/, "/dashboard/ledger"],
  [/الإشعارات/, "/notifications"],
  [/المفضلة/, "/favorites"],
  [/المجلة|مقالات|المقالات/, "/magazine"],
  [/اقرأ|الدليل الكامل|قراءة/, "/magazine/winter-swimming-pool-safety-guide"],
  [/المسابح|مسابح/, "/pools"],
  [/توثيق|الشارات|شارات/, "/badges"],
  [/تحليلات|لوحة الكابتن|نشر/, "/dashboard/coach"],
  [/الإعدادات|إعدادات/, "/dashboard/athlete/settings"],
  [/حسابي|ملفي/, "/dashboard/athlete"],
  [/الموقع|الخريطة/, "/location"],
  [/البروفايل|التفاصيل|عرض الأكاديمية|الملف/, "/academy/shennawy"],
  [/استكشف|عرض الكل|عرض كافة|المدربين|الأكاديميات/, "/explore"],
  [/الرئيسية/, "/"],
];
function routeFor(text) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  for (const [re, r] of ROUTES) if (re.test(t)) return r;
  return null;
}

// ---------- images ----------
const imgMap = JSON.parse(fs.existsSync(path.join(OUT, "_images.json")) ? fs.readFileSync(path.join(OUT, "_images.json"), "utf8") : "{}");
const pendingDownloads = new Map();
function localImage(url) {
  if (!/^https?:\/\/lh3\.googleusercontent\.com/.test(url)) return url;
  if (imgMap[url]) return imgMap[url];
  const h = crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
  const rel = `/screens/${h}.jpg`;
  imgMap[url] = rel;
  pendingDownloads.set(url, path.join(IMG_DIR, `${h}.jpg`));
  return rel;
}

// ---------- attr conversion ----------
const ATTR_MAP = {
  class: "className", for: "htmlFor", tabindex: "tabIndex", readonly: "readOnly", maxlength: "maxLength",
  minlength: "minLength", colspan: "colSpan", rowspan: "rowSpan", autocomplete: "autoComplete", autofocus: "autoFocus",
  inputmode: "inputMode", enterkeyhint: "enterKeyHint", srcset: "srcSet", crossorigin: "crossOrigin",
  viewbox: "viewBox", "stroke-width": "strokeWidth", "stroke-linecap": "strokeLinecap", "stroke-linejoin": "strokeLinejoin",
  "fill-rule": "fillRule", "clip-rule": "clipRule", "stroke-dasharray": "strokeDasharray", "stroke-dashoffset": "strokeDashoffset",
  "stop-color": "stopColor", "stop-opacity": "stopOpacity", "fill-opacity": "fillOpacity", "stroke-opacity": "strokeOpacity",
  "xlink:href": "xlinkHref", "xmlns:xlink": "xmlnsXlink", "text-anchor": "textAnchor", "dominant-baseline": "dominantBaseline",
  "font-size": "fontSize", "font-weight": "fontWeight", "font-family": "fontFamily", allowfullscreen: "allowFullScreen",
  frameborder: "frameBorder", spellcheck: "spellCheck", contenteditable: "contentEditable", novalidate: "noValidate",
  datetime: "dateTime", accesskey: "accessKey", referrerpolicy: "referrerPolicy",
};
const BOOL_ATTRS = new Set(["disabled", "required", "multiple", "hidden", "readOnly", "autoFocus", "noValidate", "allowFullScreen", "open"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

function cssToObj(style) {
  const out = [];
  for (const decl of style.split(/;(?![^(]*\))/)) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    let k = decl.slice(0, i).trim();
    let v = decl.slice(i + 1).trim();
    if (!k) continue;
    v = v.replace(/url\((['"]?)(.*?)\1\)/g, (_, q, u) => `url('${localImage(u)}')`);
    if (!k.startsWith("--")) k = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (k.startsWith("Ms")) k = "ms" + k.slice(2);
    out.push(`${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  }
  return `{{${out.join(", ")}}}`;
}

function escText(t) {
  return t.replace(/[{}<>]/g, (c) => `{${JSON.stringify(c)}}`);
}

function textOf(node) {
  return (node.textContent || "").replace(/\s+/g, " ").trim();
}

const ctx = { usesLink: false };

function convertAttrs(el) {
  const tag = el.rawTagName.toLowerCase();
  const raw = el.attributes; // decoded values
  const parts = [];
  let isLink = false;
  let href = null;
  for (let [k, v] of Object.entries(raw)) {
    const lk = k.toLowerCase();
    if (lk.startsWith("on")) continue; // drop inline handlers
    if (lk === "style") { parts.push(`style=${cssToObj(v)}`); continue; }
    if (lk === "src" || lk === "data-src") v = localImage(v);
    if (lk === "alt" && /Captenly_minimalist_logo/.test(v) && tag === "img") {
      // handled below via src override
    }
    let name = ATTR_MAP[lk] || (lk.startsWith("data-") || lk.startsWith("aria-") ? lk : k);
    if (tag === "input" && lk === "value") name = "defaultValue";
    if (tag === "input" && lk === "checked") { parts.push("defaultChecked"); continue; }
    if (tag === "option" && lk === "selected") continue;
    if (tag === "textarea" && lk === "value") name = "defaultValue";
    if (lk === "href") { href = v; continue; }
    if (BOOL_ATTRS.has(name) && (v === "" || v === name || v === lk)) { parts.push(name); continue; }
    parts.push(`${name}=${JSON.stringify(v)}`);
  }
  if (tag === "img" && /Captenly_minimalist_logo/.test(raw.alt || "")) {
    const i = parts.findIndex((p) => p.startsWith("src="));
    const logo = /90b98823/.test(raw.alt) ? LOGO_LOCAL_2 : LOGO_LOCAL;
    if (i >= 0) parts[i] = `src=${JSON.stringify(logo)}`; else parts.push(`src=${JSON.stringify(logo)}`);
    const a = parts.findIndex((p) => p.startsWith("alt="));
    if (a >= 0) parts[a] = `alt="كابتنلي"`;
  }
  if (tag === "a") {
    let target = href;
    if (!href || href === "#" || href.startsWith("#") && href.length <= 1 || href === "javascript:void(0)") {
      target = routeFor(textOf(el)) || "/";
    } else if (/^https:\/\/wa\.me\/?$/.test(href)) {
      target = "WA";
    }
    if (target === "WA") {
      parts.push(`href="https://wa.me/201000000000?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%20%D9%83%D8%A7%D8%A8%D8%AA%D9%86%D9%84%D9%8A"`, `target="_blank"`, `rel="noopener noreferrer"`);
      // de-dupe target/rel
      return { attrs: dedupe(parts), isLink: false };
    }
    if (target.startsWith("/")) { isLink = true; ctx.usesLink = true; }
    parts.push(`href=${JSON.stringify(target)}`);
  }
  return { attrs: dedupe(parts), isLink };
}
function dedupe(parts) {
  const seen = new Map();
  for (const p of parts) { const k = p.split("=")[0]; seen.set(k, p); }
  return [...seen.values()];
}

function convertNode(node, depth = 0) {
  if (node.nodeType === NodeType.TEXT_NODE) {
    const raw = node.rawText;
    if (!raw.trim()) return raw.includes("\n") ? "" : raw.length ? " " : "";
    return escText(raw.replace(/\s+/g, " "));
  }
  if (node.nodeType === NodeType.COMMENT_NODE) return "";
  const el = node;
  const tag = (el.rawTagName || "").toLowerCase();
  if (!tag) return el.childNodes.map((c) => convertNode(c, depth)).join("");
  if (tag === "script" || tag === "style" || tag === "link" || tag === "meta") return "";
  if (tag === "span" && (el.getAttribute("class") || "").includes("material-symbols-outlined")) {
    ctx.usesIcon = true;
    const iconName = textOf(el).trim();
    const styleAttr = el.getAttribute("style");
    const classAttr = el.getAttribute("class");
    const styleProp = styleAttr ? ` style=${cssToObj(styleAttr)}` : "";
    return `<Icon name=${JSON.stringify(iconName)} className=${JSON.stringify(classAttr || "")}${styleProp} />`;
  }
  let { attrs, isLink } = convertAttrs(el);
  // buttons whose label maps to a navigation route become Links (keeps the exact styling)
  let outTag = tag;
  if (tag === "button" && !/submit/.test(el.getAttribute("type") || "")) {
    const r = routeFor(textOf(el));
    const label = textOf(el);
    if (r && r.startsWith("/") && label.length > 3 && !/^(bookmark|favorite)/.test(label)) {
      outTag = "Link"; ctx.usesLink = true;
      attrs = attrs.filter((a) => !a.startsWith("type="));
      attrs.push(`href=${JSON.stringify(r)}`);
    }
  }
  if (isLink) outTag = "Link";
  const a = attrs.length ? " " + attrs.join(" ") : "";
  if (VOID.has(tag)) return `<${outTag}${a} />`;
  if (tag === "textarea") {
    const t = el.textContent.trim();
    return `<textarea${a}${t ? ` defaultValue={${JSON.stringify(t)}}` : ""} />`;
  }
  const inner = el.childNodes.map((c) => convertNode(c, depth + 1)).join("");
  return `<${outTag}${a}>${inner}</${outTag}>`;
}

// ---------- tailwind config union ----------
const twUnion = { colors: {}, fontFamily: {}, fontSize: {}, spacing: {}, borderRadius: {}, boxShadow: {} };
function collectTw(html) {
  const m = html.match(/<script id="tailwind-config">([\s\S]*?)<\/script>/);
  if (!m) return;
  try {
    const tailwind = {};
    new Function("tailwind", m[1])(tailwind);
    const ext = tailwind.config?.theme?.extend || {};
    for (const k of Object.keys(twUnion)) Object.assign(twUnion[k], ext[k] || {});
  } catch (e) { console.warn("tw parse failed", e.message); }
}

// ---------- main ----------
const index = [];
for (const kind of ["Screan Desktop", "Screan Phone"]) {
  const dir = path.join(SCREENS, kind);
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name, "code.html");
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");
    collectTw(html);
    const root = parse(html, { comment: false, blockTextElements: { script: true, style: true, noscript: false, pre: true } });
    const body = root.querySelector("body");
    if (!body) continue;
    const isDesktop = kind.includes("Desktop");
    // emit the shared chrome (header/footer from Desktop _24, bottom dock from Phone _21)
    const emitChrome = (el, compName) => {
      if (!el) return;
      ctx.usesLink = false;
    ctx.usesIcon = false;
      const jsx = convertNode(el);
      fs.mkdirSync(path.join(OUT, "chrome"), { recursive: true });
      fs.writeFileSync(path.join(OUT, "chrome", `${compName}.tsx`), `// AUTO-GENERATED chrome from Screens/${kind}/${name}\n/* eslint-disable */\n${ctx.usesLink ? 'import Link from "next/link";\n' : ""}${ctx.usesIcon ? 'import { Icon } from "@/components/Icon";\n' : ""}\nexport default function ${compName}() {\n  return (\n${jsx}\n  );\n}\n`, "utf8");
    };
    if (isDesktop && name === "_24") {
      emitChrome(body.querySelector("header"), "DesktopHeaderRaw");
      emitChrome(body.querySelector("footer"), "DesktopFooterRaw");
    }
    if (!isDesktop && name === "_21") {
      const dock = body.querySelectorAll("nav, div").find((n) => { const c = n.getAttribute("class") || ""; return /\bfixed\b/.test(c) && /bottom-/.test(c) && /الرئيسية/.test(n.textContent); });
      emitChrome(dock, "PhoneDockRaw");
      emitChrome(body.querySelector("header"), "PhoneHeaderRaw");
    }
    // remove global chrome that is rendered by shared components
    const isGlobalHeader = (h) => /استكشف/.test(h.textContent) && /(المجلة|المفضلة)/.test(h.textContent);
    const isGlobalFooter = (f) => /الرياضات والأنشطة|المنصة والدعم|CAPTENLY/.test(f.textContent);
    if (isDesktop) {
      body.querySelectorAll("header").forEach((h) => { if (isGlobalHeader(h)) h.remove(); });
      body.querySelectorAll("footer").forEach((f) => { if (isGlobalFooter(f)) f.remove(); });
    } else {
      // phone: drop the fixed bottom nav dock (rendered by the shared BottomNav)
      body.querySelectorAll("nav, div").forEach((n) => {
        const c = n.getAttribute("class") || "";
        if (/\bfixed\b/.test(c) && /bottom-/.test(c) && /الرئيسية/.test(n.textContent) && /(المفضلة|استكشف)/.test(n.textContent)) n.remove();
      });
    }
    ctx.usesLink = false;
    ctx.usesIcon = false;
    // Strip decorative "eyebrow" pills (small light-green/dark rounded labels sitting right above a heading),
    // e.g. "بوابة الأمان والاعتماد الرياضي المصري المعتمد" — requested removal of AI-style taglines.
    const removed = [];
    body.querySelectorAll("h1, h2").forEach((h) => {
      let prev = h.previousElementSibling;
      // walk up when the heading is wrapped together with the pill (e.g. <div><pill/><h1/></div>)
      const candidates = [];
      if (prev) candidates.push(prev);
      if (!prev && h.parentNode?.previousElementSibling) candidates.push(h.parentNode.previousElementSibling);
      for (const el of candidates) {
        const c = el.getAttribute?.("class") || "";
        const txt = textOf(el);
        const isPill = /rounded-full/.test(c) && /(inline-flex|flex|inline-block)/.test(c) && /(badge-label|micro-caption|text-xs|text-\[1[0-3]px\])/.test(c + el.innerHTML);
        const KEEP = /الخطوة|تم التحديث|من 6|هام •|جواز رياضي معتمد|مدرستك المفضلة|تنبيه اشتراك|^مجلة كابتنلي$/;
        if (isPill && !KEEP.test(txt) && txt.length >= 8 && txt.length <= 80 && !/ج\.م|EGP|\d+\s*(كم|km)/.test(txt) && el.querySelectorAll("button, a, input").length === 0) {
          removed.push(txt);
          el.remove();
        }
      }
    });
    if (removed.length) console.log(`[eyebrows removed] ${kind}/${name}:`, removed.join(" | "));
    const bodyClass = body.getAttribute("class") || "";
    const inner = body.childNodes.map((c) => convertNode(c)).join("");
    const comp = (isDesktop ? "D" : "P") + name.replace(/^_/, "").replace(/[^a-z0-9]/gi, "");
    const id = comp.replace(/^D|^P/, "");
    const tsx = `// AUTO-GENERATED from Screens/${kind}/${name}/code.html — faithful port of the reference design.\n/* eslint-disable */\n${ctx.usesLink ? 'import Link from "next/link";\n' : ""}${ctx.usesIcon ? 'import { Icon } from "@/components/Icon";\n' : ""}\nexport default function ${isDesktop ? "Desktop" : "Phone"}${id.charAt(0).toUpperCase() + id.slice(1)}() {\n  return (\n    <div className=${JSON.stringify("screen-root " + bodyClass)}>\n${inner}\n    </div>\n  );\n}\n`;
    fs.writeFileSync(path.join(OUT, `${comp}.tsx`), tsx, "utf8");
    index.push(comp);
  }
}
fs.writeFileSync(path.join(OUT, "_tw.json"), JSON.stringify(twUnion, null, 2));
fs.writeFileSync(path.join(OUT, "_images.json"), JSON.stringify(imgMap, null, 2));
console.log("Generated", index.length, "components");

// download images
let ok = 0, fail = 0;
const queue = Object.entries(imgMap).map(([url, rel]) => [url, path.join(ROOT, "public", rel)]);
async function worker() {
  while (queue.length) {
    const [url, dest] = queue.shift();
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) { ok++; continue; }
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw new Error(r.status);
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      ok++;
    } catch (e) { fail++; console.warn("img fail", url.slice(0, 80), e.message); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log("images ok", ok, "fail", fail);
