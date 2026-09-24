import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    // Dummy, valid-shaped env so config/env parses during integration tests.
    // (dotenv does not override already-set vars, so these win.)
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/edupay_test?schema=public',
      JWT_SECRET: 'test-jwt-secret-at-least-16-characters',
      JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-16-characters',
      STRIPE_SECRET_KEY: 'sk_test_dummy_key',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_dummy_secret',
      FRONTEND_URL: 'http://localhost:3000',
    },
  },
});
