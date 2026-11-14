import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Run `npm run generate-pwa-assets` after changing public/favicon.svg.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: minimal2023Preset,
  images: ['public/favicon.svg'],
});
