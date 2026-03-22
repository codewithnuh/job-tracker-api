import { db } from "../../db";
import { userLoginType, userSchema, userType } from "../../schemas/schema";
import { users } from "../../db/schema";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

import {
  ConflictError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "../../utils/errors/http.errors";
class UserService {
  async registerUser(input: userType) {
    const validatedData = userSchema.parse(input);
    // if(!validatedData) throw new ValidationError([{}])
    const isExistingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);
    if (isExistingUser.length > 0) {
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
    return {
      user: {
        id: newUser?.id,
        email: newUser?.email,
        name: newUser?.name,
        createdAt: newUser?.createdAt,
      },
    };
  }
  async loginUser(input: userLoginType) {
    const validatedData = userSchema.parse(input);
    const user = await db.query.users.findFirst({
      where: eq(users.email, validatedData.email),
    });
    if (!user) throw new UnauthorizedError("Wrong Credentials");
    const password = await bcrypt.compare(
      validatedData.password,
      user.passwordHash,
    );
    if (!password) throw new UnauthorizedError("Wrong Credentials");
    return {
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }
}
export const userService = new UserService();
