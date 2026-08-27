/* ============================================================================
   DE GEBEURTENISENVELOP -- één vorm voor alles wat er in dit huis gebeurt.

   DE REGEL DIE DIT BESTAND STUURT, EN HET IS ER MAAR EEN:

     DE ENVELOP DEELT VORM, NOOIT BETEKENIS.

   `website.gepubliceerd` en `bericht.klaargezet` reizen in dezelfde envelop en
   hebben niets met elkaar te maken. Wat ze delen is de verpakking: wie, wanneer,
   waarvoor, waardoor. Wat erin zit -- de lading -- is van het domein, en deze
   module kijkt er nooit in.

   Dat is CREATE-02 in zijn technische vorm, en het is dezelfde scheiding die
   scripts/objectmodel.js al maakte toen hij de envelopvelden van dit huis
   aanwees: twee vormen die alleen hun verpakking delen, delen NIETS.

   WAT DAT PRAKTISCH BETEKENT, en dit is de toets waaraan elke wijziging hier
   moet voldoen:

     - deze module require't GEEN enkel domein, en dat is te zien: er staat
       hierboven maar een require, en die gaat over de klok;
     - de lading wordt niet gelezen, niet geschoond en niet gevalideerd. Alleen
       haar OMVANG wordt begrensd, want een envelop die een megabyte draagt is
       geen envelop maar een verhuisdoos;
     - er komt nooit een lijst van geldige soorten in. Zodra deze module weet dat
       `website.gepubliceerd` bestaat en `kapper.geknipt` niet, is hij een
       domeinregister geworden en deelt hij betekenis.

   WAAROM DE ENVELOP NIET WACHT OP HET EVENT-PLATFORM. Een bus zonder afgesproken
   envelop levert twintig vormen op die achteraf niet meer gelijk te trekken zijn;
   dit huis heeft er al een (server/bus.js) en juist daarom hoort de vorm er
   eerder te zijn dan de belofte eromheen (CREATE.md par. 8 en 11, P0).

   WAT DE ENVELOP NIET IS. Hij is geen leveringsgarantie, geen volgorde, geen
   opslag en geen abonnement. Hij is een formulier. Wat er met een ingevulde
   envelop gebeurt, staat ergens anders -- en zolang dat er niet is, staat dat
   met zoveel woorden in `nietGebouwd` hieronder in plaats van als lege belofte.
   ========================================================================== */
'use strict';
const { datum } = require('../lib/klok');

/* De dertien velden. Meer worden het er niet zonder dat iemand dit blok
   verandert, en dat is de bedoeling: een envelop die per domein een veldje
   erbij krijgt, is na een jaar geen gedeelde vorm meer. */
/* ENVELOPVELDEN en niet VELDEN. Die naam was al bezet: kern/rtmail-regels.js
   noemt zijn vier matchvelden ook VELDEN, en omdat ze allebei `onderwerp` en
   `soort` bevatten, las scripts/semantiek.js de twee als EEN catalogus die zou
   moeten worden samengevoegd. Dat zou fout zijn -- het zijn twee verschillende
   dingen -- maar een meter die je naar de verkeerde reparatie stuurt, is erger
   dan geen meter. Hernoemen is hier het goedkope antwoord (LAT-regel 4). */
const ENVELOPVELDEN = ['id', 'soort', 'versie', 'actor', 'onderwerp', 'organisatie',
  'doel', 'op', 'keten', 'oorzaak', 'klasse', 'bron', 'lading'];
const VERPLICHT = ['soort', 'bron', 'klasse'];

/* De gegevensklasse van de LADING, en dit is het enige veld waarin de envelop
   iets over de inhoud zegt. Hij zegt het niet zelf -- de afzender verklaart het,
   en de envelop houdt hem aan een gesloten lijst zodat het te filteren valt.

   `codenaam` staat er apart in en niet onder `persoonlijk`, want dat is precies
   het onderscheid waar dit huis op draait: een codenaam WIJST een mens aan
   zonder hem te NOEMEN (CLAUDE.md, privacy by design). Een ontvanger die
   persoonsgegevens weert, moet die twee uit elkaar kunnen houden. */
const KLASSEN = {
  openbaar: 'niets in de lading is aan een mens te koppelen',
  intern: 'bedrijfsgegevens, geen mens',
  codenaam: 'wijst een mens aan op codenaam, zonder naam of contactgegeven',
  gevoelig: 'gegevens die alleen langs een uitdrukkelijke grondslag mogen reizen'
};

