/* ============================================================================
   VOORSTELLEN VAN PARTIJEN -- een aansluiting, dezelfde voor iedereen
   (POLITIEK.md par. 7.1, 7.2 en 9).

   Een partij plaatst een VOORSTEL met een bron, voegt TOELICHTINGEN toe en vult
   de AANNAMELIJST in. Dat is alles in V1. Elke partij gaat door dezelfde functie
   met dezelfde limieten; nergens wordt vertakt op welke partij het is of op
   haar categorie (DO-03).

   EEN KWESTIE IS VAN NIEMAND (ISSUE_PARTY_NEUTRALITY). Een partij KOPPELT een
   voorstel aan een kwestie en eigent zich niets toe: de kwestie krijgt alleen de
   regel "voorstel gekoppeld" op haar tijdlijn, zoals bij een actie. En een partij
   ziet alleen kwesties die hun inbrenger zelf OPENBAAR maakte door er een actie
   van het DoeNetwerk van te maken (./doe.js vraagt daar uitdrukkelijk om). Van
   zo'n kwestie ziet ze het onderwerp en het gebied -- geen datum, geen aantal en
   niets over wie (kwestie is geen targetinginvoer, par. 18.2).

   DE AANNAMELIJST STAAT OP ONBEKEND tot iemand een veld MET een bron invult
   (par. 7.2). Een leeg veld is een vaststelling en geen oordeel, en het staat
   voor elke partij op dezelfde plek.

   NIETS WORDT OVERSCHREVEN (DO-10). Een voorstel draagt zijn eigen hashketen
   (server/lib/keten.js); een nieuwe toelichting of een nieuw ingevuld veld is
   een nieuwe regel, en de vorige waarde blijft in de keten staan.

   VOLGORDE IS OOK EEN RANGORDE (besluit 4). Niet alfabetisch, niet op zetels,
   niet op wie het eerst plaatste, en geen verborgen persoonlijke randomisering:
   de partijen staan op hun registernummer en de lijst schuift ELKE DAG een plaats
   op, voor iedereen gelijk. Er wordt niet bijgehouden welke volgorde tot meer
   klikken leidt (NO_ORDER_OPTIMIZATION): deze module telt geen weergaven. */
'use strict';

const keten = require('../../lib/keten');
const { schoon } = require('../util');

const AANNAMES = [
  { veld: 'kosten', vraag: 'Wat kost het?' },
  { veld: 'betaler', vraag: 'Wie betaalt het?' },
  { veld: 'profiteert', vraag: 'Wie profiteert?' },
  { veld: 'nadeel', vraag: 'Wie heeft er nadeel van?' },
  { veld: 'regel', vraag: 'Welke regel moet veranderen?' },
  { veld: 'uitvoerder', vraag: 'Wie voert het uit?' },
  { veld: 'onzeker', vraag: 'Welke aannames zijn onzeker?' }
];
const AANNAME_VELDEN = AANNAMES.map(a => a.veld);

/* Dezelfde limieten voor elke partij (PARTY_CAPABILITY_PARITY). */
const LIMIETEN = { voorstellenPerDag: 25, toelichtingenPerVoorstel: 20, tekst: 2000, titel: 160, bron: 300 };
const AFWEZIG = 'Deze partij heeft hierover niets aangeleverd.';
const DAG = 86400000;

