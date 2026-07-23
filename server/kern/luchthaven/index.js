/* RTG Airport (kern/luchthaven): de gehele luchthavenoperatie in een systeem.
   De operationele regels zijn hard: een kist boardt pas als de draai rond is,
   vertrekt pas met klaring van de toren, en de keten draait nooit achteruit.
   De AI-operations denkt mee op het hele beeld; schakelen doet de mens.
   Privacy by design: passagiers reizen op codenaam, de echte naam blijft in de
   kluis. Personeel logt in via het eigen rooster (supplier LUCHT).

   Dit is de spil: het veld (constanten), de staat, de seed, de gedeelde
   helpers (ketens, draai, vip, publiek beeld, passCheck) en de ctx voor de
   deelbestanden. Wat waar woont:
     ./vluchten   vluchtleiding (bord, gates, vertragingen) en de
                  passagiersketen (boeken, inchecken, mijn reizen)
     ./grond      het platform (de draai), de toren (klaring), de
                  bagagekelder, security, de cockpit en de AI-operations
     ./royaal     het charterloket (operations beslist), de Koninklijke
                  Vleugel (vips onder protocolnaam) en de lounges
   Vast patroon: maakLuchthaven(state) -> { lucht: api }. */

const GATES = ['A1', 'A2', 'A3', 'B1', 'B2', 'C1'];
const STANDS = ['P1', 'P2', 'P3'];          // general aviation: de privejets
const HELIPADS = ['H1', 'H2'];              // de helikopters landen en vertrekken hier
const BANEN = ['06/24', '13/31'];
const BANDEN = [1, 2, 3, 4];
/* Drie categorieen op een veld: de lijnvluchten, de privejets (GA-stands, een
   lichtere draai) en de helikopters (helipads, de lichtste draai; de klaring
   van de toren is een helipad in plaats van een baan). */
const CATEGORIEEN = { lijn: '✈️', privejet: '🛩️', helikopter: '🚁' };
const DRAAI_LICHT = {
  privejet: ['brandstof', 'catering', 'schoonmaak', 'pushback-gereed'],
  helikopter: ['brandstof', 'schoonmaak', 'pushback-gereed']
};
/* De Koninklijke Vleugel: koninklijke gasten, staatsbezoeken en vips reizen
   onder PROTOCOLNAAM (nooit de echte naam; privacy by design) met een vast
   protocol. Een vip-vlucht boardt pas als het protocol rond is. */
const VIP_SOORTEN = ['koninklijk', 'staatsbezoek', 'vip'];
const VIP_PROTOCOL = ['suite-gereed', 'security-sweep', 'protocol-officier', 'motorcade', 'discrete-boarding'];
/* De lounges: binnen op vertoon van een geldige boarding pass; de Koninklijke
   Vleugel is uitsluitend voor gasten op een vlucht met een lopend vip-protocol. */
const LOUNGES = {
  salon: { naam: 'Salon Lounge', capaciteit: 40 },
  royal: { naam: 'De Koninklijke Vleugel', capaciteit: 8 }
};
const VERTREK_KETEN = ['gepland', 'inchecken', 'boarding', 'vertrokken'];
const AANKOMST_KETEN = ['onderweg', 'geland', 'bagage-op-band', 'afgerond'];
const DRAAI_TAKEN = ['brandstof', 'catering', 'schoonmaak', 'bagage-laden', 'water-en-afval', 'pushback-gereed'];
const KOFFER_KETEN = ['ingecheckt', 'gesorteerd', 'geladen', 'op-band', 'opgehaald'];
const FILTERS = [
  { id: 'f1', naam: 'Filter 1 (algemeen)' },
  { id: 'f2', naam: 'Filter 2 (algemeen)' },
  { id: 'fp', naam: 'Priority (Lifestyle en Business)' }
];

