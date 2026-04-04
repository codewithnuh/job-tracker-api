import { db } from "../../db/index.js";
import {
  loginSchema,
  loginType,
  registrationSchema,
  registrationType,
} from "../../schemas/schema.js";
import { users } from "../../db/schema.js";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import z from "zod";
import { redis } from "../../utils/redis.js";
import {
  ConflictError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
} from "../../utils/errors/http.errors.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../utils/auth/token.js";

// Define a strict interface for your token payload
interface CustomJWTPayload {
  sub: string;
  email: string;
}

class UserService {
  /**
   * Hardened Registration:
   * Uses generic error messaging to prevent user enumeration.
   * Increased SALT_ROUNDS for better brute-force resistance.
   */
  async registerUser(input: registrationType) {
    const validatedData = registrationSchema.parse(input);
    const normalizedEmail = validatedData.email.toLowerCase().trim();
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      throw new ConflictError(
        "Registration failed. Please check your details or try logging in.",
      );
    }

    const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(
      validatedData.password,
      SALT_ROUNDS,
    );

    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        name: validatedData.name!,
        passwordHash: hashedPassword,
      })
      .returning();

    if (!newUser) throw new InternalServerError("User creation failed.");

    const accesToken = await generateAccessToken({
      id: newUser.id,
      email: newUser.email,
    });
    const refreshToken = await generateRefreshToken({
      id: newUser.id,
      email: newUser.email,
    });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        createdAt: newUser.createdAt,
      },
      accesToken,
      refreshToken,
    };
  }

  /**
   * Hardened Login:
   * Prevents timing attacks by ensuring a bcrypt comparison happens
   * even if the user does not exist.
   */
  async loginUser(input: loginType) {
    const validatedData = loginSchema.parse(input);

    const DUMMY_HASH =
      "$2b$12$K8V9L6Xp6z2QzR6eR6z2QeR6z2QeR6z2QeR6z2QeR6z2QeR6z2Qe.";

    const user = await db.query.users.findFirst({
      where: eq(users.email, validatedData.email),
    });

    const isPasswordValid = await bcrypt.compare(
      validatedData.password,
      user ? user.passwordHash : DUMMY_HASH,
    );

    if (!user || !isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const accessToken = await generateAccessToken({
      id: user.id,
      email: user.email,
    });
    const refreshToken = await generateRefreshToken({
      id: user.id,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    };
  }

  async logoutUser(token: string) {
    try {
      const payload = await verifyAccessToken(token);

      const now = Math.floor(Date.now() / 1000);

      if (!payload.exp || !payload.jti) {
        return {
          success: true,
          message: "Logged out successfully",
        };
      }

      const timeLeft = payload.exp - now;

      if (timeLeft > 0) {
        await redis.setex(`blacklist:${payload.jti}`, timeLeft, "revoked");
      }
    } catch {
      // already logged out
    }

    return {
      success: true,
      message: "Logged out successfully",
    };
  }

  async getCurrentUser(token: string) {
    const isRevoked = await redis.get(`blacklist:${token}`);
    if (isRevoked) {
      throw new UnauthorizedError(
        "Session has been revoked. Please login again.",
      );
    }
    let payload: CustomJWTPayload;

    try {
      payload = (await verifyAccessToken(token)) as unknown as CustomJWTPayload;
    } catch {
      throw new UnauthorizedError("Session expired. Please login again.");
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
      throw new NotFoundError("User account no longer exists.");
    }

    return { user };
  }

  async getUserByEmail(email: string) {
    const emailResult = z.string().email().safeParse(email);
    if (!emailResult.success) {
      throw new BadRequestError("Invalid email format.");
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.email, emailResult.data))
      .limit(1);

    if (!user) throw new NotFoundError("User not found.");
    return { user };
  }

  async refreshToken(refreshToken: string) {
    const payload = await verifyRefreshToken(refreshToken);

    const isRevoked = await redis.get(`refresh_blacklist:${payload.jti}`);
    if (isRevoked) {
      throw new UnauthorizedError(
        "Session has been revoked. Please login again.",
      );
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
      throw new NotFoundError("User account no longer exists.");
    }

    if (payload.jti) {
      await redis.setex(`refresh_blacklist:${payload.jti}`, 604800, "revoked");
    }

    const newAccessToken = await generateAccessToken({
      id: user.id,
      email: user.email,
    });
    const newRefreshToken = await generateRefreshToken({
      id: user.id,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async revokeRefreshToken(refreshToken: string) {
    try {
      const payload = await verifyRefreshToken(refreshToken);

      if (!payload.jti) {
        return { success: true };
      }

      const timeLeft = payload.exp
        ? payload.exp - Math.floor(Date.now() / 1000)
        : 604800;

      if (timeLeft > 0) {
        await redis.setex(
          `refresh_blacklist:${payload.jti}`,
          Math.min(timeLeft, 604800),
          "revoked",
        );
      }
    } catch {
      // token invalid, nothing to revoke
    }

    return { success: true };
  }
}

export const userService = new UserService();
