import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

async function run() {
  const outDir = '.vite/renderer/main_window';
  const assetsDir = path.join(outDir, 'assets');

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  console.log('--- Building Renderer with Esbuild ---');
  await build({
    entryPoints: ['src/renderer.tsx'],
    bundle: true,
    outfile: path.join(assetsDir, 'index.js'),
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts',
      '.css': 'css',
      '.svg': 'dataurl',
    },
    minify: true,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  console.log('--- Moving and Updating index.html ---');
  let html = fs.readFileSync('index.html', 'utf-8');
  // Update the script tag to point to the bundled JS
  html = html.replace('/src/renderer.tsx', './assets/index.js');
  // Inject the CSS link tag
  html = html.replace('</head>', '  <link rel="stylesheet" href="./assets/index.css">\n  </head>');
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  console.log('--- Renderer Build Complete ---');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
