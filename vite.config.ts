import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Strict Content-Security-Policy, injected into BUILT output only (the dev
// server needs HMR websockets). connect-src 'none' makes "zero network
// requests" a browser-enforced guarantee, not just a claim — an analyst (or
// their security team) can verify it in the page source.
const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; " +
  "object-src 'none'; base-uri 'none'; form-action 'none'"

export function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cspPlugin()],
  server: {
    port: 5173,
    host: true,
  },
})
