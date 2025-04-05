import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

// Use defineConfig with a function to conditionally set base
export default defineConfig(({ command }) => {
  const base = command === 'build' ? '/pitch-detector/' : '/';

  return {
    base: base, // Set the base dynamically
    plugins: [solidPlugin(), tailwindcss()],
    server: {
      port: 3000,
    },
    build: {
      target: 'esnext',
    },
  };
});
