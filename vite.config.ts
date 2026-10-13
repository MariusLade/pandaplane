import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any static host or a mobile WebView wrapper.
  base: './',
  build: { target: 'es2022' },
});
