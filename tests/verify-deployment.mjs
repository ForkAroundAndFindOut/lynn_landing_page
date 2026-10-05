import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args], { cwd: root });
const expectedRevision = process.argv[2] || git('rev-parse', 'HEAD').toString().trim();
const preview = process.env.BASE_URL || 'https://codex-card-layout-lynn-landing-page.nrct6ycww6.workers.dev';
const production = 'https://lynn-landing-page.nrct6ycww6.workers.dev';
const expectedProductionHash = '4e48750db67c9167ae8cde0d95bc5eaf4f326e9613143f39b976474e50c8cae3';
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const metadataResponse = await fetch(`${preview}/revision.json`);
assert.equal(metadataResponse.status, 200);
const metadata = await metadataResponse.json();
assert.equal(metadata.revision, expectedRevision);
const assets = await Promise.all(Object.entries(metadata.assets).map(async ([file, expectedHash]) => {
  const response = await fetch(`${preview}/${file}`);
  assert.equal(response.status, 200, `${file} must load`);
  const deployedHash = hash(Buffer.from(await response.arrayBuffer()));
  const sourceHash = hash(git('show', `${expectedRevision}:${file}`));
  assert.equal(deployedHash, expectedHash, `${file} must match build manifest`);
  assert.equal(deployedHash, sourceHash, `${file} must match committed source`);
  return { file, status: response.status, sha256: deployedHash, matchesManifestAndCommit: true };
}));
const expectedAssetCount = process.env.EXPECTED_ASSET_COUNT ? Number(process.env.EXPECTED_ASSET_COUNT) : 12;
assert.equal(assets.length, expectedAssetCount);
const productionResponse = await fetch(production);
assert.equal(productionResponse.status, 200);
const productionHash = hash(Buffer.from(await productionResponse.text(), 'utf8'));
assert.equal(productionHash, expectedProductionHash, 'Existing production HTML must remain unchanged');
const preservedLocalHeads = {
  main: '0b10b41b59e717da2cc6f83f9e950250541eac3d',
  'floating-card': 'f5311c548a57cc409ef20773b6e45b17fdacf43e',
  'scrolling-reveal': '1733fa7bb7a5c53233da83df93b334ab78441611',
  'theme-2-pallette-1': 'e0b332ca07172745692d3e3060656ab0501acb64',
  'theme-2-pallette-1-heavy': '15c96a3d15e07d7f3505d3b51d1fac729e784fb1',
  'theme-2-pallette-2': 'de9cc08ed6feacc080ed3844bc925ce2aa1e8458',
  'codex/card-layout-swipe-hint': 'b14176fdec35e2460d0aa33abcdc64025d4c5a14',
};
const localHeads = Object.fromEntries(Object.keys(preservedLocalHeads).map(branch => [branch, git('rev-parse', `refs/heads/${branch}`).toString().trim()]));
assert.deepEqual(localHeads, preservedLocalHeads, 'All original local branches must retain their heads');
const remoteURL = 'https://github.com/ForkAroundAndFindOut/lynn_landing_page.git';
const remoteHeads = Object.fromEntries(git('ls-remote', '--heads', remoteURL).toString().trim().split('\n').map(line => {
  const [revision, ref] = line.trim().split(/\s+/);
  return [ref.replace('refs/heads/', ''), revision];
}));
for (const branch of ['main', 'floating-card', 'scrolling-reveal', 'codex/card-layout-swipe-hint']) assert.equal(remoteHeads[branch], preservedLocalHeads[branch], `Preserved remote branch ${branch} must remain unchanged`);
const originalRoot = path.dirname(path.resolve(root, git('rev-parse', '--git-common-dir').toString().trim()));
const originalBranch = git('-c', `safe.directory=${originalRoot.replaceAll('\\', '/')}`, '-C', originalRoot, 'branch', '--show-current').toString().trim();
assert.equal(originalBranch, 'main', 'Original checkout must remain on main');
const report = { checkedAt: new Date().toISOString(), preview, revision: metadata.revision, assets, production: { url: production, status: 200, sha256: productionHash, unchanged: true }, isolation: { localHeads, remoteHeads, originalCheckoutBranch: originalBranch, unchanged: true } };
const directory = path.resolve(process.env.EVIDENCE_DIR || path.join(root, 'verification', 'hosted'));
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, 'integrity.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ revision: report.revision, assetsVerified: assets.length, productionUnchanged: true, originalBranchesUnchanged: true }));
