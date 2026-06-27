import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
function toBase64(bytes) {
    return bytes.toString('base64');
}
function fromBase64(value) {
    return Buffer.from(value, 'base64');
}
export function hashPassword(password, saltBase64) {
    const salt = saltBase64 ? fromBase64(saltBase64) : randomBytes(SALT_BYTES);
    const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, HASH_BYTES, 'sha256');
    return {
        hash: toBase64(hash),
        salt: toBase64(salt),
    };
}
export function verifyPassword(password, hash, salt) {
    const { hash: computedHash } = hashPassword(password, salt);
    const left = Buffer.from(computedHash, 'base64');
    const right = Buffer.from(hash, 'base64');
    if (left.length !== right.length) {
        return false;
    }
    return timingSafeEqual(left, right);
}
