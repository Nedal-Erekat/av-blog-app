/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  setupFiles: ['dotenv/config'],
  // Integration tests hit a real Supabase DB over the network — several sequential
  // requests per test can exceed Jest's 5s default, especially under load.
  testTimeout: 30000,
};
