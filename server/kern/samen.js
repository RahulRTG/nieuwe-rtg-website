/* Samen: met vrienden meekijken en samen doen, door het hele leden-OS heen.
   Een lid start een samen-sessie en krijgt een korte code; vrienden doen mee
   met die code. Wie ergens heen gaat (de Mall, het Theater, de Sport-app, een
   bibliotheek-pagina) deelt dat met de kamer, en de anderen krijgen live een
   seintje "ga mee" plus een kleine kamer-chat. Alles op codenaam; niemand
   wordt gevolgd zonder dat hij zelf in de kamer stapt, en eruit stappen kan
   altijd met een knop. Kamers zijn vluchtig: na twaalf uur stilte worden ze
   vanzelf opgeruimd. */

module.exports = ({ db, save, crypto, sseToCustomer, schoon }) => {
  const UUR = 3600000;
  const K = () => {
    if (!db.data.samenKamers || typeof db.data.samenKamers !== 'object') db.data.samenKamers = {};
    return db.data.samenKamers;
  };
  const pub = (k) => ({ code: k.code, gastheer: k.gastheer, leden: k.leden.map(l => l.codenaam),
    pad: k.pad, titel: k.titel, chat: k.chat.slice(-30), at: k.at });
  // een seintje naar iedereen in de kamer, behalve (meestal) de afzender zelf
  const sein = (k, kind, data, behalveKey) => {
    for (const l of k.leden) if (l.key !== behalveKey) {
      try { sseToCustomer(l.key, 'samen', Object.assign({ kind, code: k.code }, data)); } catch (e) {}
    }
  };
  const vind = (code) => K()[String(code || '').toUpperCase().slice(0, 8)] || null;
  const lidVan = (k, key) => k.leden.find(l => l.key === key) || null;
  // alleen paden binnen ons eigen huis; nooit een externe URL de kamer in
  const schoonPad = (p) => { p = String(p || '').slice(0, 200); return p.startsWith('/apps/') || p.startsWith('/site/') ? p : null; };

  function ruimOp() {
    const nu = Date.now();
    for (const c of Object.keys(K())) if (nu - (K()[c].at || 0) > 12 * UUR) delete K()[c];
  }

  function maak(key, codenaam) {
    ruimOp();
    if (Object.keys(K()).length >= 5000) return { status: 503, error: 'Alle samen-kamers zijn even bezet; probeer het zo weer.' };
    let code;
    do { code = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (K()[code]);
    K()[code] = { code, gastheer: codenaam, leden: [{ key, codenaam }], pad: null, titel: null, chat: [], at: Date.now() };
    save();
    return { status: 200, ok: true, kamer: pub(K()[code]) };
  }

  function doeMee(key, codenaam, code) {
    const k = vind(code);
    if (!k) return { status: 404, error: 'Deze samen-code bestaat niet (meer).' };
    if (!lidVan(k, key)) {
      if (k.leden.length >= 12) return { status: 400, error: 'Deze kamer zit vol (12 personen).' };
      k.leden.push({ key, codenaam });
      k.at = Date.now(); save();
      sein(k, 'erbij', { codenaam }, key);
    }
    return { status: 200, ok: true, kamer: pub(k) };
  }

  /* "Kijk hier": een lid deelt waar hij nu is; de anderen krijgen het seintje
     en kunnen met een knop meegaan. Iedereen in de kamer mag sturen; zo werkt
     het als samen rondlopen, niet als een zender met publiek. */
  function zet(key, code, pad, titel) {
    const k = vind(code);
    if (!k) return { status: 404, error: 'Deze samen-code bestaat niet (meer).' };
    const lid = lidVan(k, key);
    if (!lid) return { status: 403, error: 'Je zit niet (meer) in deze kamer.' };
    const p = schoonPad(pad);
    if (!p) return { status: 400, error: 'Dat is geen plek binnen RTG.' };
    k.pad = p; k.titel = schoon(titel, 80) || null; k.at = Date.now(); save();
    sein(k, 'kijk', { pad: k.pad, titel: k.titel, door: lid.codenaam }, key);
    return { status: 200, ok: true, kamer: pub(k) };
  }

  function chat(key, code, tekst) {
    const k = vind(code);
    if (!k) return { status: 404, error: 'Deze samen-code bestaat niet (meer).' };
    const lid = lidVan(k, key);
    if (!lid) return { status: 403, error: 'Je zit niet (meer) in deze kamer.' };
    const t = schoon(tekst, 300);
    if (!t) return { status: 400, error: 'Zeg iets.' };
    const regel = { van: lid.codenaam, tekst: t, at: Date.now() };
    k.chat.push(regel);
    if (k.chat.length > 100) k.chat.shift();
    k.at = Date.now(); save();
    sein(k, 'chat', regel, key);
    return { status: 200, ok: true, regel };
  }

  function weg(key, code) {
    const k = vind(code);
    if (!k) return { status: 200, ok: true };
    const lid = lidVan(k, key);
    if (lid) {
      k.leden = k.leden.filter(l => l.key !== key);
      if (!k.leden.length) delete K()[k.code];
      else sein(k, 'weg', { codenaam: lid.codenaam });
      save();
    }
    return { status: 200, ok: true };
  }

  function staat(key, code) {
    const k = vind(code);
    if (!k) return { status: 404, error: 'Deze samen-code bestaat niet (meer).' };
    if (!lidVan(k, key)) return { status: 403, error: 'Je zit niet (meer) in deze kamer.' };
    return { status: 200, ok: true, kamer: pub(k) };
  }

  return { samen: { maak, doeMee, zet, chat, weg, staat, ruimOp } };
};
