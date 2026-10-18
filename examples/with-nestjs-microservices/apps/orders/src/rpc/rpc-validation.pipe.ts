import { RpcErrorCode } from "@example/contracts";
import { Injectable, StandardSchemaValidationPipe } from "@nestjs/common";
import { rpcError } from "./rpc-error.js";

/**
 * Validates every `@Payload(key, { schema })` against its contracts schema and
 * reports failures as a `VALIDATION` RPC error instead of an HTTP exception,
 * which would mean nothing to a caller on the other side of the transport.
 */
@Injectable()
export class RpcValidationPipe extends StandardSchemaValidationPipe {
  constructor() {
    super();
    this.exceptionFactory = (issues) =>
      rpcError(
        RpcErrorCode.Validation,
        this.formatIssueMessages(issues).join("; "),
      );
  }
}
