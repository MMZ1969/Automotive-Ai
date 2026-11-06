// build-library-pages.js — READ ONLY on the DB. Regenerates the public library
// at automotiveai.app/problems/ from every PUBLISHED DiagnosisAnswer.
//
// Writes (relative to backend/):
//   ../docs/problems/**             (wiped and rebuilt every run: only published rows survive)
//   ../docs/sitemap.xml             (landing page + every library page)
//   ../docs/robots.txt
//
// Usage:  node build-library-pages.js
// Then:   cd ..; git add docs; git commit -m "Library pages"; git push
//         (GitHub Pages serves docs/ at automotiveai.app within a minute or two)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import path from "path";
import { slugify, displayName, stepText } from "./library-lib.js";

const prisma = new PrismaClient();
const SITE = "https://automotiveai.app";
const DOCS = path.resolve(process.cwd(), "..", "docs");
const OUT = path.join(DOCS, "problems");
const APP_STORE = "https://apps.apple.com/us/app/autoai-auto-intelligence/id6764058138";
const PLAY = "https://play.google.com/store/apps/details?id=app.automotiveai";
const REVIEWER = "MAZ";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const one = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
const day = (d) => new Date(d).toISOString().slice(0, 10);
const niceDate = (d) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
// "2003 Ford Ranger: cracked water pump pulley" -> "Cracked water pump pulley"
const problemName = (title) => { const t = one(title).replace(/^[^:]*:\s*/, ""); return t.charAt(0).toUpperCase() + t.slice(1); };
const SEV_COLOR = { Low: "#10b981", Medium: "#f59e0b", High: "#f97316", Critical: "#ef4444" };

