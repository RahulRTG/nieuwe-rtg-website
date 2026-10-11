/* ============================================================================
   DE ARCHITECT -- de kern (ARCHITECTOPDRACHT.md fase 4, CODE.md par. 2 en 8)

   De alleen-lezende projectie over de registers die er al zijn. Hij bezit
   niets: hij leest registers in de wortel en geeft regels terug, en schrijft
   nergens heen (R1). Hij woont in scripts/ en wordt nooit door server/ geladen
   (R2, test/codearchitect.test.js).

   ELKE REGEL DRAAGT DRIE ASSEN EN EEN HERKOMST (ARCHITECTOPDRACHT.md par. 2):

     graad        onbekend · vermoed · gemeten · bewezen (BESTUUR.md; geen vijfde)
     versheid     actueel · mogelijk-verouderd · onbekend (fase 2 en 3)
     tegenspraak  geen-gevonden  twee bronnen vergeleken en ze zijn het eens
                  onbepaald      maar een bron; er viel niets te vergelijken
                  gevonden       twee bronnen zeggen iets anders, en dan kiest
                                 de Architect er nooit stil een
     herkomst     { register, pad } -- het pad is na te lopen met volg(), en
                  test/codearchitect.test.js doet dat voor elke regel van de
                  gouden onderwerpen.

   Een leeg vak draagt zijn reden (R5): een ontbrekend register geeft een regel
   met graad onbekend en waarom, nooit een crash of een oude waarde.

   WAT HIJ NIET DOET: samenvatten, kiezen, een samengesteld cijfer maken, of
   iets over de code zeggen wat geen register zegt.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { invoerVersheid } = require('./invoerspoor');

const WORTEL = path.join(__dirname, '..', '..');

/* De graad die een registerWAARDE draagt, per register, met de reden. Dit is de
   enige plek waar de Architect iets verklaart, en het is een verklaring over
   de SOORT bron en niet over een uitkomst. */
const GRAAD = {
  'SYMBOLEN.json': ['gemeten', 'deterministisch uit de bron gelezen (scripts/symbolen.js)'],
  'AANROEPGRAAF.json': ['gemeten', 'deterministisch uit de bron gelezen (scripts/aanroepgraaf.js)'],
  'ROUTEBRON.json': ['gemeten', 'uit de levende router gelezen (scripts/routebron.js)'],
  'SCHERMROUTES.json': ['gemeten', 'uit de schermen gelezen (scripts/schermroutes.js)'],
  'EXECUTION_MAP.json': ['gemeten', 'een projectie van vier registers (scripts/executionmap.js); het veld bewijs draagt zijn eigen vervalstaat'],
  'GRENZEN.json': ['vermoed', 'gegenereerd en met de hand aangevuld; de aanvullingen zijn verklaringen'],
  'WETTEN.json': ['vermoed', 'een wet is een besluit van een mens met een handhaver; dat hij geldt is geen meting'],
  'BEWIJSSCHULD.json': ['vermoed', 'verklaarde schuld: een mens schreef op wat er niet bewezen is'],
  'TOETSROUTES.json': ['gemeten', 'waargenomen in het routejournaal van echte rondes (scripts/toetsroutes.js)'],
};

function maakLezer(opties) {
  /* `wortel` is waar de registers staan, `bron` waar de code staat. Normaal is
     dat dezelfde map; de mutatietoets legt de registers ergens anders neer. */
  const wortel = (opties && opties.wortel) || WORTEL;
  const bron = (opties && opties.bron) || WORTEL;
  const cache = new Map();
  function laad(naam) {
    if (cache.has(naam)) return cache.get(naam);
    const p = path.join(wortel, naam);
    let uit;
    if (!fs.existsSync(p)) uit = { naam, ontbreekt: true, reden: naam + ' bestaat hier niet' };
    else {
      try { uit = { naam, data: JSON.parse(fs.readFileSync(p, 'utf8')) }; }
      catch (e) { uit = { naam, ontbreekt: true, reden: naam + ' is niet te lezen: ' + e.message }; }
    }
    if (!uit.ontbreekt) uit.versheid = versheidVan(naam, uit.data, wortel, soortVan);
    cache.set(naam, uit);
    return uit;
  }
  /* Is dit register met de hand geschreven? Dat staat in AFGELEID.json en wordt
     hier niet opnieuw bepaald. */
  let soorten = null;
  function soortVan(naam) {
    /* Via laad(), zodat een kapot AFGELEID.json een reden draagt en niet stil
       als leeg wordt gelezen. */
    if (!soorten) {
      soorten = new Map();
      const a = laad('AFGELEID.json');
      for (const x of (a.data && a.data.artefacten) || []) soorten.set(x.naam, x.soort);
    }
    return soorten.get(naam) || null;
  }
  return { laad, wortel, bron };
}

