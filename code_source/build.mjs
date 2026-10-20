import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const manifestPath = path.join(rootDir, 'mypc-app.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '3.0.0';

const assetsDir = path.join(rootDir, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. Bundle & minify TypeScript application code from code_source/src/app.ts targeting Chromium 108 (Tizen 8+)
await esbuild.build({
  entryPoints: [path.join(__dirname, 'src', 'app.ts')],
  bundle: true,
  minify: true,
  target: ['chrome108', 'es2022'],
  format: 'iife',
  outfile: path.join(assetsDir, 'app.js'),
});

// 2. Minify CSS from code_source/src/style.css into /assets/style.css
const rawCss = fs.readFileSync(path.join(__dirname, 'src', 'style.css'), 'utf8');
const minifiedCss = esbuild.transformSync(rawCss, {
  loader: 'css',
  minify: true,
  target: ['chrome108'],
});
fs.writeFileSync(path.join(assetsDir, 'style.css'), minifiedCss.code, 'utf8');

// 3. Generate /index.html at repository root with versioned cache-busting query strings
const templateHtml = fs.readFileSync(path.join(__dirname, 'index.template.html'), 'utf8');
const finalHtml = templateHtml.replace(/\{\{VERSION\}\}/g, version);
fs.writeFileSync(path.join(rootDir, 'index.html'), finalHtml, 'utf8');

// 4. Mirror built assets into /dist for standard deployment pipelines
const distDir = path.join(rootDir, 'dist');
const distAssetsDir = path.join(distDir, 'assets');
fs.mkdirSync(distAssetsDir, { recursive: true });
fs.copyFileSync(path.join(rootDir, 'index.html'), path.join(distDir, 'index.html'));
fs.copyFileSync(path.join(rootDir, 'mypc-app.json'), path.join(distDir, 'mypc-app.json'));
fs.copyFileSync(path.join(rootDir, 'icon.svg'), path.join(distDir, 'icon.svg'));
fs.copyFileSync(path.join(assetsDir, 'app.js'), path.join(distAssetsDir, 'app.js'));
fs.copyFileSync(path.join(assetsDir, 'style.css'), path.join(distAssetsDir, 'style.css'));

console.log(`Built WebGL 3D Benchmark v${version} from code_source/ to repository root (/).`);
