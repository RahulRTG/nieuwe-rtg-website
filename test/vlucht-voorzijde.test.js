'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');

test('RTG Vlucht draagt het goedgekeurde TravelOS-drieluik', () => {
  const html = lees('public/apps/vluchten.html');
  assert.match(html, /rtg-flight-experience/);
  assert.match(html, /\/shared\/rtg-vlucht-2026\.css/);
  assert.match(html, /Waar wilt u naartoe\?/);
  assert.match(html, /Alles bij de hand\./);
  assert.match(html, /Uw tijd bepaalt het vertrek\./);
  for (const id of ['bord', 'mijn', 'charter']) assert.match(html, new RegExp('data-t="' + id + '"'));
  for (const id of ['bord', 'mijn', 'charter']) assert.match(html, new RegExp('data-vlucht-nav="' + id + '"'));
});

test('de reiziger gebruikt de echte vlucht-, boekings- en charterroutes', () => {
  const html = lees('public/apps/vluchten.html');
  for (const pad of ['/bord', '/boek', '/mijn', '/incheck', '/pass/roteer', '/pass/intrek', '/charter'])
    assert.match(html, new RegExp("api\\('" + pad.replace('/', '\\/')));
  assert.match(html, /Operations bevestigt persoonlijk/);
  assert.match(html, /Geen automatische belofte/);
});

test('het vluchtfilter maakt geen tweede waarheid of verzonnen aanbod', () => {
  const html = lees('public/apps/vluchten.html');
  assert.match(html, /BORD=d/);
  assert.match(html, /data-vlucht-zoek/);
  assert.match(html, /Een boeking is pas gemaakt nadat de server haar bevestigt/);
  assert.doesNotMatch(html, /Vanaf €|data:image|QR-code|qrcode/i);
});

test('de instapcode blijft tabgebonden, vernieuwbaar en intrekbaar', () => {
  const html = lees('public/apps/vluchten.html');
  assert.match(html, /sessionStorage\.setItem\(passSleutel/);
  assert.match(html, /sessionStorage\.removeItem\(passSleutel/);
  assert.match(html, /Nieuwe instapcode/);
  assert.match(html, /Code intrekken/);
  assert.match(html, /alleen in dit browsertabblad/);
});

test('de nieuwe vluchtlaag blijft klein en gebruikt de centrale systeemvorm', () => {
  const css = lees('public/shared/rtg-vlucht-2026.css');
  const adapter = lees('public/shared/rtg-heritage-adapters.css');
  assert.ok(Buffer.byteLength(css) < 10 * 1024);
  assert.match(adapter, /rtg-flight-experience \.vlucht-nav/);
  assert.doesNotMatch(css, /border-radius:var\(--rtg-radius-system\)/);
});
