import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const root = __dirname

const alias = {
  '@': resolve(root, 'src/renderer/src'),
  '@shared': resolve(root, 'src/shared'),
  '@main': resolve(root, 'src/main')
}

export default defineConfig({
  resolve: { alias },
  test: {
    restoreMocks: true,
    clearMocks: true,
    passWithNoTests: true,
    exclude: ['node_modules/**', 'out/**', 'release/**', 'dist/**', 'scripts/**', 'tests/e2e/**'],
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          testTimeout: 10_000,
          hookTimeout: 10_000
        }
      },
      {
        resolve: { alias },
        test: {
          name: 'contracts',
          environment: 'node',
          include: ['tests/contracts/**/*.test.ts'],
          testTimeout: 15_000,
          hookTimeout: 15_000
        }
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000
        }
      }
    ],
    coverage: {
      provider: 'v8',
      include: ['src/shared/domain/**/*.ts', 'src/shared/print/**/*.ts'],
      exclude: ['**/*.generated.ts', '**/index.ts'],
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 80
      }
    }
  }
})
