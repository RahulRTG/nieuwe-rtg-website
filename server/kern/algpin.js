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
  const eigen = require('./eigencollectie')({ db, domein: 'kern/algpin', bezit: { algPin: 'kaart', algPinHerstel: 'kaart' } });
  const rij = () => eigen.bak('algPin');
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

  /* ---- pin vergeten ----

     "Wijzigen kan alleen met de oude pin" is goed tegen iemand die even achter
     je toestel kruipt, maar het liet iedereen die zijn pin kwijt was voorgoed
     buiten staan: de kantoorrol en de werk-apps gaan niet open zonder pin, en
     er was geen enkele weg terug. Dat is hier echt gebeurd, en het kostte de
     eigenaar de toegang tot zijn eigen boardroom.

     De weg terug loopt langs hetzelfde tweede kanaal als het wachtwoord: een
     eenmalige sleutel naar het e-mailadres van het lid zelf (zie
     routes/auth/herstel.js, en dit is met opzet dezelfde vorm -- twee
     verschillende herstelwegen zijn twee verschillende waarheden).

     Waarom dit veilig genoeg is: aanvragen kan alleen vanuit een INGELOGDE
     sessie van het lid zelf, en de sleutel gaat naar een adres dat wij hebben
     en de aanvrager niet kiest. Wie het account al heeft EN de mailbox al
     heeft, kon het wachtwoord toch al herstellen; de pin wordt daarmee niet
     zwakker dan de deur die eromheen zit. */
  const HERSTEL_MS = 3600000;   // een uur, net als de wachtwoordlink
  const herstelRij = () => eigen.bak('algPinHerstel');
  const sleutelHash = t => crypto.createHash('sha256').update(String(t)).digest('hex');

  function pinHerstelStart(key) {
    const t = crypto.randomBytes(24).toString('hex');
    herstelRij()[sleutelHash(t)] = { key, tot: Date.now() + HERSTEL_MS };
    // afgelopen sleutels meteen opruimen: anders groeit deze rij eeuwig door
    for (const [h, r] of Object.entries(herstelRij())) if (!r || r.tot < Date.now()) delete herstelRij()[h];
    save();
    return { ok: true, sleutel: t, geldigTot: new Date(Date.now() + HERSTEL_MS).toISOString() };
  }

  /* Eenmalig: de sleutel gaat weg zodra hij is gebruikt, ook als het zetten
     daarna misgaat. Een sleutel die na een misgreep nog werkt is geen sleutel. */
  async function pinHerstelZet(sleutel, pin) {
    const h = sleutelHash(String(sleutel || ''));
    const r = herstelRij()[h];
    if (!r || r.tot < Date.now()) return { status: 400, error: 'Deze herstellink is verlopen of al gebruikt. Vraag een nieuwe aan.' };
    delete herstelRij()[h];
    if (!PIN_RE.test(String(pin || ''))) { save(); return { status: 400, error: 'Kies een pincode van 4 tot 8 cijfers.' }; }
    const zout = crypto.randomBytes(16);
    rij()[r.key] = { zout: zout.toString('base64'), hash: await hash(pin, zout), at: new Date().toISOString() };
    slot.goed(doel(r.key));   // schone lei: het slot van de oude pin telt niet meer mee
    save();
    return { ok: true, gezet: true };
  }

  return { pinInfo, pinZet, pinCheck, pinHerstelStart, pinHerstelZet };
}

module.exports = { maakAlgPin };
