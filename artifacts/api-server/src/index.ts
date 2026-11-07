import app from "./app";
import { logger } from "./lib/logger";

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET === "ssd-klinika-dev-secret-change-me")
) {
  logger.error("JWT_SECRET production muhitida majburiy. .env ichida kuchli qiymat kiriting.");
  process.exit(1);
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.AUTH_DISABLED === "true"
) {
  logger.error("AUTH_DISABLED=true production uchun ruxsat etilmaydi. .env ni tekshiring.");
  process.exit(1);
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
