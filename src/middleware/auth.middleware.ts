import { FastifyRequest } from "fastify";
import { verifyToken } from "../utils/auth/token";
import { UnauthorizedError, NotFoundError } from "../utils/errors/http.errors";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { redis } from "../utils/redis"; // Ensure Redis is imported

export const authMiddleware = async (request: FastifyRequest) => {
  // 1. Extract token from cookies
  const token = request.cookies?.token;

  if (!token) {
    throw new UnauthorizedError("No authentication token provided");
  }

  /**
   * 2. Redis Blacklist Check
   * CRITICAL: We must check Redis BEFORE the database or verifyToken
   * to stop revoked sessions immediately.
   */
  const isRevoked = await redis.get(`blacklist:${token}`);
  if (isRevoked) {
    throw new UnauthorizedError(
      "Session has been revoked. Please login again.",
    );
  }

  // 3. Verify Token Integrity & Expiration
  let payload;
  try {
    payload = await verifyToken(token);
  } catch (error) {
    throw new UnauthorizedError("Invalid or expired session");
  }

  // 4. Database Lookup
  const userId = (payload as any).id;
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  if (!user) {
    // If the token is valid but the user was deleted from the DB
    throw new NotFoundError("User account not found");
  }

  // 5. Attach user to request for use in controllers
  request.user = user;
};
