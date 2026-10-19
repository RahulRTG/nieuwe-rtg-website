'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');

test('RTG Verblijven draagt het TravelOS-drieluik, op het RTG Design System', () => {
  /* Sinds batch 3 van TRAVELOS-MIGRATIE.md komt de vorm uit /ds/ en niet meer
     uit rtg-verblijven-2026.css. Wat deze toets bewaakte blijft: de wereld,
     de drie momenten en hun zinnen. */
  const html = lees('public/apps/hotels.html');
  const voorzijde = lees('public/apps/hotels-voorzijde.js');
  assert.match(html, /data-rtg-world="travel"/);
  assert.match(html, /href="\/ds\/rtg-ds\.css"/);
  assert.match(html, /Waar wilt u thuiskomen\?/);
  assert.match(voorzijde, /Alles staat voor u klaar\./);
  assert.match(voorzijde, /Zeg wat u nodig heeft\./);
  for (const id of ['zoeken', 'mijn', 'service']) assert.match(html, new RegExp('data-t="' + id + '"'));
});

test('zoeken en boeken blijven op de bestaande verblijfskern', () => {
  const js = lees('public/apps/hotels-voorzijde.js');
  for (const pad of ['/api/hotels', '/api/verblijf/mijn', '/api/verblijf']) assert.match(js, new RegExp(pad));
  assert.match(js, /Het huis bevestigt persoonlijk/);
  assert.match(js, /KAMER\.prijs\*n/);
});

test('sleutel en service verschijnen alleen in een echte verblijfstoestand', () => {
  const js = lees('public/apps/hotels-momenten.js');
  assert.match(js, /v\.status==='ingecheckt'/);
  assert.match(js, /\/api\/verblijf\/deur/);
  assert.match(js, /status==='bevestigd'/);
  assert.match(js, /Ter plaatse wordt actief zodra het huis uw verblijf heeft bevestigd/);
});

test('verblijfsservice vraagt de juiste menselijke afdeling zonder toezegging', () => {
  const js = lees('public/apps/hotels-momenten.js');
  for (const naam of ['Ontbijt', 'Housekeeping', 'Roomservice', 'Late check-out']) assert.match(js, new RegExp(naam));
  assert.match(js, /\/api\/partner\/chat\/send/);
  assert.match(js, /Er wordt niets automatisch toegezegd of besteld/);
  assert.match(js, /Een medewerker reageert persoonlijk/);
});

test('de verblijfsvoorzijde blijft in kleine modules en draagt geen eigen vormtaal', () => {
  for (const bestand of ['public/apps/hotels-voorzijde.js', 'public/apps/hotels-momenten.js'])
    assert.ok(Buffer.byteLength(lees(bestand)) < 10 * 1024, bestand + ' is te groot');
  /* Gemigreerd volgens de meting zelf: het systeem, geen erfenisblad, geen
     eigen <style>-blok en geen stijlinjectie buiten de overgangslijst. */
  const { meet } = require('../scripts/ontwerpsysteem.js');
  assert.ok(meet().gemigreerd.includes('public/apps/hotels.html'), 'hotels.html telt als gemigreerd');
  for (const weg of ['public/shared/rtg-verblijven-2026.css', 'public/shared/rtg-verblijven-momenten-2026.css'])
    assert.ok(!fs.existsSync(path.join(root, weg)), weg + ' hoort weg te zijn: niemand laadt hem nog');
});