/* Wat er met een envelop NIET gebeurt. Staat hier zodat een ontwikkelaar het
   leest voordat hij het aanneemt, en niet in een document dat hij nooit opent --
   dezelfde keuze als machtigingen.NIET_GEBOUWD in de App Store. */
const NIET_GEBOUWD = {
  levering: 'Een envelop is een vorm, geen belofte dat hij aankomt. Er is geen wachtrij, geen herhaling en geen dode-brievenbus voor derden.',
  volgorde: 'Twee envelopppen met opeenvolgende tijdstippen kunnen in een andere volgorde aankomen. Gebruik keten en oorzaak, niet de klok.',
  abonneren: 'Een derde kan zich nergens op abonneren. De bus (server/bus.js) is intern; het derdenkanaal loopt via de brug van de App Store.',
  terugkijken: 'Envelopppen worden hier niet bewaard. Wie een geschiedenis wil, bewaart hem in zijn eigen domein.'
};

const SOORT_VORM = /^[a-z][a-z0-9]{1,23}\.[a-z][a-zA-Z0-9]{1,31}$/;
const ID_VORM = /^[A-Za-z0-9_-]{8,64}$/;
const TIJD_VORM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const LADING_MAX = 16 * 1024;   // een envelop draagt een bericht, geen bestand

const tekst = (v) => (typeof v === 'string' ? v.trim() : '');

/* Een verse envelop. Geeft altijd dezelfde vorm terug -- { ok, envelop, fouten }
   -- en de fouten dragen het VELD, zodat een aanroeper ze naast het juiste stuk
   kan zetten in plaats van er een balk van te maken. Dezelfde afspraak als
   kern/appstore/manifest.js, en met opzet: twee foutvormen in een huis betekent
   twee keer uitzoeken hoe je een fout toont. */
