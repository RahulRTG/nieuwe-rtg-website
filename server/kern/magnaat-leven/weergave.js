/* Magnaat Van Nul: WAT DE SPELER ZIET.

   Een leven wordt per scherm getoond -- Vandaag, Wereld, Werk, Geld, Netwerk en
   Mijn bedrijf -- en dat laatste bestaat pas als er een onderneming is. De
   Edge krijgt `volgende`: de handelingen die NU zin hebben, elk met de reden
   waarom. Wat er niet kan staat er niet als grijze knop, want een weigering
   met reden komt van de server (./acties.js). */
'use strict';
const R = require('./regels');
const { aanbod, klantVan, euro } = require('./staat');
const { dagVanMaand } = require('./dag');

function dealVoorScherm(st, d) {
  const k = klantVan(st, d.klantId) || {};
  return {
    id: d.id, klant: k.naam, behoefte: k.behoefte, fase: d.fase, via: d.via || null,
    bedrag: d.bedrag || null, tegenbod: d.tegenbod || null, laatsteBod: !!d.laatsteBod,
    uren: d.uren || null, urenGedaan: d.urenGedaan || 0,
    factuur: d.factuur ? {
      nummer: d.factuur.nummer, bedrag: d.factuur.bedrag, dag: d.factuur.dag,
      vervaldag: d.factuur.vervaldag, herinnerd: d.factuur.herinnerd, betaaldOp: d.factuur.betaaldOp || null,
      teLaat: !d.factuur.betaaldOp && st.dag > d.factuur.vervaldag ? st.dag - d.factuur.vervaldag : 0
    } : null
  };
}

function volgendeStappen(st) {
  const uit = [];
  const zet = (actie, label, waarom, invoer) => uit.push({ actie, label, waarom, invoer: invoer || null });
  if (!st.project) {
    zet('project', 'Begin een eigen project', 'Naast je baan kun je iets voor jezelf opbouwen.', { aanbod: Object.keys(R.AANBOD) });
  }
  for (const d of st.deals) {
    const k = klantVan(st, d.klantId);
    if (d.fase === 'lead') zet('offerte', 'Offerte aan ' + k.naam, k.naam + ' zoekt ' + k.behoefte + '.', { deal: d.id, bedrag: 'euro' });
    if (d.fase === 'tegenbod') zet('onderhandel', 'Antwoord ' + k.naam, k.naam + ' biedt ' + euro(d.tegenbod) + '.', { deal: d.id, keuze: ['accepteer', 'tegen', 'weiger'] });
    if (d.fase === 'opdracht') zet('werk', 'Werk voor ' + k.naam, (d.uren - d.urenGedaan) + ' uur te gaan.', { deal: d.id, uren: 'getal' });
    if (d.fase === 'klaar' && st.onderneming) zet('factuur', 'Factuur aan ' + k.naam, 'Het werk is af.', { deal: d.id });
    if (d.fase === 'klaar' && !st.onderneming) zet('onderneming', 'Schrijf je in bij de KvK', 'Zonder onderneming kun je ' + k.naam + ' geen factuur sturen. Het kost ' + euro(R.KOSTEN.kvk) + '.', { naam: 'tekst' });
    if (d.fase === 'gefactureerd' && st.dag > d.factuur.vervaldag && !d.factuur.herinnerd) {
      zet('herinnering', 'Herinnering aan ' + k.naam, 'Factuur ' + d.factuur.nummer + ' is ' + (st.dag - d.factuur.vervaldag) + ' dagen te laat.', { deal: d.id });
    }
  }
  if (st.project && st.deals.every(d => ['afgewezen', 'betaald'].includes(d.fase))) {
    zet('netwerk', 'Netwerken', 'Je hebt geen lopende klant. Iemand die je kent zoekt misschien wat je doet.');
  }
  if (st.kas < 0 && !st.lening) zet('lenen', 'Leen van je familie', 'Je staat rood. Tot ' + euro(R.LENING.max) + ', in twee termijnen terug.', { bedrag: 'euro' });
  if (st.baan.actief && R.isWeekend(st.dag) && st.overwerkDag !== st.dag && st.uren >= st.baan.overwerk.uren) {
    zet('overwerk', 'Extra dienst', 'Weekendwerk bij ' + st.baan.werkgever + ' levert ' + euro(st.baan.overwerk.loon) + ' op.');
  }
  return uit;
}

function toon(st, boek, nu) {
  const mdag = dagVanMaand(st.dag);
  const a = aanbod(st);
  const openstaand = st.deals.filter(d => d.fase === 'gefactureerd').reduce((s, d) => s + d.factuur.bedrag, 0);
  const deals = st.deals.map(d => dealVoorScherm(st, d));
  return {
    dag: st.dag, dagVanMaand: mdag, weekend: R.isWeekend(st.dag), uren: st.uren,
    volgendeDagOver: Math.max(0, st.gerekendTot + st.dagMs - nu),
    vandaag: { meldingen: st.meldingen.slice(0, 12), volgende: volgendeStappen(st), rood: st.rood },
    wereld: {
      stad: 'Oudwijk', aanbod: Object.entries(R.AANBOD).map(([id, x]) => ({
        id, naam: x.naam, software: x.software, softwareKosten: x.softwareKosten, gekozen: !!st.project && st.project.aanbod === id }))
    },
    werk: { baan: st.baan, project: a ? { naam: a.naam, software: a.software, sinds: st.project.sinds } : null,
      opdrachten: deals.filter(d => ['opdracht', 'klaar'].includes(d.fase)) },
    geld: {
      kas: st.kas, grootboek: boek.saldo(st, ['kas']), klopt: boek.saldo(st, ['kas']) === st.kas,
      openstaand, lening: st.lening,
      vast: { loon: st.baan.actief ? st.baan.loon : 0, huur: R.KOSTEN.huur, vasteLasten: R.KOSTEN.vasteLasten,
        software: a ? a.softwareKosten : 0, levenPerMaand: R.KOSTEN.levenPerDag * R.MAAND },
      recent: (st.boek.recent || []).slice(0, 10)
    },
    netwerk: { contacten: deals },
    bedrijf: st.onderneming ? {
      naam: st.onderneming.naam, sinds: st.onderneming.sinds,
      facturen: deals.filter(d => d.factuur).map(d => Object.assign({ klant: d.klant }, d.factuur)),
      omzet: st.deals.filter(d => d.fase === 'betaald').reduce((s, d) => s + d.factuur.bedrag, 0), openstaand
    } : null,
    rtg: st.rtg
  };
}

module.exports = { toon, volgendeStappen };
