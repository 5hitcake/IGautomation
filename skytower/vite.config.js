import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> dist/        (für Capacitor/Android)
// `npm run build:single` -> dist-single/ (eine einzige HTML-Datei zum Testen am Handy)
// Test-Werkzeuge (Test-Münzen, alle Skins freischalten) sind in allen Builds
// aktiv, außer mit SKYTOWER_RELEASE=1 (für die Play-Store-Version).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig(({ mode }) => ({
  base: './',
  define: {
    __TEST_TOOLS__: JSON.stringify(process.env.SKYTOWER_RELEASE !== '1'),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
}));
