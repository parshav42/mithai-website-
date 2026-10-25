import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  throw new Error("Run this command in an interactive terminal so the password is not echoed.");
}

const password = await new Promise((resolve, reject) => {
  let value = "";
  process.stdout.write("Administrator password (hidden): ");
  process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.resume();
  process.stdin.on("data", (chunk) => {
    for (const character of chunk) {
      if (character === "\u0003") {
        process.stdin.setRawMode(false);
        reject(new Error("Password hashing cancelled."));
        return;
      }
      if (character === "\r" || character === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (character === "\u007f" || character === "\b") {
        value = value.slice(0, -1);
      } else if (character >= " ") {
        value += character;
      }
    }
  });
});

if (password.length < 14 || password.length > 1024) {
  throw new Error("Use a password between 14 and 1024 characters.");
}

const salt = randomBytes(16);
const derive = promisify(scrypt);
const hash = await derive(password, salt, 64, {
  N: 32_768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});
console.log(`ADMIN_PASSWORD_HASH=scrypt$${salt.toString("hex")}$${Buffer.from(hash).toString("hex")}`);
