/* Magnaat V2: PERSONEEL -- meer uren dan je zelf hebt, tegen een prijs die niet
   wacht tot de klant betaalt.

   Een medewerker IN DIENST krijgt elke vrijdag loon over zijn contractdagen, of
   je hem nu hebt ingepland of niet, en heeft een werkplek nodig. Een FREELANCER
   kost alleen de uren die hij echt maakt, maar per uur meer, en stuurt elke
   vrijdag een factuur die binnen twee weken betaald moet zijn. Wie je inplant,
   staat in je agenda (./tijd.js, `wie`); een teamlid werkt aan opdrachten, niet
   aan je eigen project -- dat blijft van jou.

   Loon dat niet betaald kan worden, wordt geen aanmaning: de medewerker legt het
   werk neer, en na een week gaat hij weg. Het loon blijft verschuldigd. */
'use strict';
const R = require('./regels');
const B = require('./regels-bedrijf');
const { meld, ontgrendel, post, euro, tijd } = require('./staat');
const { boekVan } = require('./boek');
const { betaalWatVervalt } = require('./geld');

const fout = (error) => ({ status: 400, error });
const teamlid = (st, id) => (st.team || []).find(m => m.id === String(id || '') && !m.weg) || null;
const dagenVan = (m) => m.dagen.map(w => R.DAGNAMEN[w]).join(', ');

/* Hoeveel minuten een teamlid op een dag kan werken: op zijn contractdagen,
   vanaf de dag dat hij begint en tot zijn laatste dag. */
function werkminuten(m, dag) {
  if (!m || m.weg || dag < m.sinds || (m.einde != null && dag > m.einde)) return 0;
  return m.dagen.includes(R.weekdag(dag)) ? m.minuten : 0;
}

function werkplek(st, m) {
  post(st, { soort: 'werkplek', naam: B.WERKPLEK.naam + ' voor ' + m.naam, bedrag: B.WERKPLEK.bedrag, dag: st.dag,
    leverancier: B.WERKPLEK.leverancier, naar: ['kosten', 'werkplek'], boekSoort: 'WERKPLEK' });
  m.werkplekVolgende = st.dag + B.WERKPLEK.elke;
}

function werf(st, z) {
  if (!st.onderneming) return fout('Personeel neem je aan als onderneming. Schrijf je eerst in.');
  const k = B.TEAMKANDIDATEN.find(x => x.id === z.kandidaat);
  if (!k) return fout('Kies wie je aanneemt: ' + B.TEAMKANDIDATEN.map(x => x.naam).join(', ') + '.');
  const eerder = st.team.find(m => m.id === k.id);
  if (eerder) return fout(k.naam + (eerder.weg ? ' werkte al voor je, en komt niet terug.' : ' werkt al voor je.'));
  if (st.team.filter(m => !m.weg).length >= B.TEAM_MAX) return fout('Meer dan ' + B.TEAM_MAX + ' mensen kun je naast je eigen werk niet aansturen.');
  const m = Object.assign({}, k, { dagen: k.dagen.slice(), sinds: st.dag, betaaldTot: st.dag - 1, gewerkt: 0, gestaakt: null, einde: null, weg: false });
  st.team.push(m);
  if (m.contract === 'dienst') {
    werkplek(st, m);
    betaalWatVervalt(st);
    meld(st, m.naam + ' (' + m.rol + ') komt bij je in dienst: ' + dagenVan(m) + ', ' + euro(m.uurloon) + ' per uur. Loon krijgt hij elke vrijdag, ' +
      'ook in een week zonder werk. De werkplek kost ' + euro(B.WERKPLEK.bedrag) + ' per vier weken, en je software een licentie meer.', 'goed');
  } else {
    meld(st, m.naam + ' werkt als freelancer voor je, op ' + dagenVan(m) + ', ' + euro(m.uurloon) + ' per uur dat hij maakt. ' +
      'Elke vrijdag stuurt hij een factuur, te betalen binnen ' + B.INHUUR_TERMIJN + ' dagen.', 'goed');
  }
  ontgrendel(st, 'personeel');
  ontgrendel(st, 'prognose');
  return { ok: true };
}

