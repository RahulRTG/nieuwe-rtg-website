/* DE HAAK: hoe een kost bij de juiste gebruiker terechtkomt zonder dat 480
   kernmodules er iets voor hoeven te doen.

   HET PROBLEEM. De kosten ontstaan op plekken die de gebruiker niet kennen.
   server/ai.js is één functie waar ELKE modelaanroep van het hele huis
   langskomt -- precies wat je wilt voor een meter -- maar die functie krijgt
   alleen een prompt mee, geen lid. De aanroeper twee lagen hoger weet het wel.
   Het lid als parameter door al die lagen draaien is honderden aanrakingen, en
   elke laag die het vergeet levert stil een kost zonder eigenaar op.

   DE OPLOSSING is de async-context: de poort zet aan het begin van een verzoek
   één keer neer WIE er aan de knop zit, en alles wat daarna in dat verzoek
   gebeurt kan het opvragen. Dezelfde techniek die server/db/bijeen.js al
   gebruikt om schrijfacties binnen één verzoek te bundelen.

   TWEE DINGEN DIE DEZE HAAK NOOIT DOET.

   Hij BEWAART NIETS. De echte opslag staat in ./meter.js en die wordt pas
   gebouwd als de kern draait; server/ai.js bestaat lang daarvoor. Daarom een
   late binding: zetMeter() hangt de echte meter erin zodra hij er is. Tot dat
   moment doet meld() niets -- en dat is beter dan een AI-aanroep die omvalt
   omdat de boekhouding nog niet wakker was.

   En hij VERZINT GEEN EIGENAAR. Geen drager in de context betekent dat de kost
   naar 'huis' gaat, en niet naar het laatste lid dat toevallig langskwam. Een
   achtergrondtaak, een cronronde en een aanmeldgesprek van iemand zonder
   account zijn ECHTE huiskosten; ze op een willekeurig lid boeken zou een
   factuur opleveren voor iets dat dat lid niet heeft gedaan.

   Geen require's in dit bestand, met opzet: server/ai.js hangt eraan en die
   moet kunnen laden zonder dat de kern bestaat. */
'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const context = new AsyncLocalStorage();

/* De drager: wie draagt deze kost. 'soort:id', want er zijn vier populaties en
   hun id's kunnen elkaar overlappen (een gezinscode kan gelijk zijn aan een
   leverancierscode). Zie ./meter.js voor de opslag.

   HET IS NOOIT EEN NAAM. Leden staan hier met hun sessiesleutel, zaken met hun
   code, gezinnen met hun gezinscode -- dezelfde handvatten waarmee de facturen
   al werken (kern/facturatie.js). Echte namen wonen in de kluis (accounts.js)
   en komen in deze laag niet voor. */
const HUIS = 'huis';
/* DE VIJFDE IS ER SINDS 31 AUGUSTUS 2026: `lab`. Een lab van de RTFoundation is
   geen gebruiker maar een ENTITEIT van de stichting, en dat onderscheid is
   precies wat ECONOMIE.md vraagt -- een rekening landt bij de entiteit van een
   wereld, nooit bij een gebruiker ervan.

   Hij is er omdat het verbruik van een lab anders bij het HUIS landt. De poorten
   zetten een drager voor een lid, een zaak en een gezin (opzet/diensten2.js,
   opzet/leverancierpoort.js, foundation/kostenpoort.js); de deuren van het
   Living Lab -- personeel achter de kantoorinlog, en de bewonerskant die op een
   labpas opengaat -- zetten er geen, en dan is het antwoord 'huis'. Dat is de
   juiste terugval voor verbruik zonder eigenaar, maar hier is er wel degelijk
   een eigenaar: de stichting. Zonder deze soort betaalt RTG dus stilzwijgend het
   onderzoek van een andere rechtspersoon, en dat is precies wat ECONOMIE.md
   verbiedt -- niet omdat het geld op is, maar omdat een stichting die haar eigen
   kosten niet kent, ze ook niet kan verantwoorden. */
const SOORTEN_DRAGER = ['lid', 'zaak', 'gezin', 'lab', 'huis'];

function drager(soort, id) {
  const s = String(soort || '').trim();
  if (s === 'huis') return HUIS;
  const i = String(id == null ? '' : id).trim().slice(0, 120);
  if (!SOORTEN_DRAGER.includes(s) || !i) return HUIS;
  return s + ':' + i;
}

/* Uit een drager weer twee stukken. Geeft altijd iets terug: een onbekende vorm
   leest als het huis, want een kost zonder leesbare eigenaar is een huiskost. */
function ontleed(d) {
  const t = String(d || '');
  const k = t.indexOf(':');
  if (k < 1) return { soort: 'huis', id: HUIS };
  const s = t.slice(0, k);
  return SOORTEN_DRAGER.includes(s) && s !== 'huis' ? { soort: s, id: t.slice(k + 1) } : { soort: 'huis', id: HUIS };
}

/* Draai fn met deze drager als eigenaar van alles wat erin gebeurt. */
function binnen(d, fn, pas) { return context.run({ drager: d || HUIS, pas: pas || null }, fn); }
function wieNu() { const s = context.getStore(); return (s && s.drager) || HUIS; }

/* De late binding. Eén meter, en de tweede aanroep vervangt de eerste in plaats
   van erbij te komen: twee meters zouden elk verbruik dubbel tellen. */
let sink = null;
function zetMeter(fn) { sink = typeof fn === 'function' ? fn : null; }
function meterStaat() { return !!sink; }

/* Meld verbruik. Geen drager meegegeven: dan die uit de context, en anders het
   huis. Slikt alles: een boekhouding die een AI-antwoord kan laten mislukken is
   erger dan een ontbroken regel, en ./overzicht.js kan zien dat er niets is. */
function meld(soortId, aantal, opties) {
  if (!sink) return false;
  const o = opties || {};
  const s = context.getStore();
  try { return !!sink({ drager: o.drager || wieNu(), soort: soortId, aantal,
    pas: o.pas || (s && s.pas) || null, bron: o.bron || null }); }
  catch (e) { return false; }
}

/* DE GRENSWACHT -- de enige plek waar deze haak NEE kan zeggen.

   meld() is achteraf: er is al iets uitgegeven. Dit is ervoor. server/ai.js
   vraagt het vlak voordat hij een model aanroept, want dat is waar het geld
   gaat. Zelfde late binding als de meter: zolang de kern niet wakker is, mag
   alles -- een AI-weg die dichtvalt omdat de boekhouding nog niet is opgestart,
   is een storing en geen grens.

   HET ANTWOORD IS ALTIJD EEN OBJECT MET `ok`, ook bij een fout in de wacht zelf.
   Een grenswacht die gooit, sluit de AI-weg van het hele huis op een fout in de
   boekhouding; dat is precies het omgekeerde van wat hij moet doen. */
let wacht = null;
function zetGrenswacht(fn) { wacht = typeof fn === 'function' ? fn : null; }
function magUitgeven(d) {
  if (!wacht) return { ok: true };
  try { return wacht(d || wieNu()) || { ok: true }; }
  catch (e) { return { ok: true }; }
}

module.exports = { binnen, wieNu, drager, ontleed, zetMeter, meterStaat, meld,
  zetGrenswacht, magUitgeven, HUIS, SOORTEN_DRAGER };
