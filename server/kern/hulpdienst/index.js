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
   geen 112-centrale en vervangt geen enkel officieel protocol. Dit is de
   orkestrator: de constanten, de state-bak, de gedeelde helpers, het korps-
   overzicht en de meldkamer-AI wonen hier; de eenheden/meldkamer in
   ./meldkamer, het ziekenhuis en de huisarts in ./zorg. */

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
  const consultenVan = code => { const h = bak(); if (!Array.isArray(h.consulten[code])) h.consulten[code] = []; return h.consulten[code]; };

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
          system: require('../rahul').RAHUL_LEAD + 'je bent de meldkamer-assistent van dit korps. Je helpt prioriteren en de juiste eenheid kiezen (land, water, lucht of heli), kort en beslist. ' +
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

  // de gedeelde ctx voor de deelbestanden
  const ctx = { db, save, crypto, findSupplier, nu, schoonTekst, isHulp, bak, eenhedenVan, meldingVan, logboek, consultenVan,
    EENHEID_SOORTEN, PRIOS };
  const api = { HULP_TYPES, EENHEID_SOORTEN, isHulp, overzicht, meldkamerAi };
  Object.assign(api, require('./meldkamer')(ctx), require('./zorg')(ctx));
  return { hulpdienst: api };
};
module.exports.HULP_TYPES = HULP_TYPES;