/* Afrekenen tot en met dag `tot`: loon over de contractdagen, of de factuur van
   de freelancer over de uren die hij maakte. */
function afrekenen(st, m, tot) {
  if (tot <= m.betaaldTot) return;
  if (m.contract === 'dienst') {
    let minuten = 0;
    for (let d = m.betaaldTot + 1; d <= tot; d++) minuten += werkminuten(m, d);
    const bedrag = Math.round(minuten * m.uurloon / 60);
    if (bedrag) {
      post(st, { soort: 'loon', naam: 'Loon ' + m.naam, bedrag, dag: st.dag, leverancier: m.naam,
        naar: ['kosten', 'personeel'], boekSoort: 'LOON_PERSONEEL', medewerker: m.id });
    }
  } else if (m.gewerkt) {
    const bedrag = Math.round(m.gewerkt * m.uurloon / 60);
    boekVan(st).boek(st, { soort: 'INHUUR', omschrijving: 'Factuur van ' + m.naam + ' over ' + tijd(m.gewerkt), sleutel: 'inhuur:' + m.id + ':' + st.dag,
      regels: [['debet', ['kosten', 'inhuur'], bedrag], ['credit', ['crediteur', m.id], bedrag]] });
    post(st, { soort: 'inhuur', naam: 'Factuur ' + m.naam, bedrag, dag: st.dag + B.INHUUR_TERMIJN, leverancier: m.naam,
      naar: ['crediteur', m.id], boekSoort: 'BETALING_LEVERANCIER' });
    m.gewerkt = 0;
  }
  m.betaaldTot = tot;
}

function laatGaan(st, m, waarom) {
  afrekenen(st, m, m.einde);
  m.weg = true;
  for (const [dag, lijst] of Object.entries(st.agenda)) st.agenda[dag] = lijst.filter(x => x.wie !== m.id);
  meld(st, m.naam + waarom, waarom.includes('loon') ? 'slecht' : 'info');
}

/* Het begin van elke dag, voor de betalingen: wie vertrekt, wat er aan
   werkplekken vervalt, en op vrijdag het loon en de facturen. */
function teamDag(st) {
  for (const m of st.team || []) {
    if (m.weg) continue;
    if (m.gestaakt && st.dag - m.gestaakt >= B.LOON_STAKING) {
      m.einde = Math.min(m.einde == null ? st.dag - 1 : m.einde, st.dag - 1);
      laatGaan(st, m, ' is weggegaan: al een week geen loon. Wat hij tegoed heeft, blijft verschuldigd.');
      continue;
    }
    if (m.einde != null && st.dag > m.einde) { laatGaan(st, m, ' werkt niet meer voor je. Zijn laatste loon of factuur staat klaar.'); continue; }
    if (m.contract === 'dienst' && m.werkplekVolgende <= st.dag) werkplek(st, m);
    if (R.weekdag(st.dag) === R.BAAN.loondag) afrekenen(st, m, st.dag - 1);
  }
}

function ontsla(st, z) {
  const m = teamlid(st, z.medewerker);
  if (!m) return fout('Die persoon werkt niet voor je.');
  if (m.einde != null) return fout(m.naam + ' heeft zijn laatste dag al: dag ' + m.einde + '.');
  m.einde = m.contract === 'dienst' ? st.dag + B.OPZEGTERMIJN : st.dag;
  for (const [dag, lijst] of Object.entries(st.agenda)) if (Number(dag) > m.einde) st.agenda[dag] = lijst.filter(x => x.wie !== m.id);
  meld(st, m.contract === 'dienst'
    ? 'Je hebt ' + m.naam + ' opgezegd. Hij werkt en krijgt loon tot en met dag ' + m.einde + ': zo lang is zijn opzegtermijn.'
    : m.naam + ' maakt vandaag af wat er staat. Zijn laatste factuur komt daarna.');
  return { ok: true };
}

module.exports = { werf, ontsla, teamDag, werkminuten, teamlid };
