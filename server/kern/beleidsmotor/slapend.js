/* SLAPENDE RECHTEN -- AUTHORITY.md fase 8, besluit van de eigenaar (23 september
   2026): ALLEEN DE LAATSTE GEBRUIKSDATUM PER ZETEL, 90 DAGEN BEWAARD.

   Wat hier staat is per houder en per zetel (kantoorrol, boardroom, balie) EEN
   datum: de dag waarop hij voor het laatst door die deur ging. Geen tijdstip,
   geen route, geen handeling, geen aantal -- dat zou een gedragslogboek over
   personeel zijn, en dat is precies wat de eigenaar NIET koos. Een datum die
   ouder is dan 90 dagen wordt gewist; wat er dan overblijft IS het antwoord
   ("niet gebruikt in 90 dagen").

   DE SCHRIJFWEG is die van ../kantoor/mensdeur-spoel.js, om dezelfde reden: dit
   wordt genoteerd NA het antwoord, en daar staat geen requestcommit meer. Dus
   eerst naar een RAM-buffer, dan via `bewerkCollectie` op een timer die unref't,
   en bij een fout terug de buffer in. Hooguit een schrijfactie per zetel per dag.

   "ONBEKEND" IS GEEN "SLAPEND". Een zetel zonder datum is pas slapend als deze
   meting zelf al 90 dagen loopt; daarvoor weten we het niet. */
'use strict';

const BEWAAR_DAGEN = 90;
const DAG = 86400000;
const SPOEL_MS = 5000;
const SINDS = '_meetSinds';
const ZETELS = Object.freeze(['kantoorrol', 'boardroom', 'balie']);

function maakSlapend({ bak, kijk, save, bewerkCollectie, nu }) {
  const tijd = nu || Date.now;
  const dag = (t) => new Date(t).toISOString().slice(0, 10);
  let wacht = new Map();
  let zetter = null;

  function pasToe(kaart, batch) {
    if (!kaart[SINDS]) kaart[SINDS] = dag(tijd());
    for (const [k, d] of batch) if (!kaart[k] || kaart[k] < d) kaart[k] = d;
    const grens = dag(tijd() - BEWAAR_DAGEN * DAG);
    for (const k of Object.keys(kaart)) if (k !== SINDS && kaart[k] < grens) delete kaart[k];
  }

  function spoel() {
    if (!wacht.size) return false;
    const batch = wacht; wacht = new Map();
    try {
      if (typeof bewerkCollectie === 'function') bewerkCollectie('zetelGebruik', (kaart) => pasToe(kaart, batch));
      else { pasToe(bak(), batch); save(); }
      return true;
    } catch (e) {
      for (const [k, d] of batch) if (!wacht.has(k) || wacht.get(k) < d) wacht.set(k, d);
      plan();
      return false;
    }
  }
  function plan() {
    if (zetter) return;
    zetter = setTimeout(() => { zetter = null; try { spoel(); } catch (e) { /* een meting houdt niets tegen */ } }, SPOEL_MS);
    if (zetter.unref) zetter.unref();
  }

  /* Noteren: een datum, en alleen als hij nieuw is voor vandaag. */
  function noteer(key, zetel) {
    if (!key || !ZETELS.includes(zetel)) return;
    const k = key + '|' + zetel;
    const d = dag(tijd());
    const opgeslagen = (kijk() || {})[k];
    if (opgeslagen === d || wacht.get(k) === d) return;
    wacht.set(k, d);
    plan();
  }

  /* Lezen projecteert de buffer over de opslag, zodat een lezing nooit een
     verborgen schrijfactie is. */
  function laatst(key, zetel) {
    const k = key + '|' + zetel;
    const opgeslagen = kijk() || {};
    const d = wacht.get(k) || opgeslagen[k] || null;
    const sinds = opgeslagen[SINDS] || (wacht.size ? dag(tijd()) : null);
    const loopt = sinds ? Math.floor((tijd() - Date.parse(sinds)) / DAG) : 0;
    let slapend;
    if (d) slapend = 'nee';
    else slapend = loopt >= BEWAAR_DAGEN ? 'ja' : 'onbekend';
    return { laatstGebruikt: d, slapend };
  }

  return { noteer, laatst, spoel, BEWAAR_DAGEN, ZETELS };
}

module.exports = { maakSlapend, BEWAAR_DAGEN };
