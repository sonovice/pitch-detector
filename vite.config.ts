import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

// Use defineConfig with a function to conditionally set base
export default defineConfig(({ command }) => {
  return {
    base: "./", // Set the base dynamically
    plugins: [solidPlugin(), tailwindcss()],
    server: {
      port: 3000,
    },
    build: {
      target: 'esnext',
    },
    worker: {
      format: 'es', // Explicitly set format for modern compatibility
      // rollupOptions can be added here if needed later
    }
  };
});
