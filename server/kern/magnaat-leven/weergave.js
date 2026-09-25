/* Magnaat FROM ZERO: WAT DE SPELER ZIET.

   Per scherm: Vandaag (agenda, gebeurtenissen, betalingen, wat aandacht
   vraagt), Werk, Geld, Netwerk, Wereld en Mijn bedrijf -- dat laatste bestaat
   pas als er een onderneming is. De cijfers komen uit het grootboek, en Geld
   zet RESULTAAT en BANK met opzet naast elkaar: een factuur is omzet, geen
   geld. Wat de Edge kan doen staat in ./volgende.js. */
'use strict';
const R = require('./regels');
const { AANBOD } = require('./klanten');
const { euro } = require('./staat');
const { vrij, gepland, rest, WAT } = require('./tijd');
const { sneller } = require('./gesprek');
const { handelingenNu } = require('./volgende');

function dealBeeld(d) {
  const f = d.factuur;
  return {
    id: d.id, klant: d.klant, fase: d.fase, vervolg: !!d.vervolg, sinds: d.sinds, uren: d.uren || null, termijn: d.termijn || null,
    rondes: d.rondes || [], afspraak: d.afspraak || null, gedaan: d.gedaan || 0, laatGeleverd: !!d.laatGeleverd,
    voorschotOntvangen: !!d.voorschotOntvangen,
    factuur: f ? { nummer: f.nummer, totaal: f.totaal, rest: f.rest, vervaldag: f.vervaldag, herinnerd: f.herinnerd,
      korting: f.korting || 0, gefinancierd: !!f.gefinancierd, betaaldOp: d.betaaldOp || null } : null
  };
}

function weekAgenda(st) {
  const dagen = [];
  for (let dag = st.dag; dag <= st.dag + 6; dag++) {
    const w = R.weekdag(dag);
    dagen.push({ dag, naam: R.DAGNAMEN[w], dienst: st.baan.actief && st.baan.dienstdagen.includes(w), loondag: st.baan.actief && w === st.baan.loondag,
      vrij: vrij(st, dag), gepland: gepland(st, dag), rest: rest(st, dag),
      items: (st.agenda[dag] || []).map((x, i) => ({ index: i, wat: x.wat, naam: WAT[x.wat], minuten: x.minuten,
        klant: x.deal ? (st.deals.find(d => d.id === x.deal) || {}).klant : null })),
      betalingen: st.posten.filter(p => p.dag === dag || (dag === st.dag && p.dag < dag)).map(p => ({ naam: p.naam, bedrag: p.bedrag, achterstand: !!p.achterstand })) });
  }
  return dagen;
}

function aandacht(st, c) {
  const uit = [];
  const komend = st.posten.filter(p => p.dag <= st.dag + 7), nodig = komend.reduce((s, p) => s + p.bedrag, 0);
  if (nodig > st.kas) uit.push({ soort: 'nood', tekst: 'De komende week moet er ' + euro(nodig) + ' betaald worden, en er staat ' + euro(st.kas) + ' op je rekening.' });
  for (const p of st.posten.filter(x => x.achterstand)) uit.push({ soort: 'nood', tekst: p.naam + ' staat open: ' + euro(p.bedrag) + '.' });
  for (const d of st.deals) {
    if (d.fase === 'gefactureerd' && st.dag > d.factuur.vervaldag && !d.factuur.gefinancierd) uit.push({ soort: 'slecht', tekst: d.klant + ' is ' + (st.dag - d.factuur.vervaldag) + ' dagen te laat met ' + euro(d.factuur.rest) + '.' });
    if (d.fase === 'overeenkomst' && d.afspraak.deadline - st.dag <= 3) uit.push({ soort: 'vraag', tekst: 'Het werk voor ' + d.klant + ' moet ' + (d.afspraak.deadline < st.dag ? 'al af zijn' : 'op ' + R.dagNaam(d.afspraak.deadline) + ' af zijn') + '.' });
  }
  if (st.software && st.software.gepauzeerd) uit.push({ soort: 'nood', tekst: 'Je software staat stil tot hij betaald is: zolang kun je niet aan een opdracht werken.' });
  if (c.vorderingen > 0 && st.kas < c.vorderingen) uit.push({ soort: 'info', tekst: 'Je bent ' + euro(c.vorderingen) + ' tegoed, maar dat is nog geen geld.' });
  return uit;
}

