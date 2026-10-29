'use strict';
/* RTG Vlucht: de voorzijde houdt zijn drie momenten, zijn echte routes en zijn
   tabgebonden instapcode. Sinds de TravelOS-migratie staat het scherm op het
   RTG Design System (TRAVELOS-MIGRATIE.md): de vorm is dan /ds/rtg-ds.css en
   het gedrag woont in vluchten-voorzijde.js en vluchten-momenten.js.
   test/vluchten-ds.e2e.js bewijst hetzelfde in een echte browser. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');
const html = lees('public/apps/vluchten.html');
const js = lees('public/apps/vluchten-voorzijde.js') + lees('public/apps/vluchten-momenten.js');

test('RTG Vlucht draagt het goedgekeurde TravelOS-drieluik', () => {
  assert.match(html, /\/ds\/rtg-ds\.css/);
  assert.match(html, /data-rtg-world="travel"/);
  assert.match(html, /Waar wilt u naartoe\?/);
  assert.match(js, /Alles bij de hand\./);
  assert.match(js, /Uw tijd bepaalt het vertrek\./);
  for (const id of ['bord', 'mijn', 'charter']) assert.match(html, new RegExp('data-t="' + id + '"'));
});

test('de reiziger gebruikt de echte vlucht-, boekings- en charterroutes', () => {
  for (const pad of ['/bord', '/boek', '/mijn', '/incheck', '/pass/roteer', '/pass/intrek', '/charter'])
    assert.match(js, new RegExp("api\\('" + ('/api/member/vluchten' + pad).replaceAll('/', '\\/')));
  assert.match(js, /fetch\(pad,/);
  assert.match(js, /Operations bevestigt persoonlijk/);
  assert.match(js, /Geen automatische belofte/);
});

test('het vluchtfilter maakt geen tweede waarheid of verzonnen aanbod', () => {
  assert.match(js, /BORD = d/);
  assert.match(js, /data-vlucht-zoek/);
  assert.match(js, /Een boeking is pas gemaakt nadat de server haar bevestigt/);
  assert.doesNotMatch(html + js, /Vanaf €|data:image|QR-code|qrcode/i);
});

test('de instapcode blijft tabgebonden, vernieuwbaar en intrekbaar', () => {
  assert.match(js, /sessionStorage\.setItem\(passSleutel/);
  assert.match(js, /sessionStorage\.removeItem\(passSleutel/);
  assert.match(js, /Nieuwe instapcode/);
  assert.match(js, /Code intrekken/);
  assert.match(js, /alleen in dit browsertabblad/);
});

test('de vluchtlaag blijft klein en heeft geen eigen stijl', () => {
  for (const f of ['public/apps/vluchten.html', 'public/apps/vluchten-voorzijde.js', 'public/apps/vluchten-momenten.js'])
    assert.ok(Buffer.byteLength(lees(f)) < 10 * 1024, f);
  assert.doesNotMatch(html, /<style|style="|\/shared\/[\w-]+\.css/);
  assert.doesNotMatch(js, /style="|\.style\./);
});
