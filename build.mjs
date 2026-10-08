import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
const files = ["index.html", "styles.css", "main.js", "deck-controller.js", "wheel-input.js", "swipe-hint.js", "motion.js", "layout.js", "contact-dialog.js", "demo-settings.js", "tuning-config.js", "qa-diagnostics.js", "favicon.svg"];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await Promise.all(
  files.map((file) => copyFile(path.join(root, file), path.join(dist, file))),
);

let revision = "uncommitted";
try {
  revision = execFileSync("git", ["-c", `safe.directory=${root.replaceAll('\\', '/')}`, "rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
} catch { /* A source archive can still be previewed locally. */ }
const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash("sha256").update(await readFile(path.join(dist, file))).digest("hex")])));
await writeFile(path.join(dist, "revision.json"), JSON.stringify({ revision, assets: hashes }, null, 2) + "\n");

console.log(`Built ${files.length} static assets in ${path.relative(root, dist)}`);
