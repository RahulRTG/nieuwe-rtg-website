/* Magnaat V3: DE MARKT -- je bent niet de enige in Oudwijk.

   AANDEEL IN PLAATS VAN EEN FORMULE. Wat je verkoopt, is je deel van wat de
   stad koopt: drie soorten kopers (./regels-markt.js, KOPERS) kiezen elke dag
   tussen jou en drie concurrenten, op prijs, op naam en op waar je zit. Je naam
   is wat je klanten van je vinden: elke opdracht die op tijd betaald werd, telt
   mee, en een te late levering telt dubbel tegen.

   CONCURRENTEN REAGEREN, elke maandag: wie klanten aan jou verliest en duurder
   is, zakt in prijs; wie ver boven jou zit, gaat omhoog. En ze maken fouten --
   dan zoekt een van hun klanten iemand anders, en dat kun jij zijn. Zo'n klant
   heeft een offerte van een concurrent naast zich liggen, en betaalt jou alleen
   meer als je naam dat waard is.

   WAAR JE ZIT, kost huur en brengt zichtbaarheid: dat staat in ./vestiging.js. */
'use strict';
const M = require('./regels-markt');
const B = require('./regels-bedrijf');
const { meld, euro, tijd } = require('./staat');
const { lot, seizoenVan, weekVan, weerVan } = require('./kalender');
const R = require('./regels');

const opKwartje = (c) => Math.round(c / 2500) * 2500;
const tussen = (st, label, [van, tot], stap = 1) => van + lot(st, label, Math.floor((tot - van) / stap) + 1) * stap;

function reputatie(st) {
  const goed = st.deals.filter(d => d.fase === 'betaald' && !d.laatGeleverd).length;
  const laat = st.deals.filter(d => d.laatGeleverd).length;
  return Math.max(0, goed - 2 * laat);
}
const kwaliteit = (st) => Math.min(90, 50 + reputatie(st) * 5);

/* Wie er verkoopt: jij (als je handel drijft) en de drie concurrenten. */
function verkopers(st) {
  const w = B.HANDELSWAAR[st.aanbod];
  if (!w) return [];
  const uit = M.CONCURRENTEN[st.aanbod].map(c => ({ id: c.id, naam: c.naam, wijk: c.wijk, kwaliteit: c.kwaliteit,
    prijs: Math.round(w.advies * st.markt.prijzen[c.id] / 100) }));
  if (st.handel) uit.unshift({ id: 'jij', naam: st.onderneming ? st.onderneming.naam : 'jij', wijk: st.vestiging.wijk, kwaliteit: kwaliteit(st), prijs: st.handel.prijs });
  return uit;
}

/* Het aandeel van elke verkoper, in promille, per soort koper opgeteld. */
function aandelen(st) {
  const w = B.HANDELSWAAR[st.aanbod], v = verkopers(st);
  const aandeel = Object.fromEntries(v.map(x => [x.id, 0]));
  for (const [soort, k] of Object.entries(M.KOPERS)) {
    const score = v.map(x => {
      const goedkoop = w.advies / x.prijs, zicht = M.WIJKEN[x.wijk].zichtbaar;
      if (soort === 'prijs') return goedkoop ** 3 * Math.sqrt(zicht);
      if (soort === 'kwaliteit') return x.kwaliteit * goedkoop * Math.sqrt(zicht);
      return zicht * goedkoop;
    });
    const som = score.reduce((s, x) => s + x, 0);
    v.forEach((x, i) => { aandeel[x.id] += k.aandeel * 10 * score[i] / som; });
  }
  for (const id of Object.keys(aandeel)) aandeel[id] = Math.round(aandeel[id]);
  return aandeel;
}

/* Wat heel de stad op een dag koopt (duizendsten van een stuk), bij dit seizoen
   en, als er een dag is gegeven, bij het weer van die dag. */
function stadsvraag(st, dag) {
  const v = M.MARKTVRAAG[st.aanbod];
  if (!v) return 0;
  const weer = dag ? M.WEER.soorten[weerVan(st, dag)] : 100;
  return v.perWeek * v.seizoen[seizoenVan(dag || st.dag)] * weer / (7 * 10000);
}
const mijnVraag = (st, dag) => Math.floor(stadsvraag(st, dag) * (aandelen(st).jij || 0) / 1000 * (dag ? 1 : 7));

/* Maandag: de concurrenten bekijken hun prijs. */
function concurrentenReageren(st) {
  const h = st.handel, w = B.HANDELSWAAR[st.aanbod];
  if (!h || !w) return;
  const a = aandelen(st), bodem = Math.max(M.REACTIE.bodem, Math.ceil(w.inkoop * 110 / w.advies));
  for (const c of M.CONCURRENTEN[st.aanbod]) {
    const pct = st.markt.prijzen[c.id], prijs = Math.round(w.advies * pct / 100);
    let nieuw = pct;
    if (h.prijs < prijs && a.jij > a[c.id]) nieuw = Math.max(bodem, pct - M.REACTIE.stap);
    else if (h.prijs > prijs * (100 + M.REACTIE.drempel) / 100 && a.jij < a[c.id]) nieuw = Math.min(M.REACTIE.plafond, pct + M.REACTIE.stap);
    if (nieuw === pct) continue;
    st.markt.prijzen[c.id] = nieuw;
    const n = Math.round(w.advies * nieuw / 100);
    meld(st, c.naam + (nieuw < pct ? ' verlaagt' : ' verhoogt') + ' zijn prijs voor ' + w.naam.toLowerCase() + ' naar ' + euro(n) + '.', nieuw < pct ? 'slecht' : 'info');
  }
}

