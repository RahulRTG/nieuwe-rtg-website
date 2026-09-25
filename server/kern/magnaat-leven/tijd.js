/* Magnaat FROM ZERO: TIJD IS HIER NET ZO SCHAARS ALS GELD.

   Elke dag heeft vrije minuten naast je baan (./regels.js, VRIJ). Die plan je
   in de agenda: aan je eigen project, aan leren, aan een opdracht, of aan een
   extra dienst. Een uur kan maar een keer op: wie donderdag de extra dienst
   neemt, heeft die zeven uur niet voor zijn klant. Dat is opportunity cost, en
   niemand hoeft het woord te kennen om hem te voelen.

   De agenda wordt uitgevoerd aan het EINDE van de dag (./dag.js roept
   `voerUit` aan). Tot dan kun je hem nog veranderen. */
'use strict';
const R = require('./regels');
const { meld, ontgrendel, deal: vindDeal, euro, tijd } = require('./staat');
const { boekVan } = require('./boek');

const WAT = { project: 'eigen project', leren: 'leren', opdracht: 'opdracht', extra: 'extra dienst', gesprek: 'klantgesprek' };

function vrij(st, dag) {
  const w = R.weekdag(dag);
  /* Zonder baan komen de dienstdagen vrij: dan heb je er zeven uur. */
  return !st.baan.actief && st.baan.dienstdagen.includes(w) ? 420 : R.VRIJ[w];
}
const gepland = (st, dag) => (st.agenda[dag] || []).reduce((s, x) => s + x.minuten, 0);
const rest = (st, dag) => vrij(st, dag) - gepland(st, dag);

const fout = (error) => ({ status: 400, error });

function plan(st, z) {
  const dag = Number(z.dag), minuten = Number(z.minuten), wat = String(z.wat || '');
  if (!Number.isInteger(dag) || dag < st.dag || dag > st.dag + 6) return fout('Je plant vandaag en de zes dagen daarna.');
  if (!WAT[wat] || wat === 'gesprek') return fout('Plan tijd voor je project, om te leren, voor een opdracht of voor een extra dienst.');
  const regel = { wat, minuten };
  if (wat === 'extra') {
    if (!st.baan.actief) return fout('Je hebt geen baan meer om een extra dienst te draaien.');
    if (R.weekdag(dag) !== st.baan.extra.dag) return fout('De keuken vraagt extra mensen op ' + R.DAGNAMEN[st.baan.extra.dag] + '.');
    if ((st.agenda[dag] || []).some(x => x.wat === 'extra')) return fout('Die extra dienst staat al in je agenda.');
    regel.minuten = st.baan.extra.minuten;
  } else if (!Number.isInteger(minuten) || minuten < 30 || minuten % 30) {
    return fout('Plan in blokken van een half uur.');
  }
  if (!st.aanbod && wat !== 'extra') return fout('Kies eerst wat je wilt maken: dan heb je een eigen project.');
  if (wat === 'opdracht') {
    const d = vindDeal(st, z.deal);
    if (!d || d.fase !== 'overeenkomst') return fout('Tijd voor een opdracht plan je op een lopende afspraak.');
    if (dag === st.dag && st.software && st.software.gepauzeerd) {
      return fout('Je software is niet betaald en staat stil, dus vandaag kun je niet aan de opdracht. Plan hem op een dag ' +
        'waarop hij weer betaald is, of gebruik deze tijd voor iets anders.');
    }
    regel.deal = d.id;
  }
  if (rest(st, dag) < regel.minuten) {
    return fout('Op ' + R.dagNaam(dag) + ' heb je nog ' + tijd(Math.max(0, rest(st, dag))) + ' vrij, en dit kost ' + tijd(regel.minuten) + '.');
  }
  (st.agenda[dag] = st.agenda[dag] || []).push(regel);
  ontgrendel(st, 'agenda');
  return { ok: true };
}

function schrap(st, z) {
  const dag = Number(z.dag), i = Number(z.index), lijst = st.agenda[dag] || [];
  if (dag < st.dag || !lijst[i] || lijst[i].wat === 'gesprek') return fout('Daar staat niets in je agenda dat je nog kunt schrappen.');
  lijst.splice(i, 1);
  return { ok: true };
}

/* Het einde van de dag: wat er gepland stond, gebeurt nu. */
function voerUit(st) {
  const lijst = st.agenda[st.dag] || [];
  for (const x of lijst) {
    if (x.wat === 'project') { st.portfolio += x.minuten; continue; }
    if (x.wat === 'leren') { st.geleerd += x.minuten; continue; }
    if (x.wat === 'extra') {
      boekVan(st).boekOver(st, { soort: 'EXTRA_DIENST', van: ['werkgever'], naar: ['kas'], bedrag: st.baan.extra.loon,
        omschrijving: 'Extra dienst bij ' + st.baan.werkgever, sleutel: 'extra:' + st.dag });
      meld(st, 'Extra dienst gedraaid: ' + euro(st.baan.extra.loon) + ' erbij.', 'goed');
      continue;
    }
    if (x.wat === 'opdracht') {
      const d = vindDeal(st, x.deal);
      if (!d || d.fase !== 'overeenkomst') continue;
      if (st.software && st.software.gepauzeerd) {
        meld(st, 'Je software staat stil omdat hij niet betaald is: ' + tijd(x.minuten) + ' werk ging verloren.', 'slecht');
        continue;
      }
      d.gedaan = Math.min(d.afspraak.minuten, d.gedaan + x.minuten);
      if (d.gedaan >= d.afspraak.minuten) meld(st, 'Het werk voor ' + d.klant + ' is af. Lever het op.', 'goed');
    }
  }
  delete st.agenda[st.dag - 8];
}

module.exports = { vrij, gepland, rest, plan, schrap, voerUit, WAT };
