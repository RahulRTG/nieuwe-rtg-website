/* DE CAMPAGNES VAN RTG ZELF -- besluit C12 van de eigenaar (28 september 2026).

   WAT EEN CAMPAGNE IS. Een campagne is een benoemde linkcode (?c=...) met een
   begin- en een einddatum, en hij hoort bij precies EEN aanmeldkanaal
   (kern/aanmeldkanaal.js). Het kanaal is dus de grote bak, de campagne een
   benoemd stuk ervan. Een campagne over twee kanalen bestaat niet: dan staat een
   nieuw lid in twee tabellen en telt de optelsom dubbel.

   WAT HIER STAAT. Alleen het register: welke codes er zijn, onder welk kanaal,
   van wanneer tot wanneer, en wie ze aanmaakte (een mens van Financien op naam).
   Wat een campagne KOSTTE staat in het boek van RTG (kern/rtgboek.js), en hoeveel
   nieuwe leden hij opleverde in de telling van het aanmeldkanaal -- geen van
   beide is hier een tweede kopie.

   VIER REGELS.
   1. EEN CODE IS VAN EEN CAMPAGNE, VOOR ALTIJD. Een code wordt niet hergebruikt
      en niet hernoemd: een oude telling onder die code gaat anders over een andere
      campagne.
   2. HET KANAAL IS VAST. Een campagne verhuist niet naar een ander kanaal, om
      dezelfde reden.
   3. 'vriend' HEEFT GEEN CAMPAGNE. Een lid dat een vriend meeneemt kost geen
      advertentie, en het boek heeft daar ook geen post voor.
   4. GEEN KLIKKEN EN GEEN ATTRIBUTIE. Het effect van een campagne is het aantal
      nieuwe leden dat met zijn code binnenkwam, langs de groepspoort. Wie de link
      zag en later zelf zocht, telt niet mee -- dat is een ondergrens en dat staat
      erbij. */
'use strict';

const NAAM = 'rtgCampagnes';
const CODE = /^[a-z0-9][a-z0-9-]{1,31}$/;
const DAG = /^\d{4}-\d{2}-\d{2}$/;

/* De kanalen komen BINNEN (`kanalen`, een functie omdat de telling later wordt
   gemaakt), zodat er geen tweede lijst ontstaat en geen koppeling tussen de twee
   domeinen. */
module.exports = ({ db, save, nu, kanalen }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/rtgcampagne', bezit: { [NAAM]: 'kaart' } });
  const klok = typeof nu === 'function' ? nu : () => new Date().toISOString();
  const kanaalLijst = () => (typeof kanalen === 'function' ? kanalen() : kanalen) || [];

  function maak({ code, naam, kanaal, van, tot, wie }) {
    const c = String(code || '').trim().toLowerCase();
    if (!CODE.test(c)) return { status: 400, error: 'Een code is 2 tot 32 tekens: kleine letters, cijfers en streepjes.' };
    const k = String(kanaal || '');
    if (k === 'vriend') return { status: 400, error: 'Een vriend die iemand meeneemt is geen campagne.' };
    if (!kanaalLijst().includes(k)) return { status: 400, error: 'Kies een van de kanalen: ' + kanaalLijst().filter(x => x !== 'vriend').join(', ') + '.' };
    if (!DAG.test(String(van || '')) || !DAG.test(String(tot || ''))) return { status: 400, error: 'Begin en einde zijn een datum als 2026-10-01.' };
    if (tot < van) return { status: 400, error: 'Het einde ligt voor het begin.' };
    const n = String(naam || '').replace(/[<>]/g, '').trim().slice(0, 80);
    if (n.length < 2) return { status: 400, error: 'Geef de campagne een naam.' };
    if (!wie) return { status: 403, error: 'Een campagne maakt een mens van Financien op naam, niet de gedeelde kantoorcode.' };
    const kaart = eigen.bak(NAAM);
    const oud = kaart[c];
    if (oud) {
      // dezelfde aanvraag nog eens verandert niets; een andere onder dezelfde code weigert
      if (oud.naam === n && oud.kanaal === k && oud.van === van && oud.tot === tot) return { ok: true, ongewijzigd: true, campagne: vorm(c, oud) };
      return { status: 409, error: 'De code ' + c + ' is al van een campagne; een code wordt niet hergebruikt.' };
    }
    kaart[c] = { naam: n, kanaal: k, van, tot, gemaaktOp: klok(), gemaaktDoor: String(wie).slice(0, 80) };
    save();
    return { ok: true, campagne: vorm(c, kaart[c]) };
  }

  const vorm = (code, r) => ({ code, naam: r.naam, kanaal: r.kanaal, van: r.van, tot: r.tot, gemaaktOp: r.gemaaktOp, gemaaktDoor: r.gemaaktDoor });

  /* Het register. Lezen maakt niets aan. */
  const lijst = () => Object.entries(eigen.kijk(NAAM)).map(([c, r]) => vorm(c, r)).sort((a, b) => (a.van < b.van ? -1 : a.van > b.van ? 1 : 0));
  const van = (code) => { const r = eigen.kijk(NAAM)[String(code || '').toLowerCase()]; return r ? vorm(String(code).toLowerCase(), r) : null; };
  // de campagnes die in een maand liepen (een dag overlap is genoeg)
  const inMaand = (m) => lijst().filter(x => x.van.slice(0, 7) <= m && x.tot.slice(0, 7) >= m);

  return { rtgCampagneMaak: maak, rtgCampagnes: lijst, rtgCampagneVan: van, rtgCampagnesInMaand: inMaand };
};