/* De versheid van een register: het invoerspoor waar het er is, de eigen regel
   van TOETSROUTES.json, en anders onbekend met de reden. Nooit "stempel is
   HEAD, dus actueel": dat is precies de regel die fase 2 vervangt. */
function versheidVan(naam, data, wortel, soortVan) {
  try {
    if (naam === 'TOETSROUTES.json') return require('../toetsroutes').versheid(data, { wortel });
    const s = data && (data.stempel || (data.gemeten && data.gemeten.op ? data.gemeten : null));
    if (s && s.invoer) return invoerVersheid(s, { wortel });
    if (soortVan && soortVan(naam) === 'BRON') return { stand: 'onbekend', reden: 'met de hand geschreven (AFGELEID.json: BRON): er is geen meting om te verouderen' };
    return { stand: 'onbekend', reden: s ? 'dit register draagt geen gemeten invoer (fase 2 dekt nog niet elke generator)' : 'dit register draagt geen stempel' };
  } catch (e) {
    return { stand: 'onbekend', reden: 'versheid niet te bepalen: ' + e.message };
  }
}

/* Een regel. `pad` is de herkomst binnen het register: segmenten gescheiden
   door een punt, en [veld=waarde] kiest een element uit een lijst. */
function regel(lezer, { veld, waarde, register, pad, kies, navolgbaar, tegenspraak, toelichting }) {
  const r = lezer.laad(register);
  if (r.ontbreekt) {
    return { veld, waarde: null, graad: 'onbekend', versheid: 'onbekend', tegenspraak: 'onbepaald',
      herkomst: { register, pad: null }, reden: r.reden };
  }
  const g = GRAAD[register] || ['onbekend', 'deze bron heeft geen verklaarde graad'];
  const leeg = waarde === undefined || waarde === null || (Array.isArray(waarde) && waarde.length === 0);
  return {
    veld,
    waarde: waarde === undefined ? null : waarde,
    graad: leeg && waarde !== 0 && !Array.isArray(waarde) ? 'onbekend' : g[0],
    versheid: r.versheid.stand,
    tegenspraak: tegenspraak || 'onbepaald',
    herkomst: navolgbaar === false
      ? { register, pad, navolgbaar: false, reden: 'samengesteld uit meer dan een element; zie de toelichting' }
      : { register, pad, ...(kies ? { kies } : {}) },
    ...(toelichting ? { toelichting } : {}),
    ...(leeg && !Array.isArray(waarde) ? { reden: register + ' noemt hier niets' } : {}),
  };
}

/* Volg een herkomstpad terug in de data. De gouden toetsen doen dit voor elke
   regel: een herkomst die niet naar dezelfde waarde leidt, is een verzinsel. */
function volg(data, pad, kies) {
  if (pad == null) return undefined;
  let v = data;
  for (const deel of splits(pad)) {
    if (v == null) return undefined;
    const m = /^\[([^=~\]]+)([=~])(.*)\](\*?)$/.exec(deel);
    if (m) {
      if (!Array.isArray(v)) return undefined;
      const past = (x) => {
        const w = haal(x, m[1]);
        return m[2] === '=' ? String(w) === m[3] : new RegExp(m[3]).test(String(w));
      };
      v = m[4] ? v.filter(past) : v.find(past);
    } else v = v[deel];
  }
  if (!kies || v == null) return v;
  if (kies === '#aantal') return Array.isArray(v) ? v.length : Object.keys(v).length;
  return Array.isArray(v) ? v.map((x) => haal(x, kies)) : haal(v, kies);
}
function haal(x, sleutel) {
  return String(sleutel).split('.').reduce((a, k) => (a == null ? a : a[k]), x);
}
function splits(pad) {
  const uit = [];
  let huidig = '', diepte = 0;
  for (const c of pad) {
    if (c === '[') { if (huidig) uit.push(huidig); huidig = '['; diepte++; continue; }
    if (c === ']') { huidig += ']'; uit.push(huidig); huidig = ''; diepte--; continue; }
    /* Een `*` direct na een filter hoort bij dat filter (alle treffers). */
    if (c === '*' && !diepte && !huidig && uit.length && uit[uit.length - 1].endsWith(']')) { uit[uit.length - 1] += '*'; continue; }
    if (c === '.' && !diepte) { if (huidig) uit.push(huidig); huidig = ''; continue; }
    huidig += c;
  }
  if (huidig) uit.push(huidig);
  return uit;
}

