// src/lib/emailNormalize.js
// Collapses email aliases to one canonical address so one inbox can't be used
// to create many accounts:
//   - lowercases and trims
//   - drops "+tag" suffixes on every domain (john+a@x.com -> john@x.com)
//   - for gmail.com / googlemail.com also drops dots (j.ohn@gmail.com -> john@gmail.com)
export function normalizeEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1) return email;

  let local = email.slice(0, at);
  let domain = email.slice(at + 1);

  if (domain === "googlemail.com") domain = "gmail.com";

  const base = local.split("+")[0];
  if (base) local = base;

  if (domain === "gmail.com") local = local.replace(/\./g, "");

  return `${local}@${domain}`;
}
