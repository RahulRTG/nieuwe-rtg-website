/* RTG Airport (kern/luchthaven.js): de gehele luchthavenoperatie in een systeem.
   Vluchtleiding (het bord, gates, vertragingen), de passagiersketen (boeken ->
   inchecken -> boarding pass op codenaam), de draai op het platform (brandstof,
   catering, schoonmaak, bagage, water en pushback), de bagagekelder (kofferketen
   met tags, vermist en gevonden), de toren (baanklaring: zonder klaring vertrekt
   er niets) en de security-filters met live wachttijden.

   De operationele regels zijn hard: een kist boardt pas als de draai rond is,
   vertrekt pas met klaring van de toren, en de keten draait nooit achteruit.
   De AI-operations denkt mee op het hele beeld; schakelen doet de mens.
   Privacy by design: passagiers reizen op codenaam, de echte naam blijft in de
   kluis. Personeel logt in via het eigen rooster (supplier LUCHT).
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
/* De lounges: het eigen systeem van de gastvrijheid op het veld. Binnen op
   vertoon van een geldige boarding pass; de Koninklijke Vleugel is uitsluitend
   voor gasten op een vlucht met een lopend vip-protocol. */
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
      db.data.supplierTypes.luchthaven = { label: 'Luchthaven', icon: '✈️', caps: ['luchthaven'] };
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

  /* ---------- vluchtleiding: het bord, gates en vertragingen ---------- */
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
  function vluchtMaak(actor, data) {
    data = data || {};
    const categorie = CATEGORIEEN[data.categorie] ? data.categorie : 'lijn';
    const plekken = plekkenVoor(categorie);
    if (data.gate && !plekken.includes(data.gate)) return { status: 400, error: 'Kies voor deze categorie een plek uit: ' + plekken.join(', ') + '.' };
    const gate = plekken.includes(data.gate) ? data.gate : plekken[0];
    const bezet = vluchten().some(v => actief(v) && v.gate === gate && v.datum === (data.datum || vandaag()) && v.tijd === data.tijd);
    if (bezet) return { status: 409, error: gate + ' is op dat moment al bezet.' };
    const v = _vluchtMaak(data);
    save();
    return { ok: true, vlucht: publiek(v) };
  }
  function vluchtStatus(actor, vid, status) {
    const v = vind(vid);
    if (!v) return { status: 404, error: 'Vlucht niet gevonden.' };
    if (status === 'geannuleerd') {
      if (!actief(v)) return { status: 409, error: 'Deze vlucht is al ' + v.status + '.' };
      v.status = 'geannuleerd'; save();
      return { ok: true, vlucht: publiek(v) };
    }
    const k = keten(v);
    if (!k.includes(status)) return { status: 400, error: 'Onbekende status voor deze vlucht (' + k.join(' -> ') + ').' };
    const van = k.indexOf(v.status), naar = k.indexOf(status);
    if (v.status === 'geannuleerd') return { status: 409, error: 'Een geannuleerde vlucht komt niet terug op het bord.' };
    if (naar <= van) return { status: 409, error: 'De keten draait niet achteruit (' + k.join(' -> ') + ').' };
    if (naar > van + 1) return { status: 409, error: 'Stap voor stap: na ' + v.status + ' komt ' + k[van + 1] + '.' };
    // de operationele grendels
    if (status === 'boarding' && !draaiRond(v)) return { status: 409, error: 'Een kist boardt pas als de draai rond is; er staan nog platformtaken open.' };
    const vip = vipVan(v);
    if (status === 'boarding' && vip && !vipRond(vip)) return { status: 409, error: 'De Koninklijke Vleugel is nog niet gereed; eerst het vip-protocol afronden.' };
    if (status === 'vertrokken' && !v.klaring) return { status: 409, error: 'Zonder klaring van de toren vertrekt er niets.' };
    if (status === 'geland') { v.band = BANDEN[(vluchten().filter(x => x.band).length) % BANDEN.length]; }
    if (status === 'bagage-op-band') {
      for (const kf of L().koffers) if (kf.vluchtId === v.id && kf.status === 'geladen') { kf.status = 'op-band'; kf.band = v.band; }
    }
    v.status = status;
    save();
    return { ok: true, vlucht: publiek(v) };
  }
  function vluchtVertraag(actor, vid, minuten, reden) {
    const v = vind(vid);
    if (!v) return { status: 404, error: 'Vlucht niet gevonden.' };
    if (!actief(v)) return { status: 409, error: 'Deze vlucht is al ' + v.status + '.' };
    const m = Math.round(Number(minuten) || 0);
    if (m < 5 || m > 720) return { status: 400, error: 'Een vertraging is 5 tot 720 minuten.' };
    const [uu, mm] = v.tijd.split(':').map(Number);
    const t = new Date(2000, 0, 1, uu, mm + m);
    v.tijd = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    v.vertraging = { minuten: (v.vertraging ? v.vertraging.minuten : 0) + m, reden: schoon(reden, 120) || 'operationele redenen', door: actor || 'vluchtleiding', at: nu() };
    save();
    return { ok: true, vlucht: publiek(v) };
  }
  function vluchtGate(actor, vid, gate) {
    const v = vind(vid);
    if (!v) return { status: 404, error: 'Vlucht niet gevonden.' };
    if (!GATES.includes(gate)) return { status: 400, error: 'Kies een bestaande gate (' + GATES.join(', ') + ').' };
    const bezet = vluchten().some(x => x.id !== v.id && actief(x) && x.gate === gate && x.datum === v.datum);
    if (bezet) return { status: 409, error: 'Gate ' + gate + ' is vandaag al bezet.' };
    v.gate = gate; save();
    return { ok: true, vlucht: publiek(v) };
  }
  function bord(filter) {
    filter = filter || {};
    let lijst = vluchten().filter(v => v.datum >= vandaag());
    if (filter.soort === 'vertrek' || filter.soort === 'aankomst') lijst = lijst.filter(v => v.soort === filter.soort);
    lijst = lijst.slice().sort((a, b) => (a.datum + a.tijd).localeCompare(b.datum + b.tijd));
    return { ok: true, gates: GATES, banen: BANEN, vluchten: lijst.slice(0, 80).map(publiek),
      security: L().security.map(f => ({ id: f.id, naam: f.naam, open: f.open, wachtMinuten: f.wachtMinuten })) };
  }

  /* ---------- de passagiersketen: boeken, inchecken, boarding pass ---------- */
  function boek(sess, codenaam, vid, data) {
    data = data || {};
    const v = vind(vid);
    if (!v || v.soort !== 'vertrek') return { status: 404, error: 'Vlucht niet gevonden.' };
    if (!['gepland', 'inchecken'].includes(v.status)) return { status: 409, error: 'Deze vlucht is niet meer te boeken (' + v.status + ').' };
    if (L().boekingen.some(b => b.key === sess.key && b.vluchtId === v.id && b.status !== 'geannuleerd'))
      return { status: 409, error: 'Je staat al op deze vlucht.' };
    const b = { id: id('bk'), code: 'VL-' + crypto.randomBytes(3).toString('hex').toUpperCase(), vluchtId: v.id,
      key: sess.key, codenaam: schoon(codenaam, 60) || 'Reiziger', status: 'geboekt', stoel: null, koffers: 0, at: nu() };
    L().boekingen.unshift(b);
    L().boekingen = L().boekingen.slice(0, 50000);
    save();
    return { ok: true, boeking: { code: b.code, vlucht: publiek(v), status: b.status } };
  }
  function incheck(sess, code, data) {
    data = data || {};
    const b = L().boekingen.find(x => x.code === String(code || '').toUpperCase() && x.key === sess.key);
    if (!b) return { status: 404, error: 'Boeking niet gevonden.' };
    const v = vind(b.vluchtId);
    if (!v) return { status: 404, error: 'Vlucht niet gevonden.' };
    if (v.status === 'gepland') return { status: 409, error: 'Het inchecken voor ' + v.nummer + ' is nog niet open.' };
    if (v.status !== 'inchecken') return { status: 409, error: 'Het inchecken voor ' + v.nummer + ' is gesloten (' + v.status + ').' };
    if (b.status === 'ingecheckt') return { status: 409, error: 'Je bent al ingecheckt (stoel ' + b.stoel + ').' };
    const stoelen = L().boekingen.filter(x => x.vluchtId === v.id && x.stoel).length;
    b.stoel = (Math.floor(stoelen / 6) + 1) + 'ABCDEF'[stoelen % 6];
    b.status = 'ingecheckt';
    b.koffers = Math.min(3, Math.max(0, Math.round(Number(data.koffers) || 0)));
    const tags = [];
    for (let i = 0; i < b.koffers; i++) {
      const kf = { tag: 'RTG-' + crypto.randomBytes(3).toString('hex').toUpperCase(), vluchtId: v.id, boekingId: b.id,
        codenaam: b.codenaam, status: 'ingecheckt', band: null, at: nu() };
      L().koffers.unshift(kf);
      tags.push(kf.tag);
    }
    L().koffers = L().koffers.slice(0, 100000);
    save();
    return { ok: true, pass: { code: b.code, vlucht: v.nummer, bestemming: v.bestemming, datum: v.datum, tijd: v.tijd,
      gate: v.gate, stoel: b.stoel, naam: b.codenaam, koffers: tags } };
  }
  function mijn(key) {
    seed();
    const uit = [];
    for (const b of L().boekingen.filter(x => x.key === key).slice(0, 20)) {
      const v = vind(b.vluchtId);
      if (!v) continue;
      uit.push({ code: b.code, status: b.status, stoel: b.stoel, vlucht: publiek(v),
        koffers: L().koffers.filter(k => k.boekingId === b.id).map(k => ({ tag: k.tag, status: k.status, band: k.band })) });
    }
    return { ok: true, boekingen: uit, charters: mijnCharters(key) };
  }

  /* ---------- het platform: de draai per vertrekkende kist ---------- */
  function draaiTaak(actor, vid, taak) {
    const v = vind(vid);
    if (!v || v.soort !== 'vertrek') return { status: 404, error: 'Vlucht niet gevonden.' };
    if (!draaiTakenVoor(v).includes(taak)) return { status: 400, error: 'Deze platformtaak hoort niet bij een ' + catVan(v) + ' (' + draaiTakenVoor(v).join(', ') + ').' };
    if (!actief(v)) return { status: 409, error: 'Deze vlucht is al ' + v.status + '.' };
    if (v.draai[taak]) return { status: 409, error: 'Deze taak is al afgevinkt.' };
    v.draai[taak] = { door: actor || 'platform', at: nu() };
    save();
    return { ok: true, vlucht: publiek(v), rond: draaiRond(v) };
  }

  /* ---------- de toren: baanklaring (de mens in de toren beslist) ---------- */
  function torenKlaring(actor, vid, baan) {
    const v = vind(vid);
    if (!v || v.soort !== 'vertrek') return { status: 404, error: 'Vlucht niet gevonden.' };
    if (v.klaring) return { status: 409, error: 'Deze vlucht heeft al klaring (baan ' + v.klaring.baan + ').' };
    if (v.status !== 'boarding') return { status: 409, error: 'Klaring volgt pas als de kist aan het boarden is.' };
    // een helikopter krijgt klaring op een helipad, al het andere op een baan
    const keuze = catVan(v) === 'helikopter' ? HELIPADS : BANEN;
    if (!keuze.includes(baan)) return { status: 400, error: 'Kies voor een ' + catVan(v) + ' een klaring op: ' + keuze.join(', ') + '.' };
    v.klaring = { baan, door: actor || 'toren', at: nu() };
    save();
    return { ok: true, vlucht: publiek(v) };
  }

  /* ---------- de bagagekelder: de kofferketen ---------- */
  function bagage(filter) {
    seed(); filter = filter || {};
    let lijst = L().koffers;
    if (KOFFER_KETEN.includes(filter.status) || filter.status === 'vermist') lijst = lijst.filter(k => k.status === filter.status);
    return { ok: true, keten: KOFFER_KETEN, koffers: lijst.slice(0, 200).map(k => {
      const v = vind(k.vluchtId);
      return { tag: k.tag, vlucht: v ? v.nummer : '?', codenaam: k.codenaam, status: k.status, band: k.band };
    }) };
  }
  function bagageZet(actor, tag, status) {
    const k = L().koffers.find(x => x.tag === String(tag || '').toUpperCase());
    if (!k) return { status: 404, error: 'Koffer niet gevonden.' };
    if (status === 'vermist') {
      if (k.status === 'opgehaald') return { status: 409, error: 'Deze koffer is al opgehaald.' };
      k.status = 'vermist'; save();
      return { ok: true, koffer: { tag: k.tag, status: k.status } };
    }
    if (k.status === 'vermist' && status === 'op-band') { k.status = 'op-band'; save(); return { ok: true, koffer: { tag: k.tag, status: k.status }, gevonden: true }; }
    if (!KOFFER_KETEN.includes(status)) return { status: 400, error: 'Onbekende kofferstatus.' };
    const van = KOFFER_KETEN.indexOf(k.status), naar = KOFFER_KETEN.indexOf(status);
    if (naar <= van) return { status: 409, error: 'De bagageketen draait niet achteruit.' };
    if (naar > van + 1) return { status: 409, error: 'Stap voor stap: na ' + k.status + ' komt ' + KOFFER_KETEN[van + 1] + '.' };
    k.status = status;
    save();
    return { ok: true, koffer: { tag: k.tag, status: k.status } };
  }

  /* ---------- het charterloket: privejets en helikopters op aanvraag ----------
     Een lid vraagt een charter aan (privejet of helikopter, bestemming en
     moment); OPERATIONS beslist -- nooit de AI en nooit automatisch. Bij een
     bevestiging komt de vlucht meteen op het bord (met vrije stand of helipad)
     en staat de aanvrager erop geboekt; inchecken gaat daarna gewoon via de
     eigen keten. */
  function charterVraag(sess, codenaam, data) {
    data = data || {};
    const soort = ['privejet', 'helikopter'].includes(data.soort) ? data.soort : null;
    if (!soort) return { status: 400, error: 'Kies een privejet of een helikopter.' };
    const bestemming = schoon(data.bestemming, 60);
    if (bestemming.length < 2) return { status: 400, error: 'Waar wilt u heen?' };
    const ch = { id: id('ch'), code: 'CH-' + crypto.randomBytes(3).toString('hex').toUpperCase(), soort, bestemming,
      datum: /^\d{4}-\d{2}-\d{2}$/.test(String(data.datum || '')) ? data.datum : vandaag(),
      tijd: /^\d{2}:\d{2}$/.test(String(data.tijd || '')) ? data.tijd : '12:00',
      key: sess.key, codenaam: schoon(codenaam, 60) || 'Reiziger', status: 'aangevraagd', vluchtId: null, at: nu() };
    L().charters.unshift(ch);
    L().charters = L().charters.slice(0, 20000);
    save();
    return { ok: true, charter: { code: ch.code, soort, bestemming, datum: ch.datum, tijd: ch.tijd, status: ch.status } };
  }
  function charterLijst() {
    seed();
    return { ok: true, charters: L().charters.slice(0, 60).map(c => ({ id: c.id, code: c.code, soort: c.soort,
      icoon: CATEGORIEEN[c.soort], bestemming: c.bestemming, datum: c.datum, tijd: c.tijd, van: c.codenaam, status: c.status })) };
  }
  function charterBeslis(actor, cid, akkoord) {
    const ch = L().charters.find(x => x.id === String(cid || ''));
    if (!ch) return { status: 404, error: 'Charteraanvraag niet gevonden.' };
    if (ch.status !== 'aangevraagd') return { status: 409, error: 'Deze aanvraag is al ' + ch.status + '.' };
    if (!akkoord) { ch.status = 'afgewezen'; save(); return { ok: true, charter: { code: ch.code, status: ch.status } }; }
    // een vrije stand of helipad zoeken voor dat moment
    const plekken = plekkenVoor(ch.soort);
    const plek = plekken.find(p => !vluchten().some(v => actief(v) && v.gate === p && v.datum === ch.datum && v.tijd === ch.tijd));
    if (!plek) return { status: 409, error: 'Geen vrije ' + (ch.soort === 'helikopter' ? 'helipad' : 'stand') + ' op dat moment; stel een andere tijd voor.' };
    const v = _vluchtMaak({ nummer: (ch.soort === 'helikopter' ? 'RH' : 'RJ') + Math.floor(100 + Math.random() * 900),
      soort: 'vertrek', categorie: ch.soort, bestemming: ch.bestemming, datum: ch.datum, tijd: ch.tijd, gate: plek,
      toestel: ch.soort === 'helikopter' ? 'RTG-H1' : 'RTG-J1' });
    v.status = 'inchecken';
    ch.status = 'bevestigd'; ch.vluchtId = v.id; ch.door = actor || 'operations';
    const b = { id: id('bk'), code: 'VL-' + crypto.randomBytes(3).toString('hex').toUpperCase(), vluchtId: v.id,
      key: ch.key, codenaam: ch.codenaam, status: 'geboekt', stoel: null, koffers: 0, at: nu() };
    L().boekingen.unshift(b);
    save();
    return { ok: true, charter: { code: ch.code, status: ch.status }, vlucht: publiek(v), boeking: { code: b.code } };
  }
  function mijnCharters(key) {
    return L().charters.filter(c => c.key === key).slice(0, 10).map(c => {
      const v = c.vluchtId ? vind(c.vluchtId) : null;
      return { code: c.code, soort: c.soort, icoon: CATEGORIEEN[c.soort], bestemming: c.bestemming,
        datum: c.datum, tijd: c.tijd, status: c.status, vlucht: v ? v.nummer : null };
    });
  }

  /* ---------- de Koninklijke Vleugel: vips onder protocolnaam ---------- */
  function vipMaak(actor, data) {
    data = data || {};
    const v = vind(String(data.vlucht || ''));
    if (!v || v.soort !== 'vertrek') return { status: 404, error: 'Vlucht niet gevonden.' };
    if (!actief(v)) return { status: 409, error: 'Deze vlucht is al ' + v.status + '.' };
    if (vipVan(v)) return { status: 409, error: 'Op deze vlucht loopt al een vip-protocol.' };
    const soort = VIP_SOORTEN.includes(data.soort) ? data.soort : 'vip';
    const protocolnaam = schoon(data.protocolnaam, 60);
    if (protocolnaam.length < 2) return { status: 400, error: 'Geef de gast een protocolnaam (nooit de echte naam).' };
    const vip = { id: id('vip'), vluchtId: v.id, protocolnaam, soort,
      suite: soort === 'vip' ? 'Suite Uno' : 'Suite Royale', protocol: {}, door: actor || 'protocol', at: nu() };
    L().vips.unshift(vip);
    L().vips = L().vips.slice(0, 5000);
    save();
    return { ok: true, vip: vipPubliek(vip) };
  }
  function vipPubliek(vip) {
    const v = vind(vip.vluchtId);
    return { id: vip.id, protocolnaam: vip.protocolnaam, soort: vip.soort, suite: vip.suite,
      vlucht: v ? v.nummer : '?', tijd: v ? v.tijd : '', rond: vipRond(vip),
      protocol: VIP_PROTOCOL.map(s => ({ stap: s, klaar: !!vip.protocol[s] })) };
  }
  function vipLijst() {
    seed();
    return { ok: true, soorten: VIP_SOORTEN, vips: L().vips.slice(0, 40).map(vipPubliek) };
  }
  function vipTaak(actor, vid2, stap) {
    const vip = L().vips.find(x => x.id === String(vid2 || ''));
    if (!vip) return { status: 404, error: 'Vip-protocol niet gevonden.' };
    if (!VIP_PROTOCOL.includes(stap)) return { status: 400, error: 'Onbekende protocolstap.' };
    if (vip.protocol[stap]) return { status: 409, error: 'Deze stap is al afgevinkt.' };
    vip.protocol[stap] = { door: actor || 'protocol', at: nu() };
    save();
    return { ok: true, vip: vipPubliek(vip), rond: vipRond(vip) };
  }

  /* ---------- de luchtzijde-partners: een boarding pass aan de deur ----------
     Elke zaak met de luchtzijde-stand aan (winkel, bar, lounge op de
     luchthaven) checkt hiermee de pass van de gast: geldig is ingecheckt,
     voor een vlucht van vandaag die nog niet weg is. */
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

  /* ---------- de lounges: gastvrijheid op vertoon van de boarding pass ---------- */
  function loungeIn(actor, loungeId, passCode) {
    const lounge = LOUNGES[String(loungeId || '')];
    if (!lounge) return { status: 400, error: 'Kies een lounge (salon of royal).' };
    const check = passCheck(passCode);
    if (!check.geldig) return { status: 409, error: 'Geen geldige boarding pass: ' + (check.reden || 'onbekend.') };
    const b = L().boekingen.find(x => x.code === String(passCode || '').trim().toUpperCase());
    const v = vind(b.vluchtId);
    if (String(loungeId) === 'royal' && !vipVan(v))
      return { status: 403, error: 'De Koninklijke Vleugel is uitsluitend voor gasten op een vlucht met een vip-protocol.' };
    if (L().lounge.some(g => g.boekingId === b.id && !g.uit))
      return { status: 409, error: 'Deze gast is al binnen.' };
    const binnen = L().lounge.filter(g => g.lounge === loungeId && !g.uit).length;
    if (binnen >= lounge.capaciteit) return { status: 409, error: lounge.naam + ' zit vol (' + lounge.capaciteit + ' plaatsen).' };
    const g = { id: id('lg'), lounge: String(loungeId), boekingId: b.id, codenaam: b.codenaam,
      vlucht: v.nummer, tijd: v.tijd, door: actor || 'lounge', in: nu(), uit: null };
    L().lounge.unshift(g);
    L().lounge = L().lounge.slice(0, 20000);
    save();
    return { ok: true, gast: g, lounge: lounge.naam };
  }
  function loungeUit(actor, gid) {
    const g = L().lounge.find(x => x.id === String(gid || ''));
    if (!g) return { status: 404, error: 'Gast niet gevonden.' };
    if (g.uit) return { status: 409, error: 'Deze gast is al uitgecheckt.' };
    g.uit = nu(); g.uitDoor = actor || 'lounge';
    save();
    return { ok: true, gast: g };
  }
  function loungeStand() {
    seed();
    return { ok: true, lounges: Object.entries(LOUNGES).map(([lid2, l]) => ({
      id: lid2, naam: l.naam, capaciteit: l.capaciteit,
      binnen: L().lounge.filter(g => g.lounge === lid2 && !g.uit).length,
      gasten: L().lounge.filter(g => g.lounge === lid2 && !g.uit).slice(0, 60)
        .map(g => ({ id: g.id, codenaam: g.codenaam, vlucht: g.vlucht, tijd: g.tijd, in: g.in }))
    })) };
  }

  /* ---------- security: de filters met live wachttijden ---------- */
  function securityZet(actor, fid, data) {
    data = data || {};
    const f = L().security.find(x => x.id === String(fid || ''));
    if (!f) return { status: 404, error: 'Filter niet gevonden.' };
    if (typeof data.open === 'boolean') f.open = data.open;
    if (data.wachtMinuten != null) {
      const w = Math.round(Number(data.wachtMinuten));
      if (!Number.isFinite(w) || w < 0 || w > 180) return { status: 400, error: 'Wachttijd in minuten (0-180).' };
      f.wachtMinuten = w;
    }
    save();
    return { ok: true, filter: { id: f.id, naam: f.naam, open: f.open, wachtMinuten: f.wachtMinuten } };
  }

  /* ---------- de cockpit + AI-operations ---------- */
  function cockpit() {
    seed();
    const d = vandaag();
    const vandaagV = vluchten().filter(v => v.datum === d);
    const signalen = [];
    for (const v of vandaagV) {
      if (v.soort === 'vertrek' && ['inchecken', 'boarding'].includes(v.status) && !draaiRond(v)) {
        const open = DRAAI_TAKEN.filter(t => !v.draai[t]);
        signalen.push({ soort: 'draai', vlucht: v.nummer, tekst: v.nummer + ' (' + v.tijd + '): de draai is niet rond; open: ' + open.join(', ') + '.' });
      }
      if (v.status === 'boarding' && !v.klaring)
        signalen.push({ soort: 'toren', vlucht: v.nummer, tekst: v.nummer + ' boardt maar heeft nog geen baanklaring van de toren.' });
      if (v.vertraging && v.vertraging.minuten >= 60)
        signalen.push({ soort: 'vertraging', vlucht: v.nummer, tekst: v.nummer + ' heeft ' + v.vertraging.minuten + ' minuten vertraging (' + v.vertraging.reden + ').' });
    }
    const dichteFilters = L().security.filter(f => !f.open).length;
    const drukte = L().security.filter(f => f.open && f.wachtMinuten > 20);
    for (const f of drukte) signalen.push({ soort: 'security', vlucht: '', tekst: f.naam + ': ' + f.wachtMinuten + ' minuten wachten; overweeg een extra filter te openen.' });
    for (const c of L().charters.filter(x => x.status === 'aangevraagd').slice(0, 5))
      signalen.push({ soort: 'charter', vlucht: c.code, tekst: 'Charteraanvraag ' + c.code + ' (' + c.soort + ' naar ' + c.bestemming + ') wacht op een besluit van operations.' });
    for (const vip of L().vips) {
      const v = vind(vip.vluchtId);
      if (v && actief(v) && ['inchecken', 'boarding'].includes(v.status) && !vipRond(vip))
        signalen.push({ soort: 'vip', vlucht: v.nummer, tekst: v.nummer + ': het vip-protocol (' + vip.soort + ', ' + vip.suite + ') is nog niet rond.' });
    }
    return { ok: true,
      vluchtenVandaag: vandaagV.length,
      vertrokken: vandaagV.filter(v => v.status === 'vertrokken').length,
      geland: vandaagV.filter(v => ['geland', 'bagage-op-band', 'afgerond'].includes(v.status)).length,
      vertraagd: vandaagV.filter(v => v.vertraging).length,
      ingecheckt: L().boekingen.filter(b => b.status === 'ingecheckt').length,
      koffersInSysteem: L().koffers.filter(k => !['opgehaald'].includes(k.status)).length,
      koffersVermist: L().koffers.filter(k => k.status === 'vermist').length,
      chartersWachtend: L().charters.filter(x => x.status === 'aangevraagd').length,
      vipsActief: L().vips.filter(vip => { const v = vind(vip.vluchtId); return v && actief(v); }).length,
      loungeGasten: L().lounge.filter(g => !g.uit).length,
      dichteFilters, signalen: signalen.slice(0, 40),
      gates: GATES, stands: STANDS, helipads: HELIPADS, banen: BANEN,
      categorieen: CATEGORIEEN, draaiTaken: DRAAI_TAKEN, vipProtocol: VIP_PROTOCOL, vipSoorten: VIP_SOORTEN };
  }
  async function luchtAI(vraag) {
    const c = cockpit();
    const beeld = c.vluchtenVandaag + ' vluchten vandaag (' + c.vertrokken + ' vertrokken, ' + c.geland + ' geland, ' + c.vertraagd + ' vertraagd), ' +
      c.ingecheckt + ' passagiers ingecheckt, ' + c.koffersInSysteem + ' koffers in het systeem (' + c.koffersVermist + ' vermist), ' +
      c.dichteFilters + ' security-filter(s) dicht. Signalen: ' +
      (c.signalen.length ? c.signalen.slice(0, 5).map(s => s.tekst).join(' | ') : 'geen') + '.';
    const q = schoon(vraag, 400);
    if (anthropic && q) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 350,
          system: require('./rahul').RAHUL_LEAD + 'je bent de AI-operations van RTG Airport. Je adviseert de vluchtleiding, het platform, de toren, ' +
            'de bagagekelder en security over de operatie van vandaag, kort en beslist. Je adviseert ALLEEN: elke schakeling (status, klaring, ' +
            'vertraging, filter) doet een mens. Veiligheid gaat altijd voor snelheid. Huidige beeld: ' + beeld,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = r.content && r.content[0] && r.content[0].text;
        if (tekst) return { ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { ok: true, demo: true, antwoord: 'Het beeld van nu: ' + beeld + ' Mijn advies: werk eerst de open draai-taken van de eerstvolgende vertrekker af, dan de klaringen. Veiligheid voor snelheid; schakelen doet u zelf.' };
  }

  return { lucht: { seed, isLucht, cockpit, bord, vluchtMaak, vluchtStatus, vluchtVertraag, vluchtGate,
    boek, incheck, mijn, draaiTaak, torenKlaring, bagage, bagageZet, securityZet, luchtAI, passCheck,
    charterVraag, charterLijst, charterBeslis, vipMaak, vipLijst, vipTaak, loungeIn, loungeUit, loungeStand,
    GATES, STANDS, HELIPADS, BANEN, DRAAI_TAKEN, KOFFER_KETEN, VIP_PROTOCOL } };
}

module.exports = { maakLuchthaven };