function maakLuchthaven({ db, save, crypto, anthropic }) {
  const nu = () => new Date().toISOString();
  const id = p => (p || 'x') + crypto.randomBytes(4).toString('hex');
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const vandaag = () => new Date().toISOString().slice(0, 10);

  function L() {
    if (!db.data.luchthaven || typeof db.data.luchthaven !== 'object')
      db.data.luchthaven = { vluchten: [], boekingen: [], koffers: [], security: [], charters: [], vips: [], lounge: [] };
    const l = db.data.luchthaven;
    for (const k of ['vluchten', 'boekingen', 'koffers', 'security', 'charters', 'vips', 'lounge']) if (!Array.isArray(l[k])) l[k] = [];
    return l;
  }

  function seed() {
    if (!Array.isArray(db.data.suppliers)) return;
    if (!db.data.supplierTypes.luchthaven)
      db.data.supplierTypes.luchthaven = { label: 'Luchthaven', icon: 'vluchten', caps: ['luchthaven'] };
    if (!db.data.suppliers.find(s => s.code === 'LUCHT')) {
      db.data.suppliers.push({
        code: 'LUCHT', name: 'RTG Airport', type: 'luchthaven', city: 'Ibiza',
        loc: { lat: 38.873, lng: 1.373, label: 'RTG Airport' }, rate: 0, menu: [], photos: [], luchthaven: {}
      });
    }
    const l = L();
    if (!l.security.length) {
      for (const f of FILTERS) l.security.push({ id: f.id, naam: f.naam, open: f.id !== 'f2', wachtMinuten: f.id === 'fp' ? 2 : 8 });
    }
    if (!l._seed) {
      l._seed = true;
      const d = vandaag();
      _vluchtMaak({ nummer: 'RT101', soort: 'vertrek', bestemming: 'Amsterdam', datum: d, tijd: '17:30', gate: 'A1', toestel: 'RTG-01' });
      const v2 = _vluchtMaak({ nummer: 'RT205', soort: 'vertrek', bestemming: 'Parijs Le Bourget', datum: d, tijd: '19:15', gate: 'B1', toestel: 'RTG-02' });
      v2.status = 'inchecken';
      _vluchtMaak({ nummer: 'RT418', soort: 'aankomst', bestemming: 'Ibiza (uit Geneve)', datum: d, tijd: '16:40', gate: 'C1', toestel: 'RTG-03' });
      save();
    }
  }
  const isLucht = s => !!(s && s.type === 'luchthaven');

  const vluchten = () => { seed(); return L().vluchten; };
  const vind = vid => vluchten().find(v => v.id === vid || v.nummer === String(vid || '').toUpperCase());
  const actief = v => !['vertrokken', 'afgerond', 'geannuleerd'].includes(v.status);
  const keten = v => v.soort === 'aankomst' ? AANKOMST_KETEN : VERTREK_KETEN;
  const catVan = v => CATEGORIEEN[v.categorie] ? v.categorie : 'lijn';
  const plekkenVoor = cat => cat === 'helikopter' ? HELIPADS : cat === 'privejet' ? STANDS : GATES;
  const draaiTakenVoor = v => DRAAI_LICHT[catVan(v)] || DRAAI_TAKEN;
  const draaiRond = v => draaiTakenVoor(v).every(t => v.draai && v.draai[t]);
  const vipVan = v => L().vips.find(x => x.vluchtId === v.id);
  const vipRond = vip => VIP_PROTOCOL.every(s => vip.protocol && vip.protocol[s]);

  function publiek(v) {
    const vip = vipVan(v);
    return { id: v.id, nummer: v.nummer, soort: v.soort, categorie: catVan(v), icoon: CATEGORIEEN[catVan(v)],
      bestemming: v.bestemming, datum: v.datum, tijd: v.tijd,
      gate: v.gate, toestel: v.toestel, status: v.status, vertraging: v.vertraging || null,
      draai: v.soort === 'vertrek' ? { klaar: draaiRond(v), taken: draaiTakenVoor(v).map(t => ({ taak: t, klaar: !!(v.draai && v.draai[t]) })) } : null,
      vip: vip ? { soort: vip.soort, suite: vip.suite, rond: vipRond(vip) } : null,
      klaring: v.klaring || null, band: v.band || null, geannuleerd: v.status === 'geannuleerd' };
  }

  function _vluchtMaak(data) {
    const categorie = CATEGORIEEN[data.categorie] ? data.categorie : 'lijn';
    const plekken = plekkenVoor(categorie);
    const v = { id: id('vl'), nummer: schoon(data.nummer, 8).toUpperCase() || 'RT' + Math.floor(100 + Math.random() * 900),
      soort: data.soort === 'aankomst' ? 'aankomst' : 'vertrek', categorie,
      bestemming: schoon(data.bestemming, 60) || 'Onbekend', datum: /^\d{4}-\d{2}-\d{2}$/.test(String(data.datum || '')) ? data.datum : vandaag(),
      tijd: /^\d{2}:\d{2}$/.test(String(data.tijd || '')) ? data.tijd : '12:00',
      gate: plekken.includes(data.gate) ? data.gate : plekken[0], toestel: schoon(data.toestel, 20) || 'RTG-0X',
      status: data.soort === 'aankomst' ? 'onderweg' : 'gepland', draai: {}, klaring: null, vertraging: null, band: null, at: nu() };
    L().vluchten.unshift(v);
    L().vluchten = L().vluchten.slice(0, 5000);
    return v;
  }

  /* De luchtzijde-partners: elke zaak met de luchtzijde-stand aan checkt
     hiermee de boarding pass van de gast: geldig is ingecheckt, voor een
     vlucht van vandaag die nog niet weg is. */
  function passCheck(code) {
    seed();
    const b = L().boekingen.find(x => x.code === String(code || '').trim().toUpperCase());
    if (!b) return { ok: true, geldig: false, reden: 'Deze code kennen we niet.' };
    const v = vind(b.vluchtId);
    if (!v) return { ok: true, geldig: false, reden: 'De vlucht bestaat niet meer.' };
    if (b.status !== 'ingecheckt') return { ok: true, geldig: false, reden: 'Deze reiziger is nog niet ingecheckt.' };
    if (v.status === 'geannuleerd') return { ok: true, geldig: false, reden: 'De vlucht is geannuleerd.' };
    if (v.status === 'vertrokken') return { ok: true, geldig: false, reden: 'Deze vlucht is al vertrokken.' };
    if (v.datum !== vandaag()) return { ok: true, geldig: false, reden: 'Deze boarding pass is niet van vandaag (' + v.datum + ').' };
    return { ok: true, geldig: true, pass: { naam: b.codenaam, vlucht: v.nummer, bestemming: v.bestemming, tijd: v.tijd, gate: v.gate, stoel: b.stoel } };
  }

  // de gedeelde ctx voor de deelbestanden
  const ctx = { db, save, crypto, anthropic, nu, id, schoon, vandaag,
    L, seed, vluchten, vind, actief, keten, catVan, plekkenVoor, draaiTakenVoor, draaiRond,
    vipVan, vipRond, publiek, _vluchtMaak, passCheck,
    GATES, STANDS, HELIPADS, BANEN, BANDEN, CATEGORIEEN, LOUNGES,
    VERTREK_KETEN, AANKOMST_KETEN, DRAAI_TAKEN, KOFFER_KETEN, VIP_SOORTEN, VIP_PROTOCOL };
  const royaal = require('./royaal')(ctx);
  // mijn reizen (in ./vluchten) toont ook de eigen charteraanvragen
  ctx.mijnCharters = royaal.mijnCharters;
  const api = { seed, isLucht, passCheck,
    GATES, STANDS, HELIPADS, BANEN, DRAAI_TAKEN, KOFFER_KETEN, VIP_PROTOCOL };
  Object.assign(api, require('./vluchten')(ctx));
  Object.assign(api, require('./grond')(ctx));
  Object.assign(api, royaal);
  delete api.mijnCharters; // intern; de leden zien hem via mijn()
  return { lucht: api };
}

module.exports = { maakLuchthaven };
