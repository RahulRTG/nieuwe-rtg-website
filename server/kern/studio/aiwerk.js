/* RTG Ontwerpstudio, deelbestand "aiwerk": het spoor waar de AI (Rahul als
   chef-ontwerper) het concept uittekent, de specsheet opstelt en de scherpe blik van
   de chef-ontwerper geeft. Val altijd terug op het studio-sjabloon uit ./bank zodat
   het ook zonder API-sleutel werkt. Krijgt de gedeelde ctx van kern/studio/index.js. */
const { DISCIPLINES, BANK, maakConcept } = require('./bank');

module.exports = (ctx) => {
  const { anthropic, save, scho, nu, vind, publiek } = ctx;
  const con = o => o.concept || maakConcept(o.discipline, o.brief, o.naam, scho);

  async function aiConcept(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    let concept = null;
    if (anthropic) {
      try {
        const sys = require('../rahul').RAHUL_LEAD + 'je bent de chef-ontwerper van RTG Ontwerpstudio, het meest exclusieve ontwerpbureau ter wereld voor ' +
          ((DISCIPLINES[o.discipline] || {}).label || o.discipline) + '. Ontwerp een concept op basis van de brief. Antwoord ALLEEN met JSON: ' +
          '{"silhouet":"..","aandrijving":"..","materialen":[".."],"kleuren":[{"naam":"..","hex":"#RRGGBB"}],"uitrusting":[".."],"verhaal":".."}. ' +
          'Gedempt "quiet luxury"-palet, geen felle kleuren. Geen echte merknamen. Kort en concreet, in het Nederlands.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 700, system: sys, messages: [{ role: 'user', content: 'Huis: ' + (o.huis || 'RTG Ontwerpstudio') + '. Naam: ' + o.naam + '. Brief: ' + (o.brief || o.naam) }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '');
        const jm = t.match(/\{[\s\S]*\}/);
        if (jm) { const p = JSON.parse(jm[0]);
          concept = {
            silhouet: scho(p.silhouet, 120), aandrijving: scho(p.aandrijving, 120), verhaal: scho(p.verhaal, 800),
            materialen: (Array.isArray(p.materialen) ? p.materialen : []).slice(0, 4).map(x => scho(x, 80)),
            uitrusting: (Array.isArray(p.uitrusting) ? p.uitrusting : []).slice(0, 5).map(x => scho(x, 100)),
            kleuren: (Array.isArray(p.kleuren) ? p.kleuren : []).slice(0, 4).map(k => ({ naam: scho(k && k.naam, 40) || 'toon', hex: /^#[0-9a-fA-F]{6}$/.test(k && k.hex) ? k.hex : '#53565A' }))
          };
          if (!concept.silhouet || !concept.kleuren.length) concept = null;
        }
      } catch (e) { /* val terug op het studio-sjabloon */ }
    }
    o.concept = concept || maakConcept(o.discipline, o.brief, o.naam, scho);
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  function aiSpecsheet(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const b = BANK[o.discipline] || BANK.automotive;
    const c = con(o);
    const mats = c.materialen.length ? c.materialen : ['koolstofvezel'];
    const modules = b.modules.map((naam, i) => ({
      naam, spec: (i === 0 ? c.aandrijving : (c.uitrusting[i % Math.max(1, c.uitrusting.length)] || 'volgens studio-standaard'))
    }));
    o.specsheet = {
      modules,
      prestaties: b.prestaties,
      afmetingen: b.afmetingen,
      materiaalpakket: mats,
      kleurwegen: c.kleuren.map(k => k.naam),
      controle: ['ontwerpreview met de chef-ontwerper', 'maquette/schaalmodel ter goedkeuring', 'prototype met validatie voor vrijgave'],
      opmerking: 'Conceptcijfers voor de studio; homologatie en certificering lopen buiten dit ontwerpspoor.'
    };
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  async function aiKritiek(oid, vraag) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const c = con(o);
    const regels = [
      'Silhouet: het ' + c.silhouet + ' is herkenbaar; houd een zuivere lijn en snijd overbodige details weg.',
      'Aandrijving: ' + c.aandrijving + ' past bij de positionering; laat de stilte en het koppel het verhaal dragen.',
      'Materiaal: ' + c.materialen.join(' en ') + ' geven gewicht; zet een enkel contrast in ' + (c.kleuren[2] || c.kleuren[0]).naam + ' voor spanning.',
      'Ervaring: ' + (c.uitrusting[0] || 'de uitrusting') + ' is het verschil met de rest; maak dat voelbaar in de eerste seconde.'
    ];
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (anthropic) {
      try {
        const sys = require('../rahul').RAHUL_LEAD + 'je bent de chef-ontwerper van RTG Ontwerpstudio. Geef een korte, scherpe maar respectvolle kritiek: silhouet, aandrijving, materiaal en de ervaring aan boord. In het Nederlands. Situatie: ' +
          o.naam + ' (' + ((DISCIPLINES[o.discipline] || {}).label) + '), ' + c.silhouet + ', ' + c.aandrijving + ', tinten ' + c.kleuren.map(k => k.naam).join('/') + '.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 450, system: sys, messages: [{ role: 'user', content: v || 'Geef je kritiek en een concreet verbeterpunt.' }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) { o.kritiek = t; o.updatedAt = nu(); save(); return { ok: true, kritiek: t, ontwerp: publiek(o) }; }
      } catch (e) { /* regelgebaseerde terugval */ }
    }
    o.kritiek = regels.join(' '); o.updatedAt = nu(); save();
    return { ok: true, kritiek: o.kritiek, punten: regels, ontwerp: publiek(o) };
  }

  return { aiConcept, aiSpecsheet, aiKritiek };
};
