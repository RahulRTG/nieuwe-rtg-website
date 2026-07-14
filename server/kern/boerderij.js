/* De boerderij-laag: een breed, slim genre voor boeren en tuinders. Alsof elke
   boerderij op RTG draait, met een meedenkend systeem dat de boer door het jaar
   loodst.

   Verschillende soorten boerderijen (de boer kiest er een, dat stuurt welke
   modules tellen):
   - akkerbouw   : gewassen op het veld (tarwe, mais, aardappel, ...)
   - tuinbouw    : groente onder glas / in de kas (tomaat, komkommer, sla, ...)
   - fruitteelt  : boomgaard (appel, peer, sinaasappel, amandel, ...)
   - wijngaard   : druiven voor wijn
   - melkvee     : koeien, dagelijkse melk
   - pluimvee    : kippen, dagelijkse eieren
   - varkens     : varkenshouderij
   - schapen     : schapen en geiten
   - gemengd     : gewassen EN dieren
   - bio         : biologisch gemengd bedrijf

   De boer beheert PERCELEN (met een gewas dat zaait -> groeit -> te oogsten is),
   DIEREN (aantal, voer, dagopbrengst) en een TAKENBORD. Het systeem rekent de
   groei uit, seint wat vandaag moet gebeuren (de Vandaag-briefing, seizoensbewust)
   en er is een AI-adviseur die vragen beantwoordt en ook echt DINGEN doet (een
   perceel aanmaken, zaaien, oogsten, dieren bijzetten, een taak plannen). Met een
   Claude-sleutel is de adviseur slim; zonder sleutel valt hij terug op een
   ingebouwde kennisbank + opdrachtherkenning, zodat het altijd werkt.

   maakBoerderij(state) volgt het vaste kern-patroon. */

// De boerderijtypes. kind bepaalt welke modules meetellen (gewas/dier/allebei).
const BTYPES = {
  akkerbouw:  { label: 'Akkerbouw',   labelEn: 'Arable',      icon: '\u{1F33E}', kind: 'gewas', gewassen: ['tarwe', 'mais', 'aardappel', 'suikerbiet', 'gerst'] },
  tuinbouw:   { label: 'Tuinbouw / kas', labelEn: 'Horticulture', icon: '\u{1F345}', kind: 'gewas', gewassen: ['tomaat', 'komkommer', 'paprika', 'sla', 'aardbei'] },
  fruitteelt: { label: 'Fruitteelt',  labelEn: 'Orchard',     icon: '\u{1F34E}', kind: 'gewas', gewassen: ['appel', 'peer', 'sinaasappel', 'citroen', 'amandel'] },
  wijngaard:  { label: 'Wijngaard',   labelEn: 'Vineyard',    icon: '\u{1F347}', kind: 'gewas', gewassen: ['druif'] },
  melkvee:    { label: 'Melkvee',     labelEn: 'Dairy',       icon: '\u{1F404}', kind: 'dier', dieren: ['melkkoe'] },
  pluimvee:   { label: 'Pluimvee',    labelEn: 'Poultry',     icon: '\u{1F414}', kind: 'dier', dieren: ['legkip'] },
  varkens:    { label: 'Varkenshouderij', labelEn: 'Pigs',    icon: '\u{1F416}', kind: 'dier', dieren: ['varken'] },
  schapen:    { label: 'Schapen & geiten', labelEn: 'Sheep & goats', icon: '\u{1F411}', kind: 'dier', dieren: ['schaap', 'geit'] },
  gemengd:    { label: 'Gemengd bedrijf', labelEn: 'Mixed',   icon: '\u{1F69C}', kind: 'gemengd', gewassen: ['tarwe', 'mais', 'aardappel'], dieren: ['melkkoe', 'legkip'] },
  bio:        { label: 'Biologisch gemengd', labelEn: 'Organic', icon: '\u{1F331}', kind: 'gemengd', gewassen: ['sla', 'wortel', 'pompoen'], dieren: ['legkip', 'schaap'] }
};

