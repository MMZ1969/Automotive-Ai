// Catches the signup typo that cost us real users: a stray letter stuck
// after ".com" on a big provider (nealpaul37@gmail.comn, sbirir@gmail.coms).
// Those addresses can never receive mail, so the verification code bounces
// and the person gives up. Also fixes a handful of common domain misspellings.
//
// Returns the corrected address, or null if nothing looks wrong.
// Keep in sync with backend/src/lib/emailTypo.js.

const PROVIDERS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "aol.com", "live.com", "msn.com", "comcast.net", "verizon.net",
  "att.net", "me.com", "ymail.com", "protonmail.com", "proton.me",
];

const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com",
  "gmaill.com": "gmail.com", "gnail.com": "gmail.com", "gmail.co": "gmail.com",
  "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yahoo.con": "yahoo.com",
  "yahoo.co": "yahoo.com", "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com",
  "hotmail.con": "hotmail.com", "outlok.com": "outlook.com", "outlook.con": "outlook.com",
  "iclod.com": "icloud.com", "icloud.con": "icloud.com", "aol.con": "aol.com",
};

// One-letter typos in the provider name itself (gmailn.com, gmal.com,
// hotmial.co was already listed, yhaoo.com, outlookk.com). Only long provider
// names are fuzzy-matched, the TLD must match exactly, and real look-alike
// domains are allowed through — the server hard-rejects on a suggestion, so
// a false positive would block a legit signup.
const FUZZY_PROVIDERS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "comcast.net", "verizon.net", "protonmail.com",
];
const REAL_LOOKALIKES = new Set([
  "mail.com", "email.com", "gmx.com", "cloud.com", "yahoo.co", "hotmail.co",
  "outlook.co", "fmail.com", "gmail.co.uk",
]);

// Damerau-Levenshtein distance capped at 1 (insert/delete/substitute/swap).
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return false;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;                       // substitution
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // swap
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1); // insert/delete
}

function fuzzyProvider(domain: string): string | null {
  if (REAL_LOOKALIKES.has(domain)) return null;
  const dot = domain.indexOf(".");
  if (dot < 1) return null;
  const name = domain.slice(0, dot), tld = domain.slice(dot);
  const hits = FUZZY_PROVIDERS.filter((p) => {
    const pDot = p.indexOf(".");
    return p.slice(pDot) === tld && withinOneEdit(name, p.slice(0, pDot));
  });
  return hits.length === 1 ? hits[0] : null;
}

export function suggestEmailFix(raw: string): string | null {
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

  const fuzzy = fuzzyProvider(domain);
  if (fuzzy) return `${local}@${fuzzy}`;
  return null;
}
