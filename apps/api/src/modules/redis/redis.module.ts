import { Module, Global } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export const REDIS_CLIENT = "REDIS_CLIENT";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const url = config.get<string>("REDIS_URL", "redis://localhost:6379");
        const client = new Redis(url, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          lazyConnect: true,
          retryStrategy: (times: number) => {
            if (times > 3) return null; // stop retrying
            return Math.min(times * 1000, 5000);
          },
        });

        let errorLogged = false;
        client.on("error", (err: Error) => {
          if (!errorLogged) {
            console.warn("[Redis] Not available — caching disabled:", err.message);
            errorLogged = true;
          }
        });

        client.on("connect", () => {
          console.log("[Redis] Connected successfully");
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