/* ---------------------------------------------------------------- vinden */

const METHODE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\//;

/* Waar gaat een vraag over? Een route, een bestand, een wet, een domein of een
   symbool. Is het dubbelzinnig, dan krijgt de vrager de kandidaten en kiest de
   Architect er niet stil een. */
function vind(lezer, ding) {
  const k = [];
  const tekst = String(ding || '').trim();
  if (METHODE.test(tekst)) k.push({ soort: 'route', id: tekst.replace(/\s+/, ' ') });
  else if (tekst.startsWith('/')) {
    const rb = lezer.laad('ROUTEBRON.json');
    for (const r of (rb.data && rb.data.perRoute) || []) if (r.route.split(' ')[1] === tekst) k.push({ soort: 'route', id: r.route });
  }
  if (fs.existsSync(path.join(lezer.bron, tekst)) && fs.statSync(path.join(lezer.bron, tekst)).isFile()) k.push({ soort: 'bestand', id: tekst });
  const w = lezer.laad('WETTEN.json');
  if (w.data && (w.data.wetten || []).some((x) => x.id === tekst)) k.push({ soort: 'wet', id: tekst });
  const g = lezer.laad('GRENZEN.json');
  if (g.data && g.data.domeinen && Object.prototype.hasOwnProperty.call(g.data.domeinen, tekst)) k.push({ soort: 'domein', id: tekst });
  if (!k.length && /^[A-Za-z_$][\w$]*$/.test(tekst)) {
    const s = lezer.laad('SYMBOLEN.json');
    for (const b of (s.data && s.data.perBestand) || []) {
      for (const sym of b.symbolen || []) if (sym.naam === tekst) k.push({ soort: 'symbool', id: b.bestand + '#' + sym.naam + ':' + sym.lijn });
    }
  }
  return k;
}

/* ---------------------------------------------------------------- uitleggen */

function uitlegBestand(lezer, bestand) {
  const regels = [];
  const s = lezer.laad('SYMBOLEN.json');
  const pb = s.data && (s.data.perBestand || []).find((b) => b.bestand === bestand);
  const p = 'perBestand[bestand=' + bestand + ']';
  regels.push(regel(lezer, { veld: 'symbolen', waarde: pb ? pb.symbolen.map((x) => x.naam) : null, register: 'SYMBOLEN.json', pad: p + '.symbolen', kies: 'naam' }));
  regels.push(regel(lezer, { veld: 'geladen door', waarde: pb ? pb.gebruiktDoor : null, register: 'SYMBOLEN.json', pad: p + '.gebruiktDoor' }));
  regels.push(regel(lezer, { veld: 'laadt', waarde: pb ? pb.requires : null, register: 'SYMBOLEN.json', pad: p + '.requires' }));

  const rb = lezer.laad('ROUTEBRON.json');
  const routes = rb.data ? (rb.data.perRoute || []).filter((r) => r.bestand === bestand).map((r) => r.route) : null;
  const ag = lezer.laad('AANROEPGRAAF.json');
  const viaGraaf = ag.data ? (ag.data.routeNaarSymbool || []).filter((r) => r.bestand === bestand).map((r) => r.route) : null;
  regels.push(regel(lezer, { veld: 'routes (router)', waarde: routes, register: 'ROUTEBRON.json', pad: 'perRoute[bestand=' + bestand + ']*', kies: 'route',
    tegenspraak: routes && viaGraaf ? (zelfde(routes, viaGraaf) ? 'geen-gevonden' : 'gevonden') : 'onbepaald',
    toelichting: routes && viaGraaf && !zelfde(routes, viaGraaf) ? 'AANROEPGRAAF.json noemt ' + viaGraaf.length + ' route(s) voor dit bestand, ROUTEBRON.json ' + routes.length : undefined }));

  const w = lezer.laad('WETTEN.json');
  const wetten = w.data ? (w.data.wetten || []).filter((x) => x.sabotage && x.sabotage.bestand === bestand).map((x) => x.id) : null;
  regels.push(regel(lezer, { veld: 'wetten', waarde: wetten, register: 'WETTEN.json', pad: 'wetten[sabotage.bestand=' + bestand + ']*', kies: 'id', toelichting: 'wetten waarvan de sabotageproef dit bestand breekt' }));
  return regels;
}

