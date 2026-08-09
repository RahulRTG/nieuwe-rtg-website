/* DE DEBITEUREN: wie moet u nog betalen, en hoe lang al.

   De facturatie bestond al (kern/facturatie): nummers, btw, een PDF, per zaak
   uitgaand en inkomend. Wat er niet was, is de vraag die elke ondernemer stelt
   zodra hij op rekening werkt: WAT STAAT ER NOG OPEN. Facturen droegen geen
   betaalstatus, dus gold elke factuur impliciet als afgedaan en bestond er geen
   debiteurenlijst.

   DE GESCHIEDENIS TELT ALS BETAALD, EN DAT IS EXPLICIET. Facturen van voor deze
   laag hebben geen `betaald`-veld. Zou "geen veld" als open gelden, dan stond
   morgen alles wat ooit is gefactureerd op de debiteurenlijst: een alarm dat
   niets betekent, en precies daarom binnen een week niet meer gelezen wordt.
   `betaald !== false` is dus de lezing, dezelfde grandfathering als bij
   kern/ondernemerpoort.js (`online !== false`).

   DE OUDERDOMSGROEPEN ZIJN GETELD, NIET GEWOGEN. Een factuur valt in precies
   een groep op grond van hoeveel dagen hij over zijn vervaldatum is. Er komt
   geen score uit en geen voorspelling: "betalingsrisico" zou hier een getal zijn
   dat op niets rust -- wij zien alleen deze zaak, niet het betaalgedrag van die
   klant elders. Wat er wel staat is wat er staat.

   ALLES OP CODENAAM, net als het klantenboek: de debiteurenlijst is bij uitstek
   de plek waar iemand een echte naam zou willen zetten. */
'use strict';

const DAG = 86400000;

/* De groepen, van jong naar oud. `tot` is het aantal dagen over de vervaldatum;
   null is "alles daarboven". */
const GROEPEN = [
  { id: 'loopt', tot: 0, label: 'Loopt nog', wat: 'Nog niet vervallen.' },
  { id: 'net', tot: 14, label: '1 tot 14 dagen over', wat: 'Een vriendelijke herinnering is meestal genoeg.' },
  { id: 'lang', tot: 30, label: '15 tot 30 dagen over', wat: 'Bel. Een tweede mail leest niemand.' },
  { id: 'zeer', tot: 60, label: '31 tot 60 dagen over', wat: 'Spreek een regeling af, of zet de levering stil.' },
  { id: 'oud', tot: null, label: 'Meer dan 60 dagen over', wat: 'Hoe ouder, hoe kleiner de kans. Handel nu.' }
];

const rond = (n) => Math.round(n * 100) / 100;

/* Hoeveel dagen is deze factuur over zijn vervaldatum. Negatief betekent: hij
   loopt nog. Null als er geen vervaldatum is -- dan valt er niets te zeggen en
   wordt hij niet ingedeeld in plaats van in de jongste groep gegooid. */
function dagenOver(f, nuMs) {
  if (!f || !f.vervaldatum) return null;
  const t = Date.parse(f.vervaldatum + 'T12:00:00Z');
  return Number.isFinite(t) ? Math.floor((nuMs - t) / DAG) : null;
}

function groepVan(dagen) {
  if (dagen === null) return null;
  if (dagen <= 0) return 'loopt';
  for (const g of GROEPEN) {
    if (g.id === 'loopt') continue;
    if (g.tot === null || dagen <= g.tot) return g.id;
  }
  return 'oud';
}

/* De opvolgregel voor het dagbeeld. Alleen als er echt iets vervallen is:
   openstaande facturen die nog gewoon lopen zijn geen actie maar de normale
   gang van zaken. */
function debiteurenOpvolging(d) {
  if (!d || !d.vervallenAantal) return null;
  return {
    id: 'debiteuren', soort: 'factuur', aantal: d.vervallenAantal,
    kop: d.vervallenAantal + ' factu' + (d.vervallenAantal === 1 ? 'ur is' : 'ren zijn') +
      ' vervallen (' + Math.round(d.vervallenBedrag) + ' euro)',
    waarom: d.oudste
      ? 'De oudste staat ' + d.oudste.dagenOver + ' dagen open. Hoe ouder een post, hoe kleiner de kans dat hij nog binnenkomt.'
      : 'Geld dat u al verdiend heeft, maar nog niet heeft.'
  };
}

module.exports = ({ db }) => {

  const alle = () => (Array.isArray(db.data.facturen) ? db.data.facturen : []);
  const zaakVan = (o) => (o && o.supplierCode
    ? (db.data.suppliers || []).find(x => x.code === o.supplierCode) || null : null);

  /* Wat deze zaak heeft verstuurd en nog niet binnen is. Zie de kop voor de
     lezing van `betaald`. */
  function openVan(code) {
    return alle().filter(f => f && f.verkoper && f.verkoper.code === code && f.betaald === false);
  }

  function debiteuren(o, nuMs) {
    const s = zaakVan(o);
    if (!s) return null;
    const nuT = Number.isFinite(nuMs) ? nuMs : Date.now();

    const open = openVan(s.code);
    const perGroep = Object.fromEntries(GROEPEN.map(g => [g.id, { aantal: 0, bedrag: 0 }]));
    const zonderDatum = [];
    const rijen = [];

    for (const f of open) {
      const d = dagenOver(f, nuT);
      const g = groepVan(d);
      const rij = { id: f.id, nummer: f.nummer, klant: f.koper.codenaam || f.koper.naam || null,
        totaal: f.totaal, datum: f.datum, vervaldatum: f.vervaldatum || null,
        dagenOver: d, groep: g };
      rijen.push(rij);
      if (!g) { zonderDatum.push(rij); continue; }
      perGroep[g].aantal++;
      perGroep[g].bedrag = rond(perGroep[g].bedrag + (Number(f.totaal) || 0));
    }

    const vervallen = rijen.filter(r => r.groep && r.groep !== 'loopt');
    const openBedrag = rond(open.reduce((n, f) => n + (Number(f.totaal) || 0), 0));
    const vervallenBedrag = rond(vervallen.reduce((n, r) => n + (Number(r.totaal) || 0), 0));

    return {
      zaak: s.code,
      aantal: open.length, bedrag: openBedrag,
      vervallenAantal: vervallen.length, vervallenBedrag,
      groepen: GROEPEN.map(g => Object.assign({ id: g.id, label: g.label, wat: g.wat }, perGroep[g.id])),
      /* De oudste openstaande post. Dat ene getal zegt meer dan het totaal:
         een groot bedrag dat net vervalt is iets anders dan een klein bedrag
         van vier maanden oud. */
      oudste: vervallen.length
        ? vervallen.reduce((a, b) => (b.dagenOver > a.dagenOver ? b : a))
        : null,
      posten: rijen.sort((a, b) => (b.dagenOver || 0) - (a.dagenOver || 0)).slice(0, 50),
      zonderVervaldatum: zonderDatum.length,
      voorbehoud: 'Alleen facturen die als onbetaald zijn aangemerkt tellen mee. Facturen van voor deze laag dragen geen betaalstatus en gelden als betaald.'
    };
  }

  return { DEBITEUREN_GROEPEN: GROEPEN, debiteuren, debiteurenOpvolging };
};

module.exports.GROEPEN = GROEPEN;
module.exports.debiteurenOpvolging = debiteurenOpvolging;
module.exports.dagenOver = dagenOver;
module.exports.groepVan = groepVan;
