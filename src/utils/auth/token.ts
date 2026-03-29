import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { v4 as uuidv4 } from "uuid";
import { UnauthorizedError } from "../errors/http.errors";
import { redis } from "../redis";

/**
 * Environment validation
 */

const requiredEnv = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`${key} is not defined`);
  }
}

/**
 * Config
 */

const JWT_ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET!,
);

const JWT_REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET!,
);

const ISSUER = process.env.JWT_ISSUER ?? "your-app-name.com";

const AUDIENCE = process.env.JWT_AUDIENCE ?? "your-app-client";

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL ?? "15m";

const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL ?? "7d";

/**
 * Token payload
 */

interface CustomPayload extends JWTPayload {
  sub: string;
  email: string;
  type: "access" | "refresh";
}

/**
 * Shared JWT builder
 */

const buildToken = (
  user: { id: string; email: string },
  type: "access" | "refresh",
  secret: Uint8Array,
  ttl: string,
) => {
  const jti = uuidv4();

  return new SignJWT({
    sub: user.id,
    email: user.email,
    type,
  })
    .setProtectedHeader({
      alg: "HS512",
    })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(jti)
    .setExpirationTime(ttl)
    .sign(secret);
};

/**
 * Generate tokens
 */

export const generateAccessToken = (user: { id: string; email: string }) => {
  return buildToken(user, "access", JWT_ACCESS_SECRET, ACCESS_TOKEN_TTL);
};

export const generateRefreshToken = (user: { id: string; email: string }) => {
  return buildToken(user, "refresh", JWT_REFRESH_SECRET, REFRESH_TOKEN_TTL);
};

/**
 * Shared verifier
 */

const verifyToken = async (
  token: string,
  expectedType: "access" | "refresh",
  secret: Uint8Array,
): Promise<CustomPayload> => {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      clockTolerance: "5s",
    });

    /**
     * Critical security check
     * Prevents token confusion
     */

    if (payload.type !== expectedType) {
      throw new UnauthorizedError("Invalid token type");
    }

    return payload as CustomPayload;
  } catch {
    throw new UnauthorizedError(
      "Session expired or invalid. Please log in again.",
    );
  }
};

/**
 * Public verification functions
 */

export const verifyAccessToken = async (
  token: string,
): Promise<CustomPayload> => {
  try {
    const { payload } = await jwtVerify(token, JWT_ACCESS_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
      clockTolerance: "5s",
    });

    //
    // 1) Ensure correct token type
    //

    if (payload.type !== "access") {
      throw new UnauthorizedError("Invalid token type");
    }

    //
    // 2) Ensure JTI exists
    //

    if (!payload.jti) {
      throw new UnauthorizedError("Invalid token");
    }

    //
    // 3) Check blacklist (logout enforcement)
    //

    const isRevoked = await redis.exists(`blacklist:${payload.jti}`);

    if (isRevoked) {
      throw new UnauthorizedError("Session expired or invalid");
    }

    return payload as CustomPayload;
  } catch {
    throw new UnauthorizedError("Session expired or invalid");
  }
};

export const verifyRefreshToken = (token: string) => {
  return verifyToken(token, "refresh", JWT_REFRESH_SECRET);
};
