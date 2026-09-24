/* Magnaat Van Nul: WAT EEN DAG MET JE DOET.

   De klok rekent bij en tikt niet (./index.js, zoals World): voor elke
   verstreken speldag draait `volgendeDag` een keer, in vaste volgorde, zodat
   tien dagen in een keer hetzelfde opleveren als tien dagen los.

     1. de dag begint: nieuwe vrije uren
     2. geld erin: het loon op dag 25, en daarna de termijn van een lening
     3. geld eruit: elke dag boodschappen, en op de eerste van de maand eerst
        de rente als je rood staat, dan huur, vaste lasten en je software
     4. klanten: een antwoord op je offerte, een betaling, of een factuur die
        over de vervaldag gaat
     5. staat je kas onder nul, dan is dat geldnood -- en dat merk je

   Elke euro gaat door het grootboek (./boek.js); dit bestand schrijft geen
   saldo zelf. */
'use strict';
const R = require('./regels');
const { meld, ontgrendel, klantVan, euro } = require('./staat');
const { boekVan } = require('./boek');

const dagVanMaand = (dag) => ((dag - 1) % R.MAAND) + 1;

function antwoordOpOfferte(st, d) {
  const k = klantVan(st, d.klantId);
  if (d.bedrag <= k.budget) {
    Object.assign(d, { fase: 'opdracht', uren: k.uren, urenGedaan: 0 });
    meld(st, k.naam + ' gaat akkoord met je offerte van ' + euro(d.bedrag) + '. Je hebt een opdracht: ' + k.uren + ' uur werk.', 'goed');
  } else if (d.bedrag <= Math.round(k.budget * 1.5)) {
    d.fase = 'tegenbod';
    d.tegenbod = Math.round(k.budget * k.stijl / 100);
    meld(st, k.naam + ' vindt ' + euro(d.bedrag) + ' te veel en biedt ' + euro(d.tegenbod) + '.', 'vraag');
  } else {
    d.fase = 'afgewezen';
    meld(st, k.naam + ' vindt ' + euro(d.bedrag) + ' veel te duur en haakt af.', 'slecht');
  }
}

function betaling(st, d) {
  const k = klantVan(st, d.klantId), f = d.factuur;
  boekVan(st).boekOver(st, { soort: 'BETALING_KLANT', van: ['klant', k.id], naar: ['kas'], bedrag: f.bedrag,
    omschrijving: 'Factuur ' + f.nummer + ' van ' + k.naam, sleutel: 'betaling:' + d.id });
  d.fase = 'betaald';
  f.betaaldOp = st.dag;
  const teLaat = st.dag - f.vervaldag;
  meld(st, k.naam + ' heeft factuur ' + f.nummer + ' betaald: ' + euro(f.bedrag) +
    (teLaat > 0 ? ', ' + teLaat + ' dagen te laat.' : ', op tijd.'), 'goed');
  // een tevreden klant beveelt je aan bij de volgende
  const lijst = R.AANBOD[st.project.aanbod].klanten;
  const volgende = lijst.find(x => !st.deals.some(y => y.klantId === x.id));
  if (volgende) {
    st.deals.push({ id: 'd' + (++st.dealTeller), klantId: volgende.id, fase: 'lead', sinds: st.dag, via: k.naam });
    meld(st, k.naam + ' beveelt je aan bij ' + volgende.naam + '.', 'goed');
  }
}

function volgendeDag(st) {
  const boek = boekVan(st);
  st.dag += 1;
  const dag = st.dag, mdag = dagVanMaand(dag);
  st.uren = R.isWeekend(dag) ? R.UREN.weekend : R.UREN.werkdag;

  if (mdag === 25 && st.baan.actief) {
    boek.boekOver(st, { soort: 'LOON', van: ['werkgever'], naar: ['kas'], bedrag: st.baan.loon,
      omschrijving: 'Loon van ' + st.baan.werkgever, sleutel: 'loon:' + dag });
    meld(st, 'Je loon is binnen: ' + euro(st.baan.loon) + '.', 'goed');
    if (st.lening && st.lening.restant > 0) {
      const t = Math.min(st.lening.termijn, st.lening.restant);
      boek.boekOver(st, { soort: 'AFLOSSING', van: ['kas'], naar: ['familie'], bedrag: t,
        omschrijving: 'Aflossing aan je familie', sleutel: 'aflossing:' + dag });
      st.lening.restant -= t;
      if (!st.lening.restant) { meld(st, 'Je lening bij je familie is afgelost.', 'goed'); st.lening = null; }
    }
  }

  boek.boekOver(st, { soort: 'LEVENSKOSTEN', van: ['kas'], naar: ['winkels'], bedrag: R.KOSTEN.levenPerDag,
    omschrijving: 'Boodschappen en vervoer', sleutel: 'leven:' + dag });

  if (mdag === 1) {
    if (st.kas < 0) {
      const rente = Math.round(-st.kas * R.KOSTEN.roodRentePromille / 1000);
      boek.boekOver(st, { soort: 'RENTE', van: ['kas'], naar: ['bank'], bedrag: rente,
        omschrijving: 'Rente over rood staan', sleutel: 'rente:' + dag });
      if (rente) meld(st, 'Rood staan kostte deze maand ' + euro(rente) + ' rente.', 'slecht');
    }
    boek.boekOver(st, { soort: 'HUUR', van: ['kas'], naar: ['verhuurder'], bedrag: R.KOSTEN.huur,
      omschrijving: 'Huur', sleutel: 'huur:' + dag });
    boek.boekOver(st, { soort: 'VASTE_LASTEN', van: ['kas'], naar: ['leveranciers'], bedrag: R.KOSTEN.vasteLasten,
      omschrijving: 'Energie, zorgverzekering en telefoon', sleutel: 'vast:' + dag });
    if (st.project) {
      const a = R.AANBOD[st.project.aanbod];
      boek.boekOver(st, { soort: 'SOFTWARE', van: ['kas'], naar: ['software'], bedrag: a.softwareKosten,
        omschrijving: a.software, sleutel: 'software:' + dag });
    }
    meld(st, 'De eerste van de maand: huur, vaste lasten' + (st.project ? ' en je software' : '') + ' zijn afgeschreven.');
  }

  for (const d of st.deals) {
    if (d.fase === 'offerte' && d.antwoordDag <= dag) antwoordOpOfferte(st, d);
    if (d.fase === 'gefactureerd') {
      const f = d.factuur;
      if (dag >= f.betaalDag) betaling(st, d);
      else if (dag > f.vervaldag && !f.teLaatGemeld) {
        f.teLaatGemeld = true;
        meld(st, klantVan(st, d.klantId).naam + ' heeft factuur ' + f.nummer + ' niet betaald, en de vervaldag is voorbij.', 'slecht');
      }
    }
  }

  if (st.kas < 0 && !st.rood) {
    st.rood = true;
    meld(st, 'Je staat rood: ' + euro(st.kas) + '. Op de eerste van de maand kost dat rente.', 'nood');
    ontgrendel(st, 'budget');
  } else if (st.kas >= 0 && st.rood) {
    st.rood = false;
    meld(st, 'Je staat weer in de plus.', 'goed');
  }
}

module.exports = { volgendeDag, dagVanMaand };