function uitlegRoute(lezer, route) {
  const regels = [];
  const [methode, pad] = route.split(' ');
  const rb = lezer.laad('ROUTEBRON.json');
  const r = rb.data && (rb.data.perRoute || []).find((x) => x.route === route);
  const ag = lezer.laad('AANROEPGRAAF.json');
  const a = ag.data && (ag.data.routeNaarSymbool || []).find((x) => x.route === route);
  regels.push(regel(lezer, { veld: 'regel', waarde: r ? r.regel : null, register: 'ROUTEBRON.json', pad: 'perRoute[route=' + route + '].regel' }));
  regels.push(regel(lezer, { veld: 'bestand', waarde: r ? r.bestand : null, register: 'ROUTEBRON.json', pad: 'perRoute[route=' + route + '].bestand',
    tegenspraak: r && a ? (r.bestand === a.bestand ? 'geen-gevonden' : 'gevonden') : 'onbepaald',
    toelichting: r && a && r.bestand !== a.bestand ? 'AANROEPGRAAF.json zegt ' + a.bestand : undefined }));
  regels.push(regel(lezer, { veld: 'symbolen', waarde: a ? a.symbolen : null, register: 'AANROEPGRAAF.json', pad: 'routeNaarSymbool[route=' + route + '].symbolen' }));
  const em = lezer.laad('EXECUTION_MAP.json');
  for (const c of (em.data && em.data.capabilities || []).filter((x) => x.pad === pad)) {
    const p = 'capabilities[pad=' + pad + ']*';
    regels.push(regel(lezer, { veld: 'rol ' + c.rol + ': herhaling', waarde: c.herhaling, register: 'EXECUTION_MAP.json', pad: p + '[rol=' + c.rol + '].herhaling' }));
    regels.push(regel(lezer, { veld: 'rol ' + c.rol + ': bewijs', waarde: c.bewijs, register: 'EXECUTION_MAP.json', pad: p + '[rol=' + c.rol + '].bewijs', toelichting: c.bewijsReden }));
    regels.push(regel(lezer, { veld: 'rol ' + c.rol + ': AI-bereik', waarde: c.bereik, register: 'EXECUTION_MAP.json', pad: p + '[rol=' + c.rol + '].bereik' }));
  }
  const tr = lezer.laad('TOETSROUTES.json');
  const toetsen = tr.data ? Object.entries(tr.data.per || {}).filter(([, t]) => t.kanten && t.kanten[route]).map(([n, t]) => n + ' (' + t.kanten[route] + ')') : null;
  regels.push(regel(lezer, { veld: 'waargenomen toetsen', waarde: toetsen, register: 'TOETSROUTES.json', pad: 'per', navolgbaar: false, toelichting: 'per toets de reeks over de rondes: 1 gezien, 0 niet, - draaide niet' }));
  void methode;
  return regels;
}

