/**
 * Test-specific constants for ngx-keys library testing.
 * These values are used in test utilities and test suites.
 */

/**
 * Default delay in milliseconds between steps in multi-step sequence simulations.
 * @default 100ms
 */
export const DEFAULT_TEST_STEP_DELAY_MS = 100;

/**
 * Short delay for quick async operations in tests.
 * @default 50ms
 */
export const SHORT_TEST_DELAY_MS = 50;

/**
 * Standard delay for async test assertions.
 * @default 200ms
 */
export const STANDARD_TEST_DELAY_MS = 200;

/**
 * Timeout longer than the default sequence timeout (2000ms) to test sequence expiration.
 * Should be DEFAULT_SEQUENCE_TIMEOUT_MS + buffer.
 * @default 2200ms
 */
export const SEQUENCE_TIMEOUT_TEST_MS = 2200;
