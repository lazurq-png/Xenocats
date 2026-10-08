import { randomUUID } from 'node:crypto';
import bcryptjs from 'bcryptjs';

/** The cost every stored password hash is made with (the seed, the password change). */
export const BCRYPT_COST = 10;

// Made when the module loads, so even the first unknown email takes no longer
// than a wrong password (only the comparison is left to do).
const unknownHash = bcryptjs.hash(randomUUID(), BCRYPT_COST);

/**
 * Whether `password` is the one `hash` was made from. With no hash (no account
 * has that email) it still compares, against a hash of a string nobody knows made
 * at the same cost, and answers no: so a login for an unknown email takes as long
 * as a wrong password, and the time does not tell which emails have accounts.
 */
export async function passwordMatches(password: string, hash: string | undefined) {
  if (hash !== undefined) return bcryptjs.compare(password, hash);
  await bcryptjs.compare(password, await unknownHash);
  return false;
}
