/* RTG Atelier, deelbestand "aiwerk": het spoor waar de AI (Rahul als creatief
   directeur) het concept uittekent, het technisch pakket (tech pack) opstelt en de
   scherpe blik van de creatief directeur geeft. Val altijd terug op het
   atelier-sjabloon uit ./bank zodat het ook zonder API-sleutel werkt. Krijgt de
   gedeelde ctx van kern/atelier/index.js. */
const { CATEGORIEEN, ONDERDELEN, maakConcept } = require('./bank');

module.exports = (ctx) => {
  const { anthropic, save, scho, nu, vind, publiek } = ctx;
  const con = o => o.concept || maakConcept(o.categorie, o.brief, o.naam, scho);

  /* ---- de AI-ontwerper: tekent het concept uit ---- */
  async function aiConcept(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Ontwerp niet gevonden.' };
    let concept = null;
    if (anthropic) {
      try {
        const sys = require('../rahul').RAHUL_LEAD + 'je bent de creatief directeur van RTG Atelier, het meest exclusieve ontwerpbureau ter wereld voor ' +
          ((CATEGORIEEN[o.categorie] || {}).label || o.categorie) + '. Ontwerp een stuk op basis van de brief. Antwoord ALLEEN met JSON: ' +
          '{"silhouet":"...","materialen":[".."],"kleuren":[{"naam":"..","hex":"#RRGGBB"}],"details":[".."],"afwerking":"..","verhaal":".."}. ' +
          'Gebruik een gedempt, "quiet luxury"-palet (geen felle kleuren). Kort en concreet, in het Nederlands.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 700, system: sys, messages: [{ role: 'user', content: 'Merk/huis: ' + (o.huis || 'RTG Atelier') + '. Naam: ' + o.naam + '. Brief: ' + (o.brief || o.naam) }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '');
        const jm = t.match(/\{[\s\S]*\}/);
        if (jm) { const p = JSON.parse(jm[0]);
          concept = {
            silhouet: scho(p.silhouet, 120), afwerking: scho(p.afwerking, 160), verhaal: scho(p.verhaal, 800),
            materialen: (Array.isArray(p.materialen) ? p.materialen : []).slice(0, 4).map(x => scho(x, 80)),
            details: (Array.isArray(p.details) ? p.details : []).slice(0, 5).map(x => scho(x, 100)),
            kleuren: (Array.isArray(p.kleuren) ? p.kleuren : []).slice(0, 4).map(k => ({ naam: scho(k && k.naam, 40) || 'toon', hex: /^#[0-9a-fA-F]{6}$/.test(k && k.hex) ? k.hex : '#8A867E' }))
          };
          if (!concept.silhouet || !concept.kleuren.length) concept = null;
        }
      } catch (e) { /* val terug op het atelier-sjabloon */ }
    }
    o.concept = concept || maakConcept(o.categorie, o.brief, o.naam, scho);
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  /* ---- het technisch pakket (tech pack) ---- */
  function aiTechpack(oid) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Ontwerp niet gevonden.' };
    const c = con(o);
    const mats = c.materialen.length ? c.materialen : ['boxcalf'];
    const namen = ONDERDELEN[o.categorie] || ONDERDELEN.tassen;
    const onderdelen = namen.map((naam, i) => ({
      naam, materiaal: mats[i % mats.length],
      spec: c.details[i % Math.max(1, c.details.length)] || 'volgens atelier-standaard'
    }));
    o.techpack = {
      onderdelen,
      constructie: (CATEGORIEEN[o.categorie] || {}).label + ', met de hand opgebouwd; ' + c.afwerking,
      maten: o.categorie === 'horloges' ? 'kastdiameter 38-40 mm, dikte < 9 mm' : (o.categorie === 'kleding' ? 'volledige maatstaat 34-46 (EU)' : 'atelier-standaardmaat, op maat mogelijk'),
      kleurwegen: c.kleuren.map(k => k.naam),
      controle: ['materiaalkeuring bij ontvangst', 'tussentijdse pasvorm/monsterkeur', 'eindcontrole met de hand'],
      opmerking: 'Prototype eerst; monster ter goedkeuring van de creatief directeur voor productievrijgave.'
    };
    o.updatedAt = nu(); save();
    return { ok: true, ontwerp: publiek(o) };
  }

  /* ---- de blik van de creatief directeur ---- */
  async function aiKritiek(oid, vraag) {
    const o = vind(oid); if (!o) return { status: 404, error: 'Ontwerp niet gevonden.' };
    const c = con(o);
    const regels = [
      'Signatuur: het ' + c.silhouet + ' is herkenbaar; houd één signatuurelement en snijd de rest weg.',
      'Materiaal: ' + c.materialen.join(' en ') + ' dragen het stuk; overweeg één contrast in ' + (c.kleuren[2] || c.kleuren[0]).naam + ' voor spanning.',
      'Commercieel: dit spreekt de couture-klant aan; een ingetogen variant verbreedt de collectie zonder het huis te verwateren.',
      'Afwerking: ' + c.afwerking + ' is het verschil met confectie; laat het zien in de fotografie.'
    ];
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (anthropic) {
      try {
        const sys = require('../rahul').RAHUL_LEAD + 'je bent de creatief directeur van RTG Atelier. Geef een korte, scherpe maar respectvolle kritiek op het ontwerp: signatuur, materiaal, commerciële haak en afwerking. In het Nederlands. Situatie: ' +
          o.naam + ' (' + ((CATEGORIEEN[o.categorie] || {}).label) + '), ' + c.silhouet + ', ' + c.materialen.join('/') + ', tinten ' + c.kleuren.map(k => k.naam).join('/') + '.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 450, system: sys, messages: [{ role: 'user', content: v || 'Geef je kritiek en één concreet verbeterpunt.' }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) { o.kritiek = t; o.updatedAt = nu(); save(); return { ok: true, kritiek: t, ontwerp: publiek(o) }; }
      } catch (e) { /* regelgebaseerde terugval */ }
    }
    o.kritiek = regels.join(' '); o.updatedAt = nu(); save();
    return { ok: true, kritiek: o.kritiek, punten: regels, ontwerp: publiek(o) };
  }

  return { aiConcept, aiTechpack, aiKritiek };
};
