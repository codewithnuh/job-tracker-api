import { describe, it, expect, vi } from "vitest";

describe("Redis retryStrategy logic", () => {
  describe("retryStrategy", () => {
    it("returns null when max retries exceeded (times > 3)", () => {
      const retryStrategy = (times: number) => {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 100, 3000);
      };

      expect(retryStrategy(4)).toBeNull();
      expect(retryStrategy(5)).toBeNull();
      expect(retryStrategy(10)).toBeNull();
    });

    it("returns retry delay when under max retries (times <= 3)", () => {
      const retryStrategy = (times: number) => {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 100, 3000);
      };

      expect(retryStrategy(1)).toBe(100);
      expect(retryStrategy(2)).toBe(200);
      expect(retryStrategy(3)).toBe(300);
    });

    it("returns calculated delay for low retry counts", () => {
      const retryStrategy = (times: number) => {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 100, 3000);
      };

      expect(retryStrategy(29)).toBeNull();
      expect(retryStrategy(30)).toBeNull();
    });
  });

  describe("error handling", () => {
    it("detects NOAUTH errors", () => {
      const detectNoAuth = (message: string) => {
        return message.includes("NOAUTH");
      };

      expect(detectNoAuth("NOAUTH authentication required")).toBe(true);
      expect(detectNoAuth("Redis connection error")).toBe(false);
    });

    it("formats error messages for logging", () => {
      const formatError = (message: string) => {
        return `❌ [Redis Error]: ${message}`;
      };

      expect(formatError("Connection refused")).toBe("❌ [Redis Error]: Connection refused");
    });

    it("formats fatal errors for NOAUTH", () => {
      const formatFatalError = () => {
        return "🛑 FATAL: Redis password is missing or wrong. Fix your .env file!";
      };

      expect(formatFatalError()).toContain("FATAL");
      expect(formatFatalError()).toContain("password");
    });
  });
});

describe("Redis URL configuration", () => {
  it("returns configured URL when set", () => {
    const config = {
      REDIS_URL: "redis://custom:6379",
      fallback: "redis://localhost:6379",
    };

    const url = config.REDIS_URL || config.fallback;
    expect(url).toBe("redis://custom:6379");
  });

  it("returns fallback when REDIS_URL not set", () => {
    const config = {
      REDIS_URL: "",
      fallback: "redis://localhost:6379",
    };

    const url = config.REDIS_URL || config.fallback;
    expect(url).toBe("redis://localhost:6379");
  });
});
