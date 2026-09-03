/* HET BESLUITREGISTER VAN DE ROLLBACK-AS, EN DE GRENDEL EROP.

   ROLLBACKBESLUIT.json zegt per route waarom een GEWEIGERD verzoek daar toch
   iets in de opslag mag achterlaten. Zonder zo'n register komt een uitgeschreven
   ontwerpbesluit elke meetronde terug als defect: de ROLLBACK-cel zakt, in
   VERTROUWEN.json wordt het `geschorst`, en server/middleware/schorspoort.js
   zet de route uiteindelijk met een 503 dicht. Dat overkwam
   /api/supplier/pay/budget, terwijl server/kern/pay/budget.js met zoveel woorden
   uitlegt waarom hij naar die kant faalt.

   WAAROM DIT REGISTER EEN ANDERE GRENDEL HEEFT DAN IDEMBESLUIT.json. Daar is de
   faalvorm dat iemand DOMEINWERK in de vastleggingslijst zet, en die vangt
   scripts/lib/idemproef.js met de eenfamilie-controle. Hier is de faalvorm een
   andere: een besluit dat ooit klopte terwijl de code eronder is veranderd. Een
   vrijstelling die een verdwenen redenering aanhaalt, is een gat met een strik
   eromheen.

   Dus draagt elke regel een `bron` en een `citaat`, en dit bestand houdt vast dat
   dat citaat LETTERLIJK in die bron staat. Wie de afweging uit de code haalt,
   laat deze toets zakken -- en moet dan opnieuw beslissen in plaats van te
   erven.

   Draai los: node --test test/rollbackbesluit.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORTEL = path.join(__dirname, '..');
const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'ROLLBACKBESLUIT.json'), 'utf8'));

test('1. elk besluit noemt een klasse die in het register zelf staat', () => {
  const klassen = Object.keys(reg.klassen || {});
  assert.ok(klassen.length, 'er zijn klassen');
  for (const [pad, r] of Object.entries(reg.routes || {})) {
    assert.ok(klassen.includes(r.klasse),
      pad + ' draagt klasse "' + r.klasse + '", en die staat niet in dit register');
  }
});

test('2. elk besluit draagt een reden, een bron en een citaat', () => {
  /* Een vrijstelling zonder onderbouwing is geen besluit maar een uitzondering
     die niemand meer kan nalezen. */
  for (const [pad, r] of Object.entries(reg.routes || {})) {
    if (r.klasse === 'tebeslissen') continue;   // die IS juist het ontbreken van een besluit
    assert.ok(r.reden && r.reden.length > 40, pad + ' heeft geen uitgeschreven reden');
    assert.ok(r.bron, pad + ' noemt geen bronbestand');
    assert.ok(r.citaat, pad + ' noemt geen citaat uit die bron');
  }
});

test('3. HET CITAAT STAAT LETTERLIJK IN DE BRON -- de grendel van dit register', () => {
  /* Dit is de toets waar het om gaat. Mutatie nagetrokken: de zin "Dat is bewust
     de goede kant om op te falen" uit server/kern/pay/budget.js weghalen of
     herschrijven laat deze toets zakken, en dan staat het besluit zonder grond.

     Hij vangt niet alles -- iemand kan de zin laten staan en de code eronder
     omdraaien -- en dat hoort erbij: dit is een grendel op de REDENERING, niet
     op het gedrag. Dat gedrag meet de staatproef, en die blijft meten. */
  for (const [pad, r] of Object.entries(reg.routes || {})) {
    if (!r.citaat) continue;
    const bron = path.join(WORTEL, r.bron);
    assert.ok(fs.existsSync(bron), pad + ': de bron ' + r.bron + ' bestaat niet (meer)');
    /* WITRUIMTE PLATGESLAGEN, en dat is geen versoepeling. Commentaar in dit
       huis loopt over regels door, dus een citaat van een hele zin staat bijna
       altijd met een regeleinde en inspringing erin. Zou de toets daarop vallen,
       dan zakt hij zodra iemand een alinea anders afbreekt -- en dan leert
       iedereen hem uit te zetten in plaats van te lezen. De ZIN moet er staan,
       niet de opmaak. */
    const plat = (t) => String(t).replace(/\s+/g, ' ').trim();
    const tekst = plat(fs.readFileSync(bron, 'utf8'));
    assert.ok(tekst.includes(plat(r.citaat)),
      pad + ': het citaat staat niet meer in ' + r.bron + ' -- de redenering is uit de code ' +
      'verdwenen, dus dit besluit heeft geen grond meer. Beslis opnieuw in plaats van te erven.\n' +
      '  gezocht: ' + JSON.stringify(r.citaat));
  }
});

test('4. de bewijsmatrix HONOREERT het besluit, en alleen de besloten klassen', () => {
  /* De koppeling zelf, met verzonnen rijen: een gezakte ROLLBACK op een route
     MET besluit wordt `nvt`, zonder besluit blijft hij `gezakt`, en een route
     met klasse `tebeslissen` telt niet als besluit -- dat is de eerlijke klasse
     voor "hier is nog niets besloten" en zou anders een open vraag stil
     afhandelen. */
  const { bouw } = require('../scripts/bewijsmatrix');
  const tabel = { routes: [
    { methode: 'POST', pad: '/api/proef/besloten' },
    { methode: 'POST', pad: '/api/proef/open' },
    { methode: 'POST', pad: '/api/proef/tebeslissen' }
  ], herkomst: 'proef' };
  const staat = new Map([
    ['POST /api/proef/besloten', { rollback: 'GEZAKT', reden: 'gemeten: er bleef iets staan' }],
    ['POST /api/proef/open', { rollback: 'GEZAKT', reden: 'gemeten: er bleef iets staan' }],
    ['POST /api/proef/tebeslissen', { rollback: 'GEZAKT', reden: 'gemeten: er bleef iets staan' }]
  ]);
  const m = bouw({ tabel, bewakers: new Map(), journaal: null, poort: null, rol: null, keten: null,
    invoer: null, idem: null, audit: null, staat, output: null, handeling: null, uitvoer: null,
    idembesluit: new Map(),
    rollbackbesluit: new Map([
      ['/api/proef/besloten', { klasse: 'veilige-kant', reden: 'x'.repeat(50) }],
      ['/api/proef/tebeslissen', { klasse: 'tebeslissen' }]
    ]) });
  const cel = (pad) => m.rijen.find(r => r.pad === pad).cellen.ROLLBACK;
  assert.equal(cel('/api/proef/besloten').staat, 'nvt', 'met besluit: de belofte geldt hier niet');
  assert.equal(cel('/api/proef/besloten').reden, 'gemeten: er bleef iets staan',
    'en de METING blijft in de cel staan -- een besluit drukt hem niet weg');
  assert.equal(cel('/api/proef/besloten').besluit, 'veilige-kant', 'met de klasse erbij');
  assert.equal(cel('/api/proef/open').staat, 'gezakt', 'zonder besluit blijft het een bevinding');
  assert.equal(cel('/api/proef/tebeslissen').staat, 'gezakt',
    '"tebeslissen" is geen besluit maar het ontbreken ervan');
});
