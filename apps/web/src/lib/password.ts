// Password hashing (bcrypt). Used by first-run setup and the credentials
// provider. No plaintext ever leaves this boundary.
import 'server-only';
import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
