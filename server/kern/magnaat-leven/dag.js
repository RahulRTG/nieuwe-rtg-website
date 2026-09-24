/* Magnaat FROM ZERO: WAT EEN DAG MET JE DOET.

   De klok rekent bij en tikt niet (./index.js, zoals World): voor elke dag die
   voorbij is, draait `volgendeDag` een keer, in vaste volgorde, zodat tien dagen
   in een keer hetzelfde opleveren als tien dagen los.

     1. de dag eindigt: wat er in de agenda stond, gebeurt (./tijd.js)
     2. de nieuwe dag begint: loon op vrijdag, boodschappen, betalingen (./geld.js)
     3. klanten: voorschotten, betalingen, verstreken vervaldagen (./opdracht.js)
     4. kansen: wie heeft je werk gezien, wie komt terug (./gesprek.js)
     5. het spel kijkt wat je bent geworden

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
  if (st.onderneming && st.baan.actief && !st.zelfstandigMag && st.dag - st.onderneming.sinds >= R.ZELFSTANDIG.dagen) {
    const binnen = ontvangen(st, R.ZELFSTANDIG.dagen), grens = Math.round(loonPer(st, R.ZELFSTANDIG.dagen) * R.ZELFSTANDIG.factor / 100);
    if (binnen >= grens) {
      st.zelfstandigMag = st.dag;
      meld(st, 'Je bedrijf bracht de afgelopen vier weken ' + euro(binnen) + ' binnen: meer dan twee keer je loon. ' +
        'Je kunt je baan opzeggen en van je eigen bedrijf leven.', 'vraag');
    }
  }
}

function volgendeDag(st) {
  voerUit(st);
  st.dag += 1;
  startDag(st);
  klantDag(st);
  kansen(st);
  wieJeBent(st);
}

module.exports = { volgendeDag, ontvangen, loonPer };
