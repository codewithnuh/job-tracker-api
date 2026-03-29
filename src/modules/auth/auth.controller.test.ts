/**
 * AUTH CONTROLLER - HARD LEVEL TESTS
 * ===================================
 * 
 * These tests simulate real HTTP requests and responses using Fastify's
 * request/reply mocking capabilities. We test at the controller layer because:
 * 
 * 1. CONTROLLER TESTS vs UNIT TESTS:
 *    - Unit tests (service layer) test business logic in isolation
 *    - Controller tests verify HTTP concerns: status codes, headers, cookies
 *    - Controller tests catch integration issues between layers
 * 
 * 2. WHY MOCK THE SERVICE LAYER?
 *    - Controllers should only orchestrate; business logic lives in services
 *    - Service tests already cover business logic thoroughly
 *    - Controller tests focus on HTTP concerns, not business logic
 *    - Faster test execution (no DB calls)
 *    - Clear separation: if a test fails, you know exactly which layer broke
 * 
 * 3. TESTING STRATEGY - "Arrange, Act, Assert" (AAA):
 *    - Arrange: Set up mocks, request payload, cookies
 *    - Act: Call the controller method
 *    - Assert: Verify response status, body, cookies
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";
import { authController } from "./auth.controller";
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} from "../../utils/errors/http.errors";

// =============================================================================
// TYPE DEFINITIONS FOR TESTING
// These mirror the actual types used in the controller
// =============================================================================

/** Request body for registration and login endpoints */
interface AuthBody {
  name?: string;
  email: string;
  password: string;
}

interface MockReply {
  statusCode: number;
  sent: boolean;
  sentData: Record<string, unknown>;
  setCookie: ReturnType<typeof vi.fn>;
  clearCookie: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

/** Success response shape that service methods return */
const mockUserResult = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  createdAt: new Date("2024-01-01"),
};

// =============================================================================
// MOCK SETUP
// We mock the service layer to isolate controller behavior
// =============================================================================

/**
 * MOCKING STRATEGY:
 * 
 * Why we mock userService:
 * 
 * 1. TEST ISOLATION: 
 *    - If service has a bug, controller tests shouldn't fail
 *    - Controller tests should only fail for controller-level issues
 * 
 * 2. TEST SPEED:
 *    - No database queries, no bcrypt hashing, no JWT operations
 *    - Tests run in milliseconds instead of seconds
 * 
 * 3. DETERMINISM:
 *    - Real services involve timing, external systems, randomness
 *    - Mocks give us predictable, reproducible results
 * 
 * 4. EDGE CASES:
 *    - We can easily test error scenarios without setting up DB states
 *    - We can test boundary conditions that are hard to create in real DB
 */
vi.mock("./auth.service", () => ({
  userService: {
    registerUser: vi.fn(),
    loginUser: vi.fn(),
    logoutUser: vi.fn(),
    getCurrentUser: vi.fn(),
    getUserByEmail: vi.fn(),
    refreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
  },
}));

vi.mock("../../utils/auth/token", () => ({
  verifyAccessToken: vi.fn(),
}));

import { userService } from "./auth.service";
import { verifyAccessToken } from "../../utils/auth/token";

// =============================================================================
// TEST DATA - EDGE CASES & BOUNDARIES
// =============================================================================

/**
 * TEST DATA STRATEGY:
 * 
 * We test with boundary values and special characters because:
 * 
 * 1. BOUNDARY TESTING:
 *    - Real users hit edge cases: passwords at minimum length, names at limits
 *    - Security bugs often appear at boundaries
 * 
 * 2. INJECTION ATTEMPTS:
 *    - SQL injection, XSS, etc. often use special characters
 *    - Tests with special chars verify sanitization is working
 * 
 * 3. UNICODE/INTERNATIONALIZATION:
 *    - Users have names with accents, emojis, non-Latin characters
 *    - Emails can have international domains
 */
const VALID_REGISTRATION = {
  name: "Valid User",
  email: "valid@example.com",
  password: "securePass123",
};

