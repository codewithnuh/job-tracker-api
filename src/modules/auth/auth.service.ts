import { db } from "../../db";
import { userSchema, userType } from "../../schemas/schema";
import { users } from "../../db/schema";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import z from "zod";
import { redis } from "../../utils/redis";
import {
  ConflictError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
} from "../../utils/errors/http.errors";
import { generateToken, verifyToken } from "../../utils/auth/token";

// Define a strict interface for your token payload
interface CustomJWTPayload {
  id: string;
  email: string;
}

class UserService {
  /**
   * Hardened Registration:
   * Uses generic error messaging to prevent user enumeration.
   * Increased SALT_ROUNDS for better brute-force resistance.
   */
  async registerUser(input: userType) {
    const validatedData = userSchema.parse(input);

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, validatedData.email))
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
        email: validatedData.email,
        name: validatedData.name!,
        passwordHash: hashedPassword,
      })
      .returning();

    if (!newUser) throw new InternalServerError("User creation failed.");

    const token = await generateToken({ id: newUser.id, email: newUser.email });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        createdAt: newUser.createdAt,
      },
      token,
    };
  }

  /**
   * Hardened Login:
   * Prevents timing attacks by ensuring a bcrypt comparison happens
   * even if the user does not exist.
   */
  async loginUser(input: userType) {
    const validatedData = userSchema.parse(input);

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

    const token = await generateToken({ id: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async logoutUser(token: string) {
    try {
      const payload = await verifyToken(token);
      const now = Math.floor(Date.now() / 1000);
      const timeLeft = payload.exp! - now;
      if (timeLeft > 0) {
        /**
         * 2. Store the token in Redis with a "TTL" (Time To Live).
         * We use the token itself as the key (or better, the 'jti' claim if you have one).
         * Once 'timeLeft' seconds pass, Redis deletes this automatically.
         */
        await redis.setex(`blacklist:${token}`, timeLeft, "revoked");
      }
    } catch {
      // If token is invalid, the user is effectively logged out.
    }

    return { success: true, message: "Logged out successfully" };
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
      payload = (await verifyToken(token)) as unknown as CustomJWTPayload;
    } catch {
      throw new UnauthorizedError("Session expired. Please login again.");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.id),
      columns: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        // passwordHash is explicitly omitted
      },
    });

    if (!user) {
      throw new NotFoundError("User account no longer exists.");
    }

    return { user };
  }

  async getUserByEmail(email: string) {
    // Wrap Zod parsing to return a clean 400 error instead of a 500
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
}

export const userService = new UserService();
