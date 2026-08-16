#!/usr/bin/env node
'use strict';

/* Een tag als @v4 is mensvriendelijk maar verplaatsbaar. Een gehackt
   Action-account kan die tag naar andere code laten wijzen. De workflow mag
   daarom alleen lokale Actions of een volledige, onveranderlijke commit-SHA
   gebruiken. Dependabot houdt de SHA plus de leesbare versiecomment bij. */

const fs = require('fs');
const path = require('path');

function losseActions(tekst, bestand) {
  const fout = [];
  String(tekst).split(/\r?\n/).forEach((regel, i) => {
    const m = /^\s*(?:-\s*)?uses:\s*([^\s#]+)/.exec(regel);
    if (!m || m[1].startsWith('./')) return;
    const at = m[1].lastIndexOf('@');
    const ref = at >= 0 ? m[1].slice(at + 1) : '';
    if (!/^[0-9a-f]{40}$/.test(ref)) fout.push(`${bestand}:${i + 1} ${m[1]}`);
  });
  return fout;
}

function controleer(map) {
  const fout = [];
  for (const naam of fs.readdirSync(map).filter(n => /\.ya?ml$/.test(n)).sort()) {
    const bestand = path.join(map, naam);
    fout.push(...losseActions(fs.readFileSync(bestand, 'utf8'), bestand));
  }
  return fout;
}

if (require.main === module) {
  const map = path.join(__dirname, '..', '.github', 'workflows');
  const fout = controleer(map);
  if (fout.length) {
    console.error('CI-keten geweigerd: zet elke externe Action vast op een volledige commit-SHA:');
    fout.forEach(f => console.error(' - ' + f));
    process.exitCode = 1;
  } else {
    console.log('CI-keten: alle externe Actions staan vast op een volledige commit-SHA.');
  }
}

module.exports = { losseActions, controleer };
