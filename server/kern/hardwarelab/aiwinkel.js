/* RTG Hardwarelab, deelbestand "aiwinkel": het spoor waar een concept naar de
   RTG-winkel gaat en waar de AI (Rahul als chef-engineer) meewerkt. Het concept
   in de winkel zetten of eruit halen, en de drie AI-acties: het concept uittekenen,
   de stuklijst opstellen en de scherpe kritiek van de chef-engineer. Val altijd
   terug op het lab-sjabloon uit ./bank zodat het ook zonder API-sleutel werkt.
   Krijgt de gedeelde ctx van kern/hardwarelab/index.js. */
const { DISCIPLINES, BANK, maakConcept, slug } = require('./bank');

module.exports = (ctx) => {
  const { db, save, anthropic, scho, nu, vind, publiek } = ctx;
  const con = o => o.concept || maakConcept(o.discipline, o.brief, o.naam, scho);

  function winkelStore() {
    if (!db.data.winkelProducten || typeof db.data.winkelProducten !== 'object') db.data.winkelProducten = {};
    return db.data.winkelProducten;
  }
  /* Een afgerond concept als echt product in de RTG-winkel zetten: het komt in
     db.data.winkelProducten en verschijnt zo op de verkooppagina en in het
     bestel-endpoint, naast de vaste catalogus. De prijs is euro, ex btw. */
  function naarWinkel(oid, prijs) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const eenmalig = Math.max(0, Math.round(Number(prijs && prijs.eenmalig) || 0));
    const perMaand = Math.max(0, Math.round(Number(prijs && prijs.perMaand) || 0));
    if (!eenmalig) return { status: 400, error: 'Geef een geldige eenmalige prijs (euro, ex btw).' };
    const eenheid = scho(prijs && prijs.eenheid, 40) || 'per stuk';
    const c = con(o);
    const store = winkelStore();
    let sl = (o.winkel && o.winkel.slug) ? o.winkel.slug : slug(o.naam);
    if (store[sl] && store[sl].concept && store[sl].concept !== o.id) sl = sl + '-' + o.id.slice(-4);
    store[sl] = {
      naam: o.naam, eenmalig, perMaand, eenheid,
      bron: 'hardwarelab', concept: o.id, discipline: o.discipline,
      disciplineLabel: (DISCIPLINES[o.discipline] || {}).label || o.discipline,
      beschrijving: c.behuizing + ' met ' + c.chip + '.',
      kleuren: (c.kleuren || []).slice(0, 3), at: nu()
    };
    o.winkel = { slug: sl, eenmalig, perMaand, eenheid, at: nu() };
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o), product: store[sl], slug: sl };
  }
  function uitWinkel(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    if (o.winkel && o.winkel.slug) { const store = winkelStore(); delete store[o.winkel.slug]; }
    o.winkel = null; o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  async function aiConcept(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    let concept = null;
    if (anthropic) {
      try {
        const sys = require('../rahul').RAHUL_LEAD + 'je bent de chef-engineer van RTG Hardwarelab, het eigen hardware-ontwerpbureau van RTG voor ' +
          ((DISCIPLINES[o.discipline] || {}).label || o.discipline) + '. Ontwerp een hardware-concept op basis van de brief. Antwoord ALLEEN met JSON: ' +
          '{"behuizing":"..","chip":"..","materialen":[".."],"kleuren":[{"naam":"..","hex":"#RRGGBB"}],"poorten":[".."],"verhaal":".."}. ' +
          'Gedempt "quiet luxury"-palet, geen felle kleuren. Gebruik RTG-huisnamen voor chips (geen echte merken). Kort en concreet, in het Nederlands.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 700, system: sys, messages: [{ role: 'user', content: 'Huis: ' + (o.huis || 'RTG Hardwarelab') + '. Naam: ' + o.naam + '. Brief: ' + (o.brief || o.naam) }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '');
        const jm = t.match(/\{[\s\S]*\}/);
        if (jm) { const p = JSON.parse(jm[0]);
          concept = {
            behuizing: scho(p.behuizing, 120), chip: scho(p.chip, 120), verhaal: scho(p.verhaal, 800),
            materialen: (Array.isArray(p.materialen) ? p.materialen : []).slice(0, 4).map(x => scho(x, 80)),
            poorten: (Array.isArray(p.poorten) ? p.poorten : []).slice(0, 5).map(x => scho(x, 100)),
            kleuren: (Array.isArray(p.kleuren) ? p.kleuren : []).slice(0, 4).map(k => ({ naam: scho(k && k.naam, 40) || 'toon', hex: /^#[0-9a-fA-F]{6}$/.test(k && k.hex) ? k.hex : '#53565A' }))
          };
          if (!concept.behuizing || !concept.kleuren.length) concept = null;
        }
      } catch (e) { /* val terug op het lab-sjabloon */ }
    }
    o.concept = concept || maakConcept(o.discipline, o.brief, o.naam, scho);
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  function aiStuklijst(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const b = BANK[o.discipline] || BANK.apparaat;
    const c = con(o);
    const mats = c.materialen.length ? c.materialen : ['aluminium'];
    const onderdelen = b.onderdelen.map((naam, i) => ({
      naam, spec: (i === 0 ? c.chip : (c.poorten[i % Math.max(1, c.poorten.length)] || 'volgens lab-standaard'))
    }));
    o.stuklijst = {
      onderdelen,
      verbruik: b.verbruik,
      afmetingen: b.afmetingen,
      materiaalpakket: mats,
      kleurwegen: c.kleuren.map(k => k.naam),
      controle: ['ontwerpreview met de chef-engineer', 'maquette/mock-up ter goedkeuring', 'prototype met validatie voor vrijgave'],
      opmerking: 'Conceptcijfers voor het lab; certificering (CE/FCC) en productievrijgave lopen buiten dit ontwerpspoor.'
    };
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  async function aiKritiek(oid, vraag) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const c = con(o);
    const regels = [
      'Behuizing: het ' + c.behuizing + ' is herkenbaar; houd een zuivere lijn en snijd overbodige naden weg.',
      'Chip: ' + c.chip + ' past bij de positionering; laat de stille koeling en de accuduur het verhaal dragen.',
      'Materiaal: ' + c.materialen.join(' en ') + ' geven gewicht; zet een enkel contrast in ' + (c.kleuren[2] || c.kleuren[0]).naam + ' voor spanning.',
      'Gebruik: ' + (c.poorten[0] || 'de aansluiting') + ' is het verschil met de rest; maak dat voelbaar in de eerste seconde.'
    ];
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (anthropic) {
      try {
        const sys = require('../rahul').RAHUL_LEAD + 'je bent de chef-engineer van RTG Hardwarelab. Geef een korte, scherpe maar respectvolle kritiek: behuizing, chip, materiaal en het gebruik in de hand. In het Nederlands. Situatie: ' +
          o.naam + ' (' + ((DISCIPLINES[o.discipline] || {}).label) + '), ' + c.behuizing + ', ' + c.chip + ', tinten ' + c.kleuren.map(k => k.naam).join('/') + '.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 450, system: sys, messages: [{ role: 'user', content: v || 'Geef je kritiek en een concreet verbeterpunt.' }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) { o.kritiek = t; o.updatedAt = nu(); save(); return { ok: true, kritiek: t, ontwerp: publiek(o) }; }
      } catch (e) { /* regelgebaseerde terugval */ }
    }
    o.kritiek = regels.join(' '); o.updatedAt = nu(); save();
    return { ok: true, kritiek: o.kritiek, punten: regels, ontwerp: publiek(o) };
  }

  return { naarWinkel, uitWinkel, aiConcept, aiStuklijst, aiKritiek };
};
