/* Magnaat V2: WAT DE ONDERNEMER ZIET -- team, contracten, handel, kosten per
   soort, en de cashflowprognose.

   DE PROGNOSE REKENT ALLEEN MET WAT VASTSTAAT: betalingen die klaarstaan, je
   loon, boodschappen, het loon en de werkplekken van je team, facturen op hun
   vervaldag en voorschotten die zijn afgesproken. Wat er NIET in staat, staat
   erbij: nieuwe omzet die je nog moet verdienen, verkoop, uren van een
   freelancer die je nog niet hebt ingepland, en een klant die te laat betaalt.
   Een prognose die dat verzwijgt, belooft geld dat er niet is. */
'use strict';
const R = require('./regels');
const B = require('./regels-bedrijf');
const { werkminuten } = require('./team');
const { waarVan, vraagPerWeek, geblokkeerd } = require('./voorraad');

const KOSTEN = { software: 'Software', personeel: 'Loon van je team', inhuur: 'Freelancers', werkplek: 'Werkplekken',
  inkoopwaarde: 'Inkoopwaarde van wat je verkocht', korting: 'Korting aan klanten', financiering: 'Voorfinanciering', kvk: 'Inschrijving' };

/* Het loon dat je team in dit venster krijgt: op elke vrijdag, en op de dag na
   iemands laatste werkdag. */
function teamLoon(st, van, tot) {
  let som = 0;
  for (const m of st.team || []) {
    if (m.weg || m.contract !== 'dienst') continue;
    const momenten = [];
    for (let d = st.dag + 1; d <= tot; d++) if (R.weekdag(d) === R.BAAN.loondag) momenten.push(d);
    if (m.einde != null) momenten.push(m.einde + 1);
    let vorige = m.betaaldTot;
    for (const e of momenten.filter((x, i, l) => l.indexOf(x) === i).sort((a, b) => a - b)) {
      const eind = Math.min(e - 1, m.einde == null ? e - 1 : m.einde);
      let minuten = 0;
      for (let d = vorige + 1; d <= eind; d++) minuten += werkminuten(m, d);
      if (e >= van && e <= tot) som += Math.round(minuten * m.uurloon / 60);
      vorige = Math.max(vorige, eind);
    }
    for (let d = m.werkplekVolgende; d <= tot && (m.einde == null || d <= m.einde); d += B.WERKPLEK.elke) if (d >= van) som += B.WERKPLEK.bedrag;
  }
  return som;
}

function prognose(st) {
  const weken = [];
  let kas = st.kas;
  const loon = st.baan.urenPerWeek * st.baan.uurloon;
  for (let w = 0; w < B.PROGNOSE_WEKEN; w++) {
    const van = st.dag + w * 7, tot = van + 6, binnen = (d) => d >= van && d <= tot;
    let erin = 0, eruit = 0;
    for (let d = van; d <= tot; d++) {
      eruit += R.BOODSCHAPPEN;
      if (st.baan.actief && d > st.dag && R.weekdag(d) === st.baan.loondag) erin += loon;
    }
    for (const p of st.posten) if (binnen(Math.max(p.dag, st.dag))) eruit += p.bedrag;
    for (const d of st.deals) {
      if (d.fase === 'gefactureerd' && !d.factuur.gefinancierd && binnen(Math.max(d.factuur.vervaldag, st.dag + 1))) erin += d.factuur.rest - (d.factuur.korting || 0);
      if (d.fase === 'overeenkomst' && d.voorschotDag && !d.voorschotOntvangen && binnen(d.voorschotDag)) erin += d.afspraak.voorschotBedrag;
    }
    eruit += teamLoon(st, van, tot);
    kas += erin - eruit;
    weken.push({ week: w + 1, van, tot, in: erin, uit: eruit, eind: kas });
  }
  return {
    weken, laagste: Math.min(...weken.map(x => x.eind)),
    nietMee: ['nieuwe opdrachten, contracttermijnen en verkoop: die moet je nog verdienen', 'uren van een freelancer die je nog niet hebt ingepland',
      'een klant die te laat betaalt: de prognose rekent met de vervaldag']
  };
}

function kostenPerSoort(st) {
  const pre = st.wereld + ':kosten:', uit = [];
  for (const [code, x] of Object.entries(st.boek.rekeningen)) {
    if (!code.startsWith(pre) || !x.saldo) continue;
    const soort = code.slice(pre.length);
    uit.push({ soort, naam: KOSTEN[soort] || soort, bedrag: x.saldo });
  }
  return uit.sort((a, b) => b.bedrag - a.bedrag);
}

function bedrijfExtra(st) {
  const w = waarVan(st), h = st.handel;
  return {
    team: (st.team || []).map(m => ({ id: m.id, naam: m.naam, rol: m.rol, contract: m.contract, uurloon: m.uurloon, tempo: m.tempo,
      dagen: m.dagen.map(x => R.DAGNAMEN[x]), minuten: m.minuten, sinds: m.sinds, einde: m.einde, weg: m.weg, gestaakt: !!m.gestaakt })),
    contracten: (st.contracten || []).map(c => ({ id: c.id, klant: c.klant, stand: c.stand, minuten: c.minuten, bedrag: c.bedrag,
      termijn: c.termijn, termijnen: c.termijnen, opgezegd: c.opgezegd, verlenging: c.verlenging })),
    handel: w ? {
      product: w.naam, leverancier: w.leverancier, inkoop: w.inkoop, advies: w.advies, minimum: w.minimum,
      gestart: !!h, prijs: h ? h.prijs : w.advies, voorraad: h ? h.voorraad : 0, onderweg: st.leveringen.reduce((s, l) => s + l.aantal, 0),
      verkocht: h ? h.verkocht : 0, gemist: h ? h.gemist : 0, omzet: h ? h.omzet : 0, marge: h ? h.omzet - h.verkocht * w.inkoop : 0,
      perWeek: Math.round(vraagPerWeek(st) / 100) / 10, geblokkeerd: geblokkeerd(st)
    } : null,
    kosten: kostenPerSoort(st)
  };
}

module.exports = { prognose, bedrijfExtra, kostenPerSoort };
