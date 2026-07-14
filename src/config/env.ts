import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables
dotenv.config();

/**
 * Environment variable schema validation
 */
const envSchema = z.object({
  PORT: z.string().default("5000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGODB_URI: z.string().url("MONGODB_URI must be a valid URL"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_URL: z.string().url().optional(),
  JWT_JWKS_URL: z.string().url().optional(),
});

/**
 * Parse and validate environment variables
 * Throws if required variables are missing or invalid
 */
const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.format());
    throw new Error("Environment validation failed");
  }

  return result.data;
};

export const env = parseEnv();

/**
 * Type-safe environment variable access
 */
export const config = {
  port: parseInt(env.PORT, 10),
  nodeEnv: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === "development",
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  mongodb: {
    uri: env.MONGODB_URI,
  },
  frontend: {
    url: env.FRONTEND_URL,
  },
  cors: {
    origin: env.FRONTEND_URL,
  },
  auth: {
    betterAuthUrl: env.BETTER_AUTH_URL || env.FRONTEND_URL,
    jwksUrl: env.JWT_JWKS_URL || `${env.FRONTEND_URL}/api/auth/jwks`,
  },
} as const;
