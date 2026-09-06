'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(root, p), 'utf8');

test('Het Vooruitzicht begint zonder verzonnen reis, score of providerbewijs', () => {
  const html = lees('public/apps/living-os.html');
  const kern = lees('public/apps/living-os.js');
  const view = lees('public/apps/living-os-view.js');
  const js = kern + '\n' + view;

  assert.doesNotMatch(html, /Kyoto|€\s*\d|\b\d{1,3}%|02 SEP|04 OKT|12 OKT/i);
  assert.match(html, /NOG GEEN INTENTIE|GEEN BEREKENING|GEEN ACTIEVE DELING/);
  assert.match(html, /living-os-data\.js/,
    'de cockpit laadt de adapter voor operationele bronnen');
  assert.ok(html.indexOf('living-os-view.js') < html.indexOf('living-os.js'),
    'de truthful presentatiemodule staat voor de interactielaag');
  assert.ok(Buffer.byteLength(kern) < 10 * 1024, 'de LivingOS-interactielaag blijft onder 10 KiB');
  assert.ok(Buffer.byteLength(view) < 10 * 1024, 'de LivingOS-presentatielaag blijft onder 10 KiB');
  assert.doesNotMatch(html + kern, /[\u2013\u2014]/,
    'LivingOS gebruikt geen brede Unicode-streep als lege waarde');

  assert.doesNotMatch(js, /score\s*:\s*\d|caps\s*:\s*\[/,
    'de client verzint geen rust- of kapitaalscores');
  assert.doesNotMatch(js, /u\.version\+\+|Universum bevestigd/,
    'een netwerkfout maakt geen lokale bevestiging of bronversie');
  assert.match(js, /Niet opgeslagen · probeer opnieuw/);
  assert.match(js, /HYPOTHETISCH SCENARIO/);
  assert.match(js, /status === 'confirmed'/,
    'alleen expliciet providerbewijs krijgt het label bevestigd');
});

test('de historische Geld-ingang kan geen voorbeeldsaldo meer tonen', () => {
  const html = lees('public/apps/geld-command.html');
  const js = lees('public/apps/geld-command.js');

  assert.match(html, /http-equiv="refresh" content="0; url=\/apps\/geld\.html"/);
  assert.match(js, /location\.replace\('\/apps\/geld\.html' \+ location\.hash\)/,
    'ook hashes gaan rechtstreeks naar de actuele geldomgeving');
  assert.doesNotMatch(html, /Kyoto|€\s*[\d.]|saldo|nettovermogen|\bLive\b|Alles is bijgewerkt/i,
    'het historische document bevat geen operationeel ogende voorbeelddata');
});

test('offline reisantwoorden noemen geen demo-bestemming en claimen geen uitvoering', () => {
  const html = lees('public/apps/app.html');
  const deel = lees('public/apps/app-main/app-main-49b.js');
  const bundel = lees('public/apps/app-main.js');
  const zonderCommentaar = bron => bron.replace(/\/\*[\s\S]*?\*\//g, '');

  for (const bron of [html, zonderCommentaar(deel)]) {
    assert.doesNotMatch(bron, /Formentera|Sal de Mar|Cala Jondal|25-31°C/i);
  }
  assert.doesNotMatch(html, /For Ibiza .*no visa|booking confirmations|mid-July/i);
  assert.match(html, /'ai\.a\.visa':'I cannot verify document or visa requirements offline\./);
  assert.match(html, /'ai\.a\.weather':'I have no live forecast available right now/);
  assert.match(html, /Nothing has been requested|Nothing has been sent or arranged/);

  for (const bron of [zonderCommentaar(deel), zonderCommentaar(bundel)]) {
    assert.doesNotMatch(bron, /dagplan voor 14 oktober|Ik zet het in gang/);
    assert.match(bron, /live dienst niet bereikbaar/);
    assert.match(bron, /Er is niets aangevraagd of geboekt/);
    assert.match(bron, /geen live verwachting beschikbaar/);
    assert.match(bron, /geen bevestigd antwoord/);
  }
});

test('Foundation gebruikt een belofte zonder neppercentage en geldige tegellinks', () => {
  const html = lees('public/apps/foundation/index.html');
  assert.doesNotMatch(html, /<strong>100%<\/strong>/);
  assert.match(html, /<strong>Ieder talent telt<\/strong>/);
  assert.match(html, /fetch\('\/api\/foundation\/impact'\)/,
    'echte impact blijft uit de impactroute komen');

  let diepte = 0;
  let maximum = 0;
  for (const tag of html.match(/<\/?a\b[^>]*>/gi) || []) {
    if (/^<\/a/i.test(tag)) diepte -= 1;
    else { diepte += 1; maximum = Math.max(maximum, diepte); }
    assert.ok(diepte >= 0, 'een link sluit zonder geopende link');
  }
  assert.equal(diepte, 0, 'alle links worden gesloten');
  assert.equal(maximum, 1, 'een link bevat nooit een tweede link');
  assert.equal((html.match(/href="leren\.html"/g) || []).length, 1,
    'Leren staat één keer als geldige tegel in het rooster');
});
