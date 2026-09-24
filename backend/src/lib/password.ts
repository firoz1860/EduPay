import bcrypt from 'bcryptjs';
import { env } from '../config/env';

/** bcrypt hashing (pure-JS impl — no native build, portable to Render/Docker). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
