/* DE OUDERDOM VAN EEN OPENSTAANDE POST.

   Debiteuren (wat komt er nog binnen) en crediteuren (wat moet er nog uit)
   stellen dezelfde vraag over dezelfde soort rij: hoeveel dagen is deze factuur
   over zijn vervaldatum, en in welke groep valt hij daarmee. Dat rekenwerk
   staat hier een keer.

   DE GRENZEN ZIJN GEDEELD, DE TEKSTEN NIET. Of iets 20 dagen over is, is
   rekenkunde en aan beide kanten hetzelfde. Wat je eraan doet niet: bij een
   debiteur is "bel de klant" het advies, bij een crediteur "betaal, of uw
   leverancier stopt met leveren". Die teksten wonen daarom bij de kant zelf.
   Zou dit bestand ze ook dragen, dan stond er aan een van beide kanten binnen
   een maand een zin die er niet hoort. */
'use strict';

const DAG = 86400000;

/* De grenzen, in dagen over de vervaldatum. Bewust hier en niet als losse
   getallen bij elke kant: uiteenlopende grenzen maken twee lijsten die niet
   meer naast elkaar te leggen zijn. */
const GRENZEN = [
  { id: 'loopt', tot: 0 },
  { id: 'net', tot: 14 },
  { id: 'lang', tot: 30 },
  { id: 'zeer', tot: 60 },
  { id: 'oud', tot: null }
];

const GROEP_IDS = GRENZEN.map(g => g.id);

/* Hoeveel dagen is deze post over zijn vervaldatum. Negatief betekent: hij
   loopt nog. NULL als er geen vervaldatum is -- dan valt er niets te zeggen, en
   dat is iets anders dan "loopt nog". Die twee door elkaar halen is precies hoe
   een post stilletjes uit beeld raakt. */
function dagenOver(post, nuMs) {
  const v = post && post.vervaldatum;
  if (!v) return null;
  const t = Date.parse(v + 'T12:00:00Z');
  return Number.isFinite(t) ? Math.floor((nuMs - t) / DAG) : null;
}

/* De groep, of null als de ouderdom onbekend is. */
function groepVan(dagen) {
  if (dagen === null || dagen === undefined) return null;
  if (dagen <= 0) return 'loopt';
  for (const g of GRENZEN) {
    if (g.id === 'loopt') continue;
    if (g.tot === null || dagen <= g.tot) return g.id;
  }
  return 'oud';
}

/* Een verzameling posten indelen. Geeft de groepen met aantal en bedrag, de
   rijen met hun ouderdom erbij, en apart wie geen vervaldatum had.

   `teksten` is een kaart van groep-id naar { label, wat }: die komt van de
   aanroepende kant, want daar wonen ze (zie de kop). */
function deelIn(posten, nuMs, teksten) {
  const per = Object.fromEntries(GROEP_IDS.map(id => [id, { aantal: 0, bedrag: 0 }]));
  const rijen = [];
  const zonder = [];

  for (const p of posten) {
    const d = dagenOver(p, nuMs);
    const g = groepVan(d);
    const rij = Object.assign({}, p, { dagenOver: d, groep: g });
    rijen.push(rij);
    if (!g) { zonder.push(rij); continue; }
    per[g].aantal++;
    per[g].bedrag = Math.round((per[g].bedrag + (Number(p.totaal) || 0)) * 100) / 100;
  }

  const vervallen = rijen.filter(r => r.groep && r.groep !== 'loopt');
  return {
    groepen: GROEP_IDS.map(id => Object.assign({ id }, (teksten || {})[id] || {}, per[id])),
    rijen: rijen.sort((a, b) => (b.dagenOver || 0) - (a.dagenOver || 0)),
    vervallen,
    vervallenBedrag: Math.round(vervallen.reduce((n, r) => n + (Number(r.totaal) || 0), 0) * 100) / 100,
    /* De oudste post. Dat ene getal zegt meer dan het totaal: een groot bedrag
       dat net vervalt is iets anders dan een klein bedrag van vier maanden oud. */
    oudste: vervallen.length ? vervallen.reduce((a, b) => (b.dagenOver > a.dagenOver ? b : a)) : null,
    zonderVervaldatum: zonder.length
  };
}

module.exports = { GRENZEN, GROEP_IDS, dagenOver, groepVan, deelIn };
