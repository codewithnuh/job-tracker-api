import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { v4 as uuidv4 } from "uuid";
import { UnauthorizedError } from "../errors/http.errors";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback_secret_change_me",
);
const ISSUER = "your-app-name.com";
const AUDIENCE = "your-app-client";

interface CustomPayload extends JWTPayload {
  id: string;
  email: string;
}

/**
 * Generates a hardened JWT with all registered claims.
 * The JTI is generated internally to ensure uniqueness per session.
 */
export const generateToken = async (user: { id: string; email: string }) => {
  const jti = uuidv4();

  return await new SignJWT({
    id: user.id,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt() // Sets 'iat'
    .setIssuer(ISSUER) // Sets 'iss'
    .setAudience(AUDIENCE) // Sets 'aud'
    .setJti(jti) // Sets 'jti'
    .setExpirationTime("2h") // Sets 'exp'
    .sign(JWT_SECRET);
};

/**
 * Verifies the token signature and claims.
 * Includes specific checks for issuer and audience for defense-in-depth.
 */
export const verifyToken = async (token: string): Promise<CustomPayload> => {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    return payload as CustomPayload;
  } catch (error: any) {
    // Cyber Analyst Note: Log the error internally for monitoring,
    // but return a generic message to the user.
    throw new UnauthorizedError(
      "Session expired or invalid. Please log in again.",
    );
  }
};
