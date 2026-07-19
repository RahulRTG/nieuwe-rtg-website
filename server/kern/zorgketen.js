/* De zorgketen (laag twee op de hulpdiensten-toren): de schakels tussen de
   spreekkamers en de rest van de zorg.

   - Recepten: de huisarts, het ziekenhuis en de medisch specialist schrijven
     voor; de apotheek ziet het recept binnenkomen, zet klaar en reikt uit.
   - De eerste hulp (SEH): een wachtrij per ziekenhuis met triagekleuren
     (rood, oranje, geel, groen, blauw); binnen via de balie of de
     ambulance, dan in behandeling, dan opgenomen of naar huis.
   - Verwijzingen: de huisarts en het ziekenhuis verwijzen naar de medisch
     specialist of de beauty medical-kliniek; die zien de verwijzing in hun
     eigen inbox en plannen.
   - Afspraken: de agenda van de specialist en de beauty medical-kliniek;
     bij beauty medical is de intake verplicht voor er behandeld wordt.

   EERLIJK: demonstratie- en oefenomgeving; geen medische diagnoses, geen
   112-vervanging. Klantdata draait ook hier op vrije tekst zonder namen. */

const ZORG_TYPES = {
  apotheek:      { label: 'Apotheek',          icon: '\u{1F48A}', caps: ['location'] },
  specialist:    { label: 'Medisch specialist', icon: '\u{1FAC0}', caps: ['location'] },
  beautymedical: { label: 'Beauty medical',     icon: '\u{2728}', caps: ['location'] }
};
const VOORSCHRIJVERS = ['huisarts', 'ziekenhuis', 'specialist'];
const VERWIJZERS = ['huisarts', 'ziekenhuis'];
const AGENDAS = ['specialist', 'beautymedical'];
const TRIAGE = ['rood', 'oranje', 'geel', 'groen', 'blauw'];

