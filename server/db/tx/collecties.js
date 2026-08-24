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

/* DE SLEUTEL VAN EEN RIJ, en waarom dat een derde accessor is geworden.

   Het grootboek bewaart een rij onder (soort, ref) en slaat alles over waar
   `ref` leeg is. Voor een order of een boeking klopt dat: die dragen een ref van
   buiten. Een RTG Pay-boeking niet -- die heeft `ref: ref || null` (meestal
   null, want een overdracht tussen twee leden verwijst nergens naar) en draagt
   haar identiteit in `id`.

   Zou payBoekingen op `ref` blijven staan, dan gaat elke rij door dezelfde
   `t.ref == null`-poort de prullenbak in: geen fout, geen melding, en een
   collectie die in server/pg/sync.js wél als herstelbaar telt. Precies de stille
   vorm die de kop van dit bestand beschrijft. Vandaar `sleutel`, naast `klant`
   en `totaal`: elke collectie zegt zelf waar haar identiteit staat. */
const sleutelVanRef = t => t.ref;

const COLLECTIES = {
  orders: {
    soort: 'order', ramMax: Number(process.env.TX_RAM_ORDERS || 30000),
    klant: klantVanTicket, totaal: totaalVanTicket, sleutel: sleutelVanRef
  },
  boekingen: {
    soort: 'boeking', ramMax: Number(process.env.TX_RAM_BOEKINGEN || 50000),
    klant: klantVanTicket, totaal: totaalVanTicket, sleutel: sleutelVanRef
  },
  directBetalingen: {
    soort: 'directbetaling', ramMax: Number(process.env.TX_RAM_DIRECTBETALINGEN || 30000),
    klant: t => t.key || null, totaal: t => t.bedrag, sleutel: sleutelVanRef
  },
  /* Een betaalverzoek kent geen klantsleutel: het is aan een CODENAAM gericht,
     en soms aan niemand (een open verzoek aan wie het bekijkt). De codenaam is
     hier dus de klantindex, in kleine letters -- want verzoekenVoor() vergelijkt
     ook op kleine letters, en anders vindt een geindexeerde lezing net die
     verzoeken niet die de oude scan wel vond. */
  betaalVerzoeken: {
    soort: 'betaalverzoek', ramMax: Number(process.env.TX_RAM_BETAALVERZOEKEN || 30000),
    klant: t => (t.naarCodename ? String(t.naarCodename).toLowerCase() : null), totaal: t => t.bedrag,
    sleutel: sleutelVanRef
  },
  /* DE ZICHTBARE BOEKINGSHISTORIE VAN RTG PAY (TAKEN.md 4.39).

     De saldi en de idem-boeken zijn sinds de crashproef-ronde duurzaam-op-
     bevestiging, maar deze collectie reed nog in de TRAGE flush-laan. Bij een
     harde crash binnen dat venster klopt het saldo wel en ontbreekt de regel in
     het overzicht: geen geldfout -- de saldi zijn de waarheid en dit is een
     weergave -- maar wel een zichtbare inconsistentie die niemand kan uitleggen.

     BEWUST NIET IN DE VOORRANG-SET van server/pg/sync.js. Die rijstrook
     serialiseert haar sleutels bij elke overdracht, en payBoekingen is een
     GROEIENDE blob van maximaal 50.000 regels; die per boeking meesturen zou de
     geld-laan juist traag maken. Een rij-voor-rij grootboek doet precies het
     omgekeerde: elke nieuwe regel is een eigen upsert, en de blob wordt kleiner
     in plaats van groter.

     KLANT IS HIER NULL, en dat is geen vergeten veld. Een pay-regel heeft TWEE
     kanten (`van` en `naar`) en de grootboekkolom kent er een. Een van de twee
     kiezen zou een index opleveren die de helft van de waarheid vindt -- erger
     dan geen index, want hij ziet eruit alsof hij werkt. Het overzicht leest
     vandaag uit het RAM-venster en filtert op allebei de kanten; wie ooit
     gepagineerd per rekening wil lezen, heeft twee kolommen nodig en dat is een
     eigen ronde. */
  payBoekingen: {
    soort: 'payboeking', ramMax: Number(process.env.TX_RAM_PAYBOEKINGEN || 50000),
    klant: () => null, totaal: t => t.centen, sleutel: t => t.id
  }
};

const NAMEN = Object.keys(COLLECTIES);
const TX_SOORT = Object.fromEntries(NAMEN.map(n => [n, COLLECTIES[n].soort]));
const klantVan = (naam, t) => COLLECTIES[naam].klant(t);
/* De identiteit van een rij: `ref` voor wie er een van buiten heeft, `id` voor
   wie hem zelf maakt. Alles in de tx-laag vraagt het HIER en leest nergens meer
   rechtstreeks `t.ref` -- twee plekken die dit moeten weten, lopen uiteen. */
const sleutelVan = (naam, t) => (t == null ? null : COLLECTIES[naam].sleutel(t));

module.exports = { COLLECTIES, NAMEN, TX_SOORT, klantVan, sleutelVan };
