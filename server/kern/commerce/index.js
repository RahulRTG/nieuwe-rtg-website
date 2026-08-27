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
     ./verkoopweg.js   waarlangs een zaak verkoopt; weigert `publiek` met de reden
     ./overdracht.js   levert de keuze af bij de deur; draagt nooit de bevestiging

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
  /* De verkoopweg telt zijn eigen aanbod niet: hij vraagt het aan de graaf. Een
     eigen kopie zou binnen een week uiteenlopen met wat er werkelijk te koop
     staat, en dan staat er een winkel met een verzonnen aantal artikelen. */
  const wegen = require('./verkoopweg')({ db, save, nu, etalage: graaf.etalage });
  /* De overdracht rekent zelf niets uit: hij krijgt het doorgerekende mandbeeld
     als parameter mee. Zo staat er geen tweede som naast die van ./afrekening.js. */
  const overdracht = require('./overdracht')({ db, save, nu });

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
    /* Het merkje van ./overdracht.js reist mee met de afrekenregel waar het bij
       hoort. De rekenaar kent het niet en hoort het niet te kennen -- die rekent
       en weet niets van wat er met een regel is gebeurd. Samenvoegen gebeurt hier,
       op een plek, en op de sleutel die beide lagen al delen. */
    const merken = new Map(m.regels.map(r => [r.koopbaarId, r.overdracht || null]));
    for (const a of uit.afrekeningen || []) {
      for (const r of a.regels || []) r.overdracht = merken.get(r.koopbaarId) || null;
    }
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
    /* DE OVERDRACHT: de keuze afleveren bij de deur die wel bevestigt. De regels
       komen uit het doorgerekende mandbeeld en niet uit het verzoek -- zie de kop
       van ./overdracht.js. Lukt hij, dan krijgen de betrokken mandregels een
       merkje: doorgegeven, aan wie, wanneer. Nooit "besteld"; dat weet RTG niet. */
    overdrachtMaak: (sleutel, o) => {
      const uit = overdracht.maak(sleutel, Object.assign({}, o, { beeld: mandBeeld(sleutel) }));
      if (uit && uit.ok) mand.merk(sleutel, uit.koopbaarIds, { id: uit.overdracht.id, naar: uit.overdracht.verkoper.naam });
      return uit && uit.ok ? { ok: true, overdracht: uit.overdracht, mand: mandBeeld(sleutel) } : uit;
    },
    overdrachtLees: (id, sleutel) => overdracht.lees(id, sleutel),
    overdrachtMijn: (sleutel) => overdracht.vanSleutel(sleutel),
    /* rekenen zonder mand: een directe afrekening van meegegeven regels */
    reken: (regels) => rekenaar.reken(regels, graaf.opzoeker().bij),
    /* de weg terug. `retourVraag` zoekt het koopbaar zelf op: een aanroeper die
       er zelf een meegeeft, kan er een verzinnen waar `retour` op staat. */
    retourVraag: (o) => retour.vraag(Object.assign({}, o, { koopbaar: graaf.opzoeker().bij(o && o.koopbaarId) })),
    retourZet: (o) => retour.zet(o),
    /* Uitvoeren is een aparte handeling dan afhandelen: afhandelen ZET KLAAR,
       dit BETAALT. Een mens drukt, en de weg loopt langs kern/pay. */
    retourVoerUit: (o) => retour.voerUit(o),
    /* kern/pay komt in kernlaag3, na deze laag -- vandaar late binding, zoals
       koppelGrens in kern/pay/poort.js zelf. Niet gekoppeld betekent dat een
       uitvoering weigert met de reden, en niet dat er stilletjes niets gebeurt. */
    koppelPay: (fn) => retour.koppelPay(fn),
    retourVanKoper: (sleutel) => retour.vanKoper(sleutel),
    retourVanVerkoper: (code) => retour.vanVerkoper(code),
    retourBij: (id) => retour.bij(id),
    RETOUR_NIET_GEBOUWD: retour.NIET_GEBOUWD,
    /* de verkoopwegen van EEN zaak; de zaakcode komt altijd van de deur */
    wegLijst: (zaak) => wegen.lijst(zaak),
    wegZet: (zaak, body) => wegen.zet(zaak, body),
    wegPubliceer: (zaak, id, live) => wegen.publiceer(zaak, id, live),
    wegWis: (zaak, id) => wegen.wis(zaak, id),
    WEG_SOORTEN: wegen.WEGSOORTEN, WEG_TOEGANG: wegen.TOEGANG, WEG_NIET_GEBOUWD: wegen.NIET_GEBOUWD
  };

  return { commerce: api };
}

module.exports = { maakCommerce };
