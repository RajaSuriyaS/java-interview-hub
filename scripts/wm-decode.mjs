/* Recover the account id from a watermarked/leaked content snippet.
   Usage:
     node scripts/wm-decode.mjs "<paste a leaked blurb or the served curriculum.js>"
     cat leaked.txt | node scripts/wm-decode.mjs
   Every full content bundle we serve carries an invisible zero-width
   fingerprint of the account id in the first phase blurb (and a visible
   signed licence banner). This tool reads either back. */
const ZW0 = '​', ZW1 = '‌', ZWD = '⁠';

function zwDecode(text) {
  const re = new RegExp(ZWD + '([' + ZW0 + ZW1 + ']+)' + ZWD);
  const m = text.match(re);
  if (!m) return null;
  const bits = [...m[1]].map(c => (c === ZW1 ? '1' : '0')).join('');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  try { return Buffer.from(bytes).toString('utf8'); } catch { return null; }
}

const input = process.argv[2] || await new Promise(r => {
  let d = ''; process.stdin.on('data', c => d += c).on('end', () => r(d));
});
const banner = (input.match(/licensed to ([^\s\]]+)[^\]]*\[([0-9a-f]{8,})\]/) || []);
const fp = zwDecode(input);
console.log(JSON.stringify({
  invisibleFingerprintAccountId: fp || '(none found — banner may have been stripped)',
  visibleBannerAccountId: banner[1] || '(none)',
  visibleBannerSignature: banner[2] || '(none)',
}, null, 2));
