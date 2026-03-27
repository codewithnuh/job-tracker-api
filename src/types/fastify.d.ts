// src/types/fastify.d.ts

import "fastify";
import { userType } from "../schemas/schema";

declare module "fastify" {
  interface FastifyRequest {
    // We omit passwordHash for security when attaching to request
    user: Omit<userType, "password"> & { id: string };
  }
}
