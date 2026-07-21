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
const BANEN = ['06/24', '13/31'];
const BANDEN = [1, 2, 3, 4];
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
      db.data.luchthaven = { vluchten: [], boekingen: [], koffers: [], security: [] };
    const l = db.data.luchthaven;
    for (const k of ['vluchten', 'boekingen', 'koffers', 'security']) if (!Array.isArray(l[k])) l[k] = [];
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
  const draaiRond = v => DRAAI_TAKEN.every(t => v.draai && v.draai[t]);

  function publiek(v) {
    return { id: v.id, nummer: v.nummer, soort: v.soort, bestemming: v.bestemming, datum: v.datum, tijd: v.tijd,
      gate: v.gate, toestel: v.toestel, status: v.status, vertraging: v.vertraging || null,
      draai: v.soort === 'vertrek' ? { klaar: draaiRond(v), taken: DRAAI_TAKEN.map(t => ({ taak: t, klaar: !!(v.draai && v.draai[t]) })) } : null,
      klaring: v.klaring || null, band: v.band || null, geannuleerd: v.status === 'geannuleerd' };
  }

  /* ---------- vluchtleiding: het bord, gates en vertragingen ---------- */
  function _vluchtMaak(data) {
    const v = { id: id('vl'), nummer: schoon(data.nummer, 8).toUpperCase() || 'RT' + Math.floor(100 + Math.random() * 900),
      soort: data.soort === 'aankomst' ? 'aankomst' : 'vertrek',
      bestemming: schoon(data.bestemming, 60) || 'Onbekend', datum: /^\d{4}-\d{2}-\d{2}$/.test(String(data.datum || '')) ? data.datum : vandaag(),
      tijd: /^\d{2}:\d{2}$/.test(String(data.tijd || '')) ? data.tijd : '12:00',
      gate: GATES.includes(data.gate) ? data.gate : GATES[0], toestel: schoon(data.toestel, 20) || 'RTG-0X',
      status: data.soort === 'aankomst' ? 'onderweg' : 'gepland', draai: {}, klaring: null, vertraging: null, band: null, at: nu() };
    L().vluchten.unshift(v);
    L().vluchten = L().vluchten.slice(0, 5000);
    return v;
  }
  function vluchtMaak(actor, data) {
    data = data || {};
    if (data.gate && !GATES.includes(data.gate)) return { status: 400, error: 'Kies een bestaande gate (' + GATES.join(', ') + ').' };
    const gate = GATES.includes(data.gate) ? data.gate : GATES[0];
    const bezet = vluchten().some(v => actief(v) && v.gate === gate && v.datum === (data.datum || vandaag()) && v.tijd === data.tijd);
    if (bezet) return { status: 409, error: 'Gate ' + gate + ' is op dat moment al bezet.' };
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
    return { ok: true, boekingen: uit };
  }

  /* ---------- het platform: de draai per vertrekkende kist ---------- */
  function draaiTaak(actor, vid, taak) {
    const v = vind(vid);
    if (!v || v.soort !== 'vertrek') return { status: 404, error: 'Vlucht niet gevonden.' };
    if (!DRAAI_TAKEN.includes(taak)) return { status: 400, error: 'Onbekende platformtaak.' };
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
    if (!BANEN.includes(baan)) return { status: 400, error: 'Kies een baan (' + BANEN.join(', ') + ').' };
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
    return { ok: true,
      vluchtenVandaag: vandaagV.length,
      vertrokken: vandaagV.filter(v => v.status === 'vertrokken').length,
      geland: vandaagV.filter(v => ['geland', 'bagage-op-band', 'afgerond'].includes(v.status)).length,
      vertraagd: vandaagV.filter(v => v.vertraging).length,
      ingecheckt: L().boekingen.filter(b => b.status === 'ingecheckt').length,
      koffersInSysteem: L().koffers.filter(k => !['opgehaald'].includes(k.status)).length,
      koffersVermist: L().koffers.filter(k => k.status === 'vermist').length,
      dichteFilters, signalen: signalen.slice(0, 40),
      gates: GATES, banen: BANEN, draaiTaken: DRAAI_TAKEN };
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
    boek, incheck, mijn, draaiTaak, torenKlaring, bagage, bagageZet, securityZet, luchtAI,
    GATES, BANEN, DRAAI_TAKEN, KOFFER_KETEN } };
}

module.exports = { maakLuchthaven };
