/* Magnaat-overdrachtsmeter: is doorgeven wel eens de moeite, en wel eens niet?

   ../server/kern/spellen/magnaat/overdracht.js voegt een keuze toe die geen
   getal op het scherm heeft: een moment van je dienst besteden aan de volgende
   ploeg vertellen wat je hebt gedaan. Twee kanten:

     DOORGEVEN kost NU. Dat ene moment is een voorval dat blijft liggen, en dat
       is deze avond echte derving.
     NIET DOORGEVEN kost ELKE MAAND. De volgende ploeg moet uitzoeken wat er
       speelt; dat loopt via `vast` -- arbeidstijd, de post die de noodoplossing
       zelf ook al gebruikt.

   DE EIS: GEEN VAN DE TWEE MAG ALTIJD WINNEN. Een noodoplossing die morgen
   verholpen is, is dat moment niet waard. Een die een half jaar sleept wel. Zou
   doorgeven altijd lonen, dan is het geen keuze maar een verplichte handeling en
   kun je hem net zo goed automatisch doen; zou het nooit lonen, dan is de knop
   decoratie en leert de speler hem te negeren.

   DIT SCRIPT ZOEKT HET OMSLAGPUNT: vanaf hoeveel maanden slepen wordt uitleggen
   goedkoper dan zwijgen? Ligt dat punt op 1, dan wint doorgeven altijd; ligt het
   voorbij het bereik, dan wint zwijgen altijd. Allebei is een klacht.

   WAT ER GEMETEN WORDT IS DE ZAAK EN NIET DE SPELER. De kosten van het zwijgen
   landen op de vestiging (`vast`), de kosten van het doorgeven op de dienst van
   die ene avond (derving). Om ze te kunnen vergelijken worden ze allebei
   uitgedrukt in euro's van dezelfde zaak.

   Draaien: node scripts/magnaat-overdracht.js */
'use strict';

const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const STORING = require('../server/kern/spellen/magnaat/storing');
const OVER = require('../server/kern/spellen/magnaat/overdracht');
const R = require('../server/kern/spellen/magnaat/rush');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };

/* Een zaak met een noodkoeling die `duurt` maanden blijft staan, met of zonder
   uitleg erbij. Geeft terug wat de zaak in die periode aan `vast` kwijt was. */
function proef(zone, omvang, duurt, uitleg) {
  const m = maakMagnaat();
  const p = { id: 'ov', soort: 'magnaat', spelers: ['anna'], teams: [0], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  p.staat.geld.anna = 5000000;
  m.eco.zet(p, 'anna', { actie: 'open',
    kavel: kaart('ijmuiden').kavels.filter(k => k.zone === zone)[0].id,
    sector: 'horeca', omvang });
  const v = p.staat.vestigingen.anna[0];
  const maand = () => { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); };
  for (let i = 0; i < 3; i++) maand();          // eerst wat echte economie
  STORING.uitVoorval(v, 'machinebreuk', p.staat.maand);
  STORING.zet(v, 'koeling', 'workaround', p.staat.maand);
  if (uitleg) OVER.noteer(v, { maand: p.staat.maand, soort: 'koeling',
    wie: 'boris', rol: 'vakkracht', staat: 'workaround', deed: 'noodkoeling geregeld' });
  let vast = 0, omzet = 0;
  for (let i = 0; i < duurt; i++) {
    /* DE NOODOPLOSSING WORDT ELKE MAAND OPNIEUW GEZET, want hij vervalt na een
       paar maanden (./storing.js) en dit script meet de UITLEG en niet de
       vergeetachtigheid van de speler. De uitleg gaat mee: hij hoort bij de
       stand, dus wie hem een keer geeft heeft hem gegeven. */
    STORING.zet(v, 'koeling', 'workaround', p.staat.maand);
    if (uitleg) OVER.noteer(v, { maand: p.staat.maand, soort: 'koeling',
      wie: 'boris', rol: 'vakkracht', staat: 'workaround', deed: 'noodkoeling geregeld' });
    maand();
    const r = p.staat.laatste.anna.regels.find(x => x.id === v.id);
    vast += r.vast; omzet += r.omzet;
  }
  return { vast, omzet, raming: R.raming(v) };
}

