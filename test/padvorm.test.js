/* HETZELFDE PAD, ANDERS GESCHREVEN, ANDERE UITKOMST BIJ HET SCHILD.

   Wet RTG-038, toegepast op paden. Het WAF-patroon voor pad-klimmen eiste `..`
   met een LETTERLIJKE slash erachter, en daar glipten de gecodeerde vormen
   langsheen -- gemeten, niet vermoed:

       /../etc/passwd        geblokkeerd
       /%2e%2e/etc/passwd    geblokkeerd
       /..%2fetc/passwd      DOOR          <- exact hetzelfde pad
       /..%5cetc/passwd      DOOR
       /%252e%252e/x         DOOR          <- dubbel gecodeerd

   Het schild is een DETECTIElaag, geen laatste verdediging: de echte insluiting
   zit in path.join + startsWith (middleware/voordeur.js) en in express.static.
   Maar een detectielaag die de helft van de schrijfwijzen niet ziet, telt die
   pogingen ook niet mee, en juist die telling drijft de banlijst en de
   automatische noodrem. Wie in de vorm schrijft die het schild niet kent, mag
   dus onbeperkt blijven proberen.

   DE TWEEDE HELFT VAN DEZE TOETS IS DE BELANGRIJKSTE: geen valse alarmen. Een
   canonisatie die te gretig is, blokkeert gewone paden, en een schild dat het
   verkeer van echte leden weigert wordt uitgezet -- dan heb je niets. Daarom
   staan hier evenveel paden die er DOORHEEN moeten als paden die eruit moeten.

   WAT HIER MET OPZET DOORHEEN GAAT: overlong UTF-8 (%c0%ae voor een punt). Dat
   is een historische IIS-truc; Node decodeert die niet naar een punt, dus in
   deze stapel is het geen tweede schrijfwijze van hetzelfde pad. Een canonisatie
   die dingen gelijkstelt die het systeem eronder niet gelijkstelt, maakt de
   vergelijking juist onbetrouwbaar.

   Gemuteerd en zien zakken: de decodeerlus uit canoniekPad halen (toets 1 en 2
   rood), de backslash-omzetting weghalen (toets 2 rood), en de patronen weer
   alleen op het rauwe pad laten kijken (toets 2 rood).
   Draai los: node --test test/padvorm.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakSchild, canoniekPad } = require('../server/kern/schild.js');

/* Elk geval krijgt een VERS schild. Dat is geen netheid: het schild bant een IP
   na vijf treffers, dus een gedeeld schild zou alles na het vijfde geval
   blokkeren en deze toets zou groen staan om de verkeerde reden. Die val zat in
   mijn eerste meting, en hij gaf precies het antwoord dat ik wilde zien. */
function geblokkeerd(pad) {
  const s = maakSchild({});
  let geweigerd = false;
  const req = { ip: '203.0.113.9', path: pad, originalUrl: pad, get: () => '', method: 'GET' };
  const res = { status: () => ({ json: () => { geweigerd = true; } }), set: () => {} };
  s.middleware(req, res, () => {});
  return geweigerd;
}

test('elke schrijfwijze van hetzelfde pad krijgt dezelfde canonieke vorm', () => {
  for (const vorm of ['/../x', '/%2e%2e/x', '/%2E%2E/x', '/%252e%252e/x']) {
    assert.match(canoniekPad(vorm), /\.\.\//, vorm + ' hoort tot ../ te worden teruggebracht');
  }
  assert.equal(canoniekPad('/a%5cb'), '/a/b', 'een backslash is dezelfde scheiding');
  assert.equal(canoniekPad('/Gewoon/Pad.HTML'), '/gewoon/pad.html', 'hoofdletters zijn geen tweede pad');
});

test('het schild ziet pad-klimmen in elke schrijfwijze', () => {
  const vormen = ['/../etc/passwd', '/%2e%2e/etc/passwd', '/%2E%2E/etc/passwd',
    '/%252e%252e/x', '/..%2fetc/passwd', '/..%5cetc/passwd', '/%25252e%25252e/x'];
  for (const pad of vormen) {
    assert.equal(geblokkeerd(pad), true,
      pad + ' is pad-klimmen; als het schild deze vorm niet ziet, telt hij de poging ook niet mee');
  }
});

test('gewone paden gaan er gewoon doorheen -- anders wordt het schild uitgezet', () => {
  const gewoon = ['/apps/app.html', '/api/state', '/gewoon/pad.html',
    '/media/foto%20naam.png', '/media/100%25korting.png', '/apps/app.html?zoek=a..b',
    '/apps/foundation/school.html', '/shared/i18n.js'];
  for (const pad of gewoon) {
    assert.equal(geblokkeerd(pad), false,
      pad + ' is een normaal verzoek; een schild met valse alarmen wordt uitgezet en beschermt dan niets');
  }
});

test('overlong UTF-8 gaat er bewust doorheen, en dat is geen omissie', () => {
  assert.equal(geblokkeerd('/%c0%ae%c0%ae/x'), false,
    'Node decodeert %c0%ae niet naar een punt, dus dit is in deze stapel geen tweede ' +
    'schrijfwijze van hetzelfde pad -- gelijkstellen wat het systeem niet gelijkstelt, ' +
    'maakt de vergelijking juist onbetrouwbaar');
});
