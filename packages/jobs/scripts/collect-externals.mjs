// Copies the lockfile-resolved subtree of the bundle's external packages
// (bullmq, @prisma/client) out of pnpm's virtual store into <outDir>/node_modules,
// so the runtime image ships EXACTLY what pnpm-lock.yaml pinned (and what the
// workspace's minimumReleaseAge / trustPolicy already vetted at install time).
// Usage: node collect-externals.mjs <outDir> <pkgDir> [<pkgDir> ...]
//   pkgDir = a symlinked package dir, e.g. packages/jobs/node_modules/bullmq
import { cpSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';

const [outDir, ...roots] = process.argv.slice(2);
// Optional peers pnpm links in; never required at runtime (generated client is
// already built, Prisma CLI is a devDependency).
const SKIP = new Set(['prisma', 'typescript']);

// slot = <store>/.pnpm/<id>   (package lives at <slot>/node_modules/<name>)
const slotOf = (real) => {
  const parts = real.split(sep);
  const i = parts.lastIndexOf('.pnpm');
  return parts.slice(0, i + 2).join(sep);
};

const seen = new Set();
const top = [];
const queue = roots.map((r) => ({ real: realpathSync(r), name: r.split('/node_modules/').pop() }));
for (const q of queue.slice()) top.push(q);

while (queue.length) {
  const { real } = queue.pop();
  const slot = slotOf(real);
  if (seen.has(slot)) continue;
  seen.add(slot);
  const nm = join(slot, 'node_modules');
  const entries = [];
  for (const e of readdirSync(nm)) {
    if (e.startsWith('@')) for (const s of readdirSync(join(nm, e))) entries.push(`${e}/${s}`);
    else entries.push(e);
  }
  for (const name of entries) {
    const p = join(nm, name);
    if (!lstatSync(p).isSymbolicLink()) continue; // the package itself
    if (SKIP.has(name)) continue;
    queue.push({ real: realpathSync(p), name });
  }
}

const dstPnpm = join(outDir, 'node_modules', '.pnpm');
mkdirSync(dstPnpm, { recursive: true });
for (const slot of seen) {
  const dst = join(dstPnpm, basename(slot));
  cpSync(slot, dst, { recursive: true, verbatimSymlinks: true });
  // drop skipped peer links (would dangle)
  for (const n of SKIP) rmSync(join(dst, 'node_modules', n), { force: true });
}
for (const { real, name } of top) {
  const link = join(outDir, 'node_modules', name);
  mkdirSync(dirname(link), { recursive: true });
  const target = join(dstPnpm, basename(slotOf(real)), 'node_modules', name);
  symlinkSync(relative(dirname(link), target), link);
}
console.log(`collected ${seen.size} packages -> ${outDir}/node_modules`);
