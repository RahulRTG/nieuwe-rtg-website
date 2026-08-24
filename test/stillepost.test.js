/* Post die nergens heen kan, moet je kunnen zien.

   WAT ER MIS WAS. server/mail.js send() begon met:

       if (!to || !/@/.test(String(to))) return;

   Alles zonder apenstaartje viel stil op de grond. Dat raakt precies een ding:
   de tweede stap van het wachtwoordherstel gaat als 'sms:<nummer>' de deur uit.
   Zonder SMS-kanaal verdween die code dus spoorloos -- terwijl het antwoord aan
   de gebruiker vrolijk `tweestaps: true` meldde.

   De schade is groter dan een gemiste sms: wachtwoordherstel was daarmee op deze
   server voor IEDEREEN onmogelijk, en niets in het systeem zei dat. Precies de
   soort fout waar deze reeks toetsen voor bedoeld is -- iets faalt en de storing
   is onzichtbaar.

   Een sms-kanaal bouwen we hier niet. Wat wel moet: een onbestelbaar bericht
   belandt in dezelfde outbox als elk ander, zodat een storing te ZIEN is in
   plaats van te raden. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function verseMap() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-post-'));
}

test('een bericht zonder e-mailadres verdwijnt niet, maar belandt in de outbox', () => {
  const dir = verseMap();
  const oud = process.env.RTG_DATA_DIR;
  process.env.RTG_DATA_DIR = dir;
  try {
    delete require.cache[require.resolve('../server/mail')];
    delete require.cache[require.resolve('../server/kluis')];
    const mail = require('../server/mail');

    const uitslag = mail.send('sms:+31612345678', 'Uw RTG-herstelcode', 'Uw code om het wachtwoord te herstellen: 123456');

    /* EN HIJ MOET OOK ECHT LANGS HET SMS-KANAAL, niet zomaar ergens in de outbox
       belanden. Dat verschil was hier niet te zien, en dat is gemeten: draai de
       poort `const isMail = /@/.test(...)` in mail.js om, en deze toets bleef
       gewoon groen. Allebei de wegen eindigen namelijk in toOutbox() met
       dezelfde To:-regel, dus aan het BESTAND is niet te zien welke weg het was.

       Een toets die het gedrag waar hij over gaat niet ziet veranderen, dekt dat
       gedrag niet (LAT.md regel 9) -- en juist hier is de weg de hele zaak: de
       herstelcode gaat als 'sms:<nummer>' de deur uit, en als die stilletjes de
       gewone postweg neemt is het wachtwoordherstel opnieuw stuk zonder dat
       iemand het ziet.

       Wat WEL verschilt is de uitslag: sendSms() geeft een bezorgstand terug,
       de gewone weg geeft niets terug. Daar hangt de bewering nu aan. */
    assert.ok(uitslag && typeof uitslag === 'object',
      'een sms hoort langs sendSms te gaan en een bezorgstand terug te geven, niet undefined');
    assert.equal(uitslag.ok, true, 'en die bezorging hoort te zijn gelukt: ' + JSON.stringify(uitslag));

    const outbox = path.join(dir, 'outbox');
    assert.ok(fs.existsSync(outbox), 'er hoort een outbox te zijn aangemaakt');
    const bestanden = fs.readdirSync(outbox);
    assert.equal(bestanden.length, 1, 'het bericht hoort bewaard te zijn, niet weggegooid');

    const inhoud = fs.readFileSync(path.join(outbox, bestanden[0]), 'utf8');
    assert.ok(/123456/.test(inhoud), 'de code hoort in het bewaarde bericht te staan: ' + inhoud.slice(0, 120));
    assert.ok(/sms:\+31612345678/.test(inhoud), 'en de bestemming ook, anders weet niemand voor wie hij was');
  } finally {
    if (oud === undefined) delete process.env.RTG_DATA_DIR; else process.env.RTG_DATA_DIR = oud;
    fs.rmSync(dir, { recursive: true, force: true });
    delete require.cache[require.resolve('../server/mail')];
    delete require.cache[require.resolve('../server/kluis')];
  }
});

test('een leeg adres blijft wel gewoon niets doen', () => {
  const dir = verseMap();
  const oud = process.env.RTG_DATA_DIR;
  process.env.RTG_DATA_DIR = dir;
  try {
    delete require.cache[require.resolve('../server/mail')];
    delete require.cache[require.resolve('../server/kluis')];
    const mail = require('../server/mail');
    mail.send('', 'Niets', 'Niets');
    mail.send(null, 'Niets', 'Niets');
    const outbox = path.join(dir, 'outbox');
    const n = fs.existsSync(outbox) ? fs.readdirSync(outbox).length : 0;
    assert.equal(n, 0, 'zonder bestemming valt er niets te bewaren');
  } finally {
    if (oud === undefined) delete process.env.RTG_DATA_DIR; else process.env.RTG_DATA_DIR = oud;
    fs.rmSync(dir, { recursive: true, force: true });
    delete require.cache[require.resolve('../server/mail')];
    delete require.cache[require.resolve('../server/kluis')];
  }
});
