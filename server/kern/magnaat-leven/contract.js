/* Magnaat V2: CONTRACTEN -- omzet die je kunt plannen, en uren die je elke
   vier weken moet leveren.

   Een tevreden klant van je onderneming wil vast werk: elke vier weken een
   aantal uren, tegen het uurtarief dat hij van je kent (./regels-bedrijf.js,
   KLANTCONTRACT). Je tekent of je bedankt; onderhandelen deed je de eerste keer.
   Elke termijn wordt een gewone opdracht met een deadline aan het eind van de
   vier weken, en loopt zoals elke opdracht: leveren, factureren, betaald
   worden. Wie een termijn te laat levert, krijgt geen verlenging.

   Een contract opzeggen kan altijd, en de termijn die loopt maak je af. */
'use strict';
const R = require('./regels');
const B = require('./regels-bedrijf');
const { meld, ontgrendel, euro, tijd } = require('./staat');

const fout = (error) => ({ status: 400, error });
const opKwartje = (c) => Math.round(c / 2500) * 2500;
const vind = (st, id) => (st.contracten || []).find(c => c.id === String(id || '')) || null;

function aanbod(st, bron, verlenging) {
  const c = { id: 'c' + (++st.contractTeller), klantId: bron.klantId, klant: bron.klant, stand: 'aanbod', sinds: st.dag,
    minuten: bron.minuten, bedrag: bron.bedrag, termijnen: B.KLANTCONTRACT.termijnen, termijn: 0, volgende: null, opgezegd: false, verlenging: !!verlenging };
  st.contracten.push(c);
  meld(st, c.klant + (verlenging ? ' wil het contract verlengen: ' : ' wil vast werk: ') + tijd(c.minuten) + ' elke vier weken voor ' + euro(c.bedrag) +
    ', ' + c.termijnen + ' termijnen lang. Het staat een week open.', 'kans');
  ontgrendel(st, 'contracten');
}

/* Een termijn begint: een opdracht met een deadline aan het eind van de vier weken. */
function termijn(st, c) {
  c.termijn += 1;
  c.volgende = st.dag + B.KLANTCONTRACT.periode;
  st.deals.push({ id: 'd' + (++st.dealTeller), klantId: c.klantId, klant: c.klant, fase: 'overeenkomst', sinds: st.dag, vervolg: true, contract: c.id,
    uren: c.minuten, termijn: B.KLANTCONTRACT.periode, gedaan: 0, rondes: [],
    afspraak: { bedrag: c.bedrag, voorschot: 0, voorschotBedrag: 0, minuten: c.minuten, deadline: c.volgende - 1, dag: st.dag } });
  meld(st, 'Termijn ' + c.termijn + ' van ' + c.termijnen + ' voor ' + c.klant + ': ' + tijd(c.minuten) + ' werk, af op ' + R.dagNaam(c.volgende - 1) +
    ' (dag ' + (c.volgende - 1) + ').', 'vraag');
}

function contractDag(st) {
  if (!st.onderneming) return;
  for (const c of st.contracten) {
    if (c.stand === 'aanbod' && st.dag - c.sinds >= B.KLANTCONTRACT.geldig) {
      c.stand = 'verlopen';
      meld(st, c.klant + ' hoorde niets over het contract en laat het erbij.', 'slecht');
    }
    if (c.stand !== 'actief' || st.dag < c.volgende) continue;
    if (c.termijn < c.termijnen && !c.opgezegd) { termijn(st, c); continue; }
    c.stand = c.opgezegd ? 'opgezegd' : 'afgelopen';
    const laat = st.deals.filter(d => d.contract === c.id && d.laatGeleverd).length;
    if (c.opgezegd) continue;
    if (laat) meld(st, c.klant + ' verlengt het contract niet: ' + laat + ' keer te laat geleverd.', 'slecht');
    else aanbod(st, c, true);
  }
  /* Een nieuw aanbod, hooguit een per dag: van een klant die je als onderneming
     kent en al een keer betaald heeft. */
  const eerste = st.deals.find(d => d.fase === 'betaald' && !d.vervolg && !d.laatGeleverd &&
    !st.contracten.some(c => c.klantId === d.klantId) && st.dag >= Math.max(d.betaaldOp, st.onderneming.sinds) + B.KLANTCONTRACT.naDagen);
  if (eerste) {
    const uurtarief = eerste.afspraak.bedrag * 60 / eerste.afspraak.minuten;
    aanbod(st, { klantId: eerste.klantId, klant: eerste.klant, minuten: B.KLANTCONTRACT.minuten, bedrag: opKwartje(uurtarief * B.KLANTCONTRACT.minuten / 60) });
  }
}

function teken(st, z) {
  const c = vind(st, z.contract);
  if (!c || c.stand !== 'aanbod') return fout('Er ligt geen contract om te tekenen.');
  c.stand = 'actief';
  meld(st, 'Contract met ' + c.klant + ' getekend: ' + euro(c.bedrag) + ' per vier weken, ' + c.termijnen + ' termijnen.', 'goed');
  termijn(st, c);
  return { ok: true };
}

function wijsAf(st, z) {
  const c = vind(st, z.contract);
  if (!c || c.stand !== 'aanbod') return fout('Er ligt geen contract om af te wijzen.');
  c.stand = 'afgewezen';
  meld(st, 'Je bedankte ' + c.klant + ' voor het contract.');
  return { ok: true };
}

function zegOp(st, z) {
  const c = vind(st, z.contract);
  if (!c || c.stand !== 'actief') return fout('Er loopt geen contract om op te zeggen.');
  if (c.opgezegd) return fout('Dat contract heb je al opgezegd.');
  c.opgezegd = true;
  meld(st, 'Contract met ' + c.klant + ' opgezegd. De termijn die loopt, maak je af; daarna houdt het op.');
  return { ok: true };
}

module.exports = { contractDag, teken, wijsAf, zegOp };
