/* Magnaat FROM ZERO: WAT NU ZIN HEEFT -- de handelingen voor de Edge.

   Het scherm rekent niets; de server zegt welke handelingen er nu zijn, in een
   vaste volgorde (wat dringt eerst), elk met de reden waarom. De eerste is de
   hoofdactie van de Edge. Er staat nooit een handeling die de server daarna
   zou weigeren om een reden die hier al bekend was. */
'use strict';
const R = require('./regels');
const { AANBOD } = require('./klanten');
const { euro, tijd: duur } = require('./staat');
const { rest } = require('./tijd');

function handelingenNu(st) {
  const uit = [];
  const zet = (actie, label, waarom, invoer) => uit.push({ actie, label, waarom, invoer: invoer || null });
  if (!st.aanbod) {
    zet('kies', 'Kies wat je gaat maken', 'Met je laptop en telefoon kun je iets voor jezelf beginnen.',
      { aanbod: Object.entries(AANBOD).map(([id, a]) => ({ id, naam: a.naam })) });
  }
  if (st.ondernemingVraag != null && !st.onderneming) {
    zet('onderneming', 'Schrijf je onderneming in', 'Je werkt structureel voor klanten. ' + R.JURISDICTIE.inschrijven + ' Het kost ' + euro(R.KVK) + '.', { naam: 'tekst' });
  }
  if (st.zelfstandigMag && st.baan.actief) zet('ontslag', 'Zeg je baan op', 'Je bedrijf brengt meer binnen dan twee keer je loon.');
  for (const d of st.deals) {
    const laatste = (d.rondes || [])[d.rondes.length - 1];
    if (d.fase === 'kans') zet('gesprek', 'Praat met ' + d.klant, 'Een half uur, en dan weet je wat hij wil.', { deal: d.id });
    if (d.fase === 'onderhandeling' && laatste && laatste.van === 'klant') {
      zet('neem', 'Akkoord met ' + d.klant, d.klant + ' biedt ' + euro(laatste.bedrag) + (laatste.voorschot ? ' met ' + laatste.voorschot + '% vooraf' : '') +
        ', af binnen ' + laatste.dagen + ' dagen.', { deal: d.id });
    }
    if (d.fase === 'onderhandeling' && !d.vervolg) {
      zet('voorstel', 'Voorstel aan ' + d.klant, duur(d.uren) + ' werk; hij wil het binnen ' + d.termijn + ' dagen. Prijs, deadline en voorschot zijn te bespreken.',
        { deal: d.id, bedrag: 'euro', dagen: d.termijn, voorschot: [0, 25, 50] });
    }
    if (d.fase === 'overeenkomst' && d.gedaan >= d.afspraak.minuten) zet('lever', 'Lever op aan ' + d.klant, 'Het werk is af.', { deal: d.id });
    if (d.fase === 'geleverd') zet('factuur', 'Factuur aan ' + d.klant, 'Opgeleverd; nu moet het betaald worden.', { deal: d.id });
    if (d.fase === 'gefactureerd' && !d.factuur.gefinancierd) {
      const teLaat = st.dag - d.factuur.vervaldag;
      if (teLaat > 0 && !d.factuur.herinnerd) zet('herinnering', 'Herinner ' + d.klant, euro(d.factuur.rest) + ' is ' + teLaat + ' dagen te laat.', { deal: d.id });
      if (!d.factuur.korting) zet('korting', 'Korting voor directe betaling', 'Geld nu van ' + d.klant + ', maar minder.', { deal: d.id, procent: 'getal' });
      if (st.onderneming) zet('voorfinancier', 'Factuur voorfinancieren', R.VOORFINANCIERING.deel + '% van ' + euro(d.factuur.rest) + ' nu; de rest kost het.', { deal: d.id });
    }
  }
  const komend = st.posten.filter(p => p.dag <= st.dag + 7);
  const nodig = komend.reduce((s, p) => s + p.bedrag, 0);
  if (nodig > st.kas) {
    for (const p of komend) {
      const kan = p.soort === 'software' || (R.VERPLICHTINGEN.find(v => v.id === p.soort) || {}).uitstel;
      if (!kan || p.uitgesteld) continue;
      if (p.soort === 'software') zet('uitstel', 'Zet je abonnement een week stil', 'Een week niets betalen, maar je software ligt dan stil: geen werk aan opdrachten.', { post: p.id });
      else zet('uitstel', 'Vraag een betalingsregeling', p.naam + ' een week later betalen, tegen ' + euro(kan.kosten) + ' kosten.', { post: p.id });
    }
    if (!st.lening) zet('lenen', 'Leen van je familie', 'Tot ' + euro(R.LENING.max) + ', terug van je volgende twee lonen.', { bedrag: 'euro' });
  }
  const open = st.deals.find(d => d.fase === 'overeenkomst' && d.gedaan < d.afspraak.minuten);
  if (rest(st, st.dag) >= 30 && st.aanbod) {
    if (open && !(st.software && st.software.gepauzeerd)) zet('plan', 'Werk aan de opdracht van ' + open.klant, 'Nog ' + duur(open.afspraak.minuten - open.gedaan) + ' te gaan, af op dag ' + open.afspraak.deadline + '.', { wat: 'opdracht', deal: open.id, dag: st.dag, minuten: 'minuten' });
    zet('plan', 'Werk aan ' + AANBOD[st.aanbod].project, 'Wie je werk ziet, kan er iets van vinden.', { wat: 'project', dag: st.dag, minuten: 'minuten' });
    zet('plan', 'Leer iets', 'Wie meer kan, doet een opdracht sneller.', { wat: 'leren', dag: st.dag, minuten: 'minuten' });
  }
  if (st.baan.actief) {
    for (let dag = st.dag; dag <= st.dag + 6; dag++) {
      if (R.weekdag(dag) === st.baan.extra.dag && rest(st, dag) >= st.baan.extra.minuten) {
        zet('plan', 'Extra dienst op ' + R.dagNaam(dag), euro(st.baan.extra.loon) + ' voor ' + duur(st.baan.extra.minuten) + ', en die tijd is dan weg.', { wat: 'extra', dag });
        break;
      }
    }
  }
  zet('slaap', 'Sluit de dag af', 'Wat je hebt gepland, gebeurt; dan begint ' + R.dagNaam(st.dag + 1) + '.');
  return uit;
}

module.exports = { handelingenNu };
