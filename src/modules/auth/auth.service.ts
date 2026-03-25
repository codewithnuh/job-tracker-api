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
import { generateToken } from "../../utils/auth/token";
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