/* WAT HET DOORGEVEN ZELF KOST: een moment van een dienst. De dienst rekent in de
   raming van de zaak (./rush.js), en een moment is grofweg wat er in dat moment
   aan werk blijft liggen. We nemen de RUIMSTE schatting -- het duurste voorval
   dat er kan staan -- want een meter hoort de keuze niet mooier te maken dan hij
   is. Blijkt doorgeven zelfs bij die aanname ergens te lonen, dan is dat een
   ondergrens en geen gunstige uitkomst. */
function momentKost(raming) {
  const zwaarste = Math.max(...R.SOORTEN.map(s => s.kost));
  const totaal = R.SOORTEN.reduce((n, s) => n + s.kost + s.groei * 2, 0);
  return raming * (zwaarste / Math.max(0.001, totaal));
}

const ZAKEN = [
  { naam: 'vol (boulevard, 30)', zone: 'boulevard', omvang: 30 },
  { naam: 'ruim (boulevard, 60)', zone: 'boulevard', omvang: 60 },
  { naam: 'rustig (terrein, 30)', zone: 'terrein', omvang: 30 }
];
const DUUR = [1, 2, 3, 4, 6, 9, 12];

function meet() {
  const klachten = [];
  const rijen = [];
  for (const z of ZAKEN) {
    const eenmalig = momentKost(proef(z.zone, z.omvang, 1, true).raming);
    const punten = [];
    let omslag = null;
    for (const d of DUUR) {
      const zwijgt = proef(z.zone, z.omvang, d, false);
      const vertelt = proef(z.zone, z.omvang, d, true);
      /* WAT ZWIJGEN KOST: het verschil in arbeidstijd over die maanden.
         WAT VERTELLEN KOST: dat ene moment, eenmalig. */
      const zwijgen = zwijgt.vast - vertelt.vast;
      punten.push({ d, zwijgen: Math.round(zwijgen), vertellen: Math.round(eenmalig) });
      if (omslag === null && zwijgen > eenmalig) omslag = d;
    }
    rijen.push({ zaak: z.naam, eenmalig: Math.round(eenmalig), punten, omslag });
  }
  /* DE KLACHT GAAT OVER DE HELE SET EN NIET OVER EEN RIJ, en die grens is door
     deze meter zelf verlegd. Eerst stond hier "een zaak waar doorgeven al vanaf
     maand een loont is fout" -- maar dat is precies wat een RUSTIGE zaak hoort
     te zijn: daar kost een moment van je dienst bijna niets, dus daar leg je het
     natuurlijk even uit. De vraag is niet of het ergens meteen loont maar of het
     OVERAL hetzelfde antwoord geeft; dan pas is het geen keuze meer. */
  if (rijen.every(r => r.omslag === 1))
    klachten.push('doorgeven loont overal al vanaf de eerste maand -- dan is het geen'
      + ' keuze maar een verplichte handeling, en kun je hem net zo goed automatisch doen');
  if (rijen.every(r => r.omslag === null))
    klachten.push('doorgeven loont nergens binnen ' + DUUR.slice(-1)[0]
      + ' maanden -- dan is de knop decoratie en leert de speler hem te negeren');
  return { rijen, klachten };
}

const { rijen, klachten } = meet();
console.log('\nMagnaat-overdrachtsmeter: wanneer is doorgeven de moeite waard?\n');
console.log('factor op `vast` bij een ongedocumenteerde ingreep: ' + OVER.ONWETEND_VAST + '\n');
for (const r of rijen) {
  console.log(r.zaak + '  (een moment van een dienst kost hier ~' + r.eenmalig + ')');
  console.log('  maanden slepen | ' + r.punten.map(p => String(p.d).padStart(6)).join(' |'));
  console.log('  zwijgen kost   | ' + r.punten.map(p => String(p.zwijgen).padStart(6)).join(' |'));
  console.log('  omslag: ' + (r.omslag === null ? 'nooit binnen het bereik'
    : 'vanaf ' + r.omslag + ' maand' + (r.omslag === 1 ? '' : 'en') + ' loont doorgeven'));
  console.log('');
}
if (klachten.length) {
  console.log('NIET OK:');
  for (const k of klachten) console.log('  - ' + k);
  process.exitCode = 1;
} else {
  console.log('doorgeven loont soms wel en soms niet; de situatie beslist');
}
