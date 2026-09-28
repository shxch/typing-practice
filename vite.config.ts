/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the site from /typing-practice/
export default defineConfig({
  base: '/typing-practice/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