function maak(ruw, opties) {
  const O = Object.assign({ id: null, op: null }, opties || {});
  const fouten = [];
  const fout = (veld, wat) => fouten.push({ veld, wat });
  if (!ruw || typeof ruw !== 'object' || Array.isArray(ruw)) {
    return { ok: false, envelop: null, fouten: [{ veld: 'envelop', wat: 'Een envelop is een object met ten minste ' + VERPLICHT.join(', ') + '.' }] };
  }

  for (const k of Object.keys(ruw)) {
    if (!ENVELOPVELDEN.includes(k)) fout(k, 'Onbekend veld "' + k + '". Een envelop kent er ' + ENVELOPVELDEN.length + ': ' + ENVELOPVELDEN.join(', ') + '. Wat van jouw domein is, hoort in de lading.');
  }

  const soort = tekst(ruw.soort);
  if (!SOORT_VORM.test(soort)) {
    fout('soort', 'De soort is domein.gebeurtenis, bijvoorbeeld website.gepubliceerd: kleine letters voor het domein, een punt, en daarna de gebeurtenis in verleden tijd.');
  }
  /* De envelop kent GEEN lijst van geldige domeinen, en dat is geen gat. Zou hij
     die kennen, dan wist hij welke domeinen bestaan -- en dan deelt hij
     betekenis in plaats van vorm. Wie een soort verzint die nergens op slaat,
     krijgt een envelop die nergens aankomt; dat is het antwoord. */

  const versie = ruw.versie == null || ruw.versie === '' ? 1 : Number(ruw.versie);
  if (!Number.isInteger(versie) || versie < 1 || versie > 999) {
    fout('versie', 'De versie is een heel getal vanaf 1. Hij hoort bij de vorm van je LADING: verandert die, dan telt hij op.');
  }

  const bron = tekst(ruw.bron);
  if (bron.length < 2 || bron.length > 64) fout('bron', 'De bron is wie deze envelop maakte, 2 tot 64 tekens: een module, een dienst of een appsleutel.');

  const klasse = tekst(ruw.klasse);
  if (!Object.prototype.hasOwnProperty.call(KLASSEN, klasse)) {
    fout('klasse', 'De klasse zegt wat er in je lading zit en is er een van: '
      + Object.entries(KLASSEN).map(([k, v]) => k + ' (' + v + ')').join('; ') + '.');
  }

  const id = tekst(O.id != null ? O.id : ruw.id) || verseId();
  if (!ID_VORM.test(id)) fout('id', 'Een id is 8 tot 64 tekens uit letters, cijfers, streepje en liggend streepje.');

  const op = tekst(O.op != null ? O.op : ruw.op) || datum().toISOString();
  if (!TIJD_VORM.test(op)) fout('op', 'Het tijdstip is ISO-8601 in UTC, bijvoorbeeld 2026-08-26T14:32:00Z.');

  /* Actor en onderwerp zijn met opzet vormloos begrensd en niet gevalideerd:
     wat een geldige actor is, weet het domein. De envelop bewaakt alleen dat er
     geen roman in staat. */
  const actor = tekst(ruw.actor);
  if (actor.length > 128) fout('actor', 'De actor is hooguit 128 tekens. Zet een verwijzing neer, geen beschrijving.');
  const onderwerp = tekst(ruw.onderwerp);
  if (onderwerp.length > 128) fout('onderwerp', 'Het onderwerp is hooguit 128 tekens.');
  const organisatie = tekst(ruw.organisatie);
  if (organisatie.length > 64) fout('organisatie', 'De organisatie is hooguit 64 tekens.');
  const doel = tekst(ruw.doel);
  if (doel.length > 64) fout('doel', 'Het doel is hooguit 64 tekens, en het is een woord uit een gesloten lijst van de laag die hem vraagt -- geen zin.');

  const keten = tekst(ruw.keten) || id;      // een envelop zonder keten begint er een
  if (!ID_VORM.test(keten)) fout('keten', 'De keten is een id: hij bindt alles wat uit dezelfde handeling voortkwam.');
  const oorzaak = tekst(ruw.oorzaak);
  if (oorzaak && !ID_VORM.test(oorzaak)) fout('oorzaak', 'De oorzaak is het id van de envelop die deze veroorzaakte. Laat hem leeg als dit het begin is.');
  if (oorzaak && oorzaak === id) fout('oorzaak', 'Een envelop kan niet zijn eigen oorzaak zijn.');

  /* DE LADING WORDT NIET GELEZEN. Alleen: is het een object, en past het. Wie
     hier een schoonmaak toevoegt, geeft de envelop kennis van domeinen -- en dan
     is dit bestand zijn enige regel kwijt. */
  const lading = ruw.lading == null ? {} : ruw.lading;
  if (typeof lading !== 'object' || Array.isArray(lading)) {
    fout('lading', 'De lading is een object. Wat erin staat is van jouw domein; de envelop kijkt er niet in.');
  } else {
    let groot = 0;
    try { groot = JSON.stringify(lading).length; } catch (e) { fout('lading', 'De lading is niet naar JSON om te zetten (een kring erin?).'); }
    if (groot > LADING_MAX) fout('lading', 'De lading is ' + Math.round(groot / 1024) + ' kB; het maximum is ' + Math.round(LADING_MAX / 1024) + ' kB. Zet een verwijzing in de envelop en het bestand ergens anders.');
  }

  if (fouten.length) return { ok: false, envelop: null, fouten };
  return { ok: true, fouten: [], envelop: {
    id, soort, versie, actor, onderwerp, organisatie, doel, op, keten,
    oorzaak: oorzaak || null, klasse, bron, lading
  } };
}

/* Een envelop die uit een handeling volgt. Hij erft de keten en wijst de vorige
   aan als oorzaak -- dat is het enige wat "een gebeurtenis volgt op een andere"
   in dit huis betekent, en het is met opzet niet de klok (zie NIET_GEBOUWD). */
function volgOp(vorige, ruw, opties) {
  const v = vorige || {};
  return maak(Object.assign({}, ruw, {
    keten: ruw && ruw.keten ? ruw.keten : (v.keten || v.id || ''),
    oorzaak: ruw && ruw.oorzaak ? ruw.oorzaak : (v.id || '')
  }), opties);
}

function verseId() {
  return require('crypto').randomBytes(12).toString('base64url');
}

/* Lezen is dezelfde controle als maken, met een verschil: bij het LEZEN mag er
   niets worden aangevuld. Een binnenkomende envelop zonder id of tijdstip is
   niet "bijna goed" -- hij komt ergens vandaan waar iemand de vorm niet aanhoudt,
   en stilzwijgend aanvullen maakt dat onzichtbaar (LAT-regel 5). */
function lees(ruw) {
  const mist = [];
  for (const v of ['id', 'op']) if (!ruw || !tekst(ruw[v])) mist.push(v);
  if (mist.length) {
    return { ok: false, envelop: null, fouten: mist.map(v => ({ veld: v, wat: 'Een binnenkomende envelop draagt zijn eigen ' + v + '. Hij wordt hier niet aangevuld.' })) };
  }
  return maak(ruw);
}

module.exports = { maak, lees, volgOp, ENVELOPVELDEN, VERPLICHT, KLASSEN, NIET_GEBOUWD, LADING_MAX };
