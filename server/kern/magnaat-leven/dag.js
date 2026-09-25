/* Magnaat FROM ZERO: WAT EEN DAG MET JE DOET.

   De klok rekent bij en tikt niet (./index.js, zoals World): voor elke dag die
   voorbij is, draait `volgendeDag` een keer, in vaste volgorde, zodat tien dagen
   in een keer hetzelfde opleveren als tien dagen los.

     1. de dag eindigt: wat er in de agenda stond, gebeurt (./tijd.js)
     2. de nieuwe dag begint: loon op vrijdag, boodschappen, betalingen (./geld.js)
     3. klanten: voorschotten, betalingen, verstreken vervaldagen (./opdracht.js)
     4. kansen: wie heeft je werk gezien, wie komt terug (./gesprek.js)
     5. het spel kijkt wat je bent geworden

   Met een onderneming (V2) komen er drie bij: je team (loon, werkplekken,
   wie vertrekt) en je handel (leveringen, verkoop) voor de betalingen, en na de
   klanten je contracten. De markt (V3) komt vlak na je team: huur van je
   bedrijfsruimte, en op maandag de concurrenten en nieuwe klanten.

   Dat laatste is het punt van V1: je richt geen bedrijf op omdat een knop dat
   zegt. Na twee betaalde opdrachten stelt het spel vast dat je structureel voor
   klanten werkt, en vraagt het hoe je verder wilt. En als je bedrijf vier weken
   lang twee keer je loon binnenbrengt, mag je je baan opzeggen. */
'use strict';
const R = require('./regels');
const { meld, euro } = require('./staat');
const { voerUit } = require('./tijd');
const { startDag } = require('./geld');
const { klantDag } = require('./opdracht');
const { kansen } = require('./gesprek');
const { teamDag } = require('./team');
const { handelDag } = require('./voorraad');
const { contractDag } = require('./contract');
const { marktDag } = require('./markt');
const { huurDag } = require('./vestiging');

/* Wat je bedrijf de afgelopen vier weken op je rekening bracht. */
function ontvangen(st, dagen) {
  return st.deals.filter(d => d.fase === 'betaald' && d.betaaldOp > st.dag - dagen)
    .reduce((s, d) => s + d.afspraak.bedrag, 0);
}
const loonPer = (st, dagen) => st.baan.urenPerWeek * st.baan.uurloon * dagen / 7;

function wieJeBent(st) {
  if (!st.onderneming && st.ondernemingVraag == null && st.betaald >= R.ONDERNEMING.opdrachten) {
    st.ondernemingVraag = st.dag;
    meld(st, 'Je hebt nu ' + st.betaald + ' opdrachten gedaan en betaald gekregen. Dat is geen hobby meer: je werkt structureel voor klanten. ' +
      R.JURISDICTIE.inschrijven + ' Dat kost ' + euro(R.KVK) + ', en daarna kun je nieuwe klanten aannemen.', 'vraag');
  }
  const z = R.niveauVan(st).zelfstandig;
  if (st.onderneming && st.baan.actief && !st.zelfstandigMag && st.dag - st.onderneming.sinds >= z.dagen) {
    const binnen = ontvangen(st, z.dagen), grens = Math.round(loonPer(st, z.dagen) * z.factor / 100);
    const buffer = Math.round(loonPer(st, 7 * z.buffer));
    if (binnen >= grens && st.kas >= buffer) {
      st.zelfstandigMag = st.dag;
      meld(st, 'Je bedrijf bracht de afgelopen ' + weken(z.dagen) + ' ' + euro(binnen) + ' binnen, meer dan ' + keer(z.factor) + ' je loon, ' +
        'en je hebt ' + euro(st.kas) + ' op de bank. Je kunt je baan opzeggen en van je eigen bedrijf leven.', 'vraag');
    }
  }
}
const weken = (d) => (d % 7 ? d + ' dagen' : d / 7 + ' weken');
const keer = (f) => (f % 100 ? String(f / 100).replace('.', ',') + ' keer' : ['', 'een', 'twee', 'drie', 'vier'][f / 100] + ' keer');

/* UITGEZET (1.0): staat je huur langer open dan je verhuurder accepteert, dan
   zegt hij je kamer op en is dit leven voorbij. Een week ervoor hoor je het.
   Alleen de huur van je kamer telt: de rest is duur, maar je woont nog. */
function uitzetting(st) {
  const grens = R.niveauVan(st).uitzetting;
  if (!grens || st.voorbij) return;
  for (const p of st.posten.filter(x => x.soort === 'huur' && x.achterstand)) {
    const open = st.dag - p.dag;
    if (open >= grens) {
      st.voorbij = { dag: st.dag, reden: 'je huur stond ' + open + ' dagen open, en je verhuurder heeft je kamer opgezegd' };
      meld(st, 'Dit leven is voorbij: ' + st.voorbij.reden + '. Je kunt terugkijken en opnieuw beginnen.', 'nood');
      return;
    }
    if (open >= grens - 7 && !p.gewaarschuwd) {
      p.gewaarschuwd = true;
      meld(st, 'Je verhuurder schrijft: betaal je de huur niet binnen ' + (grens - open) + ' dagen, dan zegt hij je kamer op.', 'nood');
    }
  }
}

function volgendeDag(st) {
  voerUit(st);
  st.dag += 1;
  teamDag(st);
  huurDag(st);
  marktDag(st);
  handelDag(st);
  startDag(st);
  uitzetting(st);
  klantDag(st);
  contractDag(st);
  kansen(st);
  wieJeBent(st);
}

module.exports = { volgendeDag, ontvangen, loonPer };