function uitlegDomein(lezer, domein) {
  const regels = [];
  const g = lezer.laad('GRENZEN.json');
  regels.push(regel(lezer, { veld: 'mag aan de kern', waarde: g.data && g.data.domeinen ? g.data.domeinen[domein] : null, register: 'GRENZEN.json', pad: 'domeinen.' + domein }));
  const s = lezer.laad('SYMBOLEN.json');
  const vorm = new RegExp('^server/(?:kern|routes)/' + domein.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(/|\\.js$|-)');
  const bestanden = s.data ? (s.data.perBestand || []).filter((b) => vorm.test(b.bestand)).map((b) => b.bestand) : null;
  regels.push(regel(lezer, { veld: 'bestanden', waarde: bestanden, register: 'SYMBOLEN.json', pad: 'perBestand[bestand~' + vorm.source + ']*', kies: 'bestand', toelichting: 'bestanden onder server/kern/' + domein + ' en server/routes/' + domein + ' (op naam; het domein is in GRENZEN.json een lijst kernnamen en geen map)' }));
  const rb = lezer.laad('ROUTEBRON.json');
  const set = new Set(bestanden || []);
  const routes = rb.data && bestanden ? (rb.data.perRoute || []).filter((r) => set.has(r.bestand)).map((r) => r.route) : null;
  regels.push(regel(lezer, { veld: 'routes in die bestanden', waarde: routes, register: 'ROUTEBRON.json', pad: 'perRoute', navolgbaar: false, toelichting: 'routes waarvan ROUTEBRON.json het bestand in de lijst hierboven noemt' }));
  return regels;
}

function uitlegWet(lezer, id) {
  const w = lezer.laad('WETTEN.json');
  const x = w.data && (w.data.wetten || []).find((y) => y.id === id);
  const p = 'wetten[id=' + id + ']';
  return [
    regel(lezer, { veld: 'wet', waarde: x ? x.wet : null, register: 'WETTEN.json', pad: p + '.wet' }),
    regel(lezer, { veld: 'bron', waarde: x ? x.bron : null, register: 'WETTEN.json', pad: p + '.bron' }),
    regel(lezer, { veld: 'bewaakt door', waarde: x ? x.bewaaktDoor : null, register: 'WETTEN.json', pad: p + '.bewaaktDoor' }),
  ];
}

function uitleg(lezer, ding) {
  const k = vind(lezer, ding);
  if (!k.length) return { ding, gevonden: false, reden: 'geen route, bestand, wet, domein of symbool met deze naam in de registers', kandidaten: [] };
  if (k.length > 1) return { ding, gevonden: false, reden: 'dubbelzinnig: kies een van de kandidaten', kandidaten: k };
  const { soort, id } = k[0];
  const regels = soort === 'route' ? uitlegRoute(lezer, id)
    : soort === 'bestand' ? uitlegBestand(lezer, id)
      : soort === 'domein' ? uitlegDomein(lezer, id)
        : soort === 'wet' ? uitlegWet(lezer, id)
          : uitlegBestand(lezer, id.split('#')[0]);
  return { ding, gevonden: true, soort, id, regels };
}

function zelfde(a, b) {
  const x = [...new Set(a)].sort(), y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/* ---------------------------------------------------------------- impact */

/* Drie blokken die NOOIT worden opgeteld: statisch, waargenomen en de
   kennisgaten. En een vaste regel die er altijd staat: versmallen mag niet.
   Dat is KEURING.md, en pas fase 8 kan daar iets aan veranderen. */
function impact(lezer, bestanden) {
  const s = lezer.laad('SYMBOLEN.json');
  const door = new Map();
  for (const b of (s.data && s.data.perBestand) || []) door.set(b.bestand, b.gebruiktDoor || []);
  const geraakt = new Set(bestanden);
  const rij = [...bestanden];
  while (rij.length) for (const x of door.get(rij.shift()) || []) if (!geraakt.has(x)) { geraakt.add(x); rij.push(x); }
  const rb = lezer.laad('ROUTEBRON.json');
  const routes = rb.data ? (rb.data.perRoute || []).filter((r) => geraakt.has(r.bestand)).map((r) => r.route) : null;
  const tr = lezer.laad('TOETSROUTES.json');
  let toetsen = null;
  if (tr.data && routes) {
    const rs = new Set(routes);
    toetsen = Object.entries(tr.data.per || {}).filter(([, t]) => Object.keys(t.kanten || {}).some((k) => rs.has(k))).map(([n]) => n);
  }
  return {
    statisch: [
      regel(lezer, { veld: 'bestanden die erop leunen (require, transitief)', waarde: [...geraakt].sort(), register: 'SYMBOLEN.json', pad: 'perBestand', navolgbaar: false, toelichting: 'de omgekeerde require-sluiting over gebruiktDoor' }),
      regel(lezer, { veld: 'routes in die bestanden', waarde: routes, register: 'ROUTEBRON.json', pad: 'perRoute', navolgbaar: false }),
    ],
    waargenomen: [
      regel(lezer, { veld: 'toetsen die een van die routes raakten', waarde: toetsen, register: 'TOETSROUTES.json', pad: 'per', navolgbaar: false }),
    ],
    kennisgaten: [
      'de require-graaf ziet de kern-tas niet: een route krijgt zijn domein vaak via (kern) => ... (CLAUDE.md, KERNHERKOMST.json)',
      'toetsen die als apart proces over HTTP praten, zijn voor de require-graaf onzichtbaar (scripts/impactbereik.js)',
      tr.ontbreekt ? 'TOETSROUTES.json ontbreekt: welke toetsen deze routes werkelijk raken is niet waargenomen' : 'een relatie die een ronde niet gezien werd, bewijst niet dat hij er niet is',
    ],
    toetsreductie: { toegestaan: false, reden: 'versmallen is een recht dat per effect verdiend wordt (KEURING.md); deze Architect heeft dat recht niet (ARCHITECTOPDRACHT.md fase 8)' },
  };
}

/* ---------------------------------------------------------------- onbekenden */

/* Waar de kennis over RTG ophoudt, in vier bakken. Een getal per bak, en de
   namen erbij; geen totaal over de bakken, want die meten vier dingen. */
function onbekenden(lezer, scope) {
  const binnen = (s) => !scope || String(s).includes(scope);
  const registers = fs.readdirSync(lezer.wortel).filter((f) => /^[A-Z][A-Z0-9_-]*\.json$/.test(f)).sort();
  const versheid = { actueel: [], 'mogelijk-verouderd': [], onbekend: [] };
  for (const r of registers) {
    const l = lezer.laad(r);
    if (l.ontbreekt) { versheid.onbekend.push({ register: r, reden: l.reden }); continue; }
    versheid[l.versheid.stand].push({ register: r, reden: l.versheid.reden });
  }
  const verwacht = Object.keys(GRAAD).filter((r) => lezer.laad(r).ontbreekt).map((r) => ({ register: r, reden: lezer.laad(r).reden }));
  const tegenspraak = [];
  const rb = lezer.laad('ROUTEBRON.json');
  if (rb.data && rb.data.gemeten) tegenspraak.push({ register: 'ROUTEBRON.json', pad: 'gemeten.waarvanTegenspraak', aantal: rb.data.gemeten.waarvanTegenspraak, ook: { verouderd: rb.data.gemeten.waarvanVerouderd, nietVastTeStellen: rb.data.gemeten.waarvanNietVastTeStellen } });
  const em = lezer.laad('EXECUTION_MAP.json');
  if (em.data) tegenspraak.push({ register: 'EXECUTION_MAP.json', pad: 'capabilities', aantal: (em.data.capabilities || []).filter((c) => Object.values(c).includes('ONBEPAALD')).length });
  const bs = lezer.laad('BEWIJSSCHULD.json');
  const schuld = bs.data ? (bs.data.posten || []).filter((p) => binnen(p.id) || binnen(p.wat)).map((p) => ({ id: p.id, soort: p.soort, aantal: p.aantal, wat: p.wat })) : null;
  return {
    graadOnbekend: { ontbrekendeBronnen: verwacht },
    versheid: {
      actueel: versheid.actueel.filter((x) => binnen(x.register)),
      'mogelijk-verouderd': versheid['mogelijk-verouderd'].filter((x) => binnen(x.register)),
      onbekend: versheid.onbekend.filter((x) => binnen(x.register)),
    },
    tegenspraak,
    verklaardeSchuld: schuld === null ? { reden: bs.reden } : schuld,
  };
}

/* ---------------------------------------------------------------- kaart */

/* Geen tweede kaart: de structurele kaart is ARCHITECTUUR.md (scripts/kaart.js).
   Dit zegt waar de Architect uit leest, hoe groot elke bron is en hoe vers. */
function kaart(lezer) {
  const tel = (r, f) => { const l = lezer.laad(r); return l.ontbreekt ? null : f(l.data); };
  return {
    structuur: 'ARCHITECTUUR.md (gegenereerd door scripts/kaart.js)',
    bronnen: Object.keys(GRAAD).map((r) => {
      const l = lezer.laad(r);
      return { register: r, graad: GRAAD[r][0], waarom: GRAAD[r][1], versheid: l.ontbreekt ? 'onbekend' : l.versheid.stand, reden: l.ontbreekt ? l.reden : l.versheid.reden };
    }),
    omvang: [
      regel(lezer, { veld: 'bestanden met symbolen', waarde: tel('SYMBOLEN.json', (d) => (d.perBestand || []).length), register: 'SYMBOLEN.json', pad: 'perBestand', kies: '#aantal' }),
      regel(lezer, { veld: 'routes met een bestand', waarde: tel('ROUTEBRON.json', (d) => d.gemeten && d.gemeten.routerRoutesMetBestand), register: 'ROUTEBRON.json', pad: 'gemeten.routerRoutesMetBestand' }),
      regel(lezer, { veld: 'domeinen', waarde: tel('GRENZEN.json', (d) => Object.keys(d.domeinen || {}).length), register: 'GRENZEN.json', pad: 'domeinen', kies: '#aantal' }),
      regel(lezer, { veld: 'wetten', waarde: tel('WETTEN.json', (d) => (d.wetten || []).length), register: 'WETTEN.json', pad: 'wetten', kies: '#aantal' }),
    ],
  };
}

module.exports = { maakLezer, vind, uitleg, impact, onbekenden, kaart, volg, regel, GRAAD, WORTEL };
