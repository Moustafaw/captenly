import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import madge from "madge";

const REPORT_DIR = path.join(process.cwd(), "qa-reports", "madge");
fs.mkdirSync(REPORT_DIR, { recursive: true });

function buildDotFromGraph(graph) {
  const lines = ['digraph CaptenlyDependencies {', '  rankdir="LR";', '  node [shape=box, style="rounded,filled", fillcolor="#EAF4F8", color="#0F4C5C", fontname="Segoe UI"];'];
  for (const [from, deps] of Object.entries(graph)) {
    for (const to of deps) {
      lines.push(`  "${from}" -> "${to}";`);
    }
  }
  lines.push("}");
  return lines.join("\n");
}

async function main() {
  const result = await madge("src", {
    tsConfig: path.join(process.cwd(), "tsconfig.json"),
    fileExtensions: ["ts", "tsx"],
    excludeRegExp: [/\.next/, /node_modules/],
  });

  const graph = result.obj();
  const circular = result.circular();
  const orphans = result.orphans();

  fs.writeFileSync(
    path.join(REPORT_DIR, "dependency-graph.json"),
    JSON.stringify(graph, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(REPORT_DIR, "circular.json"),
    JSON.stringify(circular, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(REPORT_DIR, "dependency-graph.dot"),
    buildDotFromGraph(graph),
    "utf8"
  );

  let svgGenerated = false;
  const dotCheck = spawnSync("dot", ["-V"], { encoding: "utf8", shell: true });
  if (dotCheck.status === 0) {
    try {
      const svgBuf = await result.svg();
      fs.writeFileSync(path.join(REPORT_DIR, "dependency-graph.svg"), svgBuf);
      svgGenerated = true;
    } catch {
      svgGenerated = false;
    }
  }

  const edgeCount = Object.values(graph).reduce((sum, list) => sum + list.length, 0);
  const summary = {
    totalFilesScanned: Object.keys(graph).length,
    totalImportEdges: edgeCount,
    circularDependenciesCount: circular.length,
    circularPaths: circular,
    orphansCount: orphans.length,
    svgGenerated,
  };
  fs.writeFileSync(
    path.join(REPORT_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
