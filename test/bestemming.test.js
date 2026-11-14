/* BEREIKBAAR OP DE BEDOELDE BESTEMMING -- de pure kern (scripts/lib/bestemming.js).

   Vier rijen stonden op BEWEZEN terwijl een lid naar een kantoorscherm werd
   doorgestuurd. De bestemming wordt nu vergeleken op CAPABILITY uit
   SCHERMEIGENAAR.json en nooit op url. De drie gevallen die niet mogen
   terugvallen naar url-vergelijking:

     1. dezelfde capability, een andere url (een alias)  -> BEWEZEN
     2. een andere capability via een doorverwijzing     -> nooit BEWEZEN
     3. idem, maar een andere bekende persona komt er WEL -> de bestaande
        uitkomst "verkeerd geadresseerd" (DEFECT), met dezelfde zin

   En de persona-afwijking: een bevinding met beide bronnen, die geen oordeel raakt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../scripts/lib/bestemming');

const REG = {
  'apps/a.html': { capability: 'x.a', rol: 'eigenaar', doelgroep: 'lid' },
  'apps/a-oud.html': { rol: 'alias', naar: '/apps/a.html#tab' },
  'apps/b.html': { capability: 'x.b', rol: 'eigenaar', doelgroep: 'zaak' },
  'apps/deur.html': { capability: 'x.deur', rol: 'eigenaar', doelgroep: 'zaak' }
};

test('1. zelfde scherm, en dezelfde capability via een alias, is bereikt', () => {
  assert.equal(B.beoordeel({ ingang: '/apps/a.html', landing: '/apps/a.html?x=1', register: REG, persona: 'lid' }).status, 'BEWEZEN');
  const o = B.beoordeel({ ingang: '/apps/a-oud.html', landing: '/apps/a.html', register: REG, persona: 'lid' });
  assert.equal(o.status, 'BEWEZEN', 'een alias die naar zijn eigen capability doorverwijst, is bereikt -- geen url-vergelijking');
  assert.equal(o.bestemming.uitkomst, 'zelfde-capability');
});

test('2. een andere capability via een doorverwijzing is nooit BEWEZEN', () => {
  const o = B.beoordeel({ ingang: '/apps/b.html', landing: '/apps/deur.html', register: REG, persona: 'lid', anderen: [] });
  assert.equal(o.status, 'NIET_GETEST');
  assert.match(o.reden, /landt op apps\/deur.html \(x.deur\) in plaats van op x.b/);
});

test('3. komt een andere bekende persona er wel, dan is het verkeerd geadresseerd', () => {
  const o = B.beoordeel({ ingang: '/apps/b.html', landing: '/apps/deur.html', register: REG, persona: 'lid',
    anderen: [{ persona: 'gezin', landing: '/apps/deur.html' }, { persona: 'zaak', landing: '/apps/b.html' }] });
  assert.equal(o.status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.match(o.reden, /^de wereld toont deze ingang aan een lid, maar de deur gaat alleen open voor een zaak/,
    'dezelfde zin als de bestaande uitkomst bij een dichte deur, geen nieuwe defectbetekenis');
});

test('4. een bestemming die niet te benoemen is, is niet bewezen', () => {
  const o = B.beoordeel({ ingang: '/apps/a.html', landing: '/apps/onbekend.html', register: REG, persona: 'lid' });
  assert.equal(o.status, 'NIET_GETEST');
  assert.equal(o.bestemming.uitkomst, 'onbekend');
});

test('5. persona-afwijking: beide bronnen, en alleen als de doelgroep niet gedekt is', () => {
  assert.equal(B.personaAfwijking('lid', '/apps/a.html', REG), null);
  const a = B.personaAfwijking('lid', '/apps/b.html', REG);
  assert.deepEqual({ gebruikt: a.gebruikt, verwacht: a.verwacht }, { gebruikt: 'lid', verwacht: 'zaak' });
  assert.match(a.bronGebruikt, /PERSONA_VAN_WERELD/);
  assert.equal(a.bronVerwacht, 'SCHERMEIGENAAR.json');
  assert.equal(B.personaAfwijking('lid', '/apps/a-oud.html', REG), null, 'een alias zonder doelgroep is geen afwijking');
});


test('expliciete querycontext mag niet stilzwijgend verdwijnen of wijzigen', () => {
  const ingang = '/apps/a.html?pas=rtg';
  for (const landing of ['/apps/a.html', '/apps/a.html?pas=lifestyle', '/apps/a.html?pas=rtg&extra=1',
    '/apps/a-oud.html?pas=lifestyle', 'https://vreemd.example/apps/a.html?pas=rtg', '//vreemd.example/apps/a.html?pas=rtg']) {
    const o = B.beoordeel({ ingang, landing, register: REG, persona: 'lid',
      anderen: [{ persona: 'zaak', landing: ingang }] });
    assert.equal(o.status, 'NIET_GETEST', landing);
    assert.equal(o.bestemming.uitkomst, 'andere-context', landing);
  }
});

test('exacte querycontext werkt ook via een bestaande alias; ongespecificeerde fragmenten blijven vrij', () => {
  for (const landing of ['/apps/a.html?pas=rtg', '/apps/a.html?pas=rtg#tab=foundation']) {
    const o = B.beoordeel({ ingang: '/apps/a-oud.html?pas=rtg', landing, register: REG, persona: 'lid' });
    assert.equal(o.status, 'BEWEZEN');
    assert.equal(o.bestemming.uitkomst, 'zelfde-capability');
  }
  assert.equal(B.beoordeel({ ingang: '/apps/a.html', landing: '/apps/a.html?pas=rtg#tab=foundation',
    register: REG, persona: 'lid' }).status, 'BEWEZEN');
});

test('ook zonder querycontract kan een vreemde origin geen bereikbaarheid bewijzen', () => {
  for (const landing of ['https://vreemd.example/apps/a.html', '//vreemd.example/apps/a.html', 'http://[ongeldig']) {
    assert.equal(B.beoordeel({ ingang: '/apps/a.html', landing, register: REG, persona: 'lid' }).status, 'NIET_GETEST');
  }
});
