/* CANARY -- een functie stap voor stap openzetten, en hem automatisch weer
   dichtdraaien zodra hij bewijst dat hij het niet houdt.

   DE SCHAKELKAST HAD TWEE STANDEN: aan en uit. De storingswachter
   (server/functies/wachter.js) zette daar een automaat op die een functie
   dichtgooit bij een golf serverfouten. Wat er tussen zat ontbrak: een functie
   die OPEN gaat voor tien procent van de mensen, en pas verder als het cijfer
   het toelaat. Dat is het verschil tussen een noodrem en een uitrol.

   DRIE KEUZES DIE ERTOE DOEN:

   1. DE VERDELING IS DETERMINISTISCH OP DE PERSOON, niet per verzoek gedobbeld,
      en de functie-id zit in de hash. Waarom, staat bij inCanary() in
      server/functies/toegang.js -- daar woont de verdeling, want dat is de
      plek die al beslist of een pad open is. Eén beslisser, geen tweede.

   2. DE METING KOMT UIT server/meting.js EN NIET UIT EEN EIGEN TELLER. Dat zijn
      dezelfde cijfers als /api/metrics en als de servicedoelen. Een canary die
      zelf telt, kan een ander verhaal vertellen dan het foutbudget, en dan is
      niet meer te zeggen welke van de twee de uitrol had moeten stoppen.
      Omdat die tellers sinds de start van het proces lopen, legt een canary bij
      het begin een NULMETING vast en rekent hij op het verschil.

   3. HERSTARTEN WIST DE NULMETING, EN DAT WORDT GEZEGD. Dan staat het verschil
      lager dan de nulmeting. Dat is geen fout maar een onbekende: de canary
      meldt 'nulmeting kwijt' en weegt niet. Stilzwijgend doorrekenen geeft een
      negatief foutaantal en dus altijd groen -- precies de kant waarop een
      uitrolrem niet fout mag gaan.

   TERUGROLLEN IS DEEL 0 EN NIET "UIT": bij deel 0 staat er waarom en wanneer,
   en de functie is met één knop weer op tien procent te zetten. Een functie op
   'uit' is van een canary niet te onderscheiden. */
'use strict';
const { maakTikker } = require('./tikker');

const { NIVEAUS } = require('../frictie');

const STANDAARD = {
  deel: 0.1,        // waarmee een canary begint
  drempel: 0.02,    // meer dan 2% serverfouten op de paden van deze functie
  minimum: 50,      // en pas als er genoeg antwoorden zijn om dat te zeggen
  tikMs: 30000      // hoe vaak de weging vanzelf draait
};

