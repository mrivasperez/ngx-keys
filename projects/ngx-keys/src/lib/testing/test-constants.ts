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
 * Timeout for testing sequence timeout behavior.
 * Used when a shortcut has an explicit timeout configured.
 * @default 1000ms (1 second)
 */
export const SEQUENCE_TIMEOUT_TEST_MS = 1000;

/**
 * Delay longer than SEQUENCE_TIMEOUT_TEST_MS to test sequence expiration.
 * Should be SEQUENCE_TIMEOUT_TEST_MS + buffer.
 * @default 1200ms
 */
export const SEQUENCE_EXPIRATION_TEST_MS = 1200;
