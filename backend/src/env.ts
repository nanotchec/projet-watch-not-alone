import { config } from "dotenv";

config();

const parseOrigins = (raw: string | undefined) =>
  (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const required = (value: string | undefined, name: string) => {
  if (!value || value.length === 0) {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value;
};

const parsePort = (raw: string | undefined) => {
  const fallback = 4000;
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parsePort(process.env.PORT),
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  databaseUrl: required(process.env.DATABASE_URL, "DATABASE_URL"),
};
