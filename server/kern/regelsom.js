/* DE REGELSOM: van factuurregels naar een bedrag, op één plek.

   Twee plekken rekenen regels door: de factuurmotor (kern/facturatie/motor.js)
   en de offertebouwer (kern/onderneming/offertebouw.js). Dat is precies één
   berekening te veel om twee keer op te schrijven -- een offerte die anders
   afrondt dan de factuur die er straks uit voortkomt, is een verschil van een
   paar cent waar de klant een mail over stuurt en niemand het antwoord op weet
   (lat-regel 4).

   EEN STUKPRIJS IS INCLUSIEF BTW. Dat is de afspraak van dit huis, en niet de
   enige mogelijke: er zijn genoeg systemen waar hij exclusief is. Hij staat
   hier zodat er één plek is waar hij staat. De btw wordt dus TERUGgerekend, en
   per regel, want twee regels mogen verschillende tarieven dragen (9% eten,
   21% de rest).

   AFRONDEN GEBEURT PER REGEL EN NIET AAN HET EIND. Een som van afgeronde regels
   is niet gelijk aan de afronding van de som; wie ze door elkaar haalt, krijgt
   een totaal dat een cent afwijkt van de regels erboven. Dat is precies het
   soort verschil dat niemand kan uitleggen. */
'use strict';

const rond = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* HET HOOGSTE BTW-TARIEF DAT WIJ ACCEPTEREN. Honderd procent is al absurd, maar
   het is de grens waarboven de terugrekening geen betekenis meer heeft. De
   ondergrens is nul: een negatief tarief bestaat niet, en precies -100 liet de
   deling hieronder door nul gaan -- dan werd het subtotaal Infinity, ging dat
   als `null` de opslag in, en telde de btw-aangifte van die zaak vanaf dat
   moment een gat mee. Het totaal bleef intussen gewoon kloppen, dus er viel
   niets op. */
const MAX_BTW = 100;

/* Het tarief van een regel, of null als er geen bruikbaar tarief is opgegeven.
   `null` en `''` tellen als NIET opgegeven en niet als nul procent: dat is
   precies wat een leeg formulierveld over JSON stuurt, en `Number(null)` is 0
   en eindig -- daar liep de oude controle op stuk. De factuurmotor deed het
   voor het zaaksbrede tarief al goed (`data.btw != null`); per regel bleef die
   bedoeling liggen. */
function tariefVan(waarde) {
  if (waarde === null || waarde === undefined || waarde === '') return null;
  const n = Number(waarde);
  if (!Number.isFinite(n) || n < 0 || n > MAX_BTW) return null;
  return n;
}

/* `scho` mag mee omdat de aanroepers hun eigen schoonmaakregels hebben; zonder
   valt hij terug op knippen en trimmen. */
function verwerkRegels(regels, btwStandaard, scho) {
  const schoon = scho || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  let subtotaal = 0, btwBedrag = 0, totaal = 0;
  const uit = (Array.isArray(regels) ? regels : []).slice(0, 60).map(r => {
    const aantal = Math.max(1, Number(r.aantal) || 1);
    const stuk = rond(r.stuk);
    const eigen = tariefVan(r.btw);
    const standaard = tariefVan(btwStandaard);
    /* Valt allebei weg, dan 0%: dat is het enige tarief dat wij zonder
       aanname kunnen toepassen, en het staat als tarief in de regel zodat het
       zichtbaar is in plaats van verstopt. */
    const btw = eigen !== null ? eigen : (standaard !== null ? standaard : 0);
    const regelIncl = rond(aantal * stuk);
    const regelExcl = rond(regelIncl / (1 + btw / 100));
    subtotaal += regelExcl; btwBedrag += rond(regelIncl - regelExcl); totaal += regelIncl;
    return { omschrijving: schoon(r.omschrijving, 120) || 'Post', aantal, stuk, btw, incl: regelIncl };
  });
  return { regels: uit, subtotaal: rond(subtotaal), btwBedrag: rond(btwBedrag), totaal: rond(totaal) };
}

module.exports = { verwerkRegels, rond, tariefVan, MAX_BTW };
