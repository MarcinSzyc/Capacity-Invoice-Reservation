import type {Config} from 'jest';

const shared = {
  rootDir: '.',
  testEnvironment: 'node',
  transform: {'^.+\\.ts$': ['ts-jest', {tsconfig: '<rootDir>/tsconfig.json'}]},
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  restoreMocks: true,
} as const;

const withInfrastructure = {
  globalSetup: '<rootDir>/test/support/global-setup.ts',
  globalTeardown: '<rootDir>/test/support/global-teardown.ts',
  testTimeout: 180_000,
} as const;

const config: Config = {
  projects: [
    {
      ...shared,
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/test/**/*.test.ts'],
    },
    {
      ...shared,
      ...withInfrastructure,
      displayName: 'integration',
      testMatch: [
        '<rootDir>/src/**/*.integration-test.ts',
        '<rootDir>/test/**/*.integration-test.ts',
      ],
    },
    {
      ...shared,
      ...withInfrastructure,
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/**/*.e2e-test.ts'],
    },
    {
      ...shared,
      displayName: 'cold-start',
      testMatch: ['<rootDir>/test/cold-start/**/*.smoke-test.ts'],
      testTimeout: 60_000,
    },
  ],
};

export default config;
