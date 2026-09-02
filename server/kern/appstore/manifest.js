/* ============================================================================
   HET MANIFEST -- wat een app van derden ZEGT te zijn, en wat hij VRAAGT.

   Het manifest is het enige wat een uitgever zelf invult en wat daarna door het
   hele huis wordt gelezen. Daarom wordt het hier streng gelezen en nergens
   anders opnieuw geinterpreteerd.

   DRIE KEUZES DIE HIER VASTLIGGEN.

   1. ONBEKENDE SLEUTELS WORDEN GEWEIGERD, niet genegeerd. Negeren betekent dat
      een uitgever een veld kan meesturen dat vandaag niets doet en morgen wel --
      en dan werkt zijn app anders zonder dat hij iets heeft ingezonden. Een
      geweigerde sleutel is een foutmelding met een naam erin; een genegeerde
      sleutel is een verrassing.

   2. ER STAAN GEEN URL'S IN. Geen homepage, geen supportlink, geen icoon-URL.
      Alles wat een app nodig heeft zit in zijn eigen bundel; een URL in het
      manifest is een tweede plek waar een derde de lezer heen kan sturen, en
      die willen we niet hebben (zie de externe-verwijzingsregel in ./keuring.js).

   3. EEN GEVRAAGDE MACHTIGING DIE NIET BESTAAT, IS EEN FOUT MET DE REDEN ERBIJ.
      Niet "onbekende machtiging" maar de zin uit machtigingen.NIET_GEBOUWD, of
      de lijst van wat er wel is. Een uitgever die drie keer moet raden, zendt
      drie keer in -- en dat is precies de traagheid die deze poort niet wil.
   ========================================================================== */
'use strict';

const { isMachtiging, machtiging, MACHTIGINGEN, DOELEN, NIET_GEBOUWD } = require('./machtigingen');

/* De vormregels staan in ./manifestvorm.js: welke velden er zijn en hoe ze
   eruitzien. Hier staat wat er met een INZENDING gebeurt. */
const { SLEUTELS, CATEGORIEEN, TALEN, SLEUTEL_VORM, VERSIE_VORM, PAD_VORM, PRIJS_MAX, PRIJS_MIN } = require('./manifestvorm');

const tekst = (v) => (typeof v === 'string' ? v.trim() : '');

/* Leest een ingezonden manifest. Geeft altijd hetzelfde terug: { ok, manifest,
   fouten }. De fouten dragen het VELD, zodat een uitgeverportaal ze naast het
   juiste invoervak kan zetten in plaats van er een balk van te maken. */
