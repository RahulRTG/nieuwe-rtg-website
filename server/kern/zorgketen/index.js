/* De zorgketen (laag twee op de hulpdiensten-toren): de schakels tussen de
   spreekkamers en de rest van de zorg. Recepten (voorschrijven -> apotheek), de
   eerste hulp (SEH met triagekleuren), verwijzingen naar de medisch specialist of
   beauty medical, de agenda's van die twee en de medische receptie.

   EERLIJK: demonstratie- en oefenomgeving; geen medische diagnoses, geen
   112-vervanging. Klantdata draait ook hier op vrije tekst zonder namen. Dit is de
   orkestrator: de constanten, de state-bak, de gedeelde helpers en het zorg-overzicht
   wonen hier; de recepten/SEH/verwijzingen in ./keten, de afspraken en de receptie in
   ./balie. */

const ZORG_TYPES = {
  apotheek:      { label: 'Apotheek',          icon: '\u{1F48A}', caps: ['location'] },
  specialist:    { label: 'Medisch specialist', icon: '\u{1FAC0}', caps: ['location'] },
  beautymedical: { label: 'Beauty medical',     icon: '\u{2728}', caps: ['location'] }
};
const VOORSCHRIJVERS = ['huisarts', 'ziekenhuis', 'specialist'];
const VERWIJZERS = ['huisarts', 'ziekenhuis'];
const AGENDAS = ['specialist', 'beautymedical'];
const TRIAGE = ['rood', 'oranje', 'geel', 'groen', 'blauw'];
const SPREEKKAMERS = ['ziekenhuis', 'huisarts', 'specialist', 'beautymedical'];

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
  const sehRij = zk => { const h = bak(); if (!Array.isArray(h.seh[zk])) h.seh[zk] = []; return h.seh[zk]; };
  // de rij gesorteerd op triagekleur (rood eerst) en daarna op binnenkomst
  const sehGesorteerd = zk => sehRij(zk).filter(e => e.status !== 'opgenomen' && e.status !== 'naar-huis')
    .slice().sort((a, b) => TRIAGE.indexOf(a.triage) - TRIAGE.indexOf(b.triage) || a.at - b.at);
  const afspraakRij = code => { const h = bak(); if (!Array.isArray(h.afspraken[code])) h.afspraken[code] = []; return h.afspraken[code]; };
  const receptieRij = code => { const h = bak(); if (!h.receptie) h.receptie = {}; if (!Array.isArray(h.receptie[code])) h.receptie[code] = []; return h.receptie[code]; };

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
    if (SPREEKKAMERS.includes(soort)) uit.receptie = receptieRij(s.code).filter(r => r.status !== 'klaar').slice(0, 40);
    if (VERWIJZERS.includes(soort))
      uit.verwijsDoelen = (db.data.suppliers || []).filter(x => AGENDAS.includes(x.type)).map(x => ({ code: x.code, naam: x.name, soort: x.type }));
    if (AGENDAS.includes(soort)) {
      uit.verwijzingen = h.verwijzingen.filter(v => v.naar === s.code).slice(0, 30);
      uit.afspraken = afspraakRij(s.code).slice(0, 30);
    }
    return uit;
  }

  // de gedeelde ctx voor de deelbestanden
  const ctx = { db, save, crypto, findSupplier, nu, schoon, bak, soortVan, sehRij, afspraakRij, receptieRij,
    VOORSCHRIJVERS, VERWIJZERS, AGENDAS, TRIAGE, SPREEKKAMERS };
  const api = { ZORG_TYPES, TRIAGE, zorgOverzicht };
  Object.assign(api, require('./keten')(ctx), require('./balie')(ctx));
  return { zorgketen: api };
};
module.exports.ZORG_TYPES = ZORG_TYPES;
