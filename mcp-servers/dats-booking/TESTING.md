# Testing Guide

## Overview

This project uses [Vitest](https://vitest.dev/) for unit and integration testing. Our testing philosophy prioritizes:
- **Business logic coverage** - Validate rules and calculations
- **Accessibility** - Ensure formatting works with screen readers
- **Regression prevention** - Catch bugs before they reach users
- **Confidence in refactoring** - Make changes safely

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

Coverage reports are generated in `coverage/` directory. Open `coverage/index.html` in a browser to view detailed coverage.

## Test Organization

```
src/__tests__/
├── unit/               # Pure function tests (no external dependencies)
│   └── plain-language.test.ts
├── integration/        # Multi-module tests (validates interactions)
│   └── booking-validation.test.ts
├── e2e/                # End-to-end tests (full workflows)
│   └── (future: booking-flow.test.ts)
└── fixtures/           # Test data and mock responses
    └── (future: dats-api-responses.ts)
```

### Unit Tests
Test individual functions in isolation. Focus on:
- Edge cases
- Input validation
- Output formatting
- Error handling

**Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { formatTimeWindow } from '../../utils/plain-language.js';

describe('formatTimeWindow', () => {
  it('should format time window with same period', () => {
    const window = { start: '2:00 PM', end: '2:30 PM' };
    expect(formatTimeWindow(window)).toBe('2:00 and 2:30 PM');
  });
});
```

### Integration Tests
Test how multiple modules work together. Focus on:
- Business rule validation
- Data transformation pipelines
- Service interactions

**Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { validateBookingWindow } from '../../utils/booking-validation.js';

describe('validateBookingWindow', () => {
  it('should reject obviously invalid date formats', () => {
    const result = validateBookingWindow('not-a-date', '14:00');
    expect(result.valid).toBe(false);
  });
});
```

### E2E Tests (Future)
Test complete user workflows. Focus on:
- Tool invocation → DATS API → response formatting
- Session management flows
- Error recovery scenarios

## Writing Tests

### AAA Pattern
Structure tests using Arrange-Act-Assert:
```typescript
it('should do something', () => {
  // Arrange: Set up test data
  const input = 'test data';

  // Act: Call the function
  const result = myFunction(input);

  // Assert: Verify the output
  expect(result).toBe('expected output');
});
```

### Descriptive Test Names
Use clear, specific test names that describe behavior:

✅ **Good:**
```typescript
it('should format escort as companion for plain language')
it('should reject bookings more than 3 days in advance')
it('should return "your location" for empty addresses')
```

❌ **Bad:**
```typescript
it('works')
it('test formatPassengerType')
it('handles edge case')
```

### Mock External Dependencies

When testing code that calls DATS API or other external services, mock them:

```typescript
import { vi } from 'vitest';

// Mock DATS API responses
vi.mock('../api/dats-api.js', () => ({
  DATSApi: vi.fn(() => ({
    getClientTrips: vi.fn(() => Promise.resolve([])),
  })),
}));
```

### Test Fixtures

Store reusable test data in `src/__tests__/fixtures/`:

```typescript
// fixtures/trips.ts
export const mockScheduledTrip = {
  bookingId: '12345',
  date: 'Mon, Jan 15, 2026',
  status: 'S',
  // ... full trip object
};
```

## Coverage Goals

### Target Coverage by Directory

| Directory | Current | Target | Priority |
|-----------|---------|--------|----------|
| `src/utils/` | ~25% | 80%+ | High |
| `src/api/parsers/` | 0% | 70%+ | Medium |
| `src/tools/` | 0% | 60%+ | Medium |
| `src/auth/` | 0% | 50%+ | Low |

**Note:** Not all code needs 100% coverage. Focus on:
- Business logic (validation, formatting)
- Data transformation (parsing, mapping)
- User-facing behavior (tool responses)

**Low priority for coverage:**
- Boilerplate code
- Simple getters/setters
- Framework integration code

## Common Testing Scenarios

### Testing Date/Time Functions

**Challenge:** Tests may be timezone-sensitive.

**Solution:** Mock system time or use absolute UTC timestamps:

```typescript
import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  // Set system time to a known value
  vi.setSystemTime(new Date('2026-01-15T17:00:00Z')); // 10:00 AM MST
});
```

### Testing Error Handling

Verify errors are caught and formatted properly:

```typescript
it('should handle invalid input gracefully', () => {
  const result = validateSomething('invalid');

  expect(result.valid).toBe(false);
  expect(result.error).toBeDefined();
  expect(result.error).toContain('expected error message');
});
```

### Testing Plain Language Output

Verify accessibility-friendly formatting:

```typescript
it('should format address in title case for screen readers', () => {
  const result = formatAddress('123 MAIN ST NW');

  expect(result).toBe('123 Main St NW');
  expect(result).not.toContain('ALL CAPS');
});
```

## Continuous Integration

Tests run automatically on:
- Every commit (pre-commit hook - future)
- Pull requests (GitHub Actions - future)
- Deployments (must pass before deploy - future)

## Test-Driven Development (TDD)

When adding new features:
1. **Write the test first** (it will fail - that's expected!)
2. Implement the feature to make the test pass
3. Refactor if needed (tests ensure it still works)

**Example:**
```typescript
// 1. Write test (fails initially)
it('should format saved locations as markdown table', () => {
  const locations = [{ name: 'Home', address: '123 Main St' }];
  const result = formatSavedLocations(locations);

  expect(result).toContain('| Name | Address |');
  expect(result).toContain('| Home | 123 Main St |');
});

// 2. Implement formatSavedLocations() to pass

// 3. Refactor if needed (test ensures it still works)
```

## Debugging Tests

### Run Single Test File
```bash
npm test -- src/__tests__/unit/plain-language.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- -t "formatTimeWindow"
```

### Enable Debug Output
```bash
DEBUG=* npm test
```

### VS Code Integration

Add to `.vscode/settings.json`:
```json
{
  "vitest.enable": true,
  "vitest.commandLine": "npm test"
}
```

## Known Limitations

### 1. Timezone Handling
Some validation tests are sensitive to system timezone. Future work should:
- Use UTC timestamps consistently
- Mock timezone context for tests
- Add timezone parameter to validation functions

### 2. DATS API Mocking
Integration tests currently don't mock DATS API responses. Future work should:
- Create mock SOAP responses in fixtures/
- Build mock DATS API client for testing
- Test error scenarios (network failures, timeouts)

### 3. E2E Test Coverage
No end-to-end tests yet. Future work should:
- Test full booking flow (connect → book → get trips)
- Test authentication flow (browser → session storage)
- Test error recovery (session expiry, API failures)

## Future Improvements

- [ ] Add pre-commit hook to run tests
- [ ] Set up GitHub Actions for CI
- [ ] Add E2E tests for critical workflows
- [ ] Improve timezone test handling
- [ ] Create comprehensive DATS API mock
- [ ] Add visual regression tests for formatted output
- [ ] Set up test data factories for complex objects

## Questions?

If you're unsure how to test something:
1. Look at existing tests for similar functionality
2. Check Vitest documentation: https://vitest.dev/
3. Ask in code review - testing is a team skill!

---

**Last Updated:** 2026-01-14 (Phase 0: Foundation)
**Next Review:** After Phase 2 (Test Coverage expansion)
