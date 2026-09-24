/* Magnaat FROM ZERO: WAT ER ELKE DAG BINNENKOMT EN WEGGAAT.

   Loon op vrijdag. Boodschappen elke dag. Betalingen (./staat.js, `posten`) op
   hun dag. Je rekening kan niet rood staan: lukt een betaling niet, dan blijft
   hij openstaan, kost hij een keer aanmaningskosten en probeert hij het elke
   dag opnieuw. Sommige betalingen kun je een week uitstellen, tegen de prijs die
   erbij staat; huur niet. Staat je software open, dan werkt hij niet -- en dan
   kun je niet aan je opdracht. */
'use strict';
const R = require('./regels');
const { meld, ontgrendel, post, euro } = require('./staat');
const { boekVan } = require('./boek');

const fout = (error) => ({ status: 400, error });
const TEGEN = { huur: 'verhuurder', vast: 'leveranciers', software: null, aanmaning: 'incasso', uitstel: 'leveranciers', aflossing: null };

function betaalPost(st, p) {
  const b = boekVan(st), sleutel = 'post:' + p.id;
  if (p.soort === 'software') b.boekOver(st, { soort: 'SOFTWARE', van: ['kas'], naar: ['kosten', 'software'], bedrag: p.bedrag, omschrijving: p.naam, sleutel });
  else if (p.soort === 'aflossing') b.boekOver(st, { soort: 'AFLOSSING', van: ['kas'], naar: ['schuld', 'familie'], bedrag: p.bedrag, omschrijving: p.naam, sleutel });
  else b.boekOver(st, { soort: p.soort === 'aanmaning' ? 'AANMANING' : 'VERPLICHTING', van: ['kas'], naar: [TEGEN[p.soort] || 'leveranciers'], bedrag: p.bedrag, omschrijving: p.naam, sleutel });
}

/* De volgende keer van een terugkerende betaling. */
function volgendeKeer(st, p) {
  const v = R.VERPLICHTINGEN.find(x => x.id === p.soort) || (p.soort === 'software' ? R.SOFTWARE : null);
  if (v) post(st, { soort: p.soort, naam: p.naam, bedrag: v.bedrag, dag: (p.oorspronkelijk || p.dag) + v.elke });
}

function betaalWatVervalt(st) {
  const vandaag = st.posten.filter(p => p.dag <= st.dag).sort((a, b) => a.dag - b.dag);
  for (const p of vandaag) {
    if (st.kas >= p.bedrag) {
      betaalPost(st, p);
      st.posten.splice(st.posten.indexOf(p), 1);
      volgendeKeer(st, p);
      if (p.soort === 'software' && st.software.gepauzeerd) { st.software.gepauzeerd = false; meld(st, 'Je software werkt weer.', 'goed'); }
      if (p.achterstand) meld(st, p.naam + ' is alsnog betaald.', 'goed');
      if (p.soort === 'aflossing' && !st.posten.some(x => x.soort === 'aflossing')) {
        st.lening = null;
        meld(st, 'Je lening bij je familie is afgelost.', 'goed');
      }
      continue;
    }
    if (p.achterstand) continue;
    p.achterstand = true;
    meld(st, p.naam + ' (' + euro(p.bedrag) + ') kon niet worden betaald: er staat ' + euro(st.kas) + ' op je rekening. ' +
      (p.soort === 'software' ? 'Je software staat stil tot hij betaald is.'
        : ['aanmaning', 'aflossing', 'uitstel'].includes(p.soort) ? 'Hij blijft openstaan.' : 'Er komen ' + euro(R.AANMANING) + ' aanmaningskosten bij.'), 'nood');
    if (p.soort === 'software') st.software.gepauzeerd = true;
    else if (!['aanmaning', 'aflossing', 'uitstel'].includes(p.soort)) post(st, { soort: 'aanmaning', naam: 'Aanmaningskosten ' + p.naam.toLowerCase(), bedrag: R.AANMANING, dag: st.dag });
    ontgrendel(st, 'budget');
  }
}

