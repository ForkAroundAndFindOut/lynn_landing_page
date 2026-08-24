import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
const files = ["index.html", "styles.css", "script.js", "favicon.svg"];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await Promise.all(
  files.map((file) => copyFile(path.join(root, file), path.join(dist, file))),
);

console.log(`Built ${files.length} static assets in ${path.relative(root, dist)}`);