const EDGE_CASE_NAMES = [
  "Jo",                        // 2 chars - likely below minimum
  "José García",              // Unicode characters
  "田中太郎",                  // Non-Latin characters
];

const SUSPICIOUS_INPUTS = [
  "'; DROP TABLE users; --",   // SQL injection attempt
  "<script>alert('xss')</script>", // XSS attempt
];

// =============================================================================
// HOOKS - Test isolation setup
// =============================================================================

/**
 * beforeEach: Reset all mocks before each test
 * 
 * WHY RESET MOCKS?
 * - Tests should be independent (no shared state)
 * - Without reset, one test's mocks could leak into another
 * - This prevents "mysterious" failures where one test breaks another
 */
beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// MOCK FACTORIES
// =============================================================================

/**
 * Mock FastifyRequest object
 * 
 * WHY create a custom mock?
 * 
 * 1. FastifyRequest is complex with many properties
 *    - body, params, query, headers, cookies, etc.
 *    - We only mock what we need
 * 
 * 2. Type safety
 *    - Partial types allow flexible setup
 *    - Each test adds only what it needs
 * 
 * NOTE: We use 'as any' because exactOptionalPropertyTypes is strict in tsconfig.
 * In production tests, you might want to disable this option or use proper type guards.
 */
function createMockRequest(overrides: Partial<{
  body: AuthBody;
  cookies: Record<string, string>;
}> = {}): any {
  return {
    body: { email: "test@example.com", password: "password123", name: "Test User", ...overrides.body },
    cookies: { ...overrides.cookies },
  };
}

/**
 * Mock FastifyReply object
 * 
 * WHY create a custom mock?
 * 
 * 1. FastifyReply is complex with many methods
 *    - setCookie, clearCookie, send, status, etc.
 *    - We only mock what we need
 * 
 * 2. Assertion helpers
 *    - Store sent data for easy assertion
 *    - Track called methods
 * 
 * 3. Chained method support
 *    - Fastify uses fluent interface (return this)
 *    - Mock must support chaining
 */
function createMockReply(): any {
  const reply: any = {
    statusCode: 200,
    sent: false,
    sentData: null,
  };
  
  reply.setCookie = vi.fn(function(this: any) { return this; });
  reply.clearCookie = vi.fn(function(this: any) { return this; });
  reply.status = vi.fn(function(this: any, code: number) { 
    this.statusCode = code; 
    return this; 
  });
  reply.send = vi.fn(function(this: any, data: any) {
    this.sent = true;
    this.sentData = data;
    return this;
  });
  
  return reply;
}

// =============================================================================
// REGISTER ENDPOINT TESTS
// =============================================================================

