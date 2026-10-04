'use strict';
const fs = require('node:fs');
const path = require('node:path');
function read(root, file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function walk(root, folder) {
  if (!fs.existsSync(path.join(root, folder))) return [];
  return fs.readdirSync(path.join(root, folder), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))
    .flatMap(entry => entry.isDirectory() ? walk(root, folder + '/' + entry.name) : [folder + '/' + entry.name]);
}
function attr(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp('(?:^|\\s)' + escaped + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  return match ? match[1] ?? match[2] ?? match[3] : null;
}
function resolveLocal(from, url) {
  if (!url || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) return null;
  const value = url.replace(/[?#].*$/, '');
  const resolved = value.startsWith('/') ? 'public' + value : path.posix.normalize(path.posix.dirname(from) + '/' + value);
  if (resolved.startsWith('../')) return null;
  return resolved;
}
function stylesheetLinks(html, file) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].flatMap(([tag]) => /(?:^|\s)stylesheet(?:\s|$)/i.test(attr(tag, 'rel') || '')
    ? [resolveLocal(file, attr(tag, 'href'))].filter(Boolean) : []);
}
function cssPath(root, entry, target, seen = new Set()) {
  if (!entry || seen.has(entry) || !fs.existsSync(path.join(root, entry))) return null;
  if (entry === target) return [entry];
  seen.add(entry);
  const text = read(root, entry).replace(/\/\*[\s\S]*?\*\//g, '');
  const imports = [...text.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?[^;]*;/gi)];
  for (const match of imports) {
    const child = resolveLocal(entry, match[1]);
    const result = cssPath(root, child, target, new Set(seen));
    if (result) return [entry, ...result];
  }
  return null;
}
function redirectTarget(html) {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if ((attr(tag, 'http-equiv') || '').toLowerCase() !== 'refresh') continue;
    const match = (attr(tag, 'content') || '').match(/;\s*url\s*=\s*(.*)/i);
    if (match) return match[1].replace(/^['"]|['"]$/g, '').replace(/&amp;/g, '&');
  }
  return null;
}
function directScripts(html, file) {
  return [...html.matchAll(/<script\b[^>]*>/gi)].map(([tag]) => resolveLocal(file, attr(tag, 'src'))).filter(Boolean);
}
function classifyFamily(file, route, source, registry) {
  if (registry.canvas?.[route]) return 'protected-canvas';
  if (registry.profiles?.[route]) return registry.profiles[route].type;
  if (file.startsWith('storeapps/')) return 'isolated-app-package';
  if (file === 'index.html' || file === 'explore/index.html' || file.startsWith('public/site/')) return 'public-platform';
  const specific = {
    communication: /(?:rtg-communication|rtg-mail|social-suite|sociaal-command)/,
    'foundation-family': /(?:rtg-foundation|foundation\/foundation|foundation\.css)/,
    hospitality: /(?:horeca|rendezvous|restaurant|hospitality)/,
    'travel-operations': /(?:reisplanner|reisapp|reisboek|reisgids|rtg-travel|navigatie|reiswereld)/,
    workspace: /(?:werkos|workspace|kantoor|hq-|pn-shell|enterprise)/,
    'media-and-social': /(?:muziek|media-command|salon|saloon|sociaal|clips|pulse)/,
    identity: /(?:passkey|rtgid|toegang|veilig)/
  };
  const evidence = stylesheetLinks(source, file).join(' ');
  return Object.keys(specific).find(name => specific[name].test(evidence)) || 'native-operational';
}

module.exports={read,walk,attr,resolveLocal,stylesheetLinks,cssPath,redirectTarget,directScripts,classifyFamily};
