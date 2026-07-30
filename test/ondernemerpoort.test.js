/* Ondernemer-poort (kern/ondernemerpoort.js): een nieuwe zaak loopt eerst de
   basis door (Salon-pagina + rondleiding kassa en werk-apps) voordat hij online
   mag. Bestaande zaken zijn grandfathered (online tenzij expliciet uit). npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

// Salon-profiel compleet = bio >= 15 tekens EN een foto (zoals in server.js).
function salonProfielCompleet(s) {
  const bio = ((s.salon && s.salon.bio) || '').trim();
  const heeftFoto = !!(s.salon && s.salon.foto) || (Array.isArray(s.photos) && s.photos.length > 0);
  return bio.length >= 15 && heeftFoto;
}
const poort = require('../server/kern/ondernemerpoort')({ salonProfielCompleet });

function nieuweZaak() {
  return { code: 'X', online: false, salon: { bio: '', foto: null, volgers: [] }, rondleiding: {} };
}
function volleZaak() {
  return { code: 'Y', online: false,
    salon: { bio: 'Een fijne zaak op Ibiza met zon.', foto: '/media/a.jpg', volgers: [] },
    rondleiding: { kassa: 't', werk: 't' } };
}

test('een lege nieuwe zaak is nog niet klaar en niet online', () => {
  const s = nieuweZaak();
  assert.equal(poort.poortKlaar(s), false);
  assert.equal(poort.zaakOnline(s), false);
  const b = poort.poortBeeld(s);
  assert.equal(b.klaar, false);
  assert.equal(b.stappen.every(x => !x.klaar), true);
});

test('alle drie de poortstappen samen maken de zaak klaar', () => {
  const s = volleZaak();
  assert.equal(poort.poortKlaar(s), true);
  const b = poort.poortBeeld(s);
  assert.equal(b.klaar, true);
  assert.deepEqual(b.stappen.map(x => x.id).sort(), ['kassa', 'salon', 'werk']);
});

test('rondleidingZet tikt een rondleiding af, onbekende niet', () => {
  const s = nieuweZaak();
  assert.equal(poort.rondleidingZet(s, 'kassa'), true);
  assert.equal(poort.rondleidingKlaar(s, 'kassa'), true);
  assert.equal(poort.rondleidingZet(s, 'onzin'), false);
});

test('zaakOnline vereist een compleet Salon-profiel, ook als online aan staat', () => {
  const s = nieuweZaak(); s.online = true;         // knop staat "aan"
  assert.equal(poort.zaakOnline(s), false);         // maar geen etalage -> niet online
  s.salon.bio = 'Een fijne zaak op Ibiza met zon.'; s.salon.foto = '/media/a.jpg';
  assert.equal(poort.zaakOnline(s), true);
});

test('bestaande zaak zonder online-veld telt als online (grandfathered)', () => {
  const s = { code: 'Z', salon: { bio: 'Een fijne zaak op Ibiza met zon.', foto: '/media/a.jpg', volgers: [] } };
  assert.equal(poort.zaakOnline(s), true);          // online undefined !== false
});

test('alleen kassa en werk zijn verplichte rondleidingen', () => {
  assert.deepEqual([...poort.VERPLICHTE_RONDLEIDINGEN].sort(), ['kassa', 'werk']);
  const s = volleZaak(); delete s.rondleiding.werk;  // salon-tour niet nodig, werk wel
  assert.equal(poort.poortKlaar(s), false);
});
