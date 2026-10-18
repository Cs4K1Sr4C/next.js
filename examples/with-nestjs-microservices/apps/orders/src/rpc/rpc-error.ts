import type { RpcErrorCode, RpcErrorPayload } from "@example/contracts";
import { RpcException } from "@nestjs/microservices";

/** Builds the `RpcException` shape every caller of this service can rely on. */
export function rpcError(code: RpcErrorCode, message: string): RpcException {
  const payload: RpcErrorPayload = { code, message };
  return new RpcException(payload);
}
