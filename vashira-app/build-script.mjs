import { build } from 'vite';
import react from '@vitejs/plugin-react';

async function runBuilds() {
  console.log('--- Building Renderer ---');
  await build({
    configFile: false,
    plugins: [react()],
    base: './',
    root: '.',
    build: {
      outDir: '.vite/renderer/main_window',
      emptyOutDir: true,
    }
  });

  console.log('--- Building Main ---');
  await build({
    configFile: false,
    build: {
      ssr: true,
      lib: {
        entry: 'src/main.ts',
        formats: ['cjs'],
        fileName: () => 'main.js',
      },
      rollupOptions: {
        external: ['electron', 'better-sqlite3'],
      },
      outDir: '.vite/build',
      emptyOutDir: false,
    }
  });

  console.log('--- Building Preload ---');
  await build({
    configFile: false,
    build: {
      ssr: true,
      lib: {
        entry: 'src/preload.ts',
        formats: ['cjs'],
        fileName: () => 'preload.js',
      },
      rollupOptions: {
        external: ['electron'],
      },
      outDir: '.vite/build',
      emptyOutDir: false,
    }
  });
}

runBuilds().catch(err => {
  console.error(err);
  process.exit(1);
});
