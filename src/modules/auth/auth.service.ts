import { db } from "../../db";
import { userSchema, userType } from "../../schemas/schema";
import { users } from "../../db/schema";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import z from "zod";
import {
  ConflictError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "../../utils/errors/http.errors";
import { generateToken, verifyToken } from "../../utils/auth/token";
import { JWTPayload } from "jose";
class UserService {
  async registerUser(input: userType) {
    const validatedData = userSchema.parse(input);
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (existingUser) {
      throw new ConflictError("User already exists");
    }

    const SALT_ROUNDS = 10;
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

    if (!newUser) throw new InternalServerError("Failed to register user");

    const token = await generateToken({
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
      token,
    };
  }

  async loginUser(input: userType) {
    const validatedData = userSchema.parse(input);
    const user = await db.query.users.findFirst({
      where: eq(users.email, validatedData.email),
    });

    if (!user) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      validatedData.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const token = await generateToken({
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
      token,
    };
  }
  async logoutUser(token: string) {
    // Verify token is valid before allowing logout
    // This prevents abuse where someone tries to "logout" with garbage tokens
    try {
      await verifyToken(token);
    } catch {
      // Token is already invalid/expired — logout is effectively a no-op
      // Still return success to avoid leaking token validity status
      return { success: true, message: "Logged out successfully" };
    }

    // Stateless JWTs can't be "revoked" without a blacklist.
    // If you need immediate invalidation, add a Redis-backed token denylist here:
    // await redis.setex(`revoked:${jti}`, ttl, '1');

    return { success: true, message: "Logged out successfully" };
  }
  async getCurrentUser(token: string) {
    let payload: JWTPayload | null;

    try {
      payload = await verifyToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, (payload as any).id),
      columns: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        passwordHash: false, // explicitly exclude
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    };
  }
  async getUserByEmail(email: string) {
    const validEmail = z.email().parse(email);
    if (!email) throw new NotFoundError("User not found");
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, validEmail))
      .limit(1);
    if (!user) throw new NotFoundError("User not found");
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    };
  }
}
export const userService = new UserService();
