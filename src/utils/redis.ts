import { Redis } from "ioredis";

export const redis = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    // This function decides whether to keep trying or give up
    retryStrategy(times) {
      // If we've tried more than 3 times, stop the infinite scrolling
      if (times > 3) {
        console.error("❌ Redis: Max retries reached. Stopping reconnection.");
        return null; // Returning null stops the retry loop
      }
      return Math.min(times * 100, 3000); // Wait a bit longer each time
    },
  },
);

// CRITICAL: Handle the NOAUTH error specifically
redis.on("error", (err) => {
  if (err.message.includes("NOAUTH")) {
    console.error(
      "🛑 FATAL: Redis password is missing or wrong. Fix your .env file!",
    );
    // You might even want to kill the process here in dev mode
    // process.exit(1);
  } else {
    console.error("❌ [Redis Error]:", err.message);
  }
});
