/* Magnaat V2: WAT NU ZIN HEEFT ALS ONDERNEMING -- de handelingen van je team,
   je contracten en je handel, voor de Edge (./volgende.js zet ze op hun plek).
   Dezelfde regel als daar: er staat nooit een handeling die de server zou
   weigeren om een reden die hier al bekend is. */
'use strict';
const B = require('./regels-bedrijf');
const { euro, tijd: duur } = require('./staat');
const { rest } = require('./tijd');
const { waarVan, geblokkeerd } = require('./voorraad');
const M = require('./regels-markt');

function contractAanbod(st, zet) {
  for (const c of st.contracten || []) {
    if (c.stand !== 'aanbod') continue;
    zet('teken', 'Teken het contract met ' + c.klant, duur(c.minuten) + ' werk elke vier weken voor ' + euro(c.bedrag) + ', ' + c.termijnen +
      ' termijnen. Vaste omzet, en vaste uren.', { contract: c.id });
    zet('wijsaf', 'Bedank ' + c.klant, 'Dan blijven die uren vrij.', { contract: c.id });
  }
}

function kandidaat(k) {
  return { id: k.id, naam: k.naam + ', ' + k.rol + ': ' + euro(k.uurloon) + ' per uur, ' +
    (k.contract === 'dienst' ? duur(k.minuten * k.dagen.length) + ' per week in dienst' : 'alleen de uren die hij maakt') };
}

function bedrijfHandelingen(st, zet) {
  if (!st.onderneming) return;
  const team = st.team.filter(m => !m.weg);
  const open = st.deals.filter(d => d.fase === 'overeenkomst' && d.gedaan < d.afspraak.minuten)
    .sort((a, b) => a.afspraak.deadline - b.afspraak.deadline);
  const stil = st.software && st.software.gepauzeerd;
  for (const m of team) {
    const r = rest(st, st.dag, m.id);
    if (!open.length || stil || m.gestaakt || r < 60) continue;
    zet('plan', 'Laat ' + m.naam + ' werken aan ' + open[0].klant, duur(r) + ' van ' + m.naam + ' vandaag' +
      (m.tempo < 100 ? '; hij doet er als ' + m.rol + ' langer over dan jij.' : '.'),
      { wat: 'opdracht', deal: open[0].id, dag: st.dag, wie: m.id, minuten: r - (r % 30) });
  }
  const vrij = B.TEAMKANDIDATEN.filter(k => !st.team.some(m => m.id === k.id));
  if (team.length < B.TEAM_MAX && vrij.length) {
    zet('werf', 'Neem iemand aan', 'Meer uren dan je zelf hebt. In dienst kost elke week loon, ook zonder werk; een freelancer alleen zijn uren.',
      { kandidaat: vrij.map(kandidaat) });
  }
  const w = waarVan(st);
  if (w && !geblokkeerd(st)) {
    zet('bestel', 'Bestel ' + w.naam.toLowerCase(), 'Bij ' + w.leverancier + ' voor ' + euro(w.inkoop) + ' per stuk; klanten betalen er gewoonlijk ' +
      euro(w.advies) + ' voor.' + (st.handel ? ' Betalen binnen ' + w.termijn + ' dagen na levering.' : ' De eerste keer betaal je vooraf.'),
    { aantal: 'getal', minimum: w.minimum });
  }
  const plekken = Object.entries(M.WIJKEN).filter(([id]) => id !== (st.vestiging || {}).wijk);
  zet('vestig', 'Verhuis je bedrijf', 'Waar je zit, bepaalt hoeveel mensen je zien en wat het kost.',
    { wijk: plekken.map(([id, x]) => ({ id, naam: x.naam + (x.huur ? ': ' + euro(x.huur) + ' per vier weken, verhuizen ' + euro(x.verhuis) : ': geen huur, weinig zichtbaar') })) });
  if (st.handel) zet('prijs', 'Verander je verkoopprijs', 'Nu ' + euro(st.handel.prijs) + '. Duurder verkoopt minder, goedkoper meer.', { bedrag: 'euro' });
  for (const c of st.contracten) {
    if (c.stand === 'actief' && !c.opgezegd) zet('zegop', 'Zeg het contract met ' + c.klant + ' op', 'De termijn die loopt, maak je af.', { contract: c.id });
  }
  for (const m of team) {
    if (m.einde != null) continue;
    zet('ontsla', m.contract === 'dienst' ? 'Zeg ' + m.naam + ' op' : 'Stop met ' + m.naam,
      m.contract === 'dienst' ? 'Hij werkt en krijgt loon nog ' + B.OPZEGTERMIJN + ' dagen.' : 'Hij stuurt nog een laatste factuur.', { medewerker: m.id });
  }
}

module.exports = { contractAanbod, bedrijfHandelingen };
