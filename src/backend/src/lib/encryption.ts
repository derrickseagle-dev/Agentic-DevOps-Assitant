import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.DATABASE_ENCRYPTION_KEY;
  if (!key) {
    // For dev, use a fixed key. In production, this MUST be set.
    return crypto.scryptSync("pipelineforge-dev-key-change-in-production", "pipelineforge-salt", 32);
  }
  // Expect 64-char hex string = 32 bytes
  return Buffer.from(key, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Get the GitHub token for a user. Decrypts the stored token.
 * Favor a repo-specific token if available, otherwise fall back to user's token.
 */
export function getGitHubToken(userToken: string): string {
  if (!userToken) {
    throw new Error("No GitHub token available for this user");
  }
  try {
    return decrypt(userToken);
  } catch {
    // If the token isn't encrypted yet (dev mode), return as-is
    return userToken;
  }
}
