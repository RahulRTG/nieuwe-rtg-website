/* DE CONTEXT DIE DE EDGE LEEST: wat er bij kwam, en een oud gebrek in de sleutel.

   Ronde 0 van EDGE.md voegt geen derde contextmodel toe; hij breidt het ENE uit
   dat er al was (shared/adaptief/register.js, RTGAdaptief.context) met twee
   velden die een scherm over zichzelf kan zeggen: het OBJECT waar je in staat en
   de ACTIVITEIT die loopt. Daarnaast twee velden in de declaratie: hoe een
   handeling terug te draaien is (herstel) en of hij de server raakt (effect).

   Wat hier vastligt:

   1. object en activiteit komen door de context heen, en iets dat geen object is
      wordt geen object;
   2. de sleutel waarmee de balk beslist of hij opnieuw tekent, ziet ELKE
      verandering in de stand van een handeling -- ook een nieuwe bevestiging of
      een nieuwe verhindering. Hij keek eerst alleen naar `aan`, dus wie de reden
      van een verhindering veranderde of een andere ontvanger in de lade zette,
      zag de balk de oude tekst houden (gevonden in Bestanden, 23 september 2026);
   3. herstel en effect blijven in de declaratie staan, en een GEVOLG kan een
      scherm niet over zichzelf verklaren -- dat meet server/kern/stuur/gevolg.js.

   DE MUTATIES, elk nagetrokken: zet de oude sleutel terug (`k + (aan ? '+' :
   '-')`, toets 2 zakt), laat object uit de sleutel (toets 1 zakt op de
   luisteraar), en laat normaliseer ook `gevolg` overnemen (toets 3 zakt). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const leer = require('../public/shared/adaptief.js');
const gram = require('../public/shared/adaptief/grammatica.js');
const deel = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'adaptief', f), 'utf8');
/* Het register leest zijn vorm uit ./vorm.js en de vorm van een object uit
   ../objectverwijzing.js (test/adaptiefdelen.test.js). */
const POORT = fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'objectverwijzing.js'), 'utf8');
const REGISTER = [POORT, deel('vorm.js'), deel('register.js')];

function register() {
  const mq = () => ({ matches: false, addEventListener() {} });
  const window = { RTGAdaptiefLeer: leer, RTGGrammatica: gram, matchMedia: mq, console: { warn() {}, error() {} } };
  const document = { documentElement: { setAttribute() {} } };
  const ctx = vm.createContext({ window, document });
  REGISTER.forEach((bron) => vm.runInContext(bron, ctx));
  return window.RTGAdaptief;
}

const CAP = { id: 'deel', naam: 'Delen', gewicht: 'bewust', telefoon: ['balk'], bureau: ['werkbalk'], tablet: ['balk'] };

test('object en activiteit komen door de context heen', () => {
  const A = register();
  const gezien = [];
  A.opContext((c) => gezien.push(c.sleutel));
  const c = A.context({ bron: 'office.tekst', acties: [], object: { soort: 'document', id: 'd1' }, activiteit: 'schrijven' });
  /* Een object is een verwijzing (shared/objectverwijzing.js, stap 20). */
  assert.deepEqual(JSON.parse(JSON.stringify(c.object)), { soort: 'document', id: 'd1', label: '', velden: {} });
  assert.equal(c.activiteit, 'schrijven');
  assert.equal(A.context({ bron: 'x', object: 'geen object' }).object, null, 'een tekst is geen object');
  const n = gezien.length;
  A.context({ bron: 'office.tekst', object: { soort: 'document', id: 'd1' } });
  A.context({ bron: 'office.tekst', object: { soort: 'document', id: 'd2' } });
  assert.equal(gezien.length, n + 2, 'een ander object is een andere context');
  A.context({ bron: 'office.tekst', object: { soort: 'document', id: 'd2' } });
  assert.equal(gezien.length, n + 2, 'hetzelfde object is geen nieuwe context');
});

test('de sleutel ziet elke verandering in de stand van een handeling', () => {
  const A = register();
  A.declareer(CAP);
  let keer = 0;
  A.opContext(() => { keer++; });
  const basis = { bron: 'bestanden', acties: ['deel'] };
  A.context(Object.assign({}, basis, { staat: { deel: { bevestiging: { naar: 'Amberen Vos' } } } }));
  const na1 = keer;
  A.context(Object.assign({}, basis, { staat: { deel: { bevestiging: { naar: 'Zilveren Reiger' } } } }));
  assert.equal(keer, na1 + 1, 'een andere ontvanger in de lade hoort de balk opnieuw te laten tekenen');
  assert.equal(A.voorNu()[0].bevestiging.naar, 'Zilveren Reiger');
  A.context(Object.assign({}, basis, { staat: { deel: { verhinderd: { reden: 'Strikt geclassificeerd.', bron: 'classificatie' } } } }));
  A.context(Object.assign({}, basis, { staat: { deel: { verhinderd: { reden: 'Er staat nog geen codenaam.', bron: 'toestand' } } } }));
  assert.equal(keer, na1 + 3, 'een andere reden is een andere stand');
  assert.equal(A.voorNu()[0].verhinderd.reden, 'Er staat nog geen codenaam.');
  /* Een functie in de stand (ongedaan) telt als "er is er een", niet als tekst:
     anders is elke nieuwe closure een nieuwe context en tekent de balk bij elke
     tik opnieuw. */
  A.context(Object.assign({}, basis, { staat: { deel: { ongedaan: () => 1 } } }));
  const na2 = keer;
  A.context(Object.assign({}, basis, { staat: { deel: { ongedaan: () => 2 } } }));
  assert.equal(keer, na2, 'een nieuwe closure is geen nieuwe context');
});

test('herstel en effect blijven in de declaratie; een gevolg verklaart een scherm niet over zichzelf', () => {
  const c = leer.normaliseer(Object.assign({}, CAP, { herstel: 'exact', effect: 'server', gevolg: 'geen-effect-gemeten' }));
  assert.equal(c.herstel, 'exact');
  assert.equal(c.effect, 'server');
  assert.equal(c.gevolg, undefined, 'het gevolg komt uit een meting, niet uit de declaratie');
  const A = register();
  A.declareer(Object.assign({}, CAP, { herstel: 'compensatie' }));
  assert.equal(A.capability('deel').herstel, 'compensatie');
});