/* Een klant uit de markt: iemand die een concurrent verliet, of die het seizoen bracht. */
function marktklant(st, via) {
  const n = st.markt.leadTeller++, namen = M.MARKTKLANTEN.namen[st.aanbod], K = M.MARKTKLANTEN;
  const naam = namen[n % namen.length] + (n >= namen.length ? ' ' + (Math.floor(n / namen.length) + 1) : '');
  const uren = tussen(st, 'uren:' + n, K.uren, 60);
  const ander = M.CONCURRENTEN[st.aanbod].filter(c => c.id !== via.id)[lot(st, 'ander:' + n, 2)];
  const offerte = opKwartje(M.MARKTTARIEF[st.aanbod] * ander.tarief / 100 * uren / 60);
  const max = opKwartje(offerte * (100 + Math.min(K.reputatie.max, reputatie(st) * K.reputatie.perPunt)) / 100);
  const k = { id: 'm' + n, naam, contact: naam.split(' ')[0], behoefte: 'werk dat eerst bij ' + (via.naam || 'een ander') + ' zou komen',
    komt: { soort: 'markt' }, uren, termijn: tussen(st, 'termijn:' + n, K.termijn), speling: tussen(st, 'speling:' + n, K.speling),
    bod: opKwartje(max * 80 / 100), max, voorschot: 25, laat: tussen(st, 'laat:' + n, K.laat), korting: lot(st, 'korting:' + n, 2) ? 2 : null,
    offerte: { van: ander.naam, bedrag: offerte } };
  st.markt.klanten.push(k);
  st.deals.push({ id: 'd' + (++st.dealTeller), klantId: k.id, klant: k.naam, fase: 'kans', sinds: st.dag, rondes: [], gedaan: 0 });
  meld(st, via.id ? k.naam + ' zat bij ' + via.naam + ', maar die leverde te laat. Nu vraagt hij of jij het kunt doen.'
    : k.naam + ' zoekt iemand, nu het ' + seizoenVan(st.dag) + ' is. Hij vraagt of jij het kunt doen.', 'kans');
}

function leads(st) {
  if (!st.onderneming || !st.aanbod) return;
  if (st.deals.filter(d => ['kans', 'onderhandeling'].includes(d.fase)).length >= M.MARKTKLANTEN.maxOpen) return;
  const week = weekVan(st.dag);
  const fout = M.CONCURRENTEN[st.aanbod].find(c => lot(st, 'fout:' + week + ':' + c.id, 100) >= c.betrouwbaar);
  if (fout) return marktklant(st, fout);
  const seizoen = M.MARKTVRAAG[st.aanbod].seizoen[seizoenVan(st.dag)];
  /* Wie zichtbaarder zit, wordt vaker gevonden. */
  const zicht = M.WIJKEN[st.vestiging.wijk].zichtbaar;
  if (lot(st, 'seizoen:' + week, 100) < M.MARKTKLANTEN.seizoenKans * seizoen / 100 * zicht / 100) marktklant(st, {});
}

/* Elke maandag: de concurrenten bekijken hun prijs, en de markt brengt misschien een klant. */
function marktDag(st) {
  if (R.weekdag(st.dag) !== 0) return;
  concurrentenReageren(st);
  leads(st);
}

/* Wat de speler van de markt ziet. */
function marktBeeld(st) {
  const a = st.aanbod ? aandelen(st) : {}, w = B.HANDELSWAAR[st.aanbod];
  return {
    reputatie: reputatie(st), kwaliteit: kwaliteit(st), wijk: st.vestiging.wijk,
    wijken: Object.entries(M.WIJKEN).map(([id, x]) => ({ id, naam: x.naam, huur: x.huur, verhuis: x.verhuis, zichtbaar: x.zichtbaar, jij: st.vestiging.wijk === id })),
    kopers: Object.values(M.KOPERS).map(k => ({ naam: k.naam, aandeel: k.aandeel })),
    concurrenten: st.aanbod ? M.CONCURRENTEN[st.aanbod].map(c => ({ naam: c.naam, wijk: M.WIJKEN[c.wijk].naam, kwaliteit: c.kwaliteit,
      tarief: Math.round(M.MARKTTARIEF[st.aanbod] * c.tarief / 100), prijs: w ? Math.round(w.advies * st.markt.prijzen[c.id] / 100) : null, aandeel: a[c.id] })) : [],
    jouwAandeel: a.jij == null ? null : a.jij, markttarief: st.aanbod ? M.MARKTTARIEF[st.aanbod] : null,
    uitleg: 'Een klant uit de markt heeft een offerte van een concurrent. Hij betaalt je meer naarmate je naam beter is: ' +
      M.MARKTKLANTEN.reputatie.perPunt + '% per opdracht die op tijd betaald werd, tot ' + M.MARKTKLANTEN.reputatie.max + '%. Werk van ' + tijd(60) + ' kost bij hen gemiddeld ' +
      (st.aanbod ? euro(M.MARKTTARIEF[st.aanbod]) : '-') + '.'
  };
}

module.exports = { marktDag, aandelen, mijnVraag, reputatie, marktBeeld };