function startDag(st) {
  const b = boekVan(st);
  if (st.baan.actief && R.weekdag(st.dag) === st.baan.loondag) {
    const loon = st.baan.urenPerWeek * st.baan.uurloon;
    b.boekOver(st, { soort: 'LOON', van: ['werkgever'], naar: ['kas'], bedrag: loon, omschrijving: 'Loon van ' + st.baan.werkgever, sleutel: 'loon:' + st.dag });
    meld(st, 'Je loon is binnen: ' + euro(loon) + '.', 'goed');
  }
  const eten = Math.min(Math.max(st.kas, 0), R.BOODSCHAPPEN);
  if (eten) b.boekOver(st, { soort: 'BOODSCHAPPEN', van: ['kas'], naar: ['winkels'], bedrag: eten, omschrijving: 'Boodschappen', sleutel: 'eten:' + st.dag });
  if (eten < R.BOODSCHAPPEN) meld(st, 'Je had vandaag ' + euro(eten) + ' voor eten. Het was een karige dag.', 'slecht');
  betaalWatVervalt(st);
}

function uitstel(st, z) {
  const p = st.posten.find(x => x.id === String(z.post || ''));
  if (!p) return fout('Die betaling staat niet open.');
  const regel = p.soort === 'software' ? R.SOFTWARE.uitstel : (R.VERPLICHTINGEN.find(v => v.id === p.soort) || {}).uitstel;
  if (!regel) return fout(p.naam + ' kun je niet uitstellen.');
  if (p.uitgesteld) return fout('Die betaling heb je al een keer uitgesteld.');
  if (p.dag > st.dag + 7) return fout('Uitstellen doe je in de week dat hij moet worden betaald.');
  p.oorspronkelijk = p.dag;
  p.dag = Math.max(p.dag, st.dag) + regel.dagen;
  p.uitgesteld = true;
  p.achterstand = false;
  if (p.soort === 'software') {
    st.software.gepauzeerd = true;
    meld(st, 'Je software staat een week stil: tot ' + R.dagNaam(p.dag) + ' kun je niet aan opdrachten werken.', 'vraag');
  } else {
    post(st, { soort: 'uitstel', naam: 'Kosten betalingsregeling', bedrag: regel.kosten, dag: p.dag });
    meld(st, p.naam + ' gaat naar ' + R.dagNaam(p.dag) + ' (dag ' + p.dag + '). Dat kost ' + euro(regel.kosten) + ' extra.', 'vraag');
  }
  return { ok: true };
}

function lenen(st, z) {
  if (st.lening) return fout('Je hebt al een lening bij je familie lopen.');
  const n = Number(z.bedrag), bedrag = Number.isInteger(n) ? n * 100 : 0;
  if (bedrag < 1000 || bedrag > R.LENING.max) return fout('Je familie kan je € 10 tot ' + euro(R.LENING.max) + ' lenen.');
  boekVan(st).boekOver(st, { soort: 'LENING', van: ['schuld', 'familie'], naar: ['kas'], bedrag, omschrijving: 'Lening van je familie', sleutel: 'lening:' + st.dag });
  st.lening = { bedrag, sinds: st.dag };
  const termijn = Math.ceil(bedrag / R.LENING.termijnen);
  for (let i = 1, over = bedrag; over > 0; i++) {
    const t = Math.min(termijn, over);
    post(st, { soort: 'aflossing', naam: 'Terug aan je familie', bedrag: t, dag: volgendeLoondag(st, i) });
    over -= t;
  }
  meld(st, 'Je familie leent je ' + euro(bedrag) + '. Je betaalt het terug van je volgende ' + R.LENING.termijnen + ' lonen: liquiditeit nu, een verplichting later.', 'vraag');
  return { ok: true };
}

function volgendeLoondag(st, n) {
  let d = st.dag + 1;
  while (R.weekdag(d) !== R.BAAN.loondag) d++;
  return d + (n - 1) * 7;
}

module.exports = { startDag, betaalWatVervalt, uitstel, lenen };
