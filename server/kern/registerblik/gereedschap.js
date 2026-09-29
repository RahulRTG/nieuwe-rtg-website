/* DE REGISTERBLIK -- zes gereedschappen die RTG's eigen waarheid LEZEN.

   Het kleine model hoeft niet te weten hoe RTG ervoor staat; het zoekt het op.
   Daarom zijn de gereedschappen RIJK en het redeneerprobleem KLEIN:
   `inspecteerRoute` legt zelf de uitvoeringskaart, de vervalstaat en het
   bestand naast elkaar, zodat het model niet hoeft te weten welk register bij
   welke vraag hoort.

   WAT ZE NIET KUNNEN, en dat is het ontwerp. Er is geen `leesBestand(pad)`:
   het model noemt een ROUTE of een ZOEKTERM, nooit een bestand, en een pad dat
   op een bestand lijkt is gewoon een route die niemand kent. Ze schrijven
   niets, voeren niets uit en vellen geen oordeel -- de productiestand wordt
   DOORGEGEVEN zoals scripts/productie-status.js hem schreef, en nergens uit
   losse registers samengesteld (een bewijsinstrument velt geen go-live-oordeel,
   keuringsregel 48). Elk antwoord noemt zijn register, zijn leeftijd en zijn
   graad. */
'use strict';
const { leesRegister, leeftijd, graadUitLeeftijd } = require('./bronnen');
const { segmentPatroon } = require('../../lib/padvorm');

