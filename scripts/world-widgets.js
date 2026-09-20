/* Desktop projections are derived from the existing app registry and pages.
   Design metadata describes their appearance; it cannot add a route. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const identity = require('../public/shared/rtg-world-identity');
const { APPS } = require('../server/kern/appcatalogus-data');
const { R } = require('../server/kern/rtfappcatalogus-data');
const DOEL = path.join(ROOT, 'public/shared/interface/world-widget-catalog.json');
const clean = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
function gegevens() {
  const design = JSON.parse(fs.readFileSync(path.join(__dirname, 'world-widget-design.json'), 'utf8'));
  const meta = new Map();
  APPS.forEach(a => meta.set(a.url, { name: a.naam, description: a.uitleg }));
  R.forEach(a => meta.set(a[4], { name: a[1], description: a[5], foundation: true }));
  const urls = new Set(Object.values(identity.MANIFEST).flat().filter(p => !identity.REDIRECTS.includes(p)));
  for (const url of [...urls, ...identity.REDIRECTS]) {
    const html = fs.readFileSync(path.join(ROOT, 'public', url), 'utf8');
    const redirect = html.match(/<meta[^>]*http-equiv="refresh"[^>]*content="[^";]*;\s*url=([^"\s]+)/i);
    if (redirect) {
      urls.delete(url);
      if (redirect[1].includes('#')) urls.add(redirect[1]);
    }
  }
  // Named sub-apps (such as RTG Geld) retain their canonical deep link.
  for (const url of meta.keys()) if (/[?#]/.test(url) && urls.has(url.split(/[?#]/)[0])) urls.add(url);
  return [...urls].sort().map(url => {
    const file = path.join(ROOT, 'public', url.split(/[?#]/)[0]);
    if (!fs.existsSync(file)) throw new Error('Missing widget source: ' + url);
    const html = fs.readFileSync(file, 'utf8'), spec = design[url] || {}, source = meta.get(url) || {};
    const world = identity.classify(url), name = source.name || spec.name || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    const sections = spec.sections || [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map(x => clean(x[1])).filter(Boolean).slice(0, 3);
    return { id: url.slice(6).replace(/\.html/g, '').replace(/[^a-z0-9]+/g, '-'), url, name: name.slice(0, 80),
      world, worlds: spec.shared ? ['living', 'travel', 'work', 'foundation'] : [...new Set([world].concat(source.foundation ? ['foundation'] : []))],
      type: spec.type || 'workspace', icon: spec.icon || 'grid', sections: sections.slice(0, 3),
      description: source.description || spec.intro || '', maturity: 'L0' };
  });
}
function bouw() { return JSON.stringify({ version: 1, apps: gegevens() }, null, 2) + '\n'; }
function schrijf() { fs.writeFileSync(DOEL, bouw()); }
if (require.main === module) schrijf();
module.exports = { gegevens, bouw, schrijf, DOEL };
