import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    target: 'node18',
    lib: {
      entry: 'src/main.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['electron', 'better-sqlite3'],
      output: {
        entryFileNames: '[name].js',
      },
    },
    outDir: '.vite/build',
  },
});
