import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module.js";
import { TenantGuard } from "./auth/tenant.guard.js";
import { HealthController } from "./health.controller.js";
import { OrdersModule } from "./orders/orders.module.js";
import { RateLimitModule } from "./rate-limit/rate-limit.module.js";
import { TenantThrottlerGuard } from "./rate-limit/tenant-throttler.guard.js";
import { RequestIdMiddleware } from "./request-id.middleware.js";

@Module({
  imports: [AuthModule, RateLimitModule, OrdersModule],
  controllers: [HealthController],
  providers: [
    // Global guards run in the order they are registered. The throttler keys
    // requests by the tenant id that TenantGuard sets, so it must come second.
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: TenantThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
