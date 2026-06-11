import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Em GitHub Actions, GITHUB_REPOSITORY = "usuario/repo".
// O base path e detectado automaticamente; o nome do repositorio e livre (pendencia P1).
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]

export default defineConfig({
  plugins: [react()],
  base: repo ? `/${repo}/` : '/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