function maakVoorstellen({ kaart, kijk, vastleggen, crypto, nu, nuMs, partijen, zoekKwestie, openbaar, schrijver }) {
  const vind = (id) => kijk()[String(id || '').toUpperCase()] || null;
  const dag = (t) => (t ? String(t).slice(0, 10) : null);
  const leeg = () => Object.fromEntries(AANNAME_VELDEN.map(v => [v, null]));

  function beeld(v) {
    const p = partijen.vind(v.partij);
    return {
      id: v.id, partij: p ? { id: p.id, aanduiding: p.aanduiding, stand: p.stand } : null,
      kwestie: v.kwestie, titel: v.titel, tekst: v.tekst, bron: v.bron, at: dag(v.at),
      toelichtingen: v.toelichtingen.map(t => ({ tekst: t.tekst, bron: t.bron, at: dag(t.at) })),
      aannames: AANNAMES.map(a => {
        const w = v.aannames[a.veld];
        return { veld: a.veld, vraag: a.vraag, stand: w ? 'ingevuld' : 'onbekend',
          waarde: w ? w.waarde : null, bron: w ? w.bron : null };
      })
    };
  }

  /* Een openbare kwestie zoals een partij hem ziet: het onderwerp, niets meer. */
  const kwestieBeeld = (k) => ({ id: k.id, onderwerp: k.onderwerp, gebied: k.gebied || null });
  const openbareKwesties = () => ({ ok: true, kwesties: openbaar().map(kwestieBeeld) });

  function vandaagGeplaatst(partijId) {
    const vandaag = dag(nu());
    return Object.values(kijk()).filter(v => v.partij === partijId && dag(v.at) === vandaag).length;
  }

  async function plaats(partij, b) {
    const titel = schoon(b.titel, LIMIETEN.titel);
    const tekst = schoon(b.tekst, LIMIETEN.tekst);
    const bron = schoon(b.bron, LIMIETEN.bron);
    if (titel.length < 5) return { status: 400, error: 'Geef het voorstel een titel van minstens vijf tekens.' };
    if (tekst.length < 20) return { status: 400, error: 'Beschrijf het voorstel in minstens twintig tekens.' };
    if (bron.length < 5) return { status: 400, error: 'Een voorstel draagt een bron: waar staat het letterlijk (programma, motie, besluit)?' };
    let k = null;
    if (b.kwestie) {
      k = zoekKwestie(b.kwestie);
      if (!k || !openbaar().some(o => o.id === k.id)) {
        return { status: 404, error: 'Die kwestie is niet openbaar. Een partij koppelt alleen aan kwesties die hun inbrenger zelf openbaar maakte.' };
      }
    }
    if (vandaagGeplaatst(partij.id) >= LIMIETEN.voorstellenPerDag) {
      return { status: 429, error: 'Elke partij plaatst hoogstens ' + LIMIETEN.voorstellenPerDag + ' voorstellen per dag. Die grens is voor iedereen gelijk.' };
    }
    let v = null;
    const mis = await vastleggen(() => {
      const alle = kaart();
      let id;
      do { id = 'VS-' + crypto.randomBytes(3).toString('hex').toUpperCase(); } while (alle[id]);
      v = { id, partij: partij.id, kwestie: k ? k.id : null, titel, tekst, bron, at: nu(),
        toelichtingen: [], aannames: leeg(), keten: [] };
      keten.noteerIn(v.keten, { at: v.at, wat: 'geplaatst', titel, tekst, bron, kwestie: v.kwestie }, 0);
      alle[id] = v;
      if (k) schrijver.voorstel(k, id);
    });
    return mis || { ok: true, voorstel: beeld(v) };
  }

  /* Een handeling op een eigen voorstel. Weigert voordat er iets wordt aangeraakt. */
  async function opEigen(partij, id, toets, werk) {
    const v = vind(id);
    if (!v || v.partij !== partij.id) return { status: 404, error: 'Dit voorstel staat niet op naam van uw partij.' };
    const fout = toets(v);
    if (fout) return fout;
    const mis = await vastleggen(() => werk(v));
    return mis || { ok: true, voorstel: beeld(v) };
  }

  const toelicht = (partij, id, b) => {
    const tekst = schoon(b.tekst, LIMIETEN.tekst);
    const bron = schoon(b.bron, LIMIETEN.bron) || null;
    return opEigen(partij, id, (v) => {
      if (tekst.length < 20) return { status: 400, error: 'Een toelichting heeft minstens twintig tekens.' };
      if (v.toelichtingen.length >= LIMIETEN.toelichtingenPerVoorstel) {
        return { status: 409, error: 'Een voorstel draagt hoogstens ' + LIMIETEN.toelichtingenPerVoorstel + ' toelichtingen.' };
      }
      return null;
    }, (v) => {
      const t = { tekst, bron, at: nu() };
      v.toelichtingen.push(t);
      keten.noteerIn(v.keten, { at: t.at, wat: 'toelichting', tekst, bron }, 0);
    });
  };

  const aanname = (partij, id, b) => {
    const veld = String(b.veld || '');
    const waarde = schoon(b.waarde, 600);
    const bron = schoon(b.bron, LIMIETEN.bron);
    return opEigen(partij, id, (v) => {
      if (!AANNAME_VELDEN.includes(veld)) return { status: 400, error: 'Kies een veld uit de aannamelijst: ' + AANNAME_VELDEN.join(', ') + '.' };
      if (waarde.length < 2) return { status: 400, error: 'Vul een waarde in.' };
      if (bron.length < 5) return { status: 400, error: 'Een veld van de aannamelijst gaat pas van onbekend af met een bron.' };
      const nu0 = v.aannames[veld];
      if (nu0 && nu0.waarde === waarde && nu0.bron === bron) return { ok: true, herhaling: true, voorstel: beeld(v) };
      return null;
    }, (v) => {
      v.aannames[veld] = { waarde, bron, at: nu() };
      keten.noteerIn(v.keten, { at: v.aannames[veld].at, wat: 'aanname', veld, waarde, bron }, 0);
    });
  };

  const mijn = (partij) => ({ ok: true, voorstellen: Object.values(kijk()).filter(v => v.partij === partij.id)
    .sort((a, b) => String(b.at).localeCompare(String(a.at))).map(beeld) });

  /* De voorstellen bij een kwestie, per partij en in de volgorde van vandaag.
     Elke actieve partij krijgt een plek, ook zonder voorstel -- dan staat er de
     neutrale afwezigheid. Een uitgeschreven partij houdt haar plek alleen waar
     ze iets plaatste, met haar stand erbij. */
  function bijKwestie(kid) {
    const hier = Object.values(kijk()).filter(v => v.kwestie === kid);
    const ids = new Set(partijen.lijst().partijen.filter(p => p.stand === 'actief').map(p => p.id));
    for (const v of hier) ids.add(v.partij);
    const rij = [...ids].sort();
    const start = rij.length ? Math.floor(nuMs() / DAG) % rij.length : 0;
    const volgorde = rij.slice(start).concat(rij.slice(0, start));
    const plekken = volgorde.map(pid => {
      const p = partijen.vind(pid);
      const eigen = hier.filter(v => v.partij === pid).sort((a, b) => String(a.at).localeCompare(String(b.at))).map(beeld);
      return { partij: partijen.beeld(p), voorstellen: eigen, afwezig: eigen.length ? null : AFWEZIG };
    });
    const eerste = plekken[0] && plekken[0].partij.aanduiding;
    return { plekken, volgorde: { regel: 'De volgorde schuift elke dag een plaats op en is voor iedereen gelijk. Er is geen betaalde of vaste plek.',
      vandaagBeginBij: eerste || null } };
  }

  return { plaats, toelicht, aanname, mijn, openbareKwesties, bijKwestie, AANNAMES };
}

module.exports = { maakVoorstellen, AANNAMES, LIMIETEN, AFWEZIG };
