/* RTG Architectenbureau, deelbestand "aiwerk": het spoor waar de AI (Rahul als
   chef-architect) het concept uittekent, de bouwstaat opstelt en de scherpe blik van
   de chef-architect geeft. Val altijd terug op het bureau-sjabloon uit ./bank zodat
   het ook zonder API-sleutel werkt. Krijgt de gedeelde ctx van kern/architect/index.js. */
const { DISCIPLINES, BANK, maakConcept } = require('./bank');

module.exports = (ctx) => {
  const { anthropic, save, scho, nu, vind, publiek } = ctx;
  const con = o => o.concept || maakConcept(o.discipline, o.brief, o.naam, scho);

  async function aiConcept(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    let concept = null;
    if (anthropic) {
      try {
        const sys = require('../rahul').RAHUL_LEAD + 'je bent de chef-architect van RTG Architectenbureau, het meest exclusieve architectenbureau ter wereld voor ' +
          ((DISCIPLINES[o.discipline] || {}).label || o.discipline) + '. Ontwerp een concept op basis van de brief. Antwoord ALLEEN met JSON: ' +
          '{"typologie":"..","constructie":"..","materialen":[".."],"kleuren":[{"naam":"..","hex":"#RRGGBB"}],"voorzieningen":[".."],"verhaal":".."}. ' +
          'Gedempt, natuurlijk "quiet luxury"-palet, geen felle kleuren. Geen echte merknamen of bestaande gebouwen. Kort en concreet, in het Nederlands.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 700, system: sys, messages: [{ role: 'user', content: 'Huis: ' + (o.huis || 'RTG Architectenbureau') + '. Naam: ' + o.naam + '. Brief: ' + (o.brief || o.naam) }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '');
        const jm = t.match(/\{[\s\S]*\}/);
        if (jm) { const p = JSON.parse(jm[0]);
          concept = {
            typologie: scho(p.typologie, 120), constructie: scho(p.constructie, 120), verhaal: scho(p.verhaal, 800),
            materialen: (Array.isArray(p.materialen) ? p.materialen : []).slice(0, 4).map(x => scho(x, 80)),
            voorzieningen: (Array.isArray(p.voorzieningen) ? p.voorzieningen : []).slice(0, 5).map(x => scho(x, 100)),
            kleuren: (Array.isArray(p.kleuren) ? p.kleuren : []).slice(0, 4).map(k => ({ naam: scho(k && k.naam, 40) || 'toon', hex: /^#[0-9a-fA-F]{6}$/.test(k && k.hex) ? k.hex : '#9A9791' }))
          };
          if (!concept.typologie || !concept.kleuren.length) concept = null;
        }
      } catch (e) { /* val terug op het bureau-sjabloon */ }
    }
    o.concept = concept || maakConcept(o.discipline, o.brief, o.naam, scho);
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  function aiBouwstaat(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const b = BANK[o.discipline] || BANK.villa;
    const c = con(o);
    const mats = c.materialen.length ? c.materialen : ['zichtbeton'];
    const delen = b.delen.map((naam, i) => ({
      naam, spec: (i === 0 ? c.constructie : (c.voorzieningen[i % Math.max(1, c.voorzieningen.length)] || 'volgens bureau-standaard'))
    }));
    o.bouwstaat = {
      delen,
      oppervlak: b.oppervlak,
      kavel: b.kavel,
      materiaalpakket: mats,
      kleurwegen: c.kleuren.map(k => k.naam),
      controle: ['ontwerpreview met de chef-architect', 'maquette ter goedkeuring', 'definitief ontwerp met vergunningcheck voor vrijgave'],
      opmerking: 'Conceptcijfers voor het bureau; vergunningen, constructieberekening en oplevering lopen buiten dit ontwerpspoor.'
    };
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  async function aiKritiek(oid, vraag) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Concept niet gevonden.' };
    const c = con(o);
    const regels = [
      'Typologie: het ' + c.typologie + ' is herkenbaar; houd een zuivere lijn en snijd overbodige volumes weg.',
      'Constructie: ' + c.constructie + ' past bij de positionering; laat de ruimte en het daglicht het verhaal dragen.',
      'Materiaal: ' + c.materialen.join(' en ') + ' geven gewicht; zet een enkel contrast in ' + (c.kleuren[2] || c.kleuren[0]).naam + ' voor spanning.',
      'Beleving: ' + (c.voorzieningen[0] || 'de voorziening') + ' is het verschil met de rest; maak dat voelbaar bij binnenkomst.'
    ];
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (anthropic) {
      try {
        const sys = require('../rahul').RAHUL_LEAD + 'je bent de chef-architect van RTG Architectenbureau. Geef een korte, scherpe maar respectvolle kritiek: typologie, constructie, materiaal en de beleving van de ruimte. In het Nederlands. Situatie: ' +
          o.naam + ' (' + ((DISCIPLINES[o.discipline] || {}).label) + '), ' + c.typologie + ', ' + c.constructie + ', tinten ' + c.kleuren.map(k => k.naam).join('/') + '.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 450, system: sys, messages: [{ role: 'user', content: v || 'Geef je kritiek en een concreet verbeterpunt.' }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) { o.kritiek = t; o.updatedAt = nu(); save(); return { ok: true, kritiek: t, ontwerp: publiek(o) }; }
      } catch (e) { /* regelgebaseerde terugval */ }
    }
    o.kritiek = regels.join(' '); o.updatedAt = nu(); save();
    return { ok: true, kritiek: o.kritiek, punten: regels, ontwerp: publiek(o) };
  }

  return { aiConcept, aiBouwstaat, aiKritiek };
};