describe("authController.register", () => {
  // ---------------------------------------------------------------------------
  // HAPPY PATH TESTS
  // ---------------------------------------------------------------------------
  
  /**
   * SUCCESS CASE TESTING:
   * 
   * WHY test successful registration?
   * - Verify 201 status code (CREATED is correct for new resources)
   * - Verify cookie is set with correct configuration
   * - Verify response body contains expected structure
   * 
   * STATUS CODE SELECTION:
   * - 201 Created: Used when POST creates a new resource
   * - NOT 200 OK: 200 is for successful retrieval/update, not creation
   * - NOT 204 No Content: We'd want to return the created resource
   */
  it("returns 201 with user data on successful registration", async () => {
    const mockRequest = createMockRequest({ body: VALID_REGISTRATION });
    const mockReply = createMockReply();
    
    // Configure service mock to return success
    (userService.registerUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: mockUserResult,
      accesToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    });

    // Act: Call the controller
    await authController.register(mockRequest as any, mockReply as any);

    // Assert: Verify HTTP 201 Created response
    expect(mockReply.statusCode).toBe(201);
    expect(mockReply.sent).toBe(true);
    expect(mockReply.sentData).toMatchObject({
      success: true,
      data: { user: mockUserResult },
      message: "User Registered Successfully",
    });
  });

  /**
   * COOKIE SECURITY TEST:
   * 
   * WHY verify cookie configuration?
   * 
   * 1. httpOnly: true
   *    - Prevents JavaScript access (XSS attacks can't steal cookies)
   *    - Critical security setting for authentication cookies
   * 
   * 2. sameSite: 'strict'
   *    - Prevents CSRF attacks
   *    - Cookie only sent on same-origin requests
   * 
   * 3. secure: process.env.NODE_ENV === 'production'
   *    - HTTPS only in production
   *    - Allows HTTP in development for testing convenience
   * 
   * 4. maxAge: 7200
   *    - 2 hour expiration
   *    - Balance between convenience (longer) and security (shorter)
   */
  it("sets secure cookie with correct configuration", async () => {
    const mockRequest = createMockRequest({ body: VALID_REGISTRATION });
    const mockReply = createMockReply();
    
    (userService.registerUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: mockUserResult,
      accesToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    });

    await authController.register(
      mockRequest as any,
      mockReply as unknown as FastifyReply,
    );

    expect(mockReply.setCookie).toHaveBeenCalledWith(
      "token",
      "mock-access-token",
      expect.objectContaining({
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        maxAge: 7200,
      }),
    );
    expect(mockReply.setCookie).toHaveBeenCalledWith(
      "refreshToken",
      "mock-refresh-token",
      expect.objectContaining({
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        maxAge: 604800,
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // ERROR HANDLING TESTS
  // ---------------------------------------------------------------------------

  /**
   * ERROR PROPAGATION TEST:
   * 
   * WHY test that errors bubble up correctly?
   * 
   * 1. Controllers should NOT catch and hide errors
   *    - Errors need to propagate to Fastify's error handler
   *    - Error handler formats the response consistently
   * 
   * 2. Error types should be preserved
   *    - ConflictError → 409 status
   *    - ValidationError → 400 status
   *    - UnauthorizedError → 401 status
   * 
   * 3. Error messages may contain sensitive info
   *    - Don't expose internal details in responses
   *    - Log full details server-side
   */
  it("propagates ConflictError when email already exists", async () => {
    const mockRequest = createMockRequest({ body: VALID_REGISTRATION });
    const mockReply = createMockReply();
    
    // Service throws ConflictError for duplicate email
    (userService.registerUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ConflictError("Email already registered"),
    );

    // The error should propagate (not be caught by controller)
    await expect(
      authController.register(
        mockRequest as any,
        mockReply as unknown as FastifyReply,
      ),
    ).rejects.toThrow(ConflictError);
  });

  /**
   * VALIDATION ERROR TEST:
   * 
   * WHY test validation failures?
   * 
   * 1. User input is UNTRUSTED
   *    - Clients can send malformed data
   *    - Validators protect the service layer
   * 
   * 2. Zod validation errors should propagate
   *    - Fastify has built-in schema validation
   *    - Controller can assume valid input if validation passes
   * 
   * 3. Error messages should be user-friendly
   *    - Technical details logged, not exposed
   */
  it("propagates BadRequestError for invalid input", async () => {
    const mockRequest = createMockRequest({ 
      body: { email: "invalid-email", password: "123" } 
    });
    const mockReply = createMockReply();
    
    (userService.registerUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new BadRequestError("Invalid email format"),
    );

    await expect(
      authController.register(
        mockRequest as any,
        mockReply as unknown as FastifyReply,
      ),
    ).rejects.toThrow(BadRequestError);
  });

  // ---------------------------------------------------------------------------
  // EDGE CASE TESTS
  // ---------------------------------------------------------------------------

  /**
   * EDGE CASE: MINIMUM VALID INPUT
   * 
   * WHY test minimum valid input?
   * 
   * 1. Boundary conditions often have bugs
   *    - Schema says min 5 chars for name
   *    - At exactly 5 chars, does it work?
   * 
   * 2. Performance implications
   *    - Very long names might cause issues
   *    - We want to know the limits
   * 
   * 3. Security considerations
   *    - Buffer overflow potential with very long inputs
   *    - Database column size limits
   */
  it("accepts registration with minimum valid name length", async () => {
    const mockRequest = createMockRequest({
      body: { ...VALID_REGISTRATION, name: "John" } // Exactly 5 chars
    });
    const mockReply = createMockReply();
    
    (userService.registerUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { ...mockUserResult, name: "John" },
      accesToken: "token",
      refreshToken: "refresh",
    });

    await authController.register(
      mockRequest as any,
      mockReply as unknown as FastifyReply,
    );

    expect(mockReply.statusCode).toBe(201);
    expect(userService.registerUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: "John" }),
    );
  });

  /**
   * EDGE CASE: UNICODE AND SPECIAL CHARACTERS
   * 
   * WHY test internationalization?
   * 
   * 1. Real users have diverse names
   *    - Accents: José
   *    - Non-Latin: 田中太郎
   * 
   * 2. Encoding issues can cause silent failures
   *    - Name saved as "???" in database
   *    - Characters dropped or corrupted
   * 
   * 3. Unicode normalization
   *    - Same visual name can have different byte representations
   */
  it("handles registration with unicode name", async () => {
    const unicodeName = "José García";
    const mockRequest = createMockRequest({
      body: { ...VALID_REGISTRATION, name: unicodeName }
    });
    const mockReply = createMockReply();
    
    (userService.registerUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { ...mockUserResult, name: unicodeName },
      accesToken: "token",
      refreshToken: "refresh",
    });

    await authController.register(
      mockRequest as any,
      mockReply as unknown as FastifyReply,
    );

    expect(userService.registerUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: unicodeName }),
    );
  });

  /**
   * SECURITY TEST: INJECTION ATTEMPTS
   * 
   * WHY test with suspicious input?
   * 
   * 1. Defense in depth
   *    - Schema validation is first line of defense
   *    - Service layer validation is second
   *    - We want to know where attacks are stopped
   * 
   * 2. The controller should NOT sanitize
   *    - Controllers should pass raw input to services
   *    - Sanitization happens in validation layer
   *    - This test verifies data passes through unchanged
   * 
   * 3. Logging for forensics
   *    - Suspicious inputs should be logged
   *    - Security team can analyze patterns
   */
  it("passes suspicious input to service without sanitizing (defense in depth)", async () => {
    const suspiciousInput = "'; DROP TABLE users; --";
    const mockRequest = createMockRequest({
      body: { ...VALID_REGISTRATION, name: suspiciousInput }
    });
    const mockReply = createMockReply();
    
    (userService.registerUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new BadRequestError("Invalid characters in name"),
    );

    await expect(
      authController.register(
        mockRequest as any,
        mockReply as unknown as FastifyReply,
      ),
    ).rejects.toThrow();

    expect(userService.registerUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: suspiciousInput }),
    );
  });
});