/* Het beeld is een KOPIE: wie het in hetzelfde proces ontvangt en er iets aan
   verandert, verandert niets aan het leven. Zonder kopie ging een onderhandeling
   stuk doordat een aanroeper `rondes.pop()` deed op wat hij voor zijn eigen
   lijst hield. */
const toon = (st, boek, nu) => structuredClone(beeld(st, boek, nu));

function beeld(st, boek, nu) {
  const c = boek.cijfers(st), a = st.aanbod ? AANBOD[st.aanbod] : null, deals = st.deals.map(dealBeeld);
  const bedrijfDeals = deals.filter(d => d.afspraak && d.factuur);
  return {
    dag: st.dag, dagNaam: R.dagNaam(st.dag), week: Math.ceil(st.dag / 7), vrijVandaag: rest(st, st.dag),
    volgendeDagOver: Math.max(0, st.gerekendTot + st.dagMs - nu),
    tempo: { stand: st.tempo || 'rustig', standen: Object.keys(R.TEMPO) }, ronde: st.ronde || 0,
    vandaag: { agenda: weekAgenda(st), aandacht: aandacht(st, c), meldingen: st.meldingen.slice(0, 16), volgende: handelingenNu(st) },
    werk: {
      baan: { werkgever: st.baan.werkgever, functie: st.baan.functie, actief: st.baan.actief, uren: st.baan.urenPerWeek,
        dienstdagen: st.baan.dienstdagen.map(w => R.DAGNAMEN[w]), loonPerWeek: st.baan.urenPerWeek * st.baan.uurloon,
        loondag: R.DAGNAMEN[st.baan.loondag], extra: { dag: R.DAGNAMEN[st.baan.extra.dag], minuten: st.baan.extra.minuten, loon: st.baan.extra.loon } },
      project: a ? { naam: a.project, aanbod: a.naam, software: a.software, portfolio: st.portfolio, geleerd: st.geleerd, sneller: sneller(st) } : null,
      bezit: st.bezit,
      opdrachten: deals.filter(d => ['overeenkomst', 'geleverd'].includes(d.fase)),
      kansen: deals.filter(d => ['kans', 'onderhandeling'].includes(d.fase))
    },
    geld: {
      bank: st.kas, klopt: c.kas === st.kas, teOntvangen: c.vorderingen, vooruitOntvangen: c.vooruit, schuld: c.schuld,
      resultaat: { omzet: c.omzet, kosten: c.kosten, resultaat: c.resultaat },
      opdrachten: bedrijfDeals.map(d => ({ klant: d.klant, bedrag: d.afspraak.bedrag, korting: d.factuur.korting,
        ontvangen: d.fase === 'betaald' || d.factuur.gefinancierd, factuur: d.factuur.nummer })),
      komend: st.posten.slice().sort((x, y) => x.dag - y.dag).map(p => ({ id: p.id, naam: p.naam, leverancier: p.leverancier, bedrag: p.bedrag, dag: p.dag, dagNaam: R.dagNaam(Math.max(p.dag, st.dag)), achterstand: !!p.achterstand, uitgesteld: !!p.uitgesteld })),
      facturen: bedrijfDeals.map(d => Object.assign({ klant: d.klant }, d.factuur)),
      recent: (st.boek.recent || []).slice(0, 12)
    },
    netwerk: { contacten: deals },
    wereld: {
      stad: R.JURISDICTIE.stad, startKas: R.START_KAS,
      spelregels: [R.JURISDICTIE.inschrijven, R.JURISDICTIE.btw, R.JURISDICTIE.termijn],
      plaatsen: [{ naam: st.baan.werkgever, wat: st.baan.actief ? 'waar je werkt' : 'waar je werkte' }]
        .concat(deals.filter((d, i, l) => l.findIndex(x => x.klant === d.klant) === i).map(d => ({ naam: d.klant, wat: d.fase === 'afgehaakt' ? 'kent je' : 'klant of kans' }))),
      aanbod: Object.entries(AANBOD).map(([id, x]) => ({ id, naam: x.naam, project: x.project, software: x.software, gekozen: st.aanbod === id }))
    },
    bedrijf: st.onderneming ? {
      naam: st.onderneming.naam, sinds: st.onderneming.sinds, omzet: c.omzet, kosten: c.kosten, resultaat: c.resultaat,
      balans: { kas: c.kas, vorderingen: c.vorderingen, vooruit: c.vooruit, schuld: c.schuld },
      zelfstandig: st.zelfstandig
    } : null,
    rtg: st.rtg
  };
}

module.exports = { toon };
