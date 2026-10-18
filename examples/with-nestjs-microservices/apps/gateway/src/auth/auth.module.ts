import { Module } from "@nestjs/common";
import { TenantTokens } from "./tenant-tokens.js";

@Module({
  providers: [
    {
      provide: TenantTokens,
      // Parsed once at bootstrap, so a bad GATEWAY_TOKENS stops the gateway
      // from starting instead of failing requests later.
      useFactory: (): TenantTokens => TenantTokens.fromEnv(),
    },
  ],
  exports: [TenantTokens],
})
export class AuthModule {}
