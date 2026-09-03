/* DE AUDIT-KOLOM HEEFT TWEE BRONNEN, EN ALLEBEI MOETEN ZE AAN BOD KOMEN.

   DIT IS TWEE KEER MISGEGAAN, en beide keren op dezelfde manier: een tak die de
   cel ook claimde als hij NIETS wist, met een `continue` erachter. Daarmee werd
   de tak erna onbereikbaar en stond een hele kolom stil terwijl de proef
   honderden bewezen routes rapporteerde.

     eerste keer  de tak die AUDITPROEF.json als OBJECT leest, claimde de cel
                  ook als zijn bron leeg was. Staat met naam en toenaam in
                  scripts/bewijsmatrix.js beschreven -- als opgelost.
     tweede keer  hij was niet opgelost maar verhuisd: de tak die de
                  HANDELINGPROEF leest deed daarna precies hetzelfde. 3635
                  gemeten routes van de auditproef werden weggegooid, waaronder
                  de enige route van dit huis die verder alle elf cellen draagt.

   Vandaar deze toets. Hij bewaakt niet de UITKOMST van de kolom (dat is een
   meting en die mag bewegen) maar de BEREIKBAARHEID van de tweede bron: zwijgt
   de handelingproef, dan hoort de auditproef nog te mogen spreken.

   Wie hier een derde bron bij zet: claim alleen wat je weet, en laat de rest
   door. De laatste tak zet de vloer op ongemeten. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { bouw } = require('../scripts/bewijsmatrix');

const TABEL = { routes: [{ methode: 'POST', pad: '/api/proef/spoor' }], herkomst: 'proef' };
const SLEUTEL = 'POST /api/proef/spoor';

/* Alle bronnen uit, zodat deze toets nooit stilletjes de echte registers van
   dit moment meeleest -- dezelfde regel als in test/bewijsmatrix.test.js. */
const basis = extra => bouw(Object.assign({
  tabel: TABEL, bewakers: new Map(), journaal: null,
  poort: null, rol: null, keten: null, invoer: null, idem: null,
  audit: null, auditp: null, staat: null, output: null, handeling: null, uitvoer: null
}, extra));

const cel = m => m.rijen[0].cellen.AUDIT;

test('1. zwijgt de handelingproef, dan spreekt de auditproef', () => {
  const m = basis({
    handeling: new Map(),                                   // kent deze route niet
    audit: new Map([[SLEUTEL, { audit: 'bewezen', reden: 'de handeling staat in het spoor' }]])
  });
  assert.equal(cel(m).staat, 'bewezen',
    'de auditproef is niet aan bod gekomen -- staat er een tak vóór hem die altijd claimt en doorgaat?');
  assert.equal(cel(m).bron, 'auditproef');
});

test('2. spreken ze elkaar tegen, dan wint de ZWARE bron -- ook met een gezakt', () => {
  /* DEZE TOETS IS OMGEDRAAID BIJ DE SAMENVOEGING VAN #180, #181 EN #182, en dat
     hoort hier te staan in plaats van in een commit-bericht.

     Twee takken hebben de AUDIT-knoop los van elkaar ontward, in tegengestelde
     volgorde. Er moest er een gekozen worden, en het is deze geworden: de
     auditproef spreekt eerst, ook als hij `gezakt` zegt en de handelingproef
     `bewezen`. De auditproef is voor deze vraag gebouwd (spoor voor en na de
     oproep); de handelingproef meet iets anders en draagt `audit` als
     bijvangst. Een defect-oordeel van de zware bron laten overstemmen door een
     bewezen van de lichte is het stille promoveren dat PROOF.md verbiedt.

     Wat deze toets NIET meer bewaakt is de volgorde als voorkeur -- dat is nu
     een besluit met een reden in scripts/bewijsmatrix.js. Wat hij WEL bewaakt is
     dat de tegenspraak een uitkomst heeft en dat de cel zijn bron noemt: een
     cel die van twee bronnen iets anders hoort en er geen van beide noemt, is
     onnavolgbaar. */
  const m = basis({
    handeling: new Map([[SLEUTEL, { audit: 'bewezen' }]]),
    audit: new Map([[SLEUTEL, { audit: 'gezakt', reden: 'iets anders' }]])
  });
  assert.equal(cel(m).bron, 'auditproef', 'de volgorde tussen de twee bronnen is omgedraaid');
  assert.equal(cel(m).staat, 'gezakt',
    'een gezakt van de zware bron is stil bewezen geworden -- dat is precies wat hier niet mag');
});

test('3. weet geen van beide iets, dan is de cel ongemeten -- en niet stil bewezen', () => {
  const m = basis({ handeling: new Map(), audit: new Map() });
  assert.equal(cel(m).staat, 'ongemeten');
});

test('4. een GEZAKTE auditproef wordt niet als ongemeten weggeschreven', () => {
  /* Gezakt is de zwaarste uitslag die deze kolom kent: het bewijs zegt zelf dat
     er geen spoor was. Wie dat op ongemeten zet, maakt van een bevinding een
     leemte -- en een leemte alarmeert niemand. */
  const m = basis({
    handeling: new Map(),
    audit: new Map([[SLEUTEL, { audit: 'gezakt', reden: 'geen spoor' }]])
  });
  assert.equal(cel(m).staat, 'gezakt');
  assert.equal(cel(m).bron, 'auditproef');
});