const MAX_RIJEN = 12;
const schoon = (x) => String(x == null ? '' : x).trim().replace(/[?#].*$/, '').slice(0, 200);

const REGISTERBLIK_TOOLS = [
  { name: 'inspecteerRoute', description: 'Alles wat RTG over EEN API-route weet, uit de eigen registers: wat de AI ermee mag, ' +
      'of een herhaling schade doet, de vervalstaat van het bewijs (en waarom), en in welk bestand hij staat -- met de leeftijd van elke meting.',
    input_schema: { type: 'object', properties: { pad: { type: 'string', description: 'het API-pad, bijvoorbeeld /api/bank/pas/betaal' } }, required: ['pad'] } },
  { name: 'vraagVertrouwenOp', description: 'De vervalstaat van het bewijs (bewezen, verschaald, verzwakt, geschorst, ongemeten). ' +
      'Zonder pad: de telling over alle routes. Met pad: de staat van die route en wat hem zou veranderen.',
    input_schema: { type: 'object', properties: { pad: { type: 'string' } } } },
  { name: 'vraagBewijsOp', description: 'Wat RTG WEET dat het nog niet heeft gemeten, en waarom: de posten van de bewijsschuld met hun ' +
      'sluitweg. Zonder post: het overzicht. Met post: die ene post voluit.',
    input_schema: { type: 'object', properties: { post: { type: 'string', description: 'de id van een post, bijvoorbeeld objectpoort' } } } },
  { name: 'vraagProductiestandOp', description: 'De laatste release-uitspraak zoals scripts/productie-status.js hem schreef: ' +
      'de stand en de blokkades. Ontbreekt die meting in deze omgeving, dan zegt het dat.',
    input_schema: { type: 'object', properties: {} } },
  { name: 'zoekKennis', description: 'Zoek in de documenten van RTG (besluiten, grenzen, waarom iets zo is gebouwd). ' +
      'Je krijgt de passende stukken met de registers die ze noemen: een document is een bewering, toets hem daaraan.',
    input_schema: { type: 'object', properties: { vraag: { type: 'string', description: 'de vraag of een paar woorden, bijvoorbeeld "waarom MONEY-012"' } }, required: ['vraag'] } },
  { name: 'zoekRegister', description: 'Zoek routes en bewijsposten die bij een woord horen (bijvoorbeeld "wallet" of "incasso"), ' +
      'om daarna met inspecteerRoute verder te kijken.',
    input_schema: { type: 'object', properties: { term: { type: 'string' } }, required: ['term'] } }
];

const bron = (r, l) => ({ register: r.register, gemetenOp: l.gemetenOp, dagenOud: l.dagenOud,
  vervallen: l.vervallen, graad: graadUitLeeftijd(l), ...(l.reden ? { leeftijd: l.reden } : {}) });
const nietVast = (r) => ({ stand: 'niet vast te stellen', register: r.register, reden: r.reden });

function past(patroon, pad) {
  if (patroon === pad) return true;
  const rx = segmentPatroon(patroon);
  return !!(rx && rx.test(pad));
}

function vervalstaatRijen(pad) {
  const r = leesRegister('vertrouwen');
  if (!r.ok) return { r, rijen: null };
  const rijen = Object.entries(r.inhoud.perRoute || {})
    .filter(([sleutel]) => past(sleutel.slice(sleutel.indexOf(' ') + 1), pad))
    .slice(0, 4).map(([route, u]) => ({ route, staat: u.staat, reden: u.reden || null, heropent: u.heropent || null }));
  return { r, rijen };
}

function inspecteerRoute({ pad }) {
  const p = schoon(pad);
  if (!p.startsWith('/')) return { pad: p, bekend: false, reden: 'een route begint met / (bijvoorbeeld /api/bank/pas/betaal); dit gereedschap leest geen bestanden' };
  const uit = { pad: p, bronnen: [] };
  const kaart = leesRegister('uitvoeringskaart');
  if (kaart.ok) {
    uit.uitvoering = (kaart.inhoud.capabilities || []).filter(c => past(c.pad, p)).slice(0, 4)
      .map(c => ({ pad: c.pad, rol: c.rol, bereik: c.bereik, herhaling: c.herhaling, herhalingBesluit: c.herhalingBesluit || null }));
    uit.bronnen.push({ register: kaart.register, graad: 'vermoed',
      leeftijd: 'afgeleide kaart zonder eigen stempel; risico, herstel en kosten staan er met opzet ONBEPAALD' });
  } else uit.uitvoering = nietVast(kaart);
  const v = vervalstaatRijen(p);
  if (v.rijen) { uit.vervalstaat = v.rijen; uit.bronnen.push(bron(v.r, leeftijd(v.r.inhoud))); } else uit.vervalstaat = nietVast(v.r);
  const rb = leesRegister('routebron');
  if (rb.ok) {
    uit.bestand = (rb.inhoud.perRoute || []).filter(x => past(String(x.route).slice(String(x.route).indexOf(' ') + 1), p))
      .slice(0, 4).map(x => ({ route: x.route, bestand: x.bestand, regel: x.regel }));
    uit.bronnen.push(bron(rb, leeftijd(rb.inhoud)));
  } else uit.bestand = nietVast(rb);
  uit.bekend = !!((Array.isArray(uit.uitvoering) && uit.uitvoering.length) || (Array.isArray(uit.vervalstaat) && uit.vervalstaat.length));
  if (!uit.bekend) uit.reden = 'geen register kent deze route; zoek met zoekRegister naar een woord uit het pad';
  return uit;
}

function vraagVertrouwenOp({ pad } = {}) {
  const r = leesRegister('vertrouwen');
  if (!r.ok) return nietVast(r);
  const l = leeftijd(r.inhoud);
  if (pad) { const v = vervalstaatRijen(schoon(pad)); return { pad: schoon(pad), vervalstaat: v.rijen, bron: bron(r, l) }; }
  return { telling: r.inhoud.telling, routes: r.inhoud.routes, grens: r.inhoud.grens, bron: bron(r, l) };
}

function vraagBewijsOp({ post } = {}) {
  const r = leesRegister('bewijsschuld');
  if (!r.ok) return nietVast(r);
  const posten = r.inhoud.posten || [];
  const b = bron(r, leeftijd(r.inhoud));
  if (post) {
    const p = posten.find(x => x.id === String(post));
    return p ? { post: p, bron: b } : { post: null, reden: 'geen post met deze id', ids: posten.map(x => x.id), bron: b };
  }
  return { achterstand: r.inhoud.aflossing && r.inhoud.aflossing.staat, grens: r.inhoud.grens, bron: b,
    posten: posten.map(x => ({ id: x.id, soort: x.soort, aantal: x.aantal, wat: String(x.wat || '').slice(0, 160) })) };
}

function vraagProductiestandOp() {
  const r = leesRegister('productiestand');
  if (!r.ok) return Object.assign(nietVast(r), { hoe: 'npm run productie:status schrijft deze uitspraak op de releasemachine' });
  const s = r.inhoud;
  return { PRODUCTION_STATUS: s.PRODUCTION_STATUS, blokkades: (s.blokkades || []).slice(0, 25),
    commit: s.commit || null, bron: bron(r, leeftijd(s)),
    let: 'dit is de uitspraak van de release-keuring zelf; de registerblik voegt er niets aan toe en weegt niets bij' };
}

function zoekRegister({ term }) {
  const t = schoon(term).toLowerCase();
  if (t.length < 3) return { reden: 'geef een zoekwoord van minstens drie tekens' };
  const uit = { term: t };
  const kaart = leesRegister('uitvoeringskaart');
  uit.routes = kaart.ok ? [...new Set((kaart.inhoud.capabilities || []).map(c => c.pad).filter(p => p.toLowerCase().includes(t)))].slice(0, MAX_RIJEN) : nietVast(kaart);
  const schuld = leesRegister('bewijsschuld');
  uit.bewijsposten = schuld.ok ? (schuld.inhoud.posten || [])
    .filter(x => (x.id + ' ' + x.wat).toLowerCase().includes(t)).map(x => x.id).slice(0, MAX_RIJEN) : nietVast(schuld);
  return uit;
}

const { zoekKennis } = require('./kennis');
const HANDEN = { inspecteerRoute, vraagVertrouwenOp, vraagBewijsOp, vraagProductiestandOp, zoekRegister, zoekKennis };

/* De enige ingang. Een onbekend gereedschap is een antwoord en geen crash. */
function kijk(naam, invoer) {
  const h = Object.prototype.hasOwnProperty.call(HANDEN, naam) ? HANDEN[naam] : null;
  if (!h) return { fout: 'onbekend gereedschap: ' + String(naam).slice(0, 40), kan: Object.keys(HANDEN) };
  try { return h(invoer && typeof invoer === 'object' ? invoer : {}); }
  catch (e) { return { fout: 'dit gereedschap kon niet kijken', stand: 'niet vast te stellen' }; }
}

module.exports = { REGISTERBLIK_TOOLS, kijk };
