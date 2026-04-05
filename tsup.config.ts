import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Bundle prompt markdown files and HBS templates into the output
  loader: {
    '.md': 'text',
    '.hbs': 'text',
  },
})
