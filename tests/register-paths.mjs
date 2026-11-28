import fs from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire, registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

if (typeof globalThis.AsyncLocalStorage === "undefined") {
  globalThis.AsyncLocalStorage = AsyncLocalStorage;
}

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(ROOT_DIR, "src");

const TS_JS_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
  ".js",
];

function resolveExistingFile(basePath) {
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath;
  }
  for (const ext of TS_JS_EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const ext of TS_JS_EXTENSIONS) {
      const idx = path.join(basePath, `index${ext}`);
      if (fs.existsSync(idx) && fs.statSync(idx).isFile()) {
        return idx;
      }
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // 1. Resolve tsconfig `@/*` alias -> `./src/*`
    if (specifier.startsWith("@/")) {
      const target = path.join(SRC_DIR, specifier.slice(2));
      const resolved = resolveExistingFile(target);
      if (resolved) {
        return nextResolve(pathToFileURL(resolved).href, context);
      }
    }

    // 2. Resolve extensionless Next.js / next-auth subpath imports (e.g. `next/server` -> `next/server.js`)
    if (
      (specifier.startsWith("next/") || specifier.startsWith("next-auth/")) &&
      !path.extname(specifier)
    ) {
      try {
        return nextResolve(specifier, context);
      } catch {
        try {
          return nextResolve(`${specifier}.js`, context);
        } catch {
          return nextResolve(`${specifier}/index.js`, context);
        }
      }
    }

    // 3. Resolve relative TypeScript / directory imports without explicit extension
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:")
    ) {
      try {
        return nextResolve(specifier, context);
      } catch (err) {
        const parentDir = path.dirname(fileURLToPath(context.parentURL));
        const target = path.resolve(parentDir, specifier);
        const resolved = resolveExistingFile(target);
        if (resolved) {
          return nextResolve(pathToFileURL(resolved).href, context);
        }
        throw err;
      }
    }

    return nextResolve(specifier, context);
  },

  load(url, context, nextLoad) {
    if (
      url.startsWith("file:") &&
      !url.includes("/node_modules/") &&
      (url.endsWith(".ts") || url.endsWith(".tsx"))
    ) {
      const filePath = fileURLToPath(url);
      const source = fs.readFileSync(filePath, "utf8");
      const result = ts.transpileModule(source, {
        fileName: filePath,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          isolatedModules: true,
          inlineSourceMap: true,
          inlineSources: true,
        },
      });
      return {
        format: "module",
        source: result.outputText,
        shortCircuit: true,
      };
    }

    return nextLoad(url, context);
  },
});
