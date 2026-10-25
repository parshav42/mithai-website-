import { scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_OPTIONS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const HASH_BYTES = 64;

function derivePassword(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, HASH_BYTES, SCRYPT_OPTIONS, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

export async function verifyAdminPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const parts = encodedHash.split("$");
  if (
    parts.length !== 3 ||
    parts[0] !== "scrypt" ||
    !/^[\da-f]{32}$/i.test(parts[1]) ||
    !/^[\da-f]{128}$/i.test(parts[2]) ||
    password.length < 1 ||
    password.length > 1024
  ) {
    return false;
  }

  const actual = await derivePassword(password, Buffer.from(parts[1], "hex"));
  const expected = Buffer.from(parts[2], "hex");
  return timingSafeEqual(actual, expected);
}

export function isAdministratorConfigured(
  environment: Record<string, string | undefined> = process.env,
) {
  return Boolean(
    environment.AUTH_SECRET &&
      environment.AUTH_SECRET.length >= 32 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(environment.ADMIN_EMAIL?.trim() ?? "") &&
      /^scrypt\$[\da-f]{32}\$[\da-f]{128}$/i.test(
        environment.ADMIN_PASSWORD_HASH ?? "",
      ),
  );
}
