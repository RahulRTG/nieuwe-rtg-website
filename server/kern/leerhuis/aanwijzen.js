/* ============================================================================
   HET LEERHUIS -- een mens aanwijzen op CODENAAM (besluit van de eigenaar,
   29 september 2026, ACADEMY.md par. 5).

   De eigenaar van een leerhuis legt een relatie of een bestuursrol vast voor
   iemand van wie hij de sleutel niet kent en de echte naam niet hoort te zien.
   Hij kent de codenaam; deze module zoekt de sleutel erbij. Dat is een
   opzoeking in de ledengids, en daarom geldt dezelfde vorm als bij de
   ledenbalie:

   - ALLEEN DE EIGENAAR van DIT leerhuis mag zoeken, en dat wordt gecontroleerd
     VOOR de opzoeking -- anders is dit een orakel waarmee iedereen met een
     relatie kan nagaan of een codenaam bestaat;
   - ZONDER REDEN GEEN OPZOEKING;
   - ZONDER VASTSTAAND SPOOR GEEN GEBRUIK: de journaalregel gaat via
     `noteerVast`, en weigert de opslag, dan gaat er niets door (MN-02, besluit
     5: geen aantoonbaar journaal, geen inzage). Zelfde volgorde als
     balieDossier in kern/ledenbalie-inzage.js: eerst het lid vinden, dan de
     regel MET zijn id -- zo staat hij op de inzagekaart van dat lid -- en pas
     daarna de sleutel gebruiken. Een codenaam die niet bestaat, raakt geen
     lid en schrijft dus ook geen regel.

   Hij voegt alleen `persoon` (en `manager`) toe aan de invoer; de handeling
   zelf beslist daarna alles, precies zoals bij een sleutel.
   ========================================================================== */
'use strict';

const { heeftBestuur } = require('./oordeel');

const ACTIES = ['relatieZet', 'bestuurZet'];
const kort = (x, n) => String(x == null ? '' : x).trim().slice(0, n);

function maakAanwijzen({ keyVanCodenaam, idVanKey, noteerVast }) {
  return async function aanwijzen(st, actie, invoer, door) {
    const velden = [['codenaam', 'persoon'], ['managerCodenaam', 'manager']].filter(([c]) => invoer && invoer[c]);
    if (!ACTIES.includes(actie) || !velden.length) return { ok: true, invoer };
    if (!st || !st.org) return { ok: false, status: 404, reden: 'Deze organisatie heeft geen leerhuis.' };
    if (!heeftBestuur(st, door, 'ACADEMY_OWNER'))
      return { ok: false, status: 403, reden: 'Een mens op codenaam aanwijzen doet de eigenaar van het leerhuis.' };
    const reden = kort(invoer.reden, 120);
    if (reden.length < 5) return { ok: false, status: 400, reden: 'Wie een mens op codenaam opzoekt, geeft een reden.',
      hoe: 'bijvoorbeeld: nieuwe collega bij Operations' };
    const uit = Object.assign({}, invoer);
    for (const [veld, doel] of velden) {
      const codenaam = kort(invoer[veld], 60);
      const lid = await keyVanCodenaam(codenaam);
      const id = lid ? idVanKey(lid.key) : null;
      if (id == null) return { ok: false, status: 404, reden: 'Er is geen lid met codenaam ' + codenaam + '.' };
      const spoor = await noteerVast({ door: { id: door, naam: door }, over: { id, codenaam: lid.codename || codenaam },
        waarom: reden, bron: 'leerhuis/aanwijzen ' + st.org.id });
      if (!spoor || !spoor.ok) return { ok: false, status: (spoor && spoor.status) || 503,
        reden: 'Het spoor van deze opzoeking staat niet vast, dus hij wordt niet gebruikt.' };
      uit[doel] = 'lid:' + id;
      delete uit[veld];
    }
    delete uit.reden;
    return { ok: true, invoer: uit };
  };
}

module.exports = { maakAanwijzen, ACTIES };
