'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {meet,rijen} = require('../scripts/appwerkt');
const root = path.join(__dirname,'..');

// De echte APPWERKT-runner, beperkt tot de twee query-ingangen. Geen tweede
// meetmotor en geen samenvoeging met historische bewijzen van andere apps.
test('APPWERKT bereikt en bedient de twee expliciete OS-query-ingangen', {timeout:600000}, async t => {
  const registers = ['APPWERKT.json','APPWERKT-RAAKVLAK.json'];
  const before = registers.map(file=>fs.readFileSync(path.join(root,file)));
  t.after(() => registers.forEach((file,i)=>assert.deepEqual(fs.readFileSync(path.join(root,file)),before[i],
    file+' mag ook bij een mislukte gerichte meting niet worden herschreven')));
  const selected = rijen().filter(row=>['os:rtf','os:videobellen'].includes(row.functie));
  assert.deepEqual(selected.map(row=>row.functie).sort(),['os:rtf','os:videobellen']);
  const measured = await meet(selected);
  assert.deepEqual(measured.regels.map(row=>row.functie).sort(),['os:rtf','os:videobellen']);
  for (const row of measured.regels) {
    t.diagnostic(JSON.stringify({functie:row.functie,gevonden:row.gevonden,geklikt:row.geklikt,
      bereikbaar:row.bewijzen.bereikbaar,bedienbaar:row.bewijzen.bedienbaar,waarnemingen:row.waarnemingen}));
    assert.equal(row.bewijzen.bereikbaar.status,'BEWEZEN',row.functie+': '+row.bewijzen.bereikbaar.reden);
    assert.equal(row.bewijzen.bedienbaar.status,'BEWEZEN',row.functie+': '+row.bewijzen.bedienbaar.reden);
    assert.ok(row.gevonden>0,row.functie+': echte bediening ontbreekt');
    assert.equal(row.geklikt,row.gevonden);
    assert.deepEqual(row.onaangeraakt,[]);
    assert.deepEqual(row.nietKlikbaar,[]);
  }
});
