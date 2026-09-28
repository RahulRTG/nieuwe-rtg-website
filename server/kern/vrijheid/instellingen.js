/* VRIJHEID: WAT DE ZAAK EN DE MENS ZELF OPGEVEN -- en wat nergens anders woont.

   Drie dingen heeft dit huis vandaag niet, en de motor heeft ze nodig:

     verjaardag   Het personeelsregister (accounts/staff.js) draagt geen
                  geboortedatum, en de geboortedatum van het LID gebruiken zou
                  een gegeven uit een andere hoedanigheid naar de werkgever
                  halen (MENSNETWERK.md, MN-02). Dus geeft de medewerker hem
                  ZELF op, en alleen dag en maand. Hij kan hem ook weer
                  weghalen: dan is er geen verjaardagvrijheid, en dat is zijn
                  keuze.
     bezetting    Welke bezetting en welke bevoegdheden een tijdvak nodig
                  heeft, staat nergens behalve bij de beveiliging (`minMan` per
                  post). Een leidinggevende legt het per weekdag vast. Zonder
                  eis is dekking UNKNOWN, nooit SAFE.
     feestdagen   Er is in dit huis geen feestdagenlijst. De zaak legt hem
                  vast; zonder lijst wordt een feestdag als gewone dag gelezen,
                  en dat staat in het teambeeld bij wat ontbreekt.

   Wie mag wat: de verjaardag alleen de mens zelf, de rest alleen een
   leidinggevende van de zaak. De rol komt van de aanroeper (de route leest hem
   uit de sessie) en nooit uit het lichaam. */
'use strict';
const T = require('./tijd');

module.exports = ({ eigen, save, nu }) => {
  const tijd = nu || (() => new Date().toISOString());
  const leeg = () => ({ verjaardagen: {}, eisen: [], feestdagen: [] });
  const sleutel = (code) => String(code || '').toUpperCase();

  /* Lezen schept niets (eigencollectie.kijk); schrijven wel (bak). */
  function lees(code) {
    const alle = eigen.kijk('vrijheidInstellingen');
    return alle[sleutel(code)] || leeg();
  }
  function schrijf(code) {
    const alle = eigen.bak('vrijheidInstellingen');
    const k = sleutel(code);
    return alle[k] || (alle[k] = leeg());
  }

  function zetVerjaardag(code, staffId, mmdd, door) {
    if (!door || String(door) !== String(staffId)) return { status: 403, error: 'Alleen uzelf geeft uw verjaardag op.' };
    if (mmdd != null && mmdd !== '') {
      const ok = /^\d{2}-\d{2}$/.test(String(mmdd)) && !Number.isNaN(Date.parse('2024-' + mmdd));
      if (!ok) return { status: 400, error: 'Geef dag en maand op als MM-DD, bijvoorbeeld 05-30.' };
    }
    const inst = schrijf(code);
    if (mmdd) inst.verjaardagen[String(staffId)] = { mmdd: String(mmdd), op: tijd() };
    else delete inst.verjaardagen[String(staffId)];
    save();
    return { ok: true, verjaardag: mmdd || null };
  }

  function keurEis(e) {
    if (!e || typeof e !== 'object') return 'Een eis is een object.';
    if (!(Number.isInteger(e.weekdag) && e.weekdag >= 0 && e.weekdag <= 6)) return 'weekdag is 0 (zondag) tot en met 6.';
    if (!T.isKlok(e.van) || !T.isKlok(e.tot)) return 'van en tot zijn tijden als UU:MM.';
    if (!(Number.isInteger(e.minBezetting) && e.minBezetting >= 0)) return 'minBezetting is een heel getal van nul of meer.';
    if (e.kamer != null && !/^[a-zA-Z]{2,30}$/.test(String(e.kamer))) return 'kamer is de id van een kamer, bijvoorbeeld financien.';
    for (const [c, n] of Object.entries(e.vereist || {}))
      if (!/^[A-Z0-9_]{2,40}$/.test(c) || !(Number.isInteger(n) && n >= 1)) return 'vereist noemt een bevoegdheid (HOOFDLETTERS) en een aantal van minstens 1.';
    return null;
  }

  function zetEisen(code, eisen, { door, leidinggevende }) {
    if (!leidinggevende) return { status: 403, error: 'Alleen een leidinggevende legt de bezetting vast.' };
    if (!Array.isArray(eisen) || eisen.length > 70) return { status: 400, error: 'Geef een lijst van hooguit zeventig eisen.' };
    const bezwaren = eisen.map(keurEis).map((b, i) => b && ('eis ' + (i + 1) + ': ' + b)).filter(Boolean);
    if (bezwaren.length) return { status: 422, error: 'De eisen zijn afgekeurd.', bezwaren };
    const inst = schrijf(code);
    inst.eisen = eisen.map(e => ({ weekdag: e.weekdag, van: e.van, tot: e.tot, minBezetting: e.minBezetting, vereist: { ...(e.vereist || {}) },
      ...(e.kamer ? { kamer: String(e.kamer) } : {}) }));
    inst.eisenDoor = String(door || ''); inst.eisenOp = tijd();
    save();
    return { ok: true, eisen: inst.eisen };
  }

  function zetFeestdagen(code, lijst, { leidinggevende }) {
    if (!leidinggevende) return { status: 403, error: 'Alleen een leidinggevende legt de feestdagen vast.' };
    if (!Array.isArray(lijst) || lijst.length > 60 || !lijst.every(T.isDatum)) return { status: 400, error: 'Geef hooguit zestig datums als JJJJ-MM-DD.' };
    const inst = schrijf(code);
    inst.feestdagen = [...new Set(lijst)].sort();
    save();
    return { ok: true, feestdagen: inst.feestdagen };
  }

  return { lees, zetVerjaardag, zetEisen, zetFeestdagen };
};
