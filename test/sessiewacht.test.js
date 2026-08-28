/* DE SESSIEWACHT, NAGETROKKEN. Een puur oordeel over een dubbelzinnige
   statuscode, los toetsbaar (LAT.md regel 10): de instrumenten eromheen hebben
   een server nodig, deze regel niet -- een nagebouwde `post` is genoeg.

   Wat hier vastligt is de reden dat deze wacht bestaat: drie proeven liepen
   langs /api/logout, gingen daarna zonder sessie verder, en lazen elke 401 als
   een uitspraak. Zie de kop van scripts/lib/sessiewacht.js.

   Draai los: node --test test/sessiewacht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakSessiewacht } = require('../scripts/lib/sessiewacht');

/* Een nagebouwde server: `dood` is de verzameling tokens die niet meer bestaat,
   en elk pad heeft een vaste uitkomst voor een LEVEND token. */
function maakServer({ uitkomst, dood = new Set() }) {
  const gezien = [];
  const post = async (pad, lijf, tok) => {
    gezien.push({ pad, tok });
    if (dood.has(tok)) return { status: 401, data: { error: 'Log eerst in.' } };
    return uitkomst(pad, tok);
  };
  return { post, gezien, dood };
}

test('een 401 van een LEVENDE sessie blijft staan: dat is een echte weigering', async () => {
  const srv = maakServer({ uitkomst: () => ({ status: 401, data: { error: 'niet van jou' } }) });
  let inlogs = 0;
  const w = maakSessiewacht({ post: srv.post, rollen: {
    lid: { vers: async () => { inlogs++; return 'vers'; }, leeft: async () => true }
  } });
  const u = await w.roep('/api/iets', {}, 'lid', 'oud');
  assert.equal(u.status, 401);
  assert.equal(inlogs, 0, 'een levende sessie hoeft niet vernieuwd te worden');
  assert.equal(w.hernieuwd(), 0);
});

test('een 401 van een DODE sessie wordt hersteld en de route gaat over', async () => {
  /* Precies het geval dat de IDOR-proef honderden valse "gescheiden" opleverde. */
  const srv = maakServer({ uitkomst: () => ({ status: 200, data: { ok: true } }), dood: new Set(['oud']) });
  let hier = 'oud';
  const w = maakSessiewacht({ post: srv.post, rollen: {
    lid: { vers: async () => 'vers', leeft: async (t) => !srv.dood.has(t), zet: (t) => { hier = t; } }
  } });
  const u = await w.roep('/api/iets', {}, 'lid', 'oud');
  assert.equal(u.status, 200, 'met een verse sessie geeft dezelfde route gewoon antwoord');
  assert.equal(w.hernieuwd(), 1);
  assert.equal(hier, 'vers', 'het verse token gaat terug naar de aanroeper, anders sterft de volgende route ook');
});

test('zonder probe: herhalen met een VERS token, en alleen dan telt het als herstel', async () => {
  /* Voor rollen zonder lichte "ben ik er nog"-route. Blijft het 401 met een
     gegarandeerd verse sessie, dan was het een echte weigering en hoort dat
     NIET als herstel geteld te worden -- anders leest het register een
     hersteld getal waar niets is hersteld. */
  const dood = maakServer({ uitkomst: () => ({ status: 200, data: { ok: true } }), dood: new Set(['oud']) });
  const w1 = maakSessiewacht({ post: dood.post, rollen: { zaak: { vers: async () => 'vers' } } });
  assert.equal((await w1.roep('/api/x', {}, 'zaak', 'oud')).status, 200);
  assert.equal(w1.hernieuwd(), 1);

  const weigert = maakServer({ uitkomst: () => ({ status: 401, data: { error: 'nee' } }) });
  const w2 = maakSessiewacht({ post: weigert.post, rollen: { zaak: { vers: async () => 'vers' } } });
  assert.equal((await w2.roep('/api/x', {}, 'zaak', 'oud')).status, 401);
  assert.equal(w2.hernieuwd(), 0, 'een echte weigering is geen herstel');
});

test('403 en 404 blijven met rust: die komen van een server die je herkent', async () => {
  for (const status of [403, 404, 409, 500]) {
    const srv = maakServer({ uitkomst: () => ({ status, data: {} }) });
    let inlogs = 0;
    const w = maakSessiewacht({ post: srv.post, rollen: { lid: { vers: async () => { inlogs++; return 'vers'; } } } });
    assert.equal((await w.roep('/api/x', {}, 'lid', 'oud')).status, status);
    assert.equal(inlogs, 0, status + ' hoort geen nieuwe inlog uit te lokken');
  }
});

test('een rol zonder inlog verandert niets: liever een eerlijke 401 dan een stille truc', async () => {
  const srv = maakServer({ uitkomst: () => ({ status: 401, data: {} }) });
  const w = maakSessiewacht({ post: srv.post, rollen: {} });
  assert.equal((await w.roep('/api/x', {}, 'onbekend', 'oud')).status, 401);
  assert.equal(srv.gezien.length, 1, 'geen tweede aanroep zonder iets om te vernieuwen');
});
