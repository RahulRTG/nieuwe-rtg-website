/* De hulpdiensten-toren: zes korpsen op het RTG-platform, elk met een eigen
   meldkamer (de klantenservice-room van het korps), eenheden over land,
   water en door de lucht, en de keten eromheen:

   - politie, brandweer en ambulance: meldingen met prioriteit, eenheden
     toewijzen (land/water/lucht/heli), statusketen gemeld -> toegewezen ->
     ter plaatse -> afgerond, en bijstand vragen aan een ander korps;
   - special forces (besloten korps): komt alleen in actie via een
     bijstandsverzoek van de politie, nooit rechtstreeks;
   - ziekenhuis: beddenbord en opnames; de ambulance kondigt een overdracht
     aan, het ziekenhuis neemt op en ontslaat;
   - huisarts: consulten met urgentie, en doorverwijzen naar het ziekenhuis.

   EERLIJK: dit is het RTG-demosysteem voor besturing en oefening; het is
   geen 112-centrale en vervangt geen enkel officieel protocol. */

const HULP_TYPES = {
  politie:    { label: 'Politie',        icon: '\u{1F694}', caps: ['location'] },
  brandweer:  { label: 'Brandweer',      icon: '\u{1F692}', caps: ['location'] },
  ambulance:  { label: 'Ambulance',      icon: '\u{1F691}', caps: ['location'] },
  ziekenhuis: { label: 'Ziekenhuis',     icon: '\u{1F3E5}', caps: ['location'] },
  huisarts:   { label: 'Huisarts',       icon: '\u{1FA7A}', caps: ['location'] },
  specials:   { label: 'Special Forces', icon: '\u{1F985}', caps: ['location'], besloten: true }
};
const EENHEID_SOORTEN = ['land', 'water', 'lucht', 'heli'];
const PRIOS = [1, 2, 3];

