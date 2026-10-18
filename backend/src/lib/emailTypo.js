// src/lib/emailTypo.js
// Catches the signup typo that cost us real users: a stray letter stuck
// after ".com" on a big provider (nealpaul37@gmail.comn, sbirir@gmail.coms).
// Those addresses can never receive mail, so the verification code bounces
// and the person gives up. Also fixes a handful of common domain misspellings.
//
// Returns the corrected address, or null if nothing looks wrong.
// Keep in sync with frontend50/lib/emailTypo.ts.

const PROVIDERS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "aol.com", "live.com", "msn.com", "comcast.net", "verizon.net",
  "att.net", "me.com", "ymail.com", "protonmail.com", "proton.me",
];

const DOMAIN_TYPOS = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com",
  "gmaill.com": "gmail.com", "gnail.com": "gmail.com", "gmail.co": "gmail.com",
  "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yahoo.con": "yahoo.com",
  "yahoo.co": "yahoo.com", "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com",
  "hotmail.con": "hotmail.com", "outlok.com": "outlook.com", "outlook.con": "outlook.com",
  "iclod.com": "icloud.com", "icloud.con": "icloud.com", "aol.con": "aol.com",
};

export function suggestEmailFix(raw) {
  const email = String(raw || "").trim();
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();

  if (PROVIDERS.includes(domain)) return null;

  // gmail.comn, gmail.coms, gmail.comnn, gmail.com.  -> trailing junk.
  // Only 1-2 letters glued on (or trailing dots), so real regional domains
  // like yahoo.com.br / outlook.com.au are left alone.
  for (const p of PROVIDERS) {
    if (domain.startsWith(p) && /^([a-z]{1,2}|\.+)$/.test(domain.slice(p.length))) {
      return `${local}@${p}`;
    }
  }

  if (DOMAIN_TYPOS[domain]) return `${local}@${DOMAIN_TYPOS[domain]}`;
  return null;
}
