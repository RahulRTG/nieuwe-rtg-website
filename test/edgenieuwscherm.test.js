/* EEN NIEUW SCHERM KRIJGT HET HARDE EDGE-CONTRACT (EDGE.md par. 7, besluit 4).

   Bestaande schermen ratelen: npm run edgedekking vergelijkt per scherm en laat
   een veld dat van `ja` naar `nee` gaat zakken. Maar een ratel beschermt alleen
   wat er al was. Een scherm dat er NA ronde 0 bij komt, moet vanaf dag een doen
   wat de oude schermen nog moeten leren:

   - het is gemeten (staat in EDGEDEKKING.json) -- een scherm dat de meter nooit
     zag, heeft niets bewezen;
   - het laadt de Edge (status `gemeten`); een doorverwijzing (`omgeleid`) is
     geen scherm en valt erbuiten;
   - het publiceert een wereld en een context;
   - het wijst een hoofdactie aan, of verklaart met reden dat die er niet is
     (data-rtg-edge-nvt-hoofdactie="reden": een reden per veld, sinds ronde 2);
   - geen enkele geblokkeerde handeling staat er zonder reden.

   Wat NIEUW is, staat vast in de basislijn van EDGEDEKKING.json: de schermen
   van de eerste meting. Die lijst groeit nooit mee (het script houdt hem gelijk),
   dus een scherm kan niet oud worden door opnieuw te meten.

   Het contract zelf woont bij de meter (contractNieuw in scripts/edgedekking.js).

   DE MUTATIES, elk nagetrokken: haal in contractNieuw de hoofdactie-eis weg,
   de eis dat geblokkeerd een reden draagt, de eis dat een nieuw scherm gemeten
   is, de weigering van een doorverwijzing zonder reden, of de eis dat een
   scherm met een eigen hoofdactie zijn context zelf publiceert (toets 2 zakt op
   alle vijf); laat de ratel de herkomst negeren (toets 4 zakt); en voeg een .html toe
   onder public/apps zonder meting (toets 1 zakt).

   BESLUIT 11 VOOR BESTAANDE SCHERMEN (stap 24, K-reikwijdte): een gemeten scherm
   met een eigen hoofdactie spreekt zijn context zelf, of staat op de schuldlijst
   CONTEXT_SCHULD in scripts/edgedekking.js. Die lijst mag alleen krimpen.
   MUTATIES, elk nagetrokken: zet Bestanden terug op de lijst (toets 6 zakt: de
   lijst groeit en hij spreekt al zelf), en haal de bron weg uit de kale context
   van bestanden/adaptief.js en meet opnieuw (toets 5 zakt: niet zelf en niet op
   de lijst). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'EDGEDEKKING.json');
/* Het contract en de schermlijst komen van de meter zelf (scripts/edgedekking.js):
   een tweede telling van dezelfde schermen loopt op een dag uit de pas. */
const { contractNieuw: schendingen, alleSchermen, achteruitgang, contextSchuld, CONTEXT_SCHULD } = require('../scripts/edgedekking.js');

test('elk nieuw scherm is gemeten en haalt het harde contract', () => {
  const reg = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  assert.ok(Array.isArray(reg.basislijn) && reg.basislijn.length > 100, 'EDGEDEKKING.json hoort een basislijn te dragen');
  assert.deepEqual(schendingen(reg, alleSchermen()), []);
  const verdwenen = Object.keys(reg.schermen).filter((p) => !fs.existsSync(path.join(WORTEL, 'public', p)));
  assert.deepEqual(verdwenen, [], 'EDGEDEKKING.json loopt achter op de schermen. Draai: npm run edgedekking');
});