function maakCanary({ opslag, save, meting, journaal, functies }) {
  const OP_ID = (functies && functies.OP_ID) || {};

  const staat = () => opslag.gedeeld.schakelkast();

  /* De cijfers van dit moment op de paden van deze functie: hoeveel antwoorden
     en hoeveel serverfouten. Prefix-match op het routepatroon, want zo telt
     meting.js ook (nooit op het losse pad; zie de kop daar). */
  function tel(f) {
    const r = meting.reeksen();
    let antwoorden = 0, fouten = 0;
    for (const v of r.verzoeken) {
      if (!f.paden.some(p => v.route === p || v.route.startsWith(p + '/'))) continue;
      antwoorden += v.aantal;
      if (v.status === '5xx') fouten += v.aantal;
    }
    return { antwoorden, fouten };
  }

  const nu = () => new Date().toISOString();

  function noteer(actie, id, extra) {
    if (!journaal) return;
    try {
      journaal.noteer(Object.assign({ actie, objectType: 'functie', objectId: id }, extra || {}));
    } catch (e) { /* een journaalstoring mag een uitrol niet tegenhouden */ }
  }

  function start(id, deel, opties) {
    const f = OP_ID[String(id)];
    if (!f) return { error: 'Onbekende functie: ' + id, status: 404 };
    const o = opties || {};
    const d = Math.max(0, Math.min(Number(deel == null ? STANDAARD.deel : deel), 1));
    const st = staat();
    const cur = (st[f.id] = st[f.id] || {});
    if (cur.aan === false) {
      return { error: 'Deze functie staat helemaal uit. Zet hem eerst aan; een canary verdeelt ' +
        'een open functie over de mensen, hij opent geen dichte.', status: 409 };
    }
    cur.canary = {
      deel: d, sinds: nu(), door: String(o.door || 'onbekend'),
      drempel: Number(o.drempel == null ? STANDAARD.drempel : o.drempel),
      minimum: Number(o.minimum == null ? STANDAARD.minimum : o.minimum),
      basis: tel(f), stand: 'loopt', reden: null
    };
    save();
    noteer('canary gestart', f.id, { actor: o.door, niveau: NIVEAUS.hand,
      reden: 'uitrol op ' + Math.round(d * 100) + '%', na: { deel: d } });
    return { canary: kaartVan(f, cur.canary) };
  }

  function breder(id, deel, door) {
    const f = OP_ID[String(id)];
    const cur = staat()[f ? f.id : ''];
    if (!f || !cur || !cur.canary) return { error: 'Voor deze functie loopt geen canary.', status: 404 };
    const was = cur.canary.deel;
    const d = Math.max(0, Math.min(Number(deel), 1));
    cur.canary.deel = d;
    cur.canary.stand = d > 0 ? 'loopt' : cur.canary.stand;
    /* De nulmeting schuift MEE, want vanaf nu is het een andere proef: de
       fouten van de vorige tien procent horen niet bij het oordeel over vijftig
       procent. Zonder dit zou een canary die eerder is teruggerold nooit meer
       groen kunnen worden. */
    cur.canary.basis = tel(f);
    cur.canary.sinds = nu();
    save();
    noteer('canary verbreed', f.id, { actor: door, niveau: NIVEAUS.hand,
      reden: Math.round(was * 100) + '% naar ' + Math.round(d * 100) + '%',
      voor: { deel: was }, na: { deel: d } });
    return { canary: kaartVan(f, cur.canary) };
  }

  function terug(id, reden, door, automatisch) {
    const f = OP_ID[String(id)];
    const cur = staat()[f ? f.id : ''];
    if (!f || !cur || !cur.canary) return { error: 'Voor deze functie loopt geen canary.', status: 404 };
    const was = cur.canary.deel;
    cur.canary.deel = 0;
    cur.canary.stand = 'teruggerold';
    cur.canary.reden = String(reden || 'met de hand teruggerold');
    cur.canary.terugAt = nu();
    cur.canary.automatisch = !!automatisch;
    save();
    noteer('canary teruggerold', f.id, { actor: automatisch ? 'automaat' : door,
      niveau: automatisch ? NIVEAUS.auto : NIVEAUS.hand, reden: cur.canary.reden,
      voor: { deel: was }, na: { deel: 0 }, uitslag: 'gedaan' });
    return { canary: kaartVan(f, cur.canary) };
  }

  /* Afronden: de canary verdwijnt en de functie staat voor iedereen open. Dat
     is met opzet een aparte handeling en niet "deel op 1": zolang er een
     canary-stand hangt, blijft er een uitrol lopen die niemand meer weegt. */
  function af(id, door) {
    const f = OP_ID[String(id)];
    const cur = staat()[f ? f.id : ''];
    if (!f || !cur || !cur.canary) return { error: 'Voor deze functie loopt geen canary.', status: 404 };
    const was = cur.canary.deel;
    delete cur.canary;
    save();
    noteer('canary afgerond', f.id, { actor: door, niveau: NIVEAUS.hand,
      reden: 'de functie staat nu voor iedereen open', voor: { deel: was } });
    return { af: true, id: f.id };
  }

  function meting5xx(f, c) {
    const nuTel = tel(f);
    const antwoorden = nuTel.antwoorden - (c.basis ? c.basis.antwoorden : 0);
    const fouten = nuTel.fouten - (c.basis ? c.basis.fouten : 0);
    /* Negatief betekent dat de tellers opnieuw zijn begonnen: het proces is
       herstart. Dan is er niets te zeggen, en dat is de uitslag. */
    if (antwoorden < 0 || fouten < 0) {
      return { kwijt: true, uitleg: 'de nulmeting is kwijt (het proces is herstart), dus deze canary ' +
        'wordt niet gewogen tot hij opnieuw wordt gezet' };
    }
    return { kwijt: false, antwoorden, fouten,
      deel5xx: antwoorden ? Number((fouten / antwoorden).toFixed(4)) : null,
      genoeg: antwoorden >= c.minimum };
  }

  function kaartVan(f, c) {
    const m = meting5xx(f, c);
    return {
      id: f.id, naam: f.naam, categorie: f.categorie, paden: f.paden,
      deel: c.deel, sinds: c.sinds, door: c.door, stand: c.stand, reden: c.reden || null,
      drempel: c.drempel, minimum: c.minimum, automatisch: !!c.automatisch,
      meting: m,
      oordeel: m.kwijt ? 'niet te wegen'
        : !m.genoeg ? 'onvoldoende gemeten'
        : (m.deel5xx > c.drempel ? 'over de drempel' : 'binnen de drempel'),
      let: c.deel > 0 && c.deel < 1
        ? 'anoniem verkeer valt nooit in een canary (geen stabiele sleutel), dus op paden die ' +
          'vooral zonder inlog worden gebruikt bereikt en meet deze uitrol bijna niets'
        : null
    };
  }

  function lopende() {
    const st = staat();
    const uit = [];
    for (const id of Object.keys(st)) {
      if (!st[id] || !st[id].canary || !OP_ID[id]) continue;
      uit.push(kaartVan(OP_ID[id], st[id].canary));
    }
    return uit;
  }

  /* De weging. Rolt terug wat over de drempel zit en genoeg gemeten is; raakt
     niets anders aan. Draait vanzelf op een tikker en bij elke aanroep van
     stand(), zodat een scherm nooit een canary toont die had moeten stoppen. */
  function weeg() {
    const geraakt = [];
    for (const k of lopende()) {
      if (k.stand !== 'loopt' || k.deel <= 0) continue;
      if (k.oordeel !== 'over de drempel') continue;
      terug(k.id, 'automaat: ' + Math.round(k.meting.deel5xx * 1000) / 10 + '% serverfouten op ' +
        k.meting.antwoorden + ' antwoorden, drempel ' + Math.round(k.drempel * 1000) / 10 + '%',
        'automaat', true);
      geraakt.push(k.id);
    }
    return geraakt;
  }

  function stand() {
    const teruggerold = weeg();
    const lijst = lopende();
    return {
      canaries: lijst, zojuistTeruggerold: teruggerold,
      tel: { lopend: lijst.filter(x => x.stand === 'loopt' && x.deel > 0).length,
        teruggerold: lijst.filter(x => x.stand === 'teruggerold').length },
      standaard: STANDAARD,
      uitleg: 'de cijfers komen uit server/meting.js, dezelfde tellers als /api/metrics en de ' +
        'servicedoelen; een canary rekent op het verschil sinds zijn nulmeting'
    };
  }

  /* De tikker. Zonder deze zou "automatische terugroldrempel" betekenen: pas
     als er iemand kijkt. unref, zodat hij een proces nooit openhoudt. */
  const tikker = maakTikker(weeg, STANDAARD.tikMs);   // zie ./tikker.js

  return { start, breder, terug, af, weeg, stand, lopende, tikker, STANDAARD };
}

module.exports = { maakCanary, STANDAARD };