module.exports = ({ db, save, crypto, anthropic, findSupplier }) => {
  const nu = () => Date.now();
  const schoonTekst = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max || 200);
  function bak() {
    if (!db.data.hulp) db.data.hulp = {};
    const h = db.data.hulp;
    if (!Array.isArray(h.meldingen)) h.meldingen = [];
    if (!h.eenheden) h.eenheden = {};
    if (!Array.isArray(h.opnames)) h.opnames = [];
    if (!h.consulten) h.consulten = {};
    if (!h.bedden) h.bedden = {};
    return h;
  }
  const isHulp = s => !!s && !!HULP_TYPES[s.type];
  const eenhedenVan = code => { const h = bak(); if (!Array.isArray(h.eenheden[code])) h.eenheden[code] = []; return h.eenheden[code]; };
  const meldingVan = (code, id) => bak().meldingen.find(m => m.id === id && (m.korps === code || (m.bijstand || []).includes(code)));
  const logboek = (m, wat) => { m.logboek.push({ at: nu(), wat: schoonTekst(wat, 120) }); if (m.logboek.length > 40) m.logboek.shift(); };

  /* ---------- eenheden: land, water, lucht en de heli ---------- */
  function eenheidMaak(code, naam, soort) {
    const n = schoonTekst(naam, 40);
    if (!n) return { status: 400, error: 'Hoe heet de eenheid?' };
    if (!EENHEID_SOORTEN.includes(soort)) return { status: 400, error: 'Kies land, water, lucht of heli.' };
    const rij = eenhedenVan(code);
    if (rij.length >= 40) return { status: 400, error: 'Veertig eenheden is het plafond van dit bord.' };
    const e = { id: crypto.randomBytes(4).toString('hex'), naam: n, soort, status: 'vrij' };
    rij.push(e);
    save();
    return { ok: true, eenheid: e };
  }
  function eenheidZet(code, id, status) {
    const e = eenhedenVan(code).find(x => x.id === id);
    if (!e) return { status: 404, error: 'Deze eenheid staat niet op het bord.' };
    if (!['vrij', 'buiten-dienst'].includes(status)) return { status: 400, error: 'Handmatig kan alleen vrij of buiten-dienst; de rest volgt de melding.' };
    e.status = status;
    save();
    return { ok: true, eenheid: e };
  }

  /* ---------- de meldkamer ---------- */
  function meldingMaak(code, b) {
    const s = findSupplier(code);
    if (!s || !isHulp(s)) return { status: 403, error: 'Alleen een hulpdienst heeft een meldkamer.' };
    if (s.type === 'specials') return { status: 403, error: 'Special forces nemen geen eigen meldingen aan; zij komen in actie via een bijstandsverzoek van de politie.' };
    const tekst = schoonTekst(b.tekst, 300);
    if (!tekst) return { status: 400, error: 'Wat is er gemeld?' };
    const prio = PRIOS.includes(Number(b.prio)) ? Number(b.prio) : 2;
    const m = {
      id: crypto.randomBytes(4).toString('hex'), korps: code, tekst,
      plek: schoonTekst(b.plek, 80), prio, status: 'nieuw',
      eenheidId: null, bijstand: [], logboek: [], at: nu()
    };
    logboek(m, 'Melding aangenomen (prio ' + prio + ')');
    bak().meldingen.unshift(m);
    if (bak().meldingen.length > 2000) bak().meldingen.pop();
    save();
    return { ok: true, melding: m };
  }
  function meldingWijs(code, meldingId, eenheidId) {
    const m = meldingVan(code, meldingId);
    if (!m) return { status: 404, error: 'Deze melding staat niet op uw bord.' };
    if (m.status === 'afgerond') return { status: 409, error: 'Deze melding is al afgerond.' };
    const e = eenhedenVan(code).find(x => x.id === eenheidId);
    if (!e) return { status: 404, error: 'Deze eenheid staat niet op het bord.' };
    if (e.status !== 'vrij') return { status: 409, error: e.naam + ' is niet vrij (' + e.status + ').' };
    e.status = 'onderweg';
    m.status = 'toegewezen';
    m.eenheidId = e.id;
    logboek(m, e.naam + ' (' + e.soort + ', ' + code + ') is onderweg');
    save();
    return { ok: true, melding: m };
  }
  function meldingStatus(code, meldingId, status) {
    const m = meldingVan(code, meldingId);
    if (!m) return { status: 404, error: 'Deze melding staat niet op uw bord.' };
    if (!['ter-plaatse', 'afgerond'].includes(status)) return { status: 400, error: 'Kies ter-plaatse of afgerond.' };
    m.status = status;
    logboek(m, status === 'ter-plaatse' ? 'Eenheid ter plaatse' : 'Melding afgerond');
    // bij afronden komen de eenheden van ALLE betrokken korpsen weer vrij
    if (status === 'afgerond') {
      for (const kc of [m.korps, ...(m.bijstand || [])])
        for (const e of eenhedenVan(kc)) if (e.status === 'onderweg' || e.status === 'ter-plaatse') e.status = 'vrij';
    } else if (m.eenheidId) {
      const e = eenhedenVan(m.korps).find(x => x.id === m.eenheidId);
      if (e) e.status = 'ter-plaatse';
    }
    save();
    return { ok: true, melding: m };
  }
  /* Bijstand: een korps deelt een melding met een ander korps; die ziet hem
     op het eigen bord en wijst er eigen eenheden aan toe. Special forces
     zijn ALLEEN via de politie op te roepen. */
  function bijstandVraag(code, meldingId, naarCode) {
    const m = meldingVan(code, meldingId);
    if (!m || m.korps !== code) return { status: 404, error: 'Deze melding staat niet op uw eigen bord.' };
    const doel = findSupplier(naarCode);
    if (!doel || !isHulp(doel)) return { status: 404, error: 'Dit korps kennen we niet.' };
    if (doel.type === 'specials' && (findSupplier(code) || {}).type !== 'politie')
      return { status: 403, error: 'Special forces worden uitsluitend door de politie om bijstand gevraagd.' };
    if (m.bijstand.includes(doel.code)) return { status: 409, error: 'Dit korps staat al op de melding.' };
    m.bijstand.push(doel.code);
    logboek(m, 'Bijstand gevraagd aan ' + doel.name);
    save();
    return { ok: true, melding: m };
  }

  /* ---------- ziekenhuis: bedden en opnames ---------- */
  function beddenZet(code, totaal) {
    const t = Math.max(0, Math.min(2000, Math.round(Number(totaal) || 0)));
    bak().bedden[code] = { totaal: t, bezet: Math.min((bak().bedden[code] || {}).bezet || 0, t) };
    save();
    return { ok: true, bedden: bak().bedden[code] };
  }
  function overdrachtMaak(code, b) {
    const van = findSupplier(code);
    if (!van || !['ambulance', 'huisarts'].includes(van.type)) return { status: 403, error: 'Alleen de ambulance of de huisarts draagt over aan het ziekenhuis.' };
    const zk = findSupplier(b.ziekenhuis);
    if (!zk || zk.type !== 'ziekenhuis') return { status: 404, error: 'Dit ziekenhuis kennen we niet.' };
    const triage = schoonTekst(b.triage, 200);
    if (!triage) return { status: 400, error: 'Wat is de triage of de reden van overdracht?' };
    const bed = bak().bedden[zk.code] || { totaal: 0, bezet: 0 };
    const o = {
      id: crypto.randomBytes(4).toString('hex'), ziekenhuis: zk.code, van: van.code,
      triage, status: 'aangekondigd', vol: bed.totaal > 0 && bed.bezet >= bed.totaal, at: nu()
    };
    bak().opnames.unshift(o);
    if (bak().opnames.length > 1000) bak().opnames.pop();
    save();
    return { ok: true, opname: o, waarschuwing: o.vol ? 'Let op: het beddenbord staat op vol; het ziekenhuis beslist bij aankomst.' : null };
  }
  function opnameZet(code, id, status) {
    const o = bak().opnames.find(x => x.id === id && x.ziekenhuis === code);
    if (!o) return { status: 404, error: 'Deze opname staat niet op uw bord.' };
    if (!['opgenomen', 'ontslagen', 'geweigerd'].includes(status)) return { status: 400, error: 'Kies opgenomen, ontslagen of geweigerd.' };
    const bed = bak().bedden[code] = bak().bedden[code] || { totaal: 0, bezet: 0 };
    if (status === 'opgenomen' && o.status !== 'opgenomen') bed.bezet = Math.min(bed.totaal || 9999, bed.bezet + 1);
    if (status === 'ontslagen' && o.status === 'opgenomen') bed.bezet = Math.max(0, bed.bezet - 1);
    o.status = status;
    save();
    return { ok: true, opname: o, bedden: bed };
  }

  /* ---------- huisarts: consulten met urgentie ---------- */
  function consultenVan(code) { const h = bak(); if (!Array.isArray(h.consulten[code])) h.consulten[code] = []; return h.consulten[code]; }
  function consultMaak(code, b) {
    const s = findSupplier(code);
    if (!s || s.type !== 'huisarts') return { status: 403, error: 'Alleen de huisarts plant consulten.' };
    const klacht = schoonTekst(b.klacht, 200);
    if (!klacht) return { status: 400, error: 'Wat is de klacht?' };
    const c = {
      id: crypto.randomBytes(4).toString('hex'), klacht,
      urgentie: ['hoog', 'normaal', 'laag'].includes(b.urgentie) ? b.urgentie : 'normaal',
      wanneer: schoonTekst(b.wanneer, 40), status: 'gepland', at: nu()
    };
    consultenVan(code).unshift(c);
    if (consultenVan(code).length > 500) consultenVan(code).pop();
    save();
    return { ok: true, consult: c };
  }
  function consultZet(code, id, status) {
    const c = consultenVan(code).find(x => x.id === id);
    if (!c) return { status: 404, error: 'Dit consult staat niet in de agenda.' };
    if (!['afgerond', 'verwezen', 'gepland'].includes(status)) return { status: 400, error: 'Kies gepland, afgerond of verwezen.' };
    c.status = status;
    save();
    return { ok: true, consult: c };
  }

  /* ---------- het overzicht per korps ---------- */
  function overzicht(s) {
    if (!isHulp(s)) return { status: 403, error: 'Alleen een hulpdienst heeft dit bord.' };
    const h = bak();
    const eigen = h.meldingen.filter(m => m.korps === s.code).slice(0, 50);
    const bijstand = h.meldingen.filter(m => (m.bijstand || []).includes(s.code) && m.status !== 'afgerond').slice(0, 20);
    const uit = { ok: true, korps: { code: s.code, naam: s.name, soort: s.type, label: HULP_TYPES[s.type].label },
      eenheden: eenhedenVan(s.code), meldingen: eigen, bijstand,
      open: eigen.filter(m => m.status !== 'afgerond').length };
    if (s.type === 'ziekenhuis') {
      uit.bedden = h.bedden[s.code] || { totaal: 0, bezet: 0 };
      uit.opnames = h.opnames.filter(o => o.ziekenhuis === s.code).slice(0, 30);
    }
    if (s.type === 'huisarts') uit.consulten = consultenVan(s.code).slice(0, 30);
    if (['ambulance', 'huisarts'].includes(s.type))
      uit.ziekenhuizen = (db.data.suppliers || []).filter(x => x.type === 'ziekenhuis').map(x => ({ code: x.code, naam: x.name, bedden: h.bedden[x.code] || { totaal: 0, bezet: 0 } }));
    if (['politie', 'brandweer', 'ambulance'].includes(s.type))
      uit.korpsen = (db.data.suppliers || []).filter(x => isHulp(x) && x.code !== s.code && !['ziekenhuis', 'huisarts'].includes(x.type))
        .filter(x => x.type !== 'specials' || s.type === 'politie')
        .map(x => ({ code: x.code, naam: x.name, soort: x.type }));
    return uit;
  }

  /* ---------- de meldkamer-AI ---------- */
  async function meldkamerAi(s, vraag) {
    const v = schoonTekst(vraag, 400);
    if (!v) return { status: 400, error: 'Wat wilt u weten?' };
    const o = overzicht(s);
    const beeld = 'Korps: ' + s.name + ' (' + HULP_TYPES[s.type].label + '). Eenheden: ' +
      (o.eenheden || []).map(e => e.naam + ' (' + e.soort + ', ' + e.status + ')').join(', ') +
      '. Open meldingen: ' + (o.meldingen || []).filter(m => m.status !== 'afgerond').map(m => 'prio ' + m.prio + ': ' + m.tekst).join(' | ');
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 400,
          system: require('./rahul').RAHUL_LEAD + 'je bent de meldkamer-assistent van dit korps. Je helpt prioriteren en de juiste eenheid kiezen (land, water, lucht of heli), kort en beslist. ' +
            'Je stelt NOOIT een medische diagnose en dit systeem is een demonstratie- en oefenomgeving: bij echt levensgevaar geldt altijd 112 en het eigen protocol; zeg dat er eerlijk bij als het relevant is. Situatie: ' + beeld,
          messages: [{ role: 'user', content: v }]
        });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) return { ok: true, antwoord: t };
      } catch (e) { /* de vaste hulp hieronder vangt het op */ }
    }
    const vrij = (o.eenheden || []).filter(e => e.status === 'vrij');
    return { ok: true, antwoord: 'Op het bord: ' + (o.open || 0) + ' open melding(en) en ' + vrij.length + ' vrije eenheid(en)' +
      (vrij.length ? ' (' + vrij.map(e => e.naam + ', ' + e.soort + ')').join('; ') : '') +
      '. Wijs de hoogste prio als eerste toe; water en lucht alleen als de plek erom vraagt. Dit is de demo-omgeving: bij echt levensgevaar geldt altijd 112 en het eigen protocol.' };
  }

  return { hulpdienst: { HULP_TYPES, EENHEID_SOORTEN, isHulp, overzicht, eenheidMaak, eenheidZet, meldingMaak, meldingWijs, meldingStatus, bijstandVraag, beddenZet, overdrachtMaak, opnameZet, consultMaak, consultZet, meldkamerAi } };
};
module.exports.HULP_TYPES = HULP_TYPES;
