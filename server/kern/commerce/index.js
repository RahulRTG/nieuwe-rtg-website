/* ============================================================================
   RTG COMMERCE -- de orkestrator.

   Volgt het vaste kern-patroon maakCommerce(state) en houdt zelf geen geheugen
   vast: de graaf leest, de mand bewaart wat en hoeveel, de afrekening rekent.
   Wat deze laag NIET doet, is even belangrijk als wat ze wel doet, en het staat
   in de koppen van de vier deelbestanden:

     ./graaf.js        leest de domeinen via kern/mall/aanbod.js en schrijft niets
     ./mand.js         bewaart wat en hoeveel, nooit wat het kost
     ./afrekening.js   rekent per VERKOPER, nooit een gezamenlijke bevestiging
     ./koopbaar.js     vertaalt een aanbod-rij naar werkwoorden, geen tweede vorm
     ./retour.js       de weg terug; zet een geldbesluit KLAAR en voert niets uit

   ER WORDT HIER NIETS BETAALD EN NIETS BESTELD. De weg van bevestigen loopt
   langs de domeinen die er al over gaan (kern/lidacties voor een order bij een
   partner, routes/gast voor de gastdeur) en het geld langs kern/pay/poort.js.
   Deze laag brengt een koper tot aan die deur met een bedrag dat klopt, en doet
   de deur niet zelf open. Dat is dezelfde verhouding als kern/mall/bestellingen.js
   heeft tot de vijf domeinen die hij toont.

   DE LATE BINDING VAN DE MALL. kern/commerce wordt na kern/mall gebouwd, maar
   `aanbodAlles` wordt hier als FUNCTIE doorgegeven en niet als waarde: de
   mall-api wordt in kernlaag2 samengesteld en een vastgehouden verwijzing zou
   die van dat moment zijn. Zelfde reden als de late bindingen in
   opzet/malldraden.js.
   ========================================================================== */
'use strict';

function maakCommerce(state) {
  const { db, save, nu, aanbodAlles, tariefVan, basisCat, zaakVan, capsVan } = state;

  const graaf = require('./graaf')({ aanbodAlles });
  const mand = require('./mand')({ db, save, nu });
  const rekenaar = require('./afrekening')({ tariefVan, basisCat, zaakVan, capsVan });
  /* De retourstroom krijgt de btw-splitser van de afrekening MEE en heeft er
     geen eigen. Een teruggave rekent met hetzelfde tarief als de verkoop, want
     het is dezelfde verkoop -- alleen andersom. */
  const retour = require('./retour')({ db, save, nu, btwUit: rekenaar.btwUit, zaakVan });

  /* De mand van deze sleutel, doorgerekend. Dit is de enige plek waar de drie
     bij elkaar komen, en de volgorde is niet vrij: eerst de opzoeker (EEN
     projectie voor alle regels samen), dan rekenen. Een afrekening die per regel
     de graaf opnieuw opbouwt, bouwt bij tien regels tien keer het hele huis. */
  function mandBeeld(sleutel) {
    const m = mand.lees(sleutel);
    if (!m.regels.length) {
      return { ok: true, leeg: true, regels: [], afrekeningen: [], toonTotaalCenten: 0,
        valuta: 'EUR', samenBevestigen: false, volledig: true };
    }
    const op = graaf.opzoeker();
    const uit = rekenaar.reken(m.regels, op.bij);
    return Object.assign(uit, {
      leeg: false,
      bijgewerkt: m.bij,
      /* Of de graaf compleet was toen dit bedrag werd uitgerekend. Een mand die
         is doorgerekend terwijl een bron omviel, kan een regel missen -- en dat
         hoort de koper te zien in plaats van een lager totaal. */
      volledig: op.volledig,
      stuk: op.stuk
    });
  }

  const api = {
    /* lezen */
    aanbod: (filter) => graaf.alles(filter),
    etalage: (verkoperCode) => graaf.etalage(verkoperCode),
    opzoeker: (filter) => graaf.opzoeker(filter),
    /* de mand */
    mandLees: (sleutel) => mand.lees(sleutel),
    mandZet: (sleutel, koopbaarId, aantal, vervang) => mand.zet(sleutel, koopbaarId, aantal, vervang),
    mandLeeg: (sleutel) => mand.leeg(sleutel),
    mandBeeld,
    /* rekenen zonder mand: een directe afrekening van meegegeven regels */
    reken: (regels) => rekenaar.reken(regels, graaf.opzoeker().bij),
    /* de weg terug. `retourVraag` zoekt het koopbaar zelf op: een aanroeper die
       er zelf een meegeeft, kan er een verzinnen waar `retour` op staat. */
    retourVraag: (o) => retour.vraag(Object.assign({}, o, { koopbaar: graaf.opzoeker().bij(o && o.koopbaarId) })),
    retourZet: (o) => retour.zet(o),
    retourVanKoper: (sleutel) => retour.vanKoper(sleutel),
    retourVanVerkoper: (code) => retour.vanVerkoper(code),
    retourBij: (id) => retour.bij(id),
    RETOUR_NIET_GEBOUWD: retour.NIET_GEBOUWD
  };

  return { commerce: api };
}

module.exports = { maakCommerce };
