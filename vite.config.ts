import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        gallery: new URL('./gallery.html', import.meta.url).pathname,
      },
    },
  },
});
