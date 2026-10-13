// Base58 (the alphabet Solana uses for addresses and signatures). Pure.
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const INDEX = Object.fromEntries([...ALPHABET].map((c, i) => [c, i]));

export function b58encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = '';
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
  return out;
}

export function b58decode(str) {
  let n = 0n;
  for (const c of str) {
    if (!(c in INDEX)) throw new Error('Not a valid address (bad character)');
    n = n * 58n + BigInt(INDEX[c]);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n & 255n)); n >>= 8n; }
  let zeros = 0;
  for (const c of str) { if (c === '1') zeros++; else break; }
  return Uint8Array.from([...new Array(zeros).fill(0), ...bytes]);
}

/** an address string -> its 32 bytes (throws when it is not a Solana address) */
export function pubkeyBytes(addr) {
  const b = b58decode(addr);
  if (b.length !== 32) throw new Error('Not a valid Solana address (needs 32 bytes)');
  return b;
}
