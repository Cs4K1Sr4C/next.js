import { createHash, timingSafeEqual } from "node:crypto";
import { TenantId } from "@example/contracts";

const MIN_TOKEN_LENGTH = 12;

// Public on purpose so the example runs without configuration, which is why
// they are refused when NODE_ENV=production.
const DEVELOPMENT_TOKENS = "acme:dev-token-acme,globex:dev-token-globex";

interface TenantCredential {
  readonly tenantId: string;
  readonly tokenDigest: Buffer;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * The bearer tokens the gateway accepts and the tenant each one belongs to.
 * Only SHA-256 digests of the tokens are kept after startup.
 */
export class TenantTokens {
  private constructor(
    private readonly credentials: readonly TenantCredential[],
  ) {}

  /** Loads `GATEWAY_TOKENS`, a comma-separated list of `tenantId:token`. */
  static fromEnv(): TenantTokens {
    const configured = process.env.GATEWAY_TOKENS?.trim();
    if (!configured && process.env.NODE_ENV === "production") {
      throw new Error(
        "GATEWAY_TOKENS must be set when NODE_ENV=production: the built-in development tokens are public.",
      );
    }
    return TenantTokens.parse(configured || DEVELOPMENT_TOKENS);
  }

  // Error messages name the entry or tenant, never the token itself.
  private static parse(value: string): TenantTokens {
    const tenantIds = new Set<string>();
    const tokens = new Set<string>();
    const credentials = value.split(",").map((entry, index) => {
      const separator = entry.indexOf(":");
      if (separator === -1) {
        throw new Error(
          `GATEWAY_TOKENS entry ${index + 1} must look like "tenantId:token"`,
        );
      }
      const tenantId = entry.slice(0, separator).trim();
      const token = entry.slice(separator + 1).trim();
      if (!TenantId.safeParse(tenantId).success) {
        throw new Error(
          `GATEWAY_TOKENS entry ${index + 1}: the tenant id must be 1-32 lowercase letters, digits or "-"`,
        );
      }
      if (token.length < MIN_TOKEN_LENGTH) {
        throw new Error(
          `GATEWAY_TOKENS: the token for "${tenantId}" must be at least ${MIN_TOKEN_LENGTH} characters long`,
        );
      }
      if (tenantIds.has(tenantId)) {
        throw new Error(`GATEWAY_TOKENS: tenant "${tenantId}" is listed twice`);
      }
      if (tokens.has(token)) {
        throw new Error(
          `GATEWAY_TOKENS: the token for "${tenantId}" is already used by another tenant`,
        );
      }
      tenantIds.add(tenantId);
      tokens.add(token);
      return { tenantId, tokenDigest: sha256(token) };
    });
    return new TenantTokens(credentials);
  }

  /** Returns the tenant that owns `token`, or `undefined` if none does. */
  resolve(token: string): string | undefined {
    // Comparing fixed-length digests keeps the token's length and any matching
    // prefix out of the timing, and checking every credential without an early
    // exit keeps out whether, and for which tenant, a match was found.
    const presented = sha256(token);
    let tenantId: string | undefined;
    for (const credential of this.credentials) {
      if (timingSafeEqual(presented, credential.tokenDigest)) {
        tenantId = credential.tenantId;
      }
    }
    return tenantId;
  }
}
