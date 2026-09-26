#!/usr/bin/env node
/* Enforced boundaries for the personal-vault lifecycle. Not a generic JavaScript information-flow proof. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { bundels, bundel } = require('./bundel');
const { parse } = require('./ast/parser'), { loop } = require('./ast/walk');
const privateImports = {
  'document-capability': ['server/kern/bestanden.js'],
  'bestanden-delen': ['server/kern/bestanden.js'],
  'bestanden-versiecommit': ['server/kern/bestanden-delen.js'],
  'bestanden-metadata': ['server/kern/bestanden.js']
};
const collectionWriters = ['server/kern/document-capability.js', 'server/kern/bestanden-versiecommit.js', 'server/kern/bestanden-metadata.js'];
const collectionReaders = ['server/kern/bestanden.js', 'server/kern/bestanden-opslag.js', 'server/kern/galerij.js'];
const adapters = ['server/routes/bestanden.js', 'server/kern/bestanden-delen.js'];
const literal = n => n && n.type === 'Literal' && n.kind === 'string' ? n.raw.slice(1, -1) : null;
const property = n => n && n.type === 'MemberExpression' ? (n.computed ? literal(n.property) : n.property.name) : null;
function inspect(source, file) {
  const violations = [], references = [];
  const bad = (rule, node) => violations.push({ rule, file, line: node.lijn });
  let tree;
  try { tree = parse(source); } catch (e) { return { violations: [{ rule: 'parse', file, line: e.lijn }], references }; }
  loop(tree, n => {
    if (n.type === 'CallExpression') {
      const callee = n.callee, name = callee.name || property(callee), args = n.arguments || [];
      if (name === 'require' || name === 'import') {
        const target = literal(args[0]);
        if (typeof target === 'string') {
          const privateName = path.basename(target).replace(/\.js$/, '');
          if (privateImports[privateName] && !privateImports[privateName].includes(file)) bad('private-handler-import', n);
          if (file.startsWith('public/') && /^(node:)?(fs|sqlite)$|server\/(db|kern)/.test(target)) bad('interface-persistence-import', n);
        }
      }
      if (name === 'documentActie') {
        references.push({ file, line: n.lijn, kind: 'ADAPTER_TO_CAPABILITY' });
        if (!adapters.includes(file)) bad('private-execution-call', n);
        const authority = args[2];
        if (!(authority && (authority.name === 'authority' || property(authority) === 'documentAuthority')))
          bad('adapter-policy-bypass', n);
      }
      if (args.some(a => literal(a) === 'bestanden') && /bewerkCollectie|save|schrijf|write|update|delete/i.test(name || '')) {
        references.push({ file, line: n.lijn, kind: 'COLLECTION_ACCESS' });
        if (!collectionWriters.includes(file)) bad('unreviewed-collection-writer', n);
      }
    }
    if (property(n) === 'bestanden' && property(n.object) === 'data') {
      references.push({ file, line: n.lijn, kind: 'COLLECTION_ACCESS' });
      if (!collectionReaders.includes(file)) bad('unreviewed-collection-access', n);
    }
    if (n.type === 'AssignmentExpression' || n.type === 'UpdateExpression') {
      const field = property(n.left || n.argument);
      if (field === 'documentRevision' || (field === 'wegOp' && file.includes('document'))) {
        references.push({ file, line: n.lijn, kind: 'LIFECYCLE_WRITE' });
        if (file !== 'server/kern/document-capability.js') bad('lifecycle-writer-bypass', n);
      }
      if (field === 'weg' && /^server\/kern\/(document|bestanden)/.test(file) && file !== 'server/kern/document-capability.js') bad('lifecycle-writer-bypass', n);
    }
  });
  return { violations, references };
}
function scan(root) {
  const files = [];
  function visit(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['dist', 'node_modules'].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) visit(p); else if (e.name.endsWith('.js')) files.push(p);
    }
  }
  for (const dir of ['server', 'public']) visit(path.join(root, dir));
  const parts = Object.values(bundels).map(d => 'public/' + d + '/');
  const units = files.sort().filter(p => !parts.some(d => path.relative(root, p).startsWith(d)));
  const results = units.map(p => {
    const rel = path.relative(root, p), name = rel.replace(/^public\//, '');
    const source = fs.readFileSync(p, 'utf8');
    const assembled = Object.hasOwn(bundels, name) ? bundel(name).toString() : source;
    const result = inspect(assembled, rel);
    if (assembled !== source) result.violations.push({ rule: 'bundle-source-mismatch', file: rel });
    return result;
  });
  return { scannedFiles: files.length, parsedUnits: units.length, violations: results.flatMap(x => x.violations), references: results.flatMap(x => x.references),
    exceptions: { compositionRoots: privateImports, collectionWriters, collectionReaders,
      scope: 'Creation, legacy erasure/account forgetting and backup restoration are distinct semantics, reviewed in DOCUMENT-NO-BYPASS. This rule cannot prove arbitrary reflective JavaScript data flow.' } };
}
module.exports = { inspect, scan };
if (require.main === module) { const r = scan(path.join(__dirname, '..')); console.log(JSON.stringify(r, null, 2)); if (r.violations.length) process.exitCode = 1; }
