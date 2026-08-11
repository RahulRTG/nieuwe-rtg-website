/* RTG Werk OS: DE GEBEURTENISLAAG -- de temporele waarheid onder het Werk OS.

   EEN WIJZIGING ZONDER GESCHIEDENIS IS VANAF DEZE LAAG EEN FOUT. Dat is de
   ontwerpregel, en al het andere hieronder volgt eruit.

   HYBRIDE, EN MET OPZET NIET PURISTISCH. De huidige toestand blijft op het
   object staan (de snelle operationele waarheid, en elke bestaande lezer blijft
   werken); daarnaast staat een APPEND-ONLY reeks gebeurtenissen (de historische
   waarheid). Een schrijfhandeling doet die twee in EEN aanroep, zodat ze niet
   uiteen kunnen lopen. Volledig event-sourced zou betekenen dat een lijstje
   projecten opvragen duizend gebeurtenissen naspeelt.

   EEN GEBEURTENIS DRAAGT ZES DINGEN, en de laatste twee zijn waar dit om
   begonnen is:

     objectType + objectId   waarover gaat het
     eventType               wat er gebeurde
     van / naar              de oude en de nieuwe toestand
     actor                   wie het deed
     bron                    langs welke weg (welke route, welk scherm)
     reden                   WAAROM

   Zonder `reden` zie je DAT een budget veranderde; met `reden` weet je waarom
   het 165.000 is. Waar die vraag altijd opkomt is hij VERPLICHT -- de mutatie
   wordt geweigerd, niet stil met een leeg veld opgeslagen (zie REDEN_VERPLICHT).

   DIT IS DE ENIGE DEUR. Twintig modules die elk hun eigen auditvorm bedenken,
   leveren twintig vormen op die niemand samen kan lezen -- en dat is precies
   waarom het journaal in dit huis nooit een tijdmachine werd.

   Gebouwd op het patroon van kern/concern/tijd.js. Wat NIET is meegekomen zijn
   de juridische aannames: daar heeft een feit een bron uit vier soorten en een
   venster van/tot. Hier gaat het om operationele mutaties, met een actor en een
   weg. Dat patroon klakkeloos doortrekken zou een juridische zekerheid
   suggereren die een projectbudget niet heeft. */
'use strict';

const MAX_LOG = 50000;   // per werkruimte; ouder wordt afgekapt, en dat wordt gezegd

/* De vier objectfamilies van deze ronde. Bewust niet alles: een laag die in een
   keer duizend mutaties moet dekken, dekt er in de praktijk geen enkele goed.
   Wat hier niet staat wordt door het vangnet opgemerkt (zie ./gebeurtenis-
   lezen.js) en kan een voor een volgen. */
const FAMILIES = ['project', 'contract', 'lid', 'besluit'];

/* DE HANDELINGEN WAAR "WAAROM" DE VRAAG IS. Zonder reden worden ze geweigerd.
   Dit is een korte, bewust gekozen lijst: een reden eisen bij elke veldwijziging
   levert "n.v.t." als antwoord op, en dan is het veld er wel en de betekenis
   niet. */
const REDEN_VERPLICHT = new Set([
  'project.budgetCenten',   // waarom is het budget veranderd
  'project.eigenaar',       // waarom is het project overgedragen
  'contract.status',        // waarom is dit contract opgezegd of geactiveerd
  'besluit.status'          // waarom is dit besluit aangenomen of verworpen
]);

/* `lid.rollen` STOND HIER EN IS ERAF GEHAALD, en dat is het vermelden waard.

   Inhoudelijk hoort hij er thuis: "waarom heeft deze persoon sinds maart inzage
   in finance" is precies de vraag die bij een audit als eerste komt. Maar de
   eis brak elke bestaande toekenning -- inclusief het opzetten van een
   werkruimte -- en een verplicht veld dat elke aanroeper met een leeg gebaar
   vult, levert "n.v.t." op. Dan is het veld er wel en de betekenis niet, en dat
   is precies wat de rest van deze lijst probeert te voorkomen.

   Wat er WEL gebeurt: de rolwijziging loopt gewoon door de gebeurtenislaag en
   krijgt zijn gebeurtenis met actor en tijd. Geeft de aanroeper een reden, dan
   staat hij erbij; geeft hij er geen, dan is dat in het pad ZICHTBAAR als een
   leeg veld en niet weggepoetst. De eis kan erbij zodra de schermen die een rol
   toekennen ook echt om een reden vragen -- dat is een schermwijziging en geen
   regel die je er eenzijdig bovenop legt. */

const nu = () => new Date().toISOString();

function bak(w) {
  if (!Array.isArray(w.gebeurtenissen)) w.gebeurtenissen = [];
  return w.gebeurtenissen;
}