function write(rel, html) {
  const file = path.join(DOCS, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// ── Page shell ───────────────────────────────────────────────────────────────
function page({ title, description, canonical, body, jsonld = [] }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:site_name" content="AutoAI" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/problems/library.css" />
${jsonld.map((j) => `  <script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>
  <nav>
    <a href="/" class="nav-logo">Auto<span>AI</span>™</a>
    <a href="/problems/" class="nav-link">Common problems</a>
    <a href="${APP_STORE}" class="nav-cta">Get the app</a>
  </nav>
  <main>
${body}
  </main>
  <footer>
    <div class="footer-logo">Auto<span>AI</span>™</div>
    <p><a href="/problems/">Common problems</a> · <a href="/privacy-policy.html">Privacy Policy</a> · <a href="/terms.html">Terms</a> · <a href="mailto:maz@amazmade.com">Contact</a></p>
    <p class="footer-copy">© ${new Date().getUTCFullYear()} aMAZmade. Repair guides are AI-generated and reviewed by a person, not a substitute for a professional inspection.</p>
  </footer>
</body>
</html>
`;
}

function crumbs(items) {
  return `    <ol class="crumbs">${items.map(([label, href], i) =>
    i === items.length - 1 ? `<li aria-current="page">${esc(label)}</li>` : `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join("")}</ol>`;
}
function crumbsLd(items) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map(([name, href], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + href })),
  };
}

const storeButtons = `<div class="store-buttons">
        <a href="${APP_STORE}" class="btn-primary"><span aria-hidden="true">🍎</span> App Store</a>
        <a href="${PLAY}" class="btn-secondary"><span aria-hidden="true">🤖</span> Google Play</a>
      </div>`;

function cta(vehicleName) {
  return `    <section class="cta">
      <h2>Different symptom${vehicleName ? ` on your ${esc(vehicleName)}` : ""}?</h2>
      <p>Describe it in AutoAI and get a diagnosis for your exact vehicle in about 30 seconds: likely causes, cost, difficulty and step-by-step repair. Then ask real mechanics to confirm it. Free.</p>
      ${storeButtons}
    </section>`;
}

// ── Problem page ─────────────────────────────────────────────────────────────
function problemPage(r, siblings) {
  const res = r.result || {};
  const make = displayName(r.makeName), model = displayName(r.modelName);
  const vehicle = `${r.year} ${make} ${model}`;
  const url = `/problems/${r.makeSlug}/${r.modelSlug}/${r.slug}/`;
  const steps = (Array.isArray(res.diagnosisSteps) ? res.diagnosisSteps : []).map(stepText).map(one).filter(Boolean);
  const causes = (res.causes || []).map(one).filter(Boolean);
  const parts = [...new Set([...(res.parts || []), ...(res.ebayParts || []).map((p) => p?.partName)].map(one).filter(Boolean))].slice(0, 6);
  const sev = one(res.severity);
  const title = one(r.title) || `${vehicle}: ${one(res.summary)}`;
  const description = clip(`${one(r.publicQuestion)} ${one(res.summary)}`.trim(), 155);
  const trail = [["Common problems", "/problems/"], [make, `/problems/${r.makeSlug}/`], [model, `/problems/${r.makeSlug}/${r.modelSlug}/`], [`${r.year} · ${clip(problemName(title), 40)}`, url]];

  const jsonld = [
    {
      "@context": "https://schema.org", "@type": "Article",
      headline: clip(title, 110), description,
      datePublished: r.publishedAt.toISOString(), dateModified: (r.updatedAt || r.publishedAt).toISOString(),
      author: { "@type": "Person", name: REVIEWER }, publisher: { "@type": "Organization", name: "AutoAI", url: SITE },
      mainEntityOfPage: SITE + url,
      about: { "@type": "Car", name: vehicle, brand: make, model, vehicleModelDate: String(r.year), ...(r.engine ? { vehicleEngine: { "@type": "EngineSpecification", name: r.engine } } : {}) },
    },
    crumbsLd(trail),
    ...(steps.length ? [{
      "@context": "https://schema.org", "@type": "HowTo", name: title,
      ...(one(res.estimatedCost) ? { estimatedCost: { "@type": "MonetaryAmount", currency: "USD", value: one(res.estimatedCost) } } : {}),
      step: steps.map((t, i) => ({ "@type": "HowToStep", position: i + 1, text: t })),
    }] : []),
  ];

  const related = siblings.filter((s) => s.id !== r.id).slice(0, 6);
  const body = `${crumbs(trail)}
    <article>
      <p class="eyebrow">${esc(vehicle)}${r.engine ? ` · ${esc(r.engine)}` : ""}</p>
      <h1>${esc(title)}</h1>
      ${r.publicQuestion ? `<p class="question"><span>Question</span>${esc(r.publicQuestion)}</p>` : ""}
      <p class="byline">AI-generated answer · <strong>Reviewed by ${REVIEWER}</strong>, AutoAI founder · ${esc(niceDate(r.publishedAt))}</p>

      <div class="facts">
        ${sev ? `<div class="fact"><span>Severity</span><b style="color:${SEV_COLOR[sev] || "#9ca3af"}">${esc(sev)}</b></div>` : ""}
        ${res.estimatedCost ? `<div class="fact"><span>Typical cost</span><b>${esc(one(res.estimatedCost))}</b></div>` : ""}
        ${res.diyDifficulty ? `<div class="fact"><span>DIY difficulty</span><b>${esc(one(res.diyDifficulty))}</b></div>` : ""}
      </div>

      <section>
        <h2>Short answer</h2>
        <p class="lead">${esc(one(res.summary))}</p>
        ${res.immediateAction ? `<div class="callout"><b>Do this first:</b> ${esc(one(res.immediateAction))}</div>` : ""}
      </section>

      ${causes.length ? `<section>
        <h2>Most likely causes</h2>
        <ol class="causes">${causes.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>
      </section>` : ""}

      ${steps.length ? `<section>
        <h2>Step by step</h2>
        <ol class="steps">${steps.map((t) => `<li>${esc(t)}</li>`).join("\n          ")}</ol>
      </section>` : ""}

      ${res.proTip ? `<section class="tip"><h2>Pro tip</h2><p>${esc(one(res.proTip))}</p></section>` : ""}

      ${parts.length ? `<section>
        <h2>Parts you may need</h2>
        <ul class="parts">${parts.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
        <p class="small">Bring your VIN to any parts store for the exact part number for your vehicle.</p>
      </section>` : ""}

      <p class="disclaimer">${r.engine ? "" : `Engine not specified: specs can differ between the engines offered on the ${esc(vehicle)}. `}Always confirm torque specs and fastener sizes for your exact vehicle before tightening. If a step involves brakes, steering, fuel or airbags and you're unsure, have a mechanic do it.</p>
    </article>
${cta(model)}
${related.length ? `    <section class="related">
      <h2>More ${esc(make)} ${esc(model)} problems</h2>
      <ul class="list">${related.map((s) => `<li><a href="/problems/${s.makeSlug}/${s.modelSlug}/${s.slug}/"><span class="yr">${s.year}</span>${esc(problemName(s.title))}</a></li>`).join("")}</ul>
    </section>` : ""}`;

  return page({ title: `${title} | AutoAI`, description, canonical: SITE + url, body, jsonld });
}

// ── Model page ───────────────────────────────────────────────────────────────
function modelPage(makeSlug, modelSlug, rows) {
  const make = displayName(rows[0].makeName), model = displayName(rows[0].modelName);
  const url = `/problems/${makeSlug}/${modelSlug}/`;
  const years = [...new Set(rows.map((r) => r.year))].sort();
  const yr = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : String(years[0]);
  const trail = [["Common problems", "/problems/"], [make, `/problems/${makeSlug}/`], [model, url]];
  const sorted = [...rows].sort((a, b) => a.year - b.year || one(a.title).localeCompare(one(b.title)));
  const body = `${crumbs(trail)}
    <header class="hub">
      <p class="eyebrow">${esc(yr)}</p>
      <h1>${esc(make)} ${esc(model)} common problems</h1>
      <p class="lead">Real questions from ${esc(make)} ${esc(model)} owners, with causes, typical cost and step-by-step fixes. Every answer is reviewed by ${REVIEWER} before it's published.</p>
    </header>
    <ul class="list">${sorted.map((r) => `<li><a href="${url}${r.slug}/"><span class="yr">${r.year}</span>${esc(problemName(r.title))}${r.result?.severity ? `<em style="color:${SEV_COLOR[r.result.severity] || "#9ca3af"}">${esc(r.result.severity)}</em>` : ""}</a></li>`).join("\n      ")}</ul>
${cta(model)}`;
  return page({
    title: `${make} ${model} Common Problems & Fixes (${yr}) | AutoAI`,
    description: clip(`Common ${make} ${model} problems from real owners: causes, repair cost and step-by-step fixes, reviewed by a person.`, 155),
    canonical: SITE + url, body, jsonld: [crumbsLd(trail)],
  });
}

// ── Make page ────────────────────────────────────────────────────────────────
function makePage(makeSlug, models) {
  const make = displayName(models[0][1][0].makeName);
  const url = `/problems/${makeSlug}/`;
  const trail = [["Common problems", "/problems/"], [make, url]];
  const body = `${crumbs(trail)}
    <header class="hub">
      <h1>${esc(make)} common problems</h1>
      <p class="lead">Pick your model to see real problems ${esc(make)} owners asked about, with causes and step-by-step fixes.</p>
    </header>
    <ul class="list">${models.map(([modelSlug, rows]) => `<li><a href="${url}${modelSlug}/">${esc(make)} ${esc(displayName(rows[0].modelName))}<em>${rows.length} problem${rows.length === 1 ? "" : "s"}</em></a></li>`).join("\n      ")}</ul>
${cta("")}`;
  return page({
    title: `${make} Common Problems & Fixes by Model | AutoAI`,
    description: clip(`Common ${make} problems by model, from real owners: causes, repair cost and step-by-step fixes.`, 155),
    canonical: SITE + url, body, jsonld: [crumbsLd(trail)],
  });
}

// ── Library home ─────────────────────────────────────────────────────────────
function homePage(makes, rows) {
  const latest = [...rows].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 8);
  const body = `${crumbs([["Common problems", "/problems/"]])}
    <header class="hub">
      <h1>Common car problems, answered</h1>
      <p class="lead">Real questions from drivers and DIYers, with likely causes, typical repair cost and step-by-step fixes for the exact vehicle. Every guide is reviewed by ${REVIEWER} before it goes up.</p>
    </header>
    <h2 class="section">Browse by make</h2>
    <ul class="grid">${makes.map(([makeSlug, models]) => {
      const n = models.reduce((a, [, rs]) => a + rs.length, 0);
      return `<li><a href="/problems/${makeSlug}/">${esc(displayName(models[0][1][0].makeName))}<em>${n}</em></a></li>`;
    }).join("")}</ul>
    <h2 class="section">Latest guides</h2>
    <ul class="list">${latest.map((r) => `<li><a href="/problems/${r.makeSlug}/${r.modelSlug}/${r.slug}/"><span class="yr">${r.year}</span>${esc(displayName(r.makeName))} ${esc(displayName(r.modelName))}: ${esc(problemName(r.title).charAt(0).toLowerCase() + problemName(r.title).slice(1))}</a></li>`).join("\n      ")}</ul>
${cta("")}`;
  return page({
    title: "Common Car Problems & Fixes, by Make and Model | AutoAI",
    description: "Real car problems from real owners, with likely causes, typical repair cost and step-by-step fixes for the exact vehicle. Reviewed by a person.",
    canonical: `${SITE}/problems/`, body,
  });
}

// ── Stylesheet ───────────────────────────────────────────────────────────────
const CSS = `:root{--bg:#050509;--blue:#345bff;--green:#10b981;--card:#0d0f17;--border:#1a1d2e;--text:#fff;--muted:#6b7280;--secondary:#9ca3af}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:'Barlow',system-ui,sans-serif;line-height:1.6;overflow-x:hidden}
a{color:inherit}
nav{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:24px;padding:16px 24px;background:rgba(5,5,9,.9);backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.06)}
.nav-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:24px;letter-spacing:.05em;text-decoration:none;margin-right:auto}
.nav-logo span,.footer-logo span{color:var(--blue)}
.nav-link{color:var(--secondary);text-decoration:none;font-weight:500;font-size:15px}
.nav-link:hover{color:var(--text)}
.nav-cta{background:var(--blue);color:#fff;text-decoration:none;padding:9px 18px;border-radius:8px;font-weight:600;font-size:15px;white-space:nowrap}
main{max-width:760px;margin:0 auto;padding:24px 16px 56px}
.crumbs{list-style:none;display:flex;flex-wrap:wrap;gap:6px;font-size:13px;color:var(--muted);margin-bottom:28px}
.crumbs li:not(:last-child)::after{content:"›";margin-left:6px}
.crumbs a{text-decoration:none;color:var(--secondary)}
.crumbs a:hover{color:var(--text)}
.eyebrow{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);margin-bottom:6px}
h1{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(32px,6vw,48px);line-height:1.05;letter-spacing:.01em;margin-bottom:18px;text-wrap:balance}
h2{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:26px;letter-spacing:.02em;margin:36px 0 12px}
h2.section{font-size:22px;color:var(--secondary);text-transform:uppercase;letter-spacing:.08em;margin-top:40px}
.question{background:var(--card);border:1px solid var(--border);border-left:3px solid var(--blue);border-radius:10px;padding:14px 16px;color:var(--secondary);margin-bottom:14px}
.question span{display:block;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.byline{font-size:14px;color:var(--muted)}
.byline strong{color:var(--green);font-weight:600}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:24px 0 4px}
.fact{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px}
.fact span{display:block;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.fact b{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:700}
.lead{font-size:18px;color:#e5e7eb}
.callout{margin-top:16px;background:rgba(249,115,22,.08);border:1px solid rgba(249,115,22,.35);border-radius:12px;padding:14px 16px;color:#fed7aa}
.callout b{color:#fdba74}
.causes{padding-left:22px;display:grid;gap:8px;color:#e5e7eb}
.steps{list-style:none;counter-reset:s;display:grid;gap:10px}
.steps li{counter-increment:s;position:relative;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px 12px 52px;color:#e5e7eb}
.steps li::before{content:counter(s);position:absolute;left:14px;top:12px;width:26px;height:26px;border-radius:50%;background:rgba(52,91,255,.15);color:var(--blue);font-weight:700;font-size:14px;display:grid;place-items:center}
.tip p{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.3);border-radius:12px;padding:14px 16px;color:#d1fae5}
.parts{list-style:none;display:flex;flex-wrap:wrap;gap:8px}
.parts li{background:var(--card);border:1px solid var(--border);border-radius:999px;padding:6px 14px;font-size:15px}
.small{font-size:14px;color:var(--muted);margin-top:10px}
.disclaimer{margin-top:32px;font-size:14px;color:var(--muted);border-top:1px solid var(--border);padding-top:16px}
.cta{margin-top:48px;background:radial-gradient(circle at 20% 0%,rgba(52,91,255,.18),transparent 60%),var(--card);border:1px solid var(--border);border-radius:16px;padding:24px 20px}
.cta h2{margin-top:0}
.cta p{color:var(--secondary);margin-bottom:18px}
.store-buttons{display:flex;flex-wrap:wrap;gap:10px}
.btn-primary,.btn-secondary{display:inline-flex;align-items:center;gap:8px;text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:700;font-size:16px}
.btn-primary{background:var(--blue);color:#fff}
.btn-secondary{background:var(--bg);color:var(--text);border:1px solid var(--border)}
.btn-primary:hover{background:#2a4de0}.btn-secondary:hover{border-color:var(--blue)}
.hub .lead{color:var(--secondary)}
.list{list-style:none;display:grid;gap:8px;margin-top:24px}
h2.section+.list,h2.section+.grid{margin-top:8px}
.list a{display:flex;align-items:baseline;gap:12px;text-decoration:none;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;font-weight:600}
.list a:hover,.grid a:hover{border-color:var(--blue)}
.list .yr{font-family:'Barlow Condensed',sans-serif;color:var(--blue);font-weight:700;min-width:40px}
.list em,.grid em{margin-left:auto;font-style:normal;font-size:13px;font-weight:500;color:var(--muted);white-space:nowrap}
.grid{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.grid a{display:flex;align-items:baseline;text-decoration:none;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;font-weight:600}
.related h2{font-size:22px}
footer{border-top:1px solid var(--border);padding:32px 16px;text-align:center;color:var(--muted);font-size:14px;display:grid;gap:8px}
footer a{color:var(--secondary)}
.footer-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;color:var(--text)}
.footer-copy{max-width:560px;margin:0 auto;font-size:13px}
@media (max-width:520px){nav{gap:14px;padding:12px 16px}.nav-link{display:none}h2{font-size:23px}.steps li{padding-left:46px}.steps li::before{left:12px}}
`;

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(path.join(DOCS, "CNAME"))) {
    throw new Error(`Expected the site at ${DOCS} (docs/CNAME missing). Run this from the backend folder.`);
  }
  const raw = await prisma.diagnosisAnswer.findMany({
    where: { publishedAt: { not: null }, title: { not: null }, slug: { not: null } },
    orderBy: [{ make: "asc" }, { model: "asc" }, { year: "asc" }],
  });
  const rows = raw
    .filter((r) => r.make && r.model && r.year)
    .map((r) => ({ ...r, makeName: r.make, modelName: r.model, makeSlug: slugify(r.make), modelSlug: slugify(r.model) }));

  // Group: make → model → rows (slugs collapse "FORD"/"Ford")
  const byMake = new Map();
  for (const r of rows) {
    if (!byMake.has(r.makeSlug)) byMake.set(r.makeSlug, new Map());
    const models = byMake.get(r.makeSlug);
    if (!models.has(r.modelSlug)) models.set(r.modelSlug, []);
    models.get(r.modelSlug).push(r);
  }
  const makes = [...byMake.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([m, models]) => [m, [...models.entries()].sort(([a], [b]) => a.localeCompare(b))]);

  rmSync(OUT, { recursive: true, force: true });
  write("problems/library.css", CSS);
  const urls = ["/", "/problems/"];
  write("problems/index.html", homePage(makes, rows));
  for (const [makeSlug, models] of makes) {
    write(`problems/${makeSlug}/index.html`, makePage(makeSlug, models));
    urls.push(`/problems/${makeSlug}/`);
    for (const [modelSlug, mrows] of models) {
      write(`problems/${makeSlug}/${modelSlug}/index.html`, modelPage(makeSlug, modelSlug, mrows));
      urls.push(`/problems/${makeSlug}/${modelSlug}/`);
      for (const r of mrows) {
        write(`problems/${makeSlug}/${modelSlug}/${r.slug}/index.html`, problemPage(r, mrows));
        urls.push(`/problems/${makeSlug}/${modelSlug}/${r.slug}/`);
      }
    }
  }

  const lastmod = (u) => {
    const r = rows.find((x) => `/problems/${x.makeSlug}/${x.modelSlug}/${x.slug}/` === u);
    return day(r ? (r.updatedAt || r.publishedAt) : new Date());
  };
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${lastmod(u)}</lastmod></url>`).join("\n")}
</urlset>
`);
  write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  const pages = rows.length;
  console.log(`Built ${pages} problem page${pages === 1 ? "" : "s"} across ${makes.length} make${makes.length === 1 ? "" : "s"} → ${OUT}`);
  console.log(`Sitemap: ${urls.length} URLs → ${path.join(DOCS, "sitemap.xml")}`);
  console.log(`\nPublish:\n  cd ..\n  git add docs\n  git commit -m "Library pages"\n  git push`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