function lees(ruw) {
  const fouten = [];
  const fout = (veld, wat) => fouten.push({ veld, wat });
  if (!ruw || typeof ruw !== 'object' || Array.isArray(ruw)) {
    return { ok: false, manifest: null, fouten: [{ veld: 'manifest', wat: 'Er is geen manifest meegestuurd. Stuur een object met ten minste sleutel, naam, versie, uitleg en categorie.' }] };
  }

  for (const k of Object.keys(ruw)) {
    if (!SLEUTELS.includes(k)) fout(k, 'Onbekend veld "' + k + '". Een manifest kent alleen: ' + SLEUTELS.join(', ') + '.');
  }

  const sleutel = tekst(ruw.sleutel).toLowerCase();
  if (!SLEUTEL_VORM.test(sleutel)) fout('sleutel', 'De sleutel is de vaste naam van je app in de store: kleine letters, cijfers en streepjes, 3 tot 40 tekens, beginnend met een letter.');

  const naam = tekst(ruw.naam);
  if (naam.length < 2 || naam.length > 60) fout('naam', 'De naam is 2 tot 60 tekens.');

  const versie = tekst(ruw.versie);
  if (!VERSIE_VORM.test(versie)) fout('versie', 'De versie is drie getallen met punten ertussen, bijvoorbeeld 1.0.0. Elke inzending is een nieuwe versie; een bestaande versie wordt nooit overschreven.');

  const uitleg = tekst(ruw.uitleg);
  if (uitleg.length < 20 || uitleg.length > 260) fout('uitleg', 'De uitleg is 20 tot 260 tekens: wat doet deze app, in gewone taal. Dit is wat een lid leest voordat hij iets verleent.');

  const categorie = tekst(ruw.categorie).toLowerCase();
  if (!CATEGORIEEN.includes(categorie)) fout('categorie', 'Kies een categorie uit: ' + CATEGORIEEN.join(', ') + '.');

  const start = tekst(ruw.start) || 'index.html';
  if (!PAD_VORM.test(start) || !start.endsWith('.html')) fout('start', 'Het startbestand is een pad binnen je eigen bundel dat op .html eindigt, bijvoorbeeld index.html.');

  const icoon = tekst(ruw.icoon);
  if (icoon && (!PAD_VORM.test(icoon) || !/\.(svg|png|webp)$/.test(icoon))) fout('icoon', 'Het icoon is een pad binnen je eigen bundel naar een .svg, .png of .webp. Laat het leeg als je er geen hebt; de store zet er dan zelf een neutraal merkteken bij.');

  const taal = tekst(ruw.taal).toLowerCase() || 'nl';
  if (!TALEN.includes(taal)) fout('taal', 'De taal is nl of en.');

  /* ELKE MACHTIGING DRAAGT EEN DOEL, EN DAT IS GEEN VERSIERING.

     Een machtiging zegt wat een app krijgt; het doel zegt waarvoor. Dat tweede
     is waar een lid werkelijk op beslist, en het is ook het enige waarop een
     UPDATE te vergelijken valt: dezelfde machtiging voor een ander doel is een
     andere vraag, en hoort opnieuw gesteld te worden (zie ./besluit.js, de
     vergunningsdiff).

     Een entry is daarom `{ id, doel }`. Een kale tekenreeks wordt geweigerd MET
     de lijst doelen die bij die machtiging horen erbij -- een uitgever hoort niet
     te hoeven raden welke woorden mogen. */
  const gevraagd = [];
  const doelen = {};
  const rauwM = ruw.machtigingen == null ? [] : ruw.machtigingen;
  const doelenVan = (id) => (machtiging(id) || { doelen: [] }).doelen
    .map(d => d + ' (' + DOELEN[d] + ')').join('; ');
  if (!Array.isArray(rauwM)) {
    fout('machtigingen', 'Machtigingen is een lijst. Laat hem leeg als je app niets van het lid nodig heeft; dat is de snelste weg door de poort.');
  } else if (rauwM.length > MACHTIGINGEN.length) {
    fout('machtigingen', 'Er zijn er maar ' + MACHTIGINGEN.length + '; je vraagt er meer.');
  } else {
    for (const m of rauwM) {
      const isObj = m && typeof m === 'object' && !Array.isArray(m);
      const id = tekst(isObj ? m.id : m);
      if (!isMachtiging(id)) {
        /* De reden en niet alleen de afwijzing: een uitgever die "betalen" vraagt
           hoort te lezen waarom dat er niet is, niet dat hij iets fout typte. */
        const soort = id.split('.')[0];
        const reden = NIET_GEBOUWD[soort] || NIET_GEBOUWD[id];
        fout('machtigingen', reden
          ? '"' + id + '" bestaat niet. ' + reden
          : '"' + id + '" bestaat niet. Er zijn er drie: ' + MACHTIGINGEN.map(x => x.id).join(', ') + '.');
        continue;
      }
      if (gevraagd.includes(id)) { fout('machtigingen', '"' + id + '" staat er twee keer in; vraag hem een keer, met een doel.'); continue; }
      const doel = tekst(isObj ? m.doel : '');
      if (!doel) {
        fout('machtigingen', '"' + id + '" heeft een doel nodig: schrijf { "id": "' + id + '", "doel": "..." }. Een lid beslist niet op wat je krijgt maar op waarvoor. Mogelijke doelen: ' + doelenVan(id) + '.');
        continue;
      }
      if (!(machtiging(id).doelen.includes(doel))) {
        fout('machtigingen', 'Het doel "' + doel + '" hoort niet bij "' + id + '". De doelen zijn een gesloten lijst zodat een lid twee apps kan vergelijken en een update te diffen is. Mogelijke doelen: ' + doelenVan(id) + '.');
        continue;
      }
      gevraagd.push(id);
      doelen[id] = doel;
    }
  }

  /* DE PRIJS STAAT IN HET MANIFEST, en dat is een besluit en geen plek.

     Een prijs die naast de versie zou leven, kan veranderen zonder dat er
     iemand naar heeft gekeken -- en dan verkoopt een uitgever morgen voor het
     tienvoudige wat RTG gisteren heeft goedgekeurd. Hier hoort hij bij de
     bundel, gaat hij door dezelfde keuring, en betekent een prijswijziging een
     nieuwe versie met een nieuwe handtekening van een mens. De grenzen zelf
     staan bij de andere vormregels, in ./manifestvorm.js. */
  let prijs = 0;
  if (ruw.prijsCenten != null && ruw.prijsCenten !== '') {
    prijs = Number(ruw.prijsCenten);
    if (!Number.isInteger(prijs) || prijs < 0 || prijs > PRIJS_MAX) {
      fout('prijsCenten', 'De prijs is een heel aantal centen, van 0 (gratis) tot ' + PRIJS_MAX + ' (EUR ' + (PRIJS_MAX / 100) + '). Laat hem weg als je app gratis is.');
    } else if (prijs > 0 && prijs < PRIJS_MIN) {
      fout('prijsCenten', 'Een prijs onder de 50 cent kost meer aan afhandeling dan hij opbrengt. Maak hem gratis, of vraag ten minste EUR 0,50.');
    }
  }

  /* DE VORM VAN HET BORD STAAT IN HET MANIFEST, en dat is dezelfde redenering
     als bij de prijs: zou een app de richting per aanroep meesturen, dan draait
     hij het bord om zodra hij verliest. Hier gaat hij door de keuring en tekent
     een mens hem af. Alleen zinvol met de machtiging erbij; zonder die
     machtiging is het een veld dat nergens over gaat, en dat weigeren we met de
     reden in plaats van het te negeren. */
  let arena = null;
  if (ruw.arena != null && ruw.arena !== '') {
    const a = ruw.arena;
    if (!a || typeof a !== 'object' || Array.isArray(a)) {
      fout('arena', 'Arena is een object: { "richting": "hoog" of "laag", "eenheid": "punten" }.');
    } else {
      const richting = tekst(a.richting).toLowerCase() || 'hoog';
      const eenheid = tekst(a.eenheid) || 'punten';
      if (!['hoog', 'laag'].includes(richting)) fout('arena', 'De richting is "hoog" (meer is beter) of "laag" (minder is beter, bijvoorbeeld een tijd).');
      if (eenheid.length > 20) fout('arena', 'De eenheid is hooguit 20 tekens, bijvoorbeeld punten of seconden.');
      if (!gevraagd.includes('arena.meedoen')) fout('arena', 'Een arena zonder de machtiging "arena.meedoen" doet niets. Vraag die machtiging aan met het doel meedoen-arena, of laat dit veld weg.');
      if (!fouten.some(f => f.veld === 'arena')) arena = { richting, eenheid };
    }
  }

  if (fouten.length) return { ok: false, manifest: null, fouten };
  return { ok: true, fouten: [], manifest: { sleutel, naam, versie, uitleg, categorie, start, icoon: icoon || null, machtigingen: gevraagd, doelen, taal, prijsCenten: prijs, arena } };
}

module.exports = { lees, SLEUTELS, CATEGORIEEN, TALEN, PAD_VORM, VERSIE_VORM, SLEUTEL_VORM };
