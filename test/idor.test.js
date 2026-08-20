/* HET IDOR-OORDEEL, NAGETROKKEN. Een 2xx is een BEVINDING (kan publiek zijn),
   een 401/403/404 is het bewijs van scheiding, en een 400 zegt niets over
   eigenaarschap. En een weigering die een persoonsveld prijsgeeft is zelf een
   lek, ook al is de scheiding op orde. Puur oordeel, los toetsbaar (LAT.md
   regel 10): het instrument eromheen heeft een server nodig, deze regel niet.

   Draai los: node --experimental-sqlite --test test/idor.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { oordeelIdor } = require('../scripts/lib/idor');

test('een 2xx is een doorbraak-BEVINDING, geen vonnis', () => {
  const o = oordeelIdor(200, '{"ok":true}');
  assert.equal(o.staat, 'doorbraak');
  assert.match(o.reden, /NAKIJKEN/, 'de reden dwingt het handmatig nakijken af');
});

test('401/403/404 is het bewijs van scheiding', () => {
  for (const s of [401, 403, 404]) {
    assert.equal(oordeelIdor(s, '{"error":"niet van jou"}').staat, 'gescheiden', 'status ' + s);
  }
});

test('een 400 zegt niets over eigenaarschap: onbereikbaar', () => {
  assert.equal(oordeelIdor(400, '{"error":"veld ontbreekt"}').staat, 'onbereikbaar');
  assert.equal(oordeelIdor(0, '').staat, 'onbereikbaar', 'een dode verbinding ook');
});

test('het IDOR-register draagt geen ONVERKLAARDE doorbraak', () => {
  /* De uitkomst van de proef, bewaakt: elke doorbraak-kandidaat is ofwel echt
     (staat: doorbraak, en dan hoort er een mens naar te kijken) ofwel met de
     hand afgedaan (staat: nagekeken, met een reden). Wat deze toets hard
     maakt: er staat op dit moment GEEN enkele onverklaarde doorbraak in het
     register. Komt er een bij -- een nieuwe route waar B met A's echte id
     binnenkomt -- dan zakt dit, en dat is precies de bedoeling: een IDOR-lek
     mag nooit stil in een register verdwijnen. */
  const fs = require('fs');
  const path = require('path');
  let reg;
  try { reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'IDOR.json'), 'utf8')); }
  catch (e) { return; } // nog niet gedraaid: dan valt er niets te bewaken
  const open = Object.entries(reg.perRoute || {}).filter(([, v]) => v.staat === 'doorbraak');
  assert.deepEqual(open.map(([r]) => r), [],
    'er staan ONVERKLAARDE IDOR-doorbraken in IDOR.json: ' + open.map(([r]) => r).join(', ') +
    ' -- kijk ze na en verklaar ze (NAGEKEKEN in scripts/idorproef.js) of repareer het lek');
  assert.ok((reg.gemeten.gescheiden || 0) >= 50,
    'de proef hoort tientallen routes als bewezen-gescheiden te melden, vond ' + reg.gemeten.gescheiden);
});

test('een weigering die een persoonsveld lekt is gescheiden EN een lek', () => {
  const lek = oordeelIdor(403, '{"error":"verboden","naam":"Noor de Vries"}');
  assert.equal(lek.staat, 'gescheiden');
  assert.equal(lek.lek, true, 'de naam in de 403 zegt: het object bestaat en zo heet de eigenaar');
  assert.match(lek.reden, /LEKT/);

  const schoon = oordeelIdor(403, '{"error":"U heeft hier geen toegang."}');
  assert.equal(schoon.lek, false, 'een nette weigering zonder persoonsgegeven lekt niets');
});
