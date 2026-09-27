/* RTG ZELF, ALS WERKGEVER -- de zaak waarin de mensen van het kantoor werken.

   Besluit van de eigenaar (27 september 2026, VRIJHEID.md): er komt een zaak
   die RTG zelf is, en de kantoorafdelingen worden erop aangesloten. Dat gaat in
   twee stappen, en dit bestand is de eerste:

     1 (hier)  de zaak bestaat, de kamers van het kantoor zijn zijn AFDELINGEN,
               en een medewerker hoort bij een of meer kamers. Dan is een kamer
               een TEAM, en rekent RTG Vrijheid bezetting en eerlijkheid per
               kamer.
     2 (later) het kantoor logt in als personeel van deze zaak in plaats van met
               de gedeelde OFFICE_CODE. Dat raakt de beveiliging van het hele
               kantoor en krijgt een eigen PR met een eigen keuring.

   Dezelfde vorm als de RTFoundation-positie (kern/rtfwallet.js), met dezelfde
   grendels:
     - er is er precies EEN (genre `rtg`, status 'huis'); een tweede keer
       aanmaken geeft 409 met de bestaande terug;
     - de eigenaar maakt hem aan, met een BESTAAND persoonlijk RTG-account als
       eerste leidinggevende -- geen losse personeelspin;
     - hij gaat nooit online: dit is geen zaak in de etalage;
     - hij staat in de economische wereld `rtg-intern` (ECONOMIE.md), niet in
       `commercieel`; mislukt dat, dan wordt het gemeld en niet weggeslikt;
     - NIET GESEED: `geseed` betekent "demo, bij een schone start opruimen", en
       dit is het tegendeel.

   DE AFDELINGEN zijn de kamer-ids uit het afdelingsregister
   (kern/afdelingen.js, KAMER_IDS) en worden niet overgetypt: een kamer die er
   niet meer is, verdwijnt vanzelf uit de keuze. Wie bij welke kamer hoort, zet
   een leidinggevende van deze zaak -- niet het anonieme kantoor, want dat heeft
   geen naam om onder te tekenen. */
'use strict';
const klok = require('../lib/klok');

const GENRE = 'rtg';

module.exports = ({ db, save, kern }) => {
  const k = () => kern();
  const nu = () => klok.datum().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const eigen = require('./eigencollectie')({ db, domein: 'kern/rtghuis', bezit: { rtgAfdelingen: 'kaart' } });

  const rtgZaak = () => (db.data.suppliers || []).find(s => s && s.type === GENRE) || null;
  const isRtgZaak = (code) => { const s = rtgZaak(); return !!s && s.code === String(code || '').toUpperCase(); };
  const kamerIds = () => { const a = k().afdelingen; return (a && a.KAMER_IDS) || []; };

  function beeld(s) {
    if (!s) return null;
    const e = k().economie;
    return { code: s.code, naam: s.name, sinds: s.aangeslotenAt || null, door: s.aangeslotenDoor || null,
      online: s.online === true, wereld: e ? e.wereldVanDrager('zaak:' + s.code) : null };
  }

  function stand() {
    const s = rtgZaak();
    return { ok: true, bestaat: !!s, zaak: beeld(s), afdelingen: kamerIds(),
      uitleg: s ? 'RTG heeft een eigen zaak als werkgever; de kamers van het kantoor zijn zijn afdelingen.'
        : 'RTG heeft nog geen eigen zaak als werkgever. Zolang die er niet is, geldt het RTG-beleid (tien RTG Days) voor niemand.' };
  }

  function maak(invoer, door) {
    const b = invoer || {};
    const al = rtgZaak();
    if (al) return { status: 409, error: 'RTG heeft al een eigen zaak: ' + al.code + '. Er is er precies een.', zaak: beeld(al) };
    const x = k();
    const beheerder = schoon(b.beheerder, 60);
    if (!beheerder) return { status: 400, error: 'Op wiens naam komt de eerste leidinggevende te staan?' };
    const lid = x.accounts.findByLogin(schoon(b.beheerderLogin, 120));
    if (!lid || (x.accounts.isActief && !x.accounts.isActief(lid)))
      return { status: 409, error: 'Koppel de leidinggevende aan een bestaand actief persoonlijk RTG-account.',
        uitleg: 'Vul diens persoonlijke RTG-login in. Er wordt voor RTG zelf geen losse personeelspin uitgegeven.' };
    const code = x.makeSupplierCode(schoon(b.naam, 40) || 'RTG');
    const s = { code, name: schoon(b.naam, 80) || 'RTG', type: GENRE, city: schoon(b.plaats, 60) || null, loc: null,
      rate: 0, menu: [], online: false, aangeslotenDoor: schoon(door, 60) || 'boardroom', aangeslotenAt: nu() };
    x.ensureSupplierDefaults(s);                 // zet online alleen als hij undefined is
    db.data.suppliers.push(s);
    save();
    let wereldFout = null;
    try {
      const r = x.economie.identiteitZet({ drager: 'zaak:' + code, wereld: 'rtg-intern',
        grond: 'RTG zelf als werkgever van het kantoor; geen commerciele klant van RTG (ECONOMIE.md).', door: schoon(door, 60) || 'boardroom' });
      if (!r || !r.ok) wereldFout = (r && r.error) || 'onbekend';
    } catch (e) { wereldFout = String((e && e.message) || e); }
    x.accounts.createAccountStaff({ supplierCode: code, name: beheerder, role: 'manager', func: 'Leiding',
      memberId: lid.id, memberTier: lid.tier });
    return { ok: true, code, zaak: beeld(rtgZaak()), wereldFout,
      vervolg: 'De zaak staat er. De leidinggevende logt in met het gekoppelde persoonlijke RTG-account en zet de mensen in hun kamers.' };
  }

  /* ---- afdelingen: wie hoort bij welke kamer ---- */
  function afdelingenVan(staffId) {
    const r = eigen.kijk('rtgAfdelingen')[String(staffId)];
    return r ? r.kamers.filter(c => kamerIds().includes(c)) : [];
  }
  function ledenVan(kamer) {
    const alle = eigen.kijk('rtgAfdelingen');
    return Object.keys(alle).filter(id => (alle[id].kamers || []).includes(kamer));
  }
  function afdelingZet(code, staffId, kamers, { door, leidinggevende }) {
    if (!isRtgZaak(code)) return { status: 404, error: 'Afdelingen bestaan alleen in de zaak van RTG zelf.' };
    if (!leidinggevende || !door) return { status: 403, error: 'Alleen een leidinggevende van RTG zet iemand in een kamer, op eigen naam.' };
    const staff = k().accounts.listStaff(code).find(s => String(s.id) === String(staffId));
    if (!staff) return { status: 404, error: 'Deze medewerker werkt niet bij RTG.' };
    if (!Array.isArray(kamers) || kamers.length > 8) return { status: 400, error: 'Geef hooguit acht kamers op.' };
    const onbekend = kamers.filter(c => !kamerIds().includes(c));
    if (onbekend.length) return { status: 422, error: 'Deze kamers bestaan niet: ' + onbekend.join(', ') + '.' };
    const alle = eigen.bak('rtgAfdelingen');
    if (kamers.length) alle[String(staffId)] = { kamers: [...new Set(kamers)], door: String(door), op: nu() };
    else delete alle[String(staffId)];
    save();
    return { ok: true, staffId: String(staffId), kamers: afdelingenVan(staffId) };
  }

  return { GENRE, rtgZaak, isRtgZaak, stand, maak, afdelingenVan, ledenVan, afdelingZet, kamerIds };
};