/* De laatst bekende stand per gevolgd veld, waarop het vangnet zijn
   vergelijking doet. Staat naast het log en niet erin: het log is de
   geschiedenis, dit is een hulpmiddel om te merken dat er iets buitenom ging. */
function stand(w) {
  if (!w.gebeurtenisStand || typeof w.gebeurtenisStand !== 'object') w.gebeurtenisStand = {};
  return w.gebeurtenisStand;
}

const standSleutel = (objectType, objectId, veld) => objectType + ' ' + objectId + ' ' + veld;

/* Waarden worden plat vergeleken. Wat geen tekst, getal of boolean is, wordt
   niet gevolgd: een diepe vergelijking op lijsten en objecten belooft meer dan
   deze laag waar kan maken. Rollen zijn de uitzondering en gaan als SAMENVATTING
   mee -- een lijst rol-ids is precies wat je van een rolwijziging wilt lezen. */
function plat(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v) && v.every(x => x && typeof x === 'object' && x.id)) {
    return v.map(x => String(x.id) + (x.tot ? '<' + x.tot : '')).sort().join(',');
  }
  return undefined;
}

/* ---- DE ENIGE DEUR ----

   Legt een gebeurtenis vast. Verandert zelf niets aan het object: de aanroeper
   heeft dat gedaan of doet het via werkVeld() hieronder. Geeft de gebeurtenis
   terug, of een fout -- en die fout is een echte weigering, geen waarschuwing. */
function werkMutatie(w, m) {
  const o = m || {};
  const objectType = String(o.objectType || '');
  const objectId = String(o.objectId || '');
  const eventType = String(o.eventType || '');
  if (!w) return { status: 500, error: 'Een gebeurtenis zonder werkruimte bestaat niet.' };
  if (!objectType || !objectId) return { status: 400, error: 'Een gebeurtenis hoort te zeggen waarover zij gaat.' };
  if (!eventType) return { status: 400, error: 'Een gebeurtenis zonder soort zegt niets.' };

  /* DE ACTOR IS VERPLICHT. Een mutatie zonder naam is een mutatie waarvan
     niemand kan navragen wat er gebeurde, en dat is precies het gat dat deze
     laag komt dichten. `systeem` mag, maar dan staat dat er ook. */
  const actor = String(o.actor || '').trim();
  if (!actor) return { status: 400, error: 'Een wijziging hoort op een naam te staan.' };

  const reden = o.reden == null ? '' : String(o.reden).trim().slice(0, 500);
  if (REDEN_VERPLICHT.has(eventType) && !reden) {
    return { status: 400, error: 'Waarom gebeurt dit?',
      uitleg: 'Bij ' + eventType + ' hoort een reden. Zonder reden is later wel te zien DAT het veranderde, maar niet waarom -- en dat is precies de vraag die dan gesteld wordt.' };
  }

  const g = {
    id: 'geb_' + (bak(w).length + 1).toString(36) + '_' + Math.abs(hash(objectId + eventType + nu())).toString(36),
    objectType, objectId, eventType,
    van: o.van === undefined ? null : o.van,
    naar: o.naar === undefined ? null : o.naar,
    actor, reden: reden || null,
    bron: o.bron ? String(o.bron).slice(0, 60) : null,
    occurredAt: o.occurredAt || nu()
  };
  const log = bak(w);
  log.push(g);
  if (log.length > MAX_LOG) { log.splice(0, log.length - MAX_LOG); w.gebeurtenisAfgekapt = true; }
  return { ok: true, gebeurtenis: g };
}

/* Een kleine, stabiele hash voor het id-achtervoegsel. Geen crypto: dit hoeft
   niet onvoorspelbaar te zijn, alleen uniek genoeg binnen een werkruimte. */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return h;
}

/* De gewone weg (velden zetten EN vastleggen) staat in ./gebeurtenis-veld.js.
   De naad: hier de DEUR met zijn eisen, daar het gemak erbovenop. Ze worden
   samen geexporteerd, zodat een schrijver nog steeds maar een module kent.

   DE VOLGORDE HIERONDER IS NIET VRIJ. gebeurtenis-veld.js leest deze module
   terug (hij gebruikt werkMutatie en de primitieven), dus de export moet KLAAR
   staan voordat hij wordt geladen -- anders krijgt hij een leeg object en valt
   `kern.plat is not a function` eruit. Dat is precies wat er gebeurde bij de
   eerste poging. Vandaar: eerst exporteren, dan aanvullen. */
module.exports = { werkMutatie, FAMILIES, REDEN_VERPLICHT, MAX_LOG,
  plat, standSleutel, stand, bak };
Object.assign(module.exports, require('./gebeurtenis-veld'));
