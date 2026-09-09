'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(root, p), 'utf8');
const html = lees('public/apps/rtmail.html');
const gedrag = lees('public/apps/rtmail-voorzijde.js');
const gesprek = lees('public/apps/rtmail-voorzijde-gesprek.js');
const werk = lees('public/apps/rtmail-voorzijde-werk.js');
const css = lees('public/shared/rtg-mail-2026.css');

test('RTMail opent met Aandacht, Gesprek en Naar werk in de WorkOS-stijl', () => {
  assert.match(html, /class="rtg-stijl rtg-work-flow rtm-voorzijde-actief"/);
  for (const paneel of ['aandacht', 'gesprek', 'werk']) {
    assert.match(html, new RegExp('data-rtm-paneel="' + paneel + '"'));
  }
  assert.match(html, /Uw inbox, teruggebracht tot wat ertoe doet\./);
  assert.match(html, /Van gesprek naar resultaat, zonder opnieuw te beginnen\./);
  assert.equal((html.match(/\/shared\/rtg-mail-2026\.css/g) || []).length, 1);
  assert.equal((html.match(/\/apps\/rtmail-voorzijde\.js/g) || []).length, 1);
  assert.equal((html.match(/\/apps\/rtmail-voorzijde-werk\.js/g) || []).length, 1);
  assert.equal((html.match(/\/apps\/rtmail-voorzijde-gesprek\.js/g) || []).length, 1);
  for (const kleur of ['--mail-nacht:#061116', '--mail-goud:#c99b55', '--mail-teal:#7d9f98', '--mail-wijn:#7a1830']) {
    assert.ok(css.includes(kleur), kleur);
  }
  assert.match(css, /\.rtm-nav\{position:fixed/);
});

test('de rustige voorzijde gebruikt alleen echte RTMail-bronnen', () => {
  assert.match(gedrag, /mail\.api\('vak'/);
  assert.match(gesprek, /mail\.api\('draad'/);
  assert.match(gesprek, /mail\.api\('hulp'/);
  assert.match(gedrag, /uit\.berichten/);
  assert.doesNotMatch(gedrag, /Nora de Vries|publiekscampagne|€18\.000/);
  assert.match(gesprek, /Liever niets dan verzonnen werk/);
});

test('een bericht wordt via een persoonlijk personeelsaccount aan RTG One gekoppeld', () => {
  assert.match(werk, /\/api\/account\/start/);
  assert.match(werk, /\/api\/rtgone\/project\/van-mail/);
  assert.match(werk, /velden\.mailId = bericht\.id/);
  assert.match(werk, /velden\.huis = 'rtg'/);
  assert.match(werk, /Het oorspronkelijke bericht blijft als bron gekoppeld/);
  assert.match(gedrag, /RTGMailWerkstroom\.teken\(root, m\)/);
  assert.match(gedrag, /RTGMailGesprek\.open\(root, mail, staat\.huidig, staat\.adres\)/);
  assert.match(html, /open: openBericht, draad: toonDraad/);
});

test('de bestaande volledige mailbox blijft bereikbaar', () => {
  assert.match(html, /data-rtm-diep="inbox"/);
  assert.match(gedrag, /Rustig overzicht/);
  assert.match(gedrag, /mail\.laad\(\)/);
  assert.match(gedrag, /d\.body\.classList\.remove\('rtm-voorzijde-actief'\)/);
});
