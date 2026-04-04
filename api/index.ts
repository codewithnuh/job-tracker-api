import "dotenv/config";
import { awsLambdaFastify } from "@fastify/aws-lambda";
import { buildApp } from "../src/server";

const fastify = buildApp();

export const handler = awsLambdaFastify(fastify, {
  enforceBase64: (_) => true,
});