test('het contract kan zakken: een verzonnen nieuw scherm dat het niet haalt', () => {
  const reg = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  const pad = reg.basislijn.find((p) => reg.schermen[p] && reg.schermen[p].status === 'gemeten');
  const kopie = JSON.parse(JSON.stringify(reg));
  kopie.basislijn = kopie.basislijn.filter((p) => p !== pad);
  kopie.schermen[pad].velden.hoofdactie = 'nee';
  kopie.schermen[pad].acties = { RTGAdaptief: { geblokkeerdZonderWaarom: 1 } };
  const s = schendingen(kopie, [pad]);
  assert.ok(s.some((x) => /hoofdactie/.test(x)), 'een nieuw scherm zonder hoofdactie hoort te zakken');
  assert.ok(s.some((x) => /zonder reden/.test(x)), 'een geblokkeerde handeling zonder reden hoort te zakken');
  assert.deepEqual(schendingen(kopie, ['/apps/bestaat-niet-proef.html']),
    ['/apps/bestaat-niet-proef.html: nieuw scherm, niet gemeten (npm run edgedekking)']);
  kopie.schermen[pad].velden.hoofdactie = 'nvt';
  kopie.schermen[pad].acties = {};
  assert.deepEqual(schendingen(kopie, [pad]), [], 'een verklaarde afwezigheid met reden is geen schending');
  /* Een hoofdactie uit de padtabel van Edge 2 is niet door het scherm
     aangewezen: voor een nieuw scherm telt alleen data-hoofdactie. */
  kopie.schermen[pad].velden.hoofdactie = 'ja';
  kopie.schermen[pad].herkomst = Object.assign({}, kopie.schermen[pad].herkomst, { hoofdactie: 'edge-padtabel' });
  assert.ok(schendingen(kopie, [pad]).some((x) => /wijst zelf geen hoofdactie aan/.test(x)));
  kopie.schermen[pad].herkomst.hoofdactie = 'scherm:data-hoofdactie';
  /* Besluit 11: wie een eigen hoofdactie heeft, publiceert zijn context zelf;
     de titel van het casco volstaat dan niet meer. */
  kopie.schermen[pad].herkomst.context = 'edge-casco';
  assert.ok(schendingen(kopie, [pad]).some((x) => /publiceert zijn context niet zelf/.test(x)));
  kopie.schermen[pad].herkomst.context = 'scherm';
  assert.deepEqual(schendingen(kopie, [pad]), []);
  kopie.schermen[pad].velden.hoofdactie = 'nvt';
  kopie.schermen[pad].herkomst.context = 'edge-casco';
  assert.deepEqual(schendingen(kopie, [pad]), [], 'zonder hoofdactie mag een scherm bij de titel van het casco blijven');
  kopie.schermen[pad].velden.hoofdactie = 'ja';
  kopie.schermen[pad].herkomst.context = 'scherm';
  /* Een nieuw scherm dat een lid doorstuurt, is niet gemeten -- ook als het
     naar een inlog gaat en onder zijn eigen rol wel een Edge zou hebben. */
  kopie.schermen['/apps/nieuw-kantoor-proef.html'] = { status: 'omgeleid', naar: '/apps/personeel.html' };
  assert.ok(schendingen(kopie, ['/apps/nieuw-kantoor-proef.html'])[0].includes('stuurt een lid door naar /apps/personeel.html'));
});

test('de ratel ziet ook een veld dat ja blijft maar niet meer van het scherm zelf komt', () => {
  const oud = { schermen: { '/apps/x.html': { velden: { context: 'ja', hoofdactie: 'ja' },
    herkomst: { context: 'scherm', hoofdactie: 'scherm:data-hoofdactie' } } } };
  const nieuw = { '/apps/x.html': { status: 'gemeten', velden: { context: 'ja', hoofdactie: 'ja' },
    herkomst: { context: 'edge-casco', hoofdactie: 'scherm:data-hoofdactie' } } };
  assert.deepEqual(achteruitgang(oud, nieuw).map((a) => [a.veld, a.was, a.nu]), [['context', 'ja (scherm)', 'ja (edge-casco)']]);
  nieuw['/apps/x.html'].velden.hoofdactie = 'nee';
  assert.equal(achteruitgang(oud, nieuw).length, 2, 'en een veld dat naar nee gaat, blijft achteruit');
});

test('de basislijn en de schermen lopen niet uit elkaar', () => {
  const reg = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  for (const p of reg.basislijn) assert.ok(reg.schermen[p], p + ' staat in de basislijn maar niet in de meting');
});

/* De schuldlijst mag alleen krimpen: dit getal gaat omlaag bij elke portie, en
   nooit omhoog. Een scherm dat er weer bij moet, is een achteruitgang en geen
   aanpassing van dit getal. */
const SCHULD_MAX = 49;

test('elk bestaand scherm met een eigen hoofdactie spreekt zijn context zelf, of staat op de schuldlijst', () => {
  const reg = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  assert.deepEqual(contextSchuld(reg), []);
});

test('de schuldlijst groeit niet, en kan zakken', () => {
  assert.ok(CONTEXT_SCHULD.length <= SCHULD_MAX, 'CONTEXT_SCHULD groeide van ' + SCHULD_MAX + ' naar ' + CONTEXT_SCHULD.length);
  assert.equal(new Set(CONTEXT_SCHULD).size, CONTEXT_SCHULD.length, 'een scherm staat twee keer op de lijst');
  const reg = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  const kopie = JSON.parse(JSON.stringify(reg));
  const pad = Object.keys(kopie.schermen).find((p) => kopie.schermen[p].status === 'gemeten' &&
    (kopie.schermen[p].herkomst || {}).hoofdactie === 'scherm:data-hoofdactie' && !CONTEXT_SCHULD.includes(p));
  assert.ok(pad, 'er hoort minstens een scherm met eigen hoofdactie buiten de lijst te staan (de eerste portie)');
  kopie.schermen[pad].herkomst.context = 'edge-casco';
  assert.ok(contextSchuld(kopie).some((x) => x.startsWith(pad + ': heeft een eigen hoofdactie')), 'een scherm dat terugvalt op het casco hoort te zakken');
  const schuld = CONTEXT_SCHULD[0];
  kopie.schermen[schuld].herkomst.context = 'scherm';
  assert.ok(contextSchuld(kopie).some((x) => x.startsWith(schuld + ': publiceert zijn context zelf')), 'een afgelost scherm hoort van de lijst te moeten');
});
