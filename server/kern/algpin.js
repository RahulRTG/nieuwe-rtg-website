/* De algemene pin: een persoonlijke pincode van het lid die privacygevoelige
   apps op het RTG-OS beschermt en waarmee ook de werk-apps openen (het ene
   account levert de bevoegdheid, de pin het bewijs op het toestel). Een pin,
   overal dezelfde, zodat niemand tien codes hoeft te onthouden.

   Veiligheid:
   - scrypt met een eigen zout per lid (node:crypto, geen afhankelijkheden),
     timingvast vergeleken; de pin zelf wordt nergens bewaard of gelogd.
   - een klein slot per lid: vijf foute pogingen = een minuut wachten.
   - wijzigen kan alleen met de oude pin; de kluis blijft de kluis.

   maakAlgPin(state) volgt het vaste kern-patroon. */

function maakAlgPin({ db, save, crypto, slot }) {
  const rij = () => {
    if (!db.data.algPin || typeof db.data.algPin !== 'object') db.data.algPin = {};
    return db.data.algPin;
  };
  /* Het slot komt van buiten (server/pinslot.js) en wordt gedeeld met de
     personeelspin, de sleutelwoorden en het koppelen. Hier stond een eigen
     kopie van dezelfde teller, met dezelfde grenzen -- maar zonder de
     opruimronde die het gedeelde slot wel heeft, dus die Map groeide met elke
     sleutel die ooit een misgreep had en kromp nooit meer. De sleutel draagt
     zijn soort voorop, zodat twee deuren met dezelfde sleutelwaarde niet
     elkaars teller vullen. */
  /* Meteen bij het opstarten, niet pas bij de eerste misgreep: een ontbrekend
     slot is stil een ongeremde pincode. Liever een server die niet start. */
  if (!slot || typeof slot.dicht !== 'function')
    throw new Error('algpin: het gedeelde slot ontbreekt; zonder rem is een pincode van vier cijfers zo geraden.');
  const doel = key => 'algpin:' + key;
  const PIN_RE = /^\d{4,8}$/;

  /* Asynchroon, en om dezelfde reden als bij de sleutelwoorden: scryptSync is
     hier 40 ms gemeten, en 40 ms synchroon rekenen is 40 ms waarin de server
     NIEMAND anders antwoordt. De threadpool rekent even zwaar, alleen naast de
     lus in plaats van erin. Zie kern/sleutelwoorden.js voor de meting. */
  const hash = (pin, zout) => new Promise((klaar, mis) =>
    crypto.scrypt(String(pin), zout, 32, { N: 16384, r: 8, p: 1 }, (e, k) => e ? mis(e) : klaar(k.toString('base64'))));

  const teVaak = key => slot.dicht(doel(key));
  const fout = key => slot.fout(doel(key), 'de algemene pincode van ' + key);
  async function klopt(key, pin) {
    const p = rij()[key];
    if (!p || !PIN_RE.test(String(pin || ''))) return false;
    const a = Buffer.from(await hash(pin, Buffer.from(p.zout, 'base64')));
    const b = Buffer.from(p.hash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  function pinInfo(key) { return { gezet: !!rij()[key] }; }

  async function pinZet(key, body) {
    const pin = String((body || {}).pin || '');
    if (!PIN_RE.test(pin)) return { status: 400, error: 'Kies een pincode van 4 tot 8 cijfers.' };
    if (rij()[key]) {
      if (teVaak(key)) return { status: 429, error: 'Te veel foute pogingen. Wacht een minuut.' };
      if (!await klopt(key, (body || {}).oud)) { fout(key); return { status: 401, error: 'De huidige pincode klopt niet.' }; }
    }
    const zout = crypto.randomBytes(16);
    rij()[key] = { zout: zout.toString('base64'), hash: await hash(pin, zout), at: new Date().toISOString() };
    save();
    return { ok: true, gezet: true };
  }

  async function pinCheck(key, pin) {
    if (!rij()[key]) return { ok: true, gezet: false }; // geen pin gezet = niets te bewijzen
    if (teVaak(key)) return { status: 429, error: 'Te veel foute pogingen. Wacht een minuut.' };
    if (!await klopt(key, pin)) { fout(key); return { status: 401, error: 'Onjuiste pincode.' }; }
    slot.goed(doel(key));
    return { ok: true, gezet: true };
  }

  return { pinInfo, pinZet, pinCheck };
}

module.exports = { maakAlgPin };
