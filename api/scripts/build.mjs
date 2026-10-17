import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { zipSync } from 'fflate';

const functions = { api: 'src/index.ts', 'events-auth': 'src/events-auth.ts' };
const version = process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev';
const epoch = new Date('1980-01-02T00:00:00Z');

rmSync('dist', { recursive: true, force: true });

for (const [name, entry] of Object.entries(functions)) {
  const dir = `dist/${name}`;
  mkdirSync(dir, { recursive: true });

  await build({
    entryPoints: [entry],
    outfile: `${dir}/index.mjs`,
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    minify: true,
    sourcemap: true,
    legalComments: 'none',
    external: ['@aws-sdk/*'],
    define: { 'process.env.APP_VERSION': JSON.stringify(version) },
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
    logLevel: 'warning',
  });

  const files = Object.fromEntries(
    ['index.mjs', 'index.mjs.map'].map((file) => [
      file,
      [readFileSync(`${dir}/${file}`), { mtime: epoch }],
    ]),
  );
  writeFileSync(`dist/${name}.zip`, zipSync(files, { level: 9 }));
}

console.log(`built ${Object.keys(functions).join(', ')} (version ${version})`);
