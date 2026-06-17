// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: "https://gabroberge.github.io",
  base: "/legacy-as-a-service/",
  vite: {
    plugins: [tailwindcss()],
  },
});