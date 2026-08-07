/* EEN LOGBOEK MAG DE SERVER NIET TRAAG MAKEN.

   WAT ER MIS WAS, en het was mijn eigen code van dezelfde dag. Het
   doorgeefjournaal schreef bij ELKE mislukking meteen weg. De gedachte was goed
   -- juist die regel wil je terugvinden als de server daarna omvalt -- maar het
   journaal is EEN blob in EEN rij, dus elke schrijfactie serialiseert en
   versleutelt de hele lijst opnieuw.

   Nagemeten op een verse installatie: 500 verzoeken naar een onbekend pad gaven
   1002 schrijfacties en lieten de WAL met 4,18 MB groeien -- 13,9 kB per
   verzoek. En de prijs LIEP OP met de lijst: 0,72 ms bij 159 kB journaal, 3,63
   ms bij 1114 kB. Bij de eigen bovengrens van 20.000 regels is dat ongeveer 10
   ms geblokkeerde lus per mislukt verzoek, en het zakt daarna nooit meer.

   Erger dan traag: een willekeurige bezoeker kon met een GET naar een
   niet-bestaand pad een schijfschrijving afdwingen.

   DE MAAT DIE ER TOE DOET is niet "hoe snel is een regel op schijf" maar "hoe
   vaak schrijven we". Deze toetsen bewaken dat, en ze meten het aantal
   schrijfacties in plaats van tijd -- tijd is op een drukke machine ruis, een
   telling niet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakDoorgeefjournaal } = require('../server/kern/doorgeefjournaal');

test('honderd mislukkingen kosten geen honderd schrijfacties', () => {
  let schrijfacties = 0;
  const j = maakDoorgeefjournaal({ db: { data: {} }, save: () => { schrijfacties++; } });
  for (let i = 0; i < 100; i++) j.journaalBinnen({ wat: '/api/weg', methode: 'GET', status: 404, mislukt: true });
  assert.equal(schrijfacties, 0,
    'tijdens het verzoek hoort er NIETS naar schijf te gaan; anders kan een vreemde met een onbekend pad een schrijfactie afdwingen');
  assert.equal(j.journaalLees({}).regels.length, 100, 'maar in het venster staan ze wel allemaal');
});

test('na de wachttijd wordt er precies EEN keer gespoeld', async () => {
  let schrijfacties = 0;
  const j = maakDoorgeefjournaal({ db: { data: {} }, save: () => { schrijfacties++; } });
  for (let i = 0; i < 50; i++) j.journaalBinnen({ wat: '/api/weg', methode: 'GET', status: 500, mislukt: true });
  await new Promise(r => setTimeout(r, 1300));
  assert.equal(schrijfacties, 1,
    'vijftig mislukkingen binnen een seconde horen samen EEN schrijfactie te kosten, niet vijftig');
});

test('een geslaagd verzoek raakt de schijf sowieso niet', async () => {
  let schrijfacties = 0;
  const j = maakDoorgeefjournaal({ db: { data: {} }, save: () => { schrijfacties++; } });
  for (let i = 0; i < 200; i++) j.journaalBinnen({ wat: '/api/lijstje', methode: 'GET', status: 200 });
  await new Promise(r => setTimeout(r, 1300));
  assert.equal(schrijfacties, 0, 'gewoon verkeer hoort het journaal niets te kosten');
});