// Gewaskennis: groeidagen (zaai -> oogst), eenheid en opbrengst per hectare.
// mnd = de maanden waarin je normaal zaait/plant (1-12), voor het seizoensadvies.
const GEWASSEN = {
  tarwe:      { label: 'Tarwe',      groeidagen: 240, eenheid: 'kg', perHa: 8000,  zaaiMnd: [10, 11] },
  gerst:      { label: 'Gerst',      groeidagen: 210, eenheid: 'kg', perHa: 7000,  zaaiMnd: [10, 3] },
  mais:       { label: 'Mais',       groeidagen: 150, eenheid: 'kg', perHa: 11000, zaaiMnd: [4, 5] },
  aardappel:  { label: 'Aardappel',  groeidagen: 110, eenheid: 'kg', perHa: 45000, zaaiMnd: [4, 5] },
  suikerbiet: { label: 'Suikerbiet', groeidagen: 200, eenheid: 'kg', perHa: 75000, zaaiMnd: [3, 4] },
  tomaat:     { label: 'Tomaat',     groeidagen: 90,  eenheid: 'kg', perHa: 60000, zaaiMnd: [2, 3, 4] },
  komkommer:  { label: 'Komkommer',  groeidagen: 60,  eenheid: 'kg', perHa: 55000, zaaiMnd: [2, 3, 4] },
  paprika:    { label: 'Paprika',    groeidagen: 100, eenheid: 'kg', perHa: 40000, zaaiMnd: [2, 3] },
  sla:        { label: 'Sla',        groeidagen: 45,  eenheid: 'krop', perHa: 40000, zaaiMnd: [3, 4, 5, 6, 7, 8] },
  aardbei:    { label: 'Aardbei',    groeidagen: 70,  eenheid: 'kg', perHa: 25000, zaaiMnd: [3, 4] },
  wortel:     { label: 'Wortel',     groeidagen: 80,  eenheid: 'kg', perHa: 60000, zaaiMnd: [3, 4, 5, 6] },
  pompoen:    { label: 'Pompoen',    groeidagen: 110, eenheid: 'stuk', perHa: 20000, zaaiMnd: [5, 6] },
  appel:      { label: 'Appel',      groeidagen: 160, eenheid: 'kg', perHa: 45000, zaaiMnd: [4] },
  peer:       { label: 'Peer',       groeidagen: 170, eenheid: 'kg', perHa: 35000, zaaiMnd: [4] },
  sinaasappel:{ label: 'Sinaasappel', groeidagen: 240, eenheid: 'kg', perHa: 40000, zaaiMnd: [3] },
  citroen:    { label: 'Citroen',    groeidagen: 220, eenheid: 'kg', perHa: 35000, zaaiMnd: [3] },
  amandel:    { label: 'Amandel',    groeidagen: 210, eenheid: 'kg', perHa: 2500,  zaaiMnd: [2, 3] },
  druif:      { label: 'Druif',      groeidagen: 150, eenheid: 'kg', perHa: 12000, zaaiMnd: [3, 4] }
};

// Dierkennis: wat het dagelijks oplevert (eenheid) en hoeveel voer per dier per dag.
const DIEREN = {
  melkkoe: { label: 'Melkkoe', opbrengst: 'melk', eenheid: 'L', perDier: 28, voerKg: 22 },
  legkip:  { label: 'Legkip',  opbrengst: 'eieren', eenheid: 'st', perDier: 0.9, voerKg: 0.13 },
  varken:  { label: 'Varken',  opbrengst: 'vlees', eenheid: 'kg', perDier: 0, voerKg: 2.5 },
  schaap:  { label: 'Schaap',  opbrengst: 'wol/melk', eenheid: 'L', perDier: 1.5, voerKg: 2 },
  geit:    { label: 'Geit',    opbrengst: 'melk', eenheid: 'L', perDier: 3, voerKg: 2 }
};

