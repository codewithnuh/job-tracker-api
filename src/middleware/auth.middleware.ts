import { FastifyRequest } from "fastify";
import { verifyAccessToken } from "../utils/auth/token.js";
import { UnauthorizedError, NotFoundError } from "../utils/errors/http.errors";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const authMiddleware = async (request: FastifyRequest) => {
  const token = request.cookies?.token;

  if (!token) {
    throw new UnauthorizedError("No authentication token provided");
  }

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError("Invalid or expired session");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.sub),
    columns: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError("User account not found");
  }

  request.user = user;
};