module.exports = ({ db, save, crypto, findSupplier }) => {
  const nu = () => Date.now();
  const schoon = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max || 200);
  function bak() {
    if (!db.data.hulp) db.data.hulp = {};
    const h = db.data.hulp;
    if (!Array.isArray(h.recepten)) h.recepten = [];
    if (!h.seh) h.seh = {};
    if (!Array.isArray(h.verwijzingen)) h.verwijzingen = [];
    if (!h.afspraken) h.afspraken = {};
    return h;
  }
  const soortVan = code => (findSupplier(code) || {}).type || null;

  /* ---------- recepten: voorschrijven en uitreiken ---------- */
  function receptMaak(code, b) {
    if (!VOORSCHRIJVERS.includes(soortVan(code))) return { status: 403, error: 'Alleen de huisarts, het ziekenhuis of de specialist schrijft voor.' };
    const apo = findSupplier(b.apotheek);
    if (!apo || apo.type !== 'apotheek') return { status: 404, error: 'Deze apotheek kennen we niet.' };
    const middel = schoon(b.middel, 120);
    if (!middel) return { status: 400, error: 'Welk middel schrijft u voor?' };
    const r = {
      id: crypto.randomBytes(4).toString('hex'), van: code, apotheek: apo.code,
      middel, dosering: schoon(b.dosering, 120), status: 'voorgeschreven', at: nu()
    };
    bak().recepten.unshift(r);
    if (bak().recepten.length > 2000) bak().recepten.pop();
    save();
    return { ok: true, recept: r };
  }
  function receptZet(code, id, status) {
    if (soortVan(code) !== 'apotheek') return { status: 403, error: 'Alleen de apotheek handelt recepten af.' };
    const r = bak().recepten.find(x => x.id === id && x.apotheek === code);
    if (!r) return { status: 404, error: 'Dit recept staat niet bij deze apotheek.' };
    if (!['klaar', 'uitgereikt', 'geweigerd'].includes(status)) return { status: 400, error: 'Kies klaar, uitgereikt of geweigerd.' };
    if (r.status === 'uitgereikt') return { status: 409, error: 'Dit recept is al uitgereikt.' };
    r.status = status;
    save();
    return { ok: true, recept: r };
  }

  /* ---------- de eerste hulp: triagekleuren en de wachtrij ---------- */
  function sehRij(zk) { const h = bak(); if (!Array.isArray(h.seh[zk])) h.seh[zk] = []; return h.seh[zk]; }
  function sehBinnen(code, b) {
    if (soortVan(code) !== 'ziekenhuis') return { status: 403, error: 'Alleen het ziekenhuis heeft een eerste hulp.' };
    const klacht = schoon(b.klacht, 200);
    if (!klacht) return { status: 400, error: 'Waarmee komt de patient binnen?' };
    if (!TRIAGE.includes(b.triage)) return { status: 400, error: 'Kies een triagekleur: rood, oranje, geel, groen of blauw.' };
    const e = { id: crypto.randomBytes(4).toString('hex'), klacht, triage: b.triage, via: schoon(b.via, 40) || 'balie', status: 'wacht', at: nu() };
    sehRij(code).push(e);
    if (sehRij(code).length > 300) sehRij(code).shift();
    save();
    return { ok: true, patient: e };
  }
  function sehZet(code, id, status) {
    if (soortVan(code) !== 'ziekenhuis') return { status: 403, error: 'Alleen het ziekenhuis heeft een eerste hulp.' };
    const e = sehRij(code).find(x => x.id === id);
    if (!e) return { status: 404, error: 'Deze patient staat niet in de rij.' };
    if (!['in-behandeling', 'opgenomen', 'naar-huis'].includes(status)) return { status: 400, error: 'Kies in-behandeling, opgenomen of naar-huis.' };
    e.status = status;
    save();
    return { ok: true, patient: e };
  }
  // de rij gesorteerd op triagekleur (rood eerst) en daarna op binnenkomst
  function sehGesorteerd(zk) {
    return sehRij(zk).filter(e => e.status !== 'opgenomen' && e.status !== 'naar-huis')
      .slice().sort((a, b) => TRIAGE.indexOf(a.triage) - TRIAGE.indexOf(b.triage) || a.at - b.at);
  }

  /* ---------- verwijzingen: van de spreekkamer naar de specialist ---------- */
  function verwijsMaak(code, b) {
    if (!VERWIJZERS.includes(soortVan(code))) return { status: 403, error: 'Alleen de huisarts of het ziekenhuis verwijst door.' };
    const naar = findSupplier(b.naar);
    if (!naar || !AGENDAS.includes(naar.type)) return { status: 404, error: 'Verwijzen kan naar een medisch specialist of een beauty medical-kliniek.' };
    const reden = schoon(b.reden, 200);
    if (!reden) return { status: 400, error: 'Wat is de reden van de verwijzing?' };
    const v = { id: crypto.randomBytes(4).toString('hex'), van: code, naar: naar.code, reden, status: 'nieuw', at: nu() };
    bak().verwijzingen.unshift(v);
    if (bak().verwijzingen.length > 1000) bak().verwijzingen.pop();
    save();
    return { ok: true, verwijzing: v };
  }
  function verwijsZet(code, id, status) {
    const v = bak().verwijzingen.find(x => x.id === id && x.naar === code);
    if (!v) return { status: 404, error: 'Deze verwijzing staat niet in uw inbox.' };
    if (!['gepland', 'gezien', 'terugverwezen'].includes(status)) return { status: 400, error: 'Kies gepland, gezien of terugverwezen.' };
    v.status = status;
    save();
    return { ok: true, verwijzing: v };
  }

  /* ---------- afspraken: specialist en beauty medical ---------- */
  function afspraakRij(code) { const h = bak(); if (!Array.isArray(h.afspraken[code])) h.afspraken[code] = []; return h.afspraken[code]; }
  function afspraakMaak(code, b) {
    const soort = soortVan(code);
    if (!AGENDAS.includes(soort)) return { status: 403, error: 'Alleen de specialist en beauty medical plannen hier afspraken.' };
    const wat = schoon(b.wat, 120);
    if (!wat) return { status: 400, error: 'Waarvoor is de afspraak?' };
    // beauty medical behandelt nooit zonder intake: eerlijk over risico's
    const intake = b.intake === true;
    if (soort === 'beautymedical' && !intake) return { status: 400, error: 'Bij beauty medical is de intake verplicht: plan eerst een intakegesprek (vink de intake aan).' };
    const a = { id: crypto.randomBytes(4).toString('hex'), wat, wanneer: schoon(b.wanneer, 40), intake, status: 'gepland', at: nu() };
    afspraakRij(code).unshift(a);
    if (afspraakRij(code).length > 500) afspraakRij(code).pop();
    save();
    return { ok: true, afspraak: a };
  }
  function afspraakZet(code, id, status) {
    const a = afspraakRij(code).find(x => x.id === id);
    if (!a) return { status: 404, error: 'Deze afspraak staat niet in de agenda.' };
    if (!['afgerond', 'geannuleerd', 'gepland'].includes(status)) return { status: 400, error: 'Kies gepland, afgerond of geannuleerd.' };
    a.status = status;
    save();
    return { ok: true, afspraak: a };
  }

  /* ---------- het zorg-overzicht per soort zaak ---------- */
  function zorgOverzicht(s) {
    const soort = s && s.type;
    const magHier = !!ZORG_TYPES[soort] || VOORSCHRIJVERS.includes(soort) || VERWIJZERS.includes(soort);
    if (!magHier) return { status: 403, error: 'Deze zaak hoort niet bij de zorgketen.' };
    const h = bak();
    const uit = { ok: true, soort, zaak: { code: s.code, naam: s.name, label: (ZORG_TYPES[soort] || {}).label || soort } };
    if (soort === 'apotheek') uit.recepten = h.recepten.filter(r => r.apotheek === s.code).slice(0, 50);
    if (VOORSCHRIJVERS.includes(soort)) {
      uit.eigenRecepten = h.recepten.filter(r => r.van === s.code).slice(0, 20);
      uit.apotheken = (db.data.suppliers || []).filter(x => x.type === 'apotheek').map(x => ({ code: x.code, naam: x.name }));
    }
    if (soort === 'ziekenhuis') uit.seh = sehGesorteerd(s.code);
    if (VERWIJZERS.includes(soort))
      uit.verwijsDoelen = (db.data.suppliers || []).filter(x => AGENDAS.includes(x.type)).map(x => ({ code: x.code, naam: x.name, soort: x.type }));
    if (AGENDAS.includes(soort)) {
      uit.verwijzingen = h.verwijzingen.filter(v => v.naar === s.code).slice(0, 30);
      uit.afspraken = afspraakRij(s.code).slice(0, 30);
    }
    return uit;
  }

  return { zorgketen: { ZORG_TYPES, TRIAGE, zorgOverzicht, receptMaak, receptZet, sehBinnen, sehZet, verwijsMaak, verwijsZet, afspraakMaak, afspraakZet } };
};
module.exports.ZORG_TYPES = ZORG_TYPES;