// =============================================================================
// LOGIN ENDPOINT TESTS
// =============================================================================

describe("authController.login", () => {
  /**
   * HAPPY PATH TEST:
   * 
   * WHY verify 200 status for login?
   * - Login retrieves/validates existing session
   * - 200 OK is correct for successful retrieval
   * - NOT 201 Created (we didn't create a new resource)
   */
  it("returns 200 with user data on successful login", async () => {
    const mockRequest = createMockRequest({ 
      body: { email: "user@example.com", password: "password123" },
      cookies: {},
    });
    const mockReply = createMockReply();
    
    (userService.loginUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: mockUserResult,
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });

    await authController.login(
      mockRequest as any,
      mockReply as unknown as FastifyReply,
    );

    expect(mockReply.statusCode).toBe(200);
    expect(mockReply.sentData).toMatchObject({
      success: true,
      message: "Login Successful",
    });
    expect(mockReply.setCookie).toHaveBeenCalledWith(
      "refreshToken",
      "new-refresh-token",
      expect.objectContaining({
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        maxAge: 604800,
      }),
    );
  });

  /**
   * SESSION CACHING TEST:
   * 
   * WHY test existing session detection?
   * 
   * 1. UX optimization
   *    - If already logged in with same email, return session info
   *    - Don't regenerate tokens unnecessarily
   * 
   * 2. Token regeneration costs
   *    - JWT signing is CPU-intensive
   *    - Avoid regeneration if existing token is valid
   * 
   * 3. Race condition prevention
   *    - What if someone tries to login while already logged in?
   *    - Behavior should be deterministic
   */
  it("returns existing session without regenerating tokens", async () => {
    const existingToken = "valid-existing-token";
    const email = "user@example.com";
    
    const mockRequest = createMockRequest({
      body: { email, password: "password123" },
      cookies: { token: existingToken },
    });
    const mockReply = createMockReply();
    
    (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      email,
      sub: "user-123",
      type: "access" as const,
    });
    
    (userService.getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: mockUserResult,
    });

    await authController.login(
      mockRequest as any,
      mockReply as unknown as FastifyReply,
    );

    expect(mockReply.sentData.message).toBe("Session is already active.");
    expect(userService.loginUser).not.toHaveBeenCalled();
    expect(userService.getUserByEmail).toHaveBeenCalledWith(email);
  });

  /**
   * DIFFERENT EMAIL TEST:
   * 
   * WHY test session check with different email?
   * 
   * 1. Session reuse should only happen for SAME email
   *    - User A logged in, then tries to login as User B
   *    - Should NOT reuse User A's session
   * 
   * 2. Security consideration
   *    - Prevents session confusion attacks
   *    - Each user should have their own session
   */
  it("regenerates tokens when logging in with different email than session", async () => {
    const existingToken = "valid-existing-token";
    
    const mockRequest = createMockRequest({
      body: { email: "new@example.com", password: "password123" },
      cookies: { token: existingToken },
    });
    const mockReply = createMockReply();
    
    (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      email: "old@example.com",
      sub: "user-old",
      type: "access" as const,
    });
    
    (userService.loginUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { ...mockUserResult, email: "new@example.com" },
      accessToken: "new-token",
      refreshToken: "new-refresh",
    });

    await authController.login(
      mockRequest as any,
      mockReply as unknown as FastifyReply,
    );

    expect(userService.loginUser).toHaveBeenCalled();
    expect(mockReply.sentData.message).toBe("Login Successful");
  });

  /**
   * UNAUTHORIZED ERROR TEST:
   * 
   * WHY verify UnauthorizedError propagates?
   * 
   * 1. Error type determines response code
   *    - UnauthorizedError → 401
   *    - Controller doesn't need to know this mapping
   *    - Fastify error handler does this
   * 
   * 2. Password brute-force protection
   *    - Response time should be consistent
   *    - No information leakage about whether email exists
   */
  it("propagates UnauthorizedError for invalid credentials", async () => {
    const mockRequest = createMockRequest({
      body: { email: "user@example.com", password: "wrongpassword" },
      cookies: {},
    });
    const mockReply = createMockReply();
    
    (userService.loginUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError("Invalid email or password"),
    );

    await expect(
      authController.login(
        mockRequest as any,
        mockReply as unknown as FastifyReply,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  /**
   * INVALID EXISTING TOKEN TEST:
   * 
   * WHY test when existing token is invalid but user wants to login?
   * 
   * 1. Graceful degradation
   *    - Old/expired token in cookie shouldn't block new login
   *    - Should proceed to normal login flow
   * 
   * 2. Token refresh expired
   *    - User needs to re-authenticate
   *    - Don't expose why the old token failed
   */
  it("proceeds with login when existing token is invalid", async () => {
    const expiredToken = "expired-token";
    
    const mockRequest = createMockRequest({
      body: { email: "user@example.com", password: "password123" },
      cookies: { token: expiredToken },
    });
    const mockReply = createMockReply();
    
    // Token verification fails
    (verifyAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError("Token expired"),
    );
    
    // But login succeeds
    (userService.loginUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: mockUserResult,
      accessToken: "new-token",
      refreshToken: "new-refresh",
    });

    await authController.login(
      mockRequest as any,
      mockReply as unknown as FastifyReply,
    );

    // Should still login successfully despite invalid token
    expect(userService.loginUser).toHaveBeenCalled();
    expect(mockReply.sentData.message).toBe("Login Successful");
  });
});

// =============================================================================
// LOGOUT ENDPOINT TESTS
// =============================================================================

describe("authController.logout", () => {
  /**
   * SUCCESSFUL LOGOUT TEST:
   * 
   * WHY verify cookie is cleared?
   * 
   * 1. Cookie clearing is explicit action
   *    - Setting maxAge to 0 or expires to past date
   *    - Browser deletes cookie on next request
   * 
   * 2. Security requirement
   *    - Session should be terminated
   *    - Token should be blacklisted
   * 
   * 3. Path must match original cookie
   *    - Cookie path="/" means clearCookie must use "/"
   *    - Mismatched paths leave orphaned cookies
   */
  it("clears auth cookie and returns 200 on successful logout", async () => {
    const mockRequest = createMockRequest({
      cookies: { token: "valid-token-to-revoke", refreshToken: "valid-refresh-token" },
    });
    const mockReply = createMockReply();
    
    (userService.logoutUser as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (userService.revokeRefreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    await authController.logout(
      mockRequest as FastifyRequest,
      mockReply as unknown as FastifyReply,
    );

    expect(userService.logoutUser).toHaveBeenCalledWith("valid-token-to-revoke");
    expect(userService.revokeRefreshToken).toHaveBeenCalledWith("valid-refresh-token");
    expect(mockReply.clearCookie).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        path: "/",
        httpOnly: true,
      }),
    );
    expect(mockReply.clearCookie).toHaveBeenCalledWith(
      "refreshToken",
      expect.objectContaining({
        path: "/",
        httpOnly: true,
      }),
    );
    expect(mockReply.statusCode).toBe(200);
  });

  /**
   * NO COOKIE LOGOUT TEST:
   * 
   * WHY test logout without a token?
   * 
   * 1. Idempotent operations
   *    - Logout should succeed even if not logged in
   *    - User clicks logout twice → both should succeed
   * 
   * 2. Frontend robustness
   *    - Frontend might call logout on any page
   *    - Shouldn't fail if session expired
   * 
   * 3. Security consideration
   *    - Still clear any cookies that exist
   *    - Don't reveal whether user was logged in
   */
  it("succeeds even without existing token cookie", async () => {
    const mockRequest = createMockRequest({ cookies: {} });
    const mockReply = createMockReply();

    await authController.logout(
      mockRequest as FastifyRequest,
      mockReply as unknown as FastifyReply,
    );

    expect(userService.logoutUser).not.toHaveBeenCalled();
    expect(userService.revokeRefreshToken).not.toHaveBeenCalled();
    expect(mockReply.clearCookie).toHaveBeenCalledTimes(2);
    expect(mockReply.statusCode).toBe(200);
  });

  /**
   * INVALID TOKEN LOGOUT TEST:
   * 
   * WHY test logout with invalid token?
   * 
   * 1. Graceful degradation
   *    - Invalid token should be handled gracefully
   *    - Don't expose technical details to client
   * 
   * 2. Service handles invalid tokens
   *    - Service already has try-catch for verification
   *    - Controller passes through any error
   */
  it("clears cookie even when token is invalid", async () => {
    const mockRequest = createMockRequest({
      cookies: { token: "invalid-token", refreshToken: "invalid-refresh-token" },
    });
    const mockReply = createMockReply();
    
    (userService.logoutUser as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (userService.revokeRefreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    await authController.logout(
      mockRequest as FastifyRequest,
      mockReply as unknown as FastifyReply,
    );

    expect(mockReply.clearCookie).toHaveBeenCalledTimes(2);
    expect(mockReply.statusCode).toBe(200);
  });
});

// =============================================================================
// GET CURRENT USER TESTS
// =============================================================================

describe("authController.getCurrentUser", () => {
  /**
   * SUCCESSFUL AUTHENTICATION TEST:
   * 
   * WHY test successful user retrieval?
   * 
   * 1. Verify 200 response for authenticated requests
   *    - 200 OK = authenticated and authorized
   *    - Correct resource returned
   * 
   * 2. Response structure validation
   *    - Success flag should be true
   *    - User data should be in data field
   *    - No error field
   */
  it("returns 200 with user data for valid token", async () => {
    const mockRequest = createMockRequest({
      cookies: { token: "valid-access-token" },
    });
    const mockReply = createMockReply();
    
    (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: mockUserResult,
    });

    await authController.getCurrentUser(
      mockRequest as FastifyRequest,
      mockReply as unknown as FastifyReply,
    );

    expect(mockReply.statusCode).toBe(200);
    expect(mockReply.sentData).toMatchObject({
      success: true,
      data: { user: mockUserResult },
      message: "User retrieved successfully",
    });
  });

  /**
   * MISSING TOKEN TEST:
   * 
   * WHY test missing token?
   * 
   * 1. Authentication requirement
   *    - Some endpoints require authentication
   *    - Missing token should fail with 401
   * 
   * 2. Defense in depth
   *    - Don't trust that routes always provide token
   *    - Controller validates presence
   */
  it("throws UnauthorizedError when no token cookie exists", async () => {
    const mockRequest = createMockRequest({ cookies: {} });
    const mockReply = createMockReply();

    await expect(
      authController.getCurrentUser(
        mockRequest as FastifyRequest,
        mockReply as unknown as FastifyReply,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  /**
   * EXPIRED TOKEN TEST:
   * 
   * WHY test expired token?
   * 
   * 1. Token expiration is expected behavior
   *    - Access tokens have short lifespan (15 min typical)
   *    - Refresh tokens have longer lifespan (7 days typical)
   * 
   * 2. Proper error message
   *    - User should know to refresh their session
   *    - Don't expose technical details
   */
  it("propagates UnauthorizedError for expired token", async () => {
    const mockRequest = createMockRequest({
      cookies: { token: "expired-token" },
    });
    const mockReply = createMockReply();
    
    (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError("Session expired. Please login again."),
    );

    await expect(
      authController.getCurrentUser(
        mockRequest as FastifyRequest,
        mockReply as unknown as FastifyReply,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  /**
   * DELETED USER TEST:
   * 
   * WHY test deleted user?
   * 
   * 1. Edge case: user deleted after login
   *    - User logs in successfully
   *    - Admin deletes user account
   *    - User makes authenticated request
   * 
   * 2. Proper error response
   *    - 404 Not Found is correct
   *    - User account genuinely doesn't exist
   * 
   * 3. Security consideration
   *    - Should not allow access to deleted accounts
   *    - Revoke any remaining tokens immediately
   */
  it("throws NotFoundError when user no longer exists", async () => {
    const mockRequest = createMockRequest({
      cookies: { token: "valid-token-for-deleted-user" },
    });
    const mockReply = createMockReply();
    
    (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new NotFoundError("User account no longer exists."),
    );

    await expect(
      authController.getCurrentUser(
        mockRequest as FastifyRequest,
        mockReply as unknown as FastifyReply,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  /**
   * REVOKED TOKEN TEST:
   * 
   * WHY test revoked token (logout followed by use)?
   * 
   * 1. Logout should be immediate
   *    - Token should be blacklisted after logout
   *    - Subsequent use should fail
   * 
   * 2. Session management
   *    - User should be able to log out from all devices
   *    - Revoked tokens should not work anywhere
   */
  it("rejects revoked token (used after logout)", async () => {
    const mockRequest = createMockRequest({
      cookies: { token: "revoked-token" },
    });
    const mockReply = createMockReply();
    
    (userService.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError("Session has been revoked. Please login again."),
    );

    await expect(
      authController.getCurrentUser(
        mockRequest as FastifyRequest,
        mockReply as unknown as FastifyReply,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });
});

// =============================================================================
// INTEGRATION NOTES
// =============================================================================

/**
 * WHAT THESE TESTS DON'T COVER (Integration Tests):
 * 
 * 1. REAL SERVICE CALLS:
 *    - These mock the service layer
 *    - Integration tests would use real services
 *    - Would test database interactions
 * 
 * 2. FASTIFY PLUGIN LIFECYCLE:
 *    - Request/response hooks
 *    - Error handlers
 *    - Serialization
 * 
 * 3. ROUTE LEVEL CONCERNS:
 *    - Schema validation (Fastify schema)
 *    - Rate limiting
 *    - Authentication middleware
 * 
 * 4. END-TO-END FLOWS:
 *    - Register → Login → Get User → Logout
 *    - Token refresh flow
 *    - Multi-device scenarios
 * 
 * RECOMMENDED INTEGRATION TEST PATTERNS:
 * 
 * 1. Use real database (test container)
 * 2. Use real Redis
 * 3. Test full request/response cycle
 * 4. Test actual HTTP headers and cookies
 */

// =============================================================================
// REFRESH TOKEN TESTS
// =============================================================================

describe("authController.refresh", () => {
  it("returns 200 with new tokens on successful refresh", async () => {
    const mockRequest = createMockRequest({
      cookies: { refreshToken: "valid-refresh-token" },
    });
    const mockReply = createMockReply();
    
    (userService.refreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: mockUserResult,
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });

    await authController.refresh(
      mockRequest as any,
      mockReply as unknown as FastifyReply,
    );

    expect(mockReply.statusCode).toBe(200);
    expect(mockReply.sentData).toMatchObject({
      success: true,
      data: { user: mockUserResult },
      message: "Token refreshed successfully",
    });
  });

  it("sets new access token cookie with correct configuration", async () => {
    const mockRequest = createMockRequest({
      cookies: { refreshToken: "valid-refresh-token" },
    });
    const mockReply = createMockReply();
    
    (userService.refreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: mockUserResult,
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });

    await authController.refresh(
      mockRequest as any,
      mockReply as unknown as FastifyReply,
    );

    expect(mockReply.setCookie).toHaveBeenCalledWith(
      "token",
      "new-access-token",
      expect.objectContaining({
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        maxAge: 7200,
      }),
    );
  });

  it("sets new refresh token cookie with correct configuration", async () => {
    const mockRequest = createMockRequest({
      cookies: { refreshToken: "valid-refresh-token" },
    });
    const mockReply = createMockReply();
    
    (userService.refreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: mockUserResult,
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });

    await authController.refresh(
      mockRequest as any,
      mockReply as unknown as FastifyReply,
    );

    expect(mockReply.setCookie).toHaveBeenCalledWith(
      "refreshToken",
      "new-refresh-token",
      expect.objectContaining({
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        maxAge: 604800,
      }),
    );
  });

  it("throws UnauthorizedError when no refresh token is provided", async () => {
    const mockRequest = createMockRequest({ cookies: {} });
    const mockReply = createMockReply();

    await expect(
      authController.refresh(
        mockRequest as any,
        mockReply as unknown as FastifyReply,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("propagates UnauthorizedError when refresh token is invalid", async () => {
    const mockRequest = createMockRequest({
      cookies: { refreshToken: "invalid-refresh-token" },
    });
    const mockReply = createMockReply();
    
    (userService.refreshToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError("Invalid or expired refresh token"),
    );

    await expect(
      authController.refresh(
        mockRequest as any,
        mockReply as unknown as FastifyReply,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("propagates UnauthorizedError when refresh token is revoked", async () => {
    const mockRequest = createMockRequest({
      cookies: { refreshToken: "revoked-refresh-token" },
    });
    const mockReply = createMockReply();
    
    (userService.refreshToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError("Session has been revoked. Please login again."),
    );

    await expect(
      authController.refresh(
        mockRequest as any,
        mockReply as unknown as FastifyReply,
      ),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("propagates NotFoundError when user no longer exists", async () => {
    const mockRequest = createMockRequest({
      cookies: { refreshToken: "valid-refresh-token" },
    });
    const mockReply = createMockReply();
    
    (userService.refreshToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new NotFoundError("User account no longer exists."),
    );

    await expect(
      authController.refresh(
        mockRequest as any,
        mockReply as unknown as FastifyReply,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
