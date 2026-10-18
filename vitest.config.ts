import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/tests/**/*.test.ts'],
        mockReset: true,
        restoreMocks: true,
        unstubEnvs: true,
    },
});
