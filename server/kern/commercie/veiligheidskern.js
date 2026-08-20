/* DE VEILIGHEIDSKERN -- vijf soorten handelingen, een deur.

   WAAROM DIT HET LAATSTE STUK IS. Alles hiervoor beantwoordt een deelvraag: mag
   deze actor dit (besluit.js), draagt hij daar bewijs van (bewijstoken.js), past
   het hele plan (voornemen.js), gebeurt het maar een keer (betaalopdracht/rij.js).
   Wat ontbrak is de plek waar die antwoorden VERPLICHT worden gesteld. Zolang
   een domein rechtstreeks geld kan verplaatsen, is elk van die lagen een
   aanbeveling.

   VIJF SOORTEN, EN NIET MEER:

     WAARDE       geld verplaatst
     IDENTITEIT   wie iemand is verandert
     RECHTEN      wat iemand mag verandert
     EXPORT       gegevens verlaten het huis
     AI           een model voert iets uit in plaats van te adviseren

   Waarom juist deze vijf: het zijn de handelingen die je niet terug kunt nemen
   door een scherm te verversen. Al het andere is werk; dit is onomkeerbaar werk.

   DE KERN IS PIEPKLEIN, EN DAT IS EEN EIGENSCHAP EN GEEN TOEVAL. Een
   veiligheidskern van vijfhonderd regels is geen kern maar een tweede
   applicatie, en niemand leest hem meer in een keer. `test/veiligheidskern.test.js`
   meet de omvang en zakt als hij groeit. Wie hier iets bij wil zetten, hoort
   eerst te vragen of het niet ERBUITEN kan.

   DRIE REGELS.

   1. GEEN HANDELING ZONDER BESLUIT. Voor alles wat waarde, identiteit of rechten
      raakt, moet er een uitkomst van ./besluit.js bij liggen die DOOR zegt. De
      kern beslist niet zelf -- zou hij dat doen, dan is er een negende
      autorisatiesysteem bij in plaats van een minder.
   2. GEEN HANDELING ZONDER WIE EN WAAROM. Een onomkeerbare handeling zonder
      naam en zonder reden is achteraf niet te verantwoorden, en dat is precies
      wanneer je het nodig hebt.
   3. ALLES LAAT EEN SPOOR, OOK WAT MISLUKT. Juist wat mislukt: een handeling die
      halverwege afbreekt is de interessantste rij in het journaal.

   WAT DIT NIET IS: een plek waar iets gebeurt. De kern voert niets uit; hij
   krijgt een functie mee en roept die aan. Zo blijft hij klein, en zo kan hij
   nooit een domein worden. */
'use strict';

const klok = require('../../lib/klok');
const { DOOR } = require('./besluit');

const SOORT = { WAARDE: 'WAARDE', IDENTITEIT: 'IDENTITEIT', RECHTEN: 'RECHTEN',
  EXPORT: 'EXPORT', AI: 'AI' };

/* Welke soorten een besluit VERPLICHT nodig hebben. Export en AI staan er
   bewust niet in: die horen wel door de kern (om het spoor) maar hun poort woont
   elders -- consent bij export, kern/aipoort.js bij AI. Een tweede besluit
   eisen zou betekenen dat er twee plekken zijn waar die grens wordt getrokken. */
const EIST_BESLUIT = new Set([SOORT.WAARDE, SOORT.IDENTITEIT, SOORT.RECHTEN]);

function maakVeiligheidskern({ journaal, nu }) {
  const tijd = nu || klok.nu;

  async function doe(handeling, uitvoeren) {
    const h = handeling || {};
    const soort = String(h.soort || '');
    if (!SOORT[soort]) return { status: 400, error: 'Onbekende soort handeling: ' + (h.soort || '(geen)') + '.' };
    const wie = String(h.wie || '').slice(0, 60);
    const waarom = String(h.waarom || '').trim().slice(0, 300);
    if (!wie) return { status: 400, error: 'Een onomkeerbare handeling draagt een naam.' };
    if (waarom.length < 5) return { status: 400, error: 'Een onomkeerbare handeling draagt een reden.' };
    if (typeof uitvoeren !== 'function') return { status: 400, error: 'Er is niets om uit te voeren.' };

    if (EIST_BESLUIT.has(soort) && !DOOR.has(h.besluit && h.besluit.uitkomst))
      return { status: 403,
        error: 'Deze handeling raakt ' + soort.toLowerCase() + ' en heeft een besluit nodig dat doorlaat.',
        besluit: (h.besluit && h.besluit.uitkomst) || null };

    const rij = { soort, wat: String(h.wat || '').slice(0, 120), wie, waarom,
      waardeCenten: Number.isFinite(h.waardeCenten) ? Math.round(h.waardeCenten) : null,
      besluit: h.besluit ? { uitkomst: h.besluit.uitkomst, beleid: h.besluit.beleid || null } : null,
      bewijs: h.bewijs ? true : false, at: tijd() };

    try {
      const uit = await uitvoeren();
      noteer({ ...rij, gelukt: true });
      return { status: 200, ok: true, uitkomst: uit };
    } catch (e) {
      /* De fout gaat DOOR naar de aanroeper. Een kern die fouten opeet, maakt
         van een mislukte betaling een geslaagd antwoord -- precies de fout die
         kern/bank/overboeken.js ooit had. */
      noteer({ ...rij, gelukt: false, fout: String((e && e.message) || e).slice(0, 200) });
      throw e;
    }
  }

  function noteer(rij) { try { if (journaal) journaal(rij); } catch (e) { /* nooit de handeling blokkeren */ } }

  return { doe, SOORT, EIST_BESLUIT };
}

module.exports = { maakVeiligheidskern, SOORT, EIST_BESLUIT };
