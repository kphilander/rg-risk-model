import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { cspPlugin } from './vite.config'

// Portable build: ONE self-contained HTML file (all JS/CSS inlined) that an
// analyst can be emailed, download, and double-click. Works from file:// and
// fully offline; the strict CSP is injected here too.
export default defineConfig({
  plugins: [react(), viteSingleFile(), cspPlugin()],
  build: {
    outDir: 'dist-portable',
    emptyOutDir: true,
  },
})