function maakBoerderij({ db, save, crypto, findSupplier, anthropic, schoon }) {
  const id = (p) => (p || 'x') + crypto.randomBytes(3).toString('hex');
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 120));
  const getal = (v, max) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };

  function isBoer(s) { return !!s && ((db.data.supplierTypes[s.type] || {}).caps || []).includes('boerderij'); }

  // Zorg dat de boerderij-structuur bestaat.
  function ensure(s) {
    if (!s.boerderij) s.boerderij = { type: null, opgezet: false, percelen: [], dieren: [], taken: [], instel: {} };
    const b = s.boerderij;
    if (!Array.isArray(b.percelen)) b.percelen = [];
    if (!Array.isArray(b.dieren)) b.dieren = [];
    if (!Array.isArray(b.taken)) b.taken = [];
    if (!b.instel) b.instel = {};
    return b;
  }

  function seizoen(d) {
    const m = (d || new Date()).getMonth() + 1;
    if ([12, 1, 2].includes(m)) return 'winter';
    if ([3, 4, 5].includes(m)) return 'lente';
    if ([6, 7, 8].includes(m)) return 'zomer';
    return 'herfst';
  }
  const SEIZOEN_LABEL = { winter: 'winter', lente: 'lente', zomer: 'zomer', herfst: 'herfst' };

  // Hoe ver is een gewas? Geeft fase + voortgang (0-1) + resterende dagen.
  function gewasFase(p) {
    const g = GEWASSEN[p.gewas];
    if (!p.gewas || !g || !p.gezaaidOp) return { fase: 'leeg', voortgang: 0, restDagen: null };
    if (p.geoogstOp) return { fase: 'geoogst', voortgang: 1, restDagen: 0 };
    const dagen = Math.max(0, Math.round((Date.now() - new Date(p.gezaaidOp).getTime()) / 86400000));
    const voortgang = Math.min(1, dagen / g.groeidagen);
    const restDagen = Math.max(0, g.groeidagen - dagen);
    let fase = 'groeit';
    if (voortgang >= 1) fase = 'te-oogsten';
    else if (voortgang < 0.15) fase = 'gezaaid';
    return { fase, voortgang, restDagen };
  }
  function perceelPubliek(p) {
    const f = gewasFase(p);
    const g = GEWASSEN[p.gewas];
    return {
      id: p.id, naam: p.naam, ha: p.ha, gewas: p.gewas || null,
      gewasLabel: g ? g.label : null, eenheid: g ? g.eenheid : null,
      gezaaidOp: p.gezaaidOp || null, oogstVerwacht: p.oogstVerwacht || null, geoogstOp: p.geoogstOp || null,
      opbrengst: p.opbrengst || 0, laatsteWater: p.laatsteWater || null,
      fase: f.fase, voortgang: Math.round(f.voortgang * 100), restDagen: f.restDagen,
      verwachtKg: g ? Math.round((p.ha || 0) * g.perHa) : 0
    };
  }
  function dierPubliek(d) {
    const k = DIEREN[d.soort];
    return {
      id: d.id, soort: d.soort, soortLabel: k ? k.label : d.soort, aantal: d.aantal || 0,
      stal: d.stal || null, opbrengstSoort: k ? k.opbrengst : null, eenheid: k ? k.eenheid : null,
      dagopbrengst: d.dagopbrengst != null ? d.dagopbrengst : (k ? Math.round((d.aantal || 0) * k.perDier) : 0),
      voerKgPerDag: Math.round((d.aantal || 0) * (k ? k.voerKg : 0)),
      gezondheid: d.gezondheid || 'goed', laatsteVoer: d.laatsteVoer || null
    };
  }

  /* ---- de Vandaag-briefing: wat vraagt nu aandacht? (seizoensbewust) ---- */
  function briefing(s) {
    const b = ensure(s);
    const seiz = seizoen();
    const punten = [];
    // oogstklare percelen
    const teOogsten = b.percelen.filter(p => gewasFase(p).fase === 'te-oogsten');
    if (teOogsten.length) punten.push({ soort: 'oogst', urgentie: 'hoog', tekst: teOogsten.length + ' perceel(en) klaar om te oogsten: ' + teOogsten.map(p => p.naam).join(', ') + '.' });
    // pas gezaaid, water geven bij warm weer
    if (seiz === 'zomer') {
      const droog = b.percelen.filter(p => { const f = gewasFase(p); return (f.fase === 'groeit' || f.fase === 'gezaaid') && (!p.laatsteWater || (Date.now() - new Date(p.laatsteWater).getTime()) > 2 * 86400000); });
      if (droog.length) punten.push({ soort: 'water', urgentie: 'midden', tekst: 'Warm seizoen: ' + droog.length + ' perceel(en) langer dan 2 dagen niet beregend.' });
    }
    // dieren: voer + gezondheid
    const nietGevoerd = b.dieren.filter(d => !d.laatsteVoer || d.laatsteVoer.slice(0, 10) !== vandaag());
    if (nietGevoerd.length) punten.push({ soort: 'voer', urgentie: 'hoog', tekst: nietGevoerd.length + ' diergroep(en) vandaag nog niet gevoerd.' });
    const ziek = b.dieren.filter(d => d.gezondheid && d.gezondheid !== 'goed');
    if (ziek.length) punten.push({ soort: 'gezondheid', urgentie: 'hoog', tekst: ziek.length + ' diergroep(en) met een aandachtspunt voor de gezondheid.' });
    // open taken voor vandaag / te laat
    const open = b.taken.filter(t => !t.klaar);
    const teLaat = open.filter(t => t.voor && t.voor < vandaag());
    if (teLaat.length) punten.push({ soort: 'taak', urgentie: 'hoog', tekst: teLaat.length + ' taak/taken over de einddatum.' });
    else if (open.length) punten.push({ soort: 'taak', urgentie: 'laag', tekst: open.length + ' open taak/taken op het bord.' });
    // seizoensadvies: wat kun je nu zaaien?
    const m = new Date().getMonth() + 1;
    const nuZaaien = Object.keys(GEWASSEN).filter(k => (GEWASSEN[k].zaaiMnd || []).includes(m)).map(k => GEWASSEN[k].label);
    if (nuZaaien.length) punten.push({ soort: 'seizoen', urgentie: 'laag', tekst: 'Goede maand om te zaaien/planten: ' + nuZaaien.slice(0, 6).join(', ') + '.' });
    return { seizoen: seiz, seizoenLabel: SEIZOEN_LABEL[seiz], punten };
  }

  function stats(b) {
    const totMelk = b.dieren.reduce((n, d) => n + (DIEREN[d.soort] && DIEREN[d.soort].opbrengst === 'melk' ? (dierPubliek(d).dagopbrengst || 0) : 0), 0);
    const totEieren = b.dieren.reduce((n, d) => n + (DIEREN[d.soort] && DIEREN[d.soort].opbrengst === 'eieren' ? (dierPubliek(d).dagopbrengst || 0) : 0), 0);
    return {
      percelen: b.percelen.length,
      hectare: Math.round(b.percelen.reduce((n, p) => n + (p.ha || 0), 0) * 10) / 10,
      teOogsten: b.percelen.filter(p => gewasFase(p).fase === 'te-oogsten').length,
      dierGroepen: b.dieren.length,
      dieren: b.dieren.reduce((n, d) => n + (d.aantal || 0), 0),
      melkPerDag: Math.round(totMelk), eierenPerDag: Math.round(totEieren),
      voerPerDag: b.dieren.reduce((n, d) => n + dierPubliek(d).voerKgPerDag, 0),
      openTaken: b.taken.filter(t => !t.klaar).length
    };
  }

  // Het volledige dashboard voor de boer-app.
  function overzicht(s) {
    const b = ensure(s);
    const t = b.type ? BTYPES[b.type] : null;
    return {
      opgezet: b.opgezet, type: b.type, typeLabel: t ? t.label : null, kind: t ? t.kind : null, typeIcon: t ? t.icon : null,
      types: Object.keys(BTYPES).map(k => ({ id: k, label: BTYPES[k].label, labelEn: BTYPES[k].labelEn, icon: BTYPES[k].icon, kind: BTYPES[k].kind })),
      gewaskeuze: t ? (t.gewassen || Object.keys(GEWASSEN)).map(k => ({ id: k, label: GEWASSEN[k].label })) : Object.keys(GEWASSEN).map(k => ({ id: k, label: GEWASSEN[k].label })),
      dierkeuze: t ? (t.dieren || Object.keys(DIEREN)).map(k => ({ id: k, label: DIEREN[k].label })) : Object.keys(DIEREN).map(k => ({ id: k, label: DIEREN[k].label })),
      percelen: b.percelen.map(perceelPubliek), dieren: b.dieren.map(dierPubliek),
      taken: b.taken.slice().sort((a, c) => (a.klaar - c.klaar) || String(a.voor || '').localeCompare(String(c.voor || ''))),
      stats: stats(b), briefing: briefing(s)
    };
  }

  /* ---- muterende acties (boer/manager) ---- */
  function kiesType(s, typeId) {
    const b = ensure(s);
    if (!BTYPES[typeId]) return { error: 'Onbekend boerderijtype.' };
    b.type = typeId; b.opgezet = true; save();
    return { ok: true };
  }
  function zetPerceel(s, data) {
    const b = ensure(s);
    if (data.weg) { b.percelen = b.percelen.filter(p => p.id !== data.id); save(); return { ok: true }; }
    const naam = scho(data.naam, 60);
    if (!naam) return { error: 'Geef het perceel een naam.' };
    const ha = getal(data.ha, 100000);
    if (data.id) {
      const p = b.percelen.find(x => x.id === data.id);
      if (!p) return { error: 'Perceel niet gevonden.' };
      p.naam = naam; if (data.ha != null) p.ha = ha;
      save(); return { ok: true };
    }
    if (b.percelen.length >= 2000) return { error: 'Tot 2000 percelen per bedrijf.' };
    b.percelen.push({ id: id('pc'), naam, ha, gewas: null, gezaaidOp: null, oogstVerwacht: null, geoogstOp: null, opbrengst: 0 });
    save(); return { ok: true };
  }
  function zaaiPerceel(s, perceelId, gewas) {
    const b = ensure(s);
    const p = b.percelen.find(x => x.id === perceelId);
    if (!p) return { error: 'Perceel niet gevonden.' };
    if (!GEWASSEN[gewas]) return { error: 'Onbekend gewas.' };
    p.gewas = gewas; p.gezaaidOp = nu(); p.geoogstOp = null; p.opbrengst = 0;
    p.oogstVerwacht = new Date(Date.now() + GEWASSEN[gewas].groeidagen * 86400000).toISOString().slice(0, 10);
    save(); return { ok: true, oogstVerwacht: p.oogstVerwacht };
  }
  function waterPerceel(s, perceelId) {
    const b = ensure(s);
    const p = b.percelen.find(x => x.id === perceelId);
    if (!p) return { error: 'Perceel niet gevonden.' };
    p.laatsteWater = nu(); save(); return { ok: true };
  }
  function oogstPerceel(s, perceelId, kg) {
    const b = ensure(s);
    const p = b.percelen.find(x => x.id === perceelId);
    if (!p) return { error: 'Perceel niet gevonden.' };
    if (!p.gewas) return { error: 'Op dit perceel staat geen gewas.' };
    const g = GEWASSEN[p.gewas];
    const opbrengst = kg != null && Number(kg) > 0 ? getal(kg, 100000000) : Math.round((p.ha || 0) * g.perHa);
    p.opbrengst = opbrengst; p.geoogstOp = nu();
    save(); return { ok: true, opbrengst, eenheid: g.eenheid };
  }
  function zetDier(s, data) {
    const b = ensure(s);
    if (data.weg) { b.dieren = b.dieren.filter(d => d.id !== data.id); save(); return { ok: true }; }
    if (!DIEREN[data.soort] && !data.id) return { error: 'Onbekende diersoort.' };
    if (data.id) {
      const d = b.dieren.find(x => x.id === data.id);
      if (!d) return { error: 'Diergroep niet gevonden.' };
      if (data.aantal != null) d.aantal = getal(data.aantal, 1000000);
      if (data.stal != null) d.stal = scho(data.stal, 40);
      if (data.gezondheid && ['goed', 'aandacht', 'ziek'].includes(data.gezondheid)) d.gezondheid = data.gezondheid;
      save(); return { ok: true };
    }
    if (b.dieren.length >= 500) return { error: 'Tot 500 diergroepen per bedrijf.' };
    b.dieren.push({ id: id('dr'), soort: data.soort, aantal: getal(data.aantal, 1000000), stal: scho(data.stal, 40), gezondheid: 'goed' });
    save(); return { ok: true };
  }
  function voerDier(s, dierId) {
    const b = ensure(s);
    const d = b.dieren.find(x => x.id === dierId);
    if (!d) return { error: 'Diergroep niet gevonden.' };
    d.laatsteVoer = nu(); save();
    return { ok: true, voerKg: dierPubliek(d).voerKgPerDag };
  }
  function opbrengstDier(s, dierId, waarde) {
    const b = ensure(s);
    const d = b.dieren.find(x => x.id === dierId);
    if (!d) return { error: 'Diergroep niet gevonden.' };
    d.dagopbrengst = getal(waarde, 10000000); save();
    return { ok: true };
  }
  function zetTaak(s, data) {
    const b = ensure(s);
    if (data.weg) { b.taken = b.taken.filter(t => t.id !== data.id); save(); return { ok: true }; }
    const wat = scho(data.wat, 120);
    if (!wat) return { error: 'Beschrijf de taak.' };
    if (b.taken.length >= 1000) b.taken = b.taken.filter(t => !t.klaar).slice(-900);
    b.taken.push({ id: id('tk'), wat, waar: scho(data.waar, 60) || null, voor: /^\d{4}-\d{2}-\d{2}$/.test(data.voor || '') ? data.voor : null, klaar: false, at: nu() });
    save(); return { ok: true };
  }
  function rondTaak(s, taakId, door) {
    const b = ensure(s);
    const t = b.taken.find(x => x.id === taakId);
    if (!t) return { error: 'Taak niet gevonden.' };
    t.klaar = true; t.klaarOp = nu(); t.door = scho(door, 40) || null;
    save(); return { ok: true };
  }

  /* ---- de AI-adviseur: beantwoordt vragen en DOET dingen ---- */
  // Ingebouwde kennisbank (werkt zonder Claude-sleutel).
  const KENNIS = [
    { w: /tomaat|tomaten/, a: 'Tomaten zaai je onder glas februari-april; uitplanten na de laatste nachtvorst. Gelijkmatig water, niet op het blad. Oogst na ongeveer 90 dagen.' },
    { w: /aardappel/, a: 'Pootaardappelen de grond in april-mei. Aanaarden als het loof 20 cm is. Oogsten als het loof afsterft, ongeveer 110 dagen na poten.' },
    { w: /mais|maïs/, a: 'Mais zaai je bij een bodemtemperatuur boven 10 graden (april-mei). Oogst als de kolven vol zijn, ongeveer 150 dagen.' },
    { w: /koe|melk|melkvee/, a: 'Een melkkoe geeft grofweg 25-30 liter per dag en eet ongeveer 22 kg voer. Twee keer per dag melken en voeren, en let op de conditie.' },
    { w: /kip|eieren|pluimvee/, a: 'Een legkip legt gemiddeld 5-6 eieren per week en eet ongeveer 130 gram voer per dag. Zorg voor vers water, licht en schone legnesten.' },
    { w: /water|beregen|droogte/, a: 'Beregen bij warm, droog weer bij voorkeur vroeg in de ochtend of tegen de avond, zodat er minder verdampt. Geef liever een keer flink dan elke dag een beetje.' },
    { w: /bemest|mest|stikstof/, a: 'Bemest op basis van een grondmonster. Deel de stikstofgift; te veel ineens spoelt uit. Bij biologisch werk je met vaste mest en groenbemesters.' },
    { w: /wijn|druif|druiven|wijngaard/, a: 'Druiven snoei je in de winter. Oogsten in de nazomer bij het juiste suikergehalte. Let op meeldauw bij vochtig weer.' }
  ];
  function samenvatting(s) {
    const b = ensure(s); const st = stats(b); const t = b.type ? BTYPES[b.type].label : 'nog niet gekozen';
    return 'Type: ' + t + '. Percelen: ' + st.percelen + ' (' + st.hectare + ' ha, ' + st.teOogsten + ' oogstklaar). Dieren: ' + st.dieren + ' in ' + st.dierGroepen + ' groepen. Open taken: ' + st.openTaken + '.';
  }
  // Ingebouwde opdrachtherkenning: laat de adviseur ook zonder Claude iets DOEN.
  function cannedActie(s, vraag) {
    const q = vraag.toLowerCase();
    let m;
    // "voeg perceel <naam> van <n> ha toe"
    m = q.match(/(?:voeg|maak|nieuw).*perceel\s+"?([a-z0-9 \-]{2,40}?)"?\s*(?:van\s+([\d.,]+)\s*ha)?(?:\s+toe|\s+aan)?$/);
    if (m) { const r = zetPerceel(s, { naam: m[1].trim(), ha: m[2] ? Number(m[2].replace(',', '.')) : 0 }); return r.error ? { antwoord: r.error } : { antwoord: 'Perceel "' + m[1].trim() + '" aangemaakt.' + (m[2] ? ' (' + m[2] + ' ha)' : ''), gedaan: true }; }
    // "zaai <gewas> op <perceelnaam>"
    m = q.match(/za(?:ai|aien|ien)\s+([a-z]+)\s+(?:op|in)\s+"?([a-z0-9 \-]{2,40}?)"?$/);
    if (m) {
      const gewasId = Object.keys(GEWASSEN).find(k => k === m[1] || GEWASSEN[k].label.toLowerCase() === m[1]);
      const b = ensure(s); const p = b.percelen.find(x => x.naam.toLowerCase() === m[2].trim());
      if (!gewasId) return { antwoord: 'Ik ken het gewas "' + m[1] + '" niet.' };
      if (!p) return { antwoord: 'Ik vind geen perceel "' + m[2].trim() + '".' };
      const r = zaaiPerceel(s, p.id, gewasId);
      return r.error ? { antwoord: r.error } : { antwoord: GEWASSEN[gewasId].label + ' gezaaid op ' + p.naam + '. Oogst verwacht rond ' + r.oogstVerwacht + '.', gedaan: true };
    }
    // "oogst <perceelnaam>"
    m = q.match(/oogst\s+(?:perceel\s+)?"?([a-z0-9 \-]{2,40}?)"?$/);
    if (m) { const b = ensure(s); const p = b.percelen.find(x => x.naam.toLowerCase() === m[1].trim()); if (!p) return { antwoord: 'Ik vind geen perceel "' + m[1].trim() + '".' }; const r = oogstPerceel(s, p.id); return r.error ? { antwoord: r.error } : { antwoord: p.naam + ' geoogst: ' + r.opbrengst + ' ' + r.eenheid + '.', gedaan: true }; }
    // "voeg <n> <dier> toe" / "zet <n> koeien"
    m = q.match(/(?:voeg|zet|koop)\s+(\d{1,7})\s+([a-z]+)/);
    if (m) {
      const soortId = Object.keys(DIEREN).find(k => k === m[2] || DIEREN[k].label.toLowerCase() === m[2] || m[2].startsWith(k.slice(0, 4)) || (m[2] === 'koeien' && k === 'melkkoe') || (m[2] === 'kippen' && k === 'legkip') || (m[2] === 'schapen' && k === 'schaap') || (m[2] === 'geiten' && k === 'geit') || (m[2] === 'varkens' && k === 'varken'));
      if (soortId) { const r = zetDier(s, { soort: soortId, aantal: Number(m[1]) }); return r.error ? { antwoord: r.error } : { antwoord: m[1] + ' ' + DIEREN[soortId].label.toLowerCase() + '(en) toegevoegd.', gedaan: true }; }
    }
    // "plan taak: <tekst>" / "herinner me aan <tekst>"
    m = q.match(/(?:plan|voeg|maak).*taak[:\s]+(.{3,120})$/) || q.match(/herinner\s+(?:me\s+)?(?:aan\s+)?(.{3,120})$/);
    if (m) { const r = zetTaak(s, { wat: m[1].trim() }); return r.error ? { antwoord: r.error } : { antwoord: 'Taak op het bord gezet: ' + m[1].trim(), gedaan: true }; }
    return null;
  }
  function cannedAntwoord(s, vraag) {
    const actie = cannedActie(s, vraag);
    if (actie) return actie;
    for (const k of KENNIS) if (k.w.test(vraag.toLowerCase())) return { antwoord: k.a };
    // val terug op een seizoenstip + de eigen situatie
    const br = briefing(s);
    const tip = br.punten.length ? br.punten[0].tekst : 'Alles ziet er rustig uit. ';
    return { antwoord: 'Ik denk met je mee (' + br.seizoenLabel + '). ' + tip + ' Vraag me gerust iets als "zaai tomaat op Kasblok 1", "voeg 20 melkkoeien toe" of "wanneer aardappels poten?".' };
  }
  async function advies(s, vraag, aiAan) {
    vraag = scho(vraag, 500);
    if (!vraag) return { antwoord: 'Stel je vraag of geef een opdracht.' };
    // Opdrachten (die iets DOEN) altijd zelf afhandelen, ook met Claude aan, zodat
    // de mutatie deterministisch en veilig blijft.
    const actie = cannedActie(s, vraag);
    if (actie) return actie;
    if (aiAan && anthropic) {
      try {
        const sys = 'Je bent de ervaren, praktische bedrijfsadviseur van een boer op het RTG-platform. Antwoord kort, concreet en in het Nederlands. Hier is de huidige situatie: ' + samenvatting(s) + ' Geef bruikbaar advies over gewassen, dieren, planning en seizoen.';
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 400, system: sys, messages: [{ role: 'user', content: vraag }] });
        const tekst = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (tekst) return { antwoord: tekst };
      } catch (e) { /* val terug op de kennisbank */ }
    }
    return cannedAntwoord(s, vraag);
  }

  return {
    BTYPES, GEWASSEN, DIEREN,
    isBoer, ensure, overzicht, briefing,
    kiesType, zetPerceel, zaaiPerceel, waterPerceel, oogstPerceel,
    zetDier, voerDier, opbrengstDier, zetTaak, rondTaak,
    advies, perceelPubliek, dierPubliek
  };
}

module.exports = { maakBoerderij, BTYPES, GEWASSEN, DIEREN };
