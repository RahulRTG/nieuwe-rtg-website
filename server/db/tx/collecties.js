/* ============================================================================
   WELKE COLLECTIES EEN RIJ-VOOR-RIJ GROOTBOEK HEBBEN, EN HOE ZE ERUITZIEN.

   Dit stond verspreid: een TX_SOORT in ledger.js, een TX_RAM_MAX ernaast, een
   txKlantVan in ledger.js EN nog een in index.js, en twee lussen die de namen
   ['orders', 'boekingen'] met de hand opsomden. Vijf plekken die hetzelfde
   moesten weten -- LAT.md regel 4 -- en dus vijf plekken die je alle vijf moet
   raken om er een collectie bij te zetten. Vergeet je er een, dan is het gevolg
   stil: de collectie telt wel als "herstelbaar" (server/pg/sync.js leidt dat
   hieruit af) maar wordt nooit weggeschreven.

   Nu is een collectie toevoegen een blok in deze tabel, en niets anders.

   DE TWEE NIEUWE. directBetalingen en betaalVerzoeken hadden geen grootboek en
   werden bijgehouden met `arr.unshift(x); arr = arr.slice(0, N)` -- exact het
   patroon waarmee boeking 50.001 verdween, maar dan met geld erin. Samen 38 MB
   die de afsluit-flush mocht uitstellen omdat de regel "elk nieuw item staat al
   als rij in het grootboek" ook op hen werd toegepast, terwijl dat voor hen niet
   gold.

   VELDEN VERSCHILLEN PER COLLECTIE, en daar zit de valkuil. Een order draagt
   `customerKey` en `total`; een directe betaling draagt `key` en `bedrag`. Wie
   rijVan() ongewijzigd op de nieuwe collecties loslaat, krijgt een grootboek
   waarin elk bedrag 0 is en geen enkele klant terug te vinden -- zonder ook maar
   een foutmelding, want er gaat niets stuk. Daarom levert elke collectie hier
   zelf haar klantsleutel en haar totaal.
   ========================================================================== */
'use strict';

const klantVanTicket = t => t.customerKey || t.customerTier;
const totaalVanTicket = t => (t.total != null ? t.total : t.price);

const COLLECTIES = {
  orders: {
    soort: 'order', ramMax: Number(process.env.TX_RAM_ORDERS || 30000),
    klant: klantVanTicket, totaal: totaalVanTicket
  },
  boekingen: {
    soort: 'boeking', ramMax: Number(process.env.TX_RAM_BOEKINGEN || 50000),
    klant: klantVanTicket, totaal: totaalVanTicket
  },
  directBetalingen: {
    soort: 'directbetaling', ramMax: Number(process.env.TX_RAM_DIRECTBETALINGEN || 30000),
    klant: t => t.key || null, totaal: t => t.bedrag
  },
  /* Een betaalverzoek kent geen klantsleutel: het is aan een CODENAAM gericht,
     en soms aan niemand (een open verzoek aan wie het bekijkt). De codenaam is
     hier dus de klantindex, in kleine letters -- want verzoekenVoor() vergelijkt
     ook op kleine letters, en anders vindt een geindexeerde lezing net die
     verzoeken niet die de oude scan wel vond. */
  betaalVerzoeken: {
    soort: 'betaalverzoek', ramMax: Number(process.env.TX_RAM_BETAALVERZOEKEN || 30000),
    klant: t => (t.naarCodename ? String(t.naarCodename).toLowerCase() : null), totaal: t => t.bedrag
  }
};

const NAMEN = Object.keys(COLLECTIES);
const TX_SOORT = Object.fromEntries(NAMEN.map(n => [n, COLLECTIES[n].soort]));
const klantVan = (naam, t) => COLLECTIES[naam].klant(t);

module.exports = { COLLECTIES, NAMEN, TX_SOORT, klantVan };
