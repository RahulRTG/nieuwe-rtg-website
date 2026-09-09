/* ============================================================================
   DE VERTAALKAST -- vertaalde interface die een herstart overleeft.

   WAAROM DIT BESTAAT. server/translate.js hield zijn vertalingen in een LRU van
   5000 regels in het geheugen van EEN proces. Het huis serveert 109.643
   verschillende UI-teksten naar 113 doeltalen; die 5000 is dus geen cache maar
   een doorgeefluik dat vrijwel altijd mist. Elke misser is een modelaanroep:
   traag voor de bezoeker, betaald door het huis, en bij elke herstart opnieuw.

   WAT DE KAST WEL IS. Interface-tekst is STATISCH. "Boek deze reis" is morgen
   in het Japans nog steeds hetzelfde. Een vertaling die een keer is gemaakt
   hoort daarom nooit een tweede keer gemaakt te worden -- niet na een herstart,
   niet voor de volgende bezoeker, niet op de volgende pagina.

   WAT DE KAST NIET IS. Geen opslag voor BERICHTEN. Wat een lid typt is geen
   interface: dat gaat langs dezelfde vertaalweg maar hoort niet op schijf naast
   de knoppen van het huis te blijven staan. De aanroeper zegt daarom expliciet
   of een regel bewaard mag worden (`bewaar`), en /api/vertaal/ui is de enige
   die dat vandaag zegt -- precies dezelfde grens als server/lib/ui-bronnen.js
   al voor de MODELWEG trekt. Zonder die grens is de kast een chatlog.

   EEN BESTAND PER TAAL, EN LUI. Wie Japans opvraagt hoeft de Zoeloe-tabel niet
   te laden. Een taal komt binnen bij zijn eerste gebruik en gaat daarna niet
   meer van schijf.

   BEGRENSD, WANT ANDERS IS HET GEEN CACHE MAAR EEN LEK. Per taal een harde
   bovengrens; daarboven valt de oudst ingevoegde regel eruit (Map bewaart de
   invoegvolgorde). Een kast die niet kan vallen, groeit tot de schijf vol is.

   EEN ONSCHRIJFBARE MAP IS GEEN FOUT. In een toets, in een alleen-lezen
   container of zonder datamap draait de kast gewoon door zonder schijf. Hij
   zegt dat dan ook (`schijf: false`) in plaats van te doen alsof hij bewaart.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

/* Per taal, niet in totaal. Ruim genoeg voor de hele schermfamilie van een
   werkelijk gebruikte taal (een zwaar gebruikt scherm draagt er een paar
   honderd), en klein genoeg dat 113 volle talen de schijf niet opeten. */
const MAX_PER_TAAL = 10000;
/* Schrijven is write-behind: een taalbestand gaat hoogstens een keer per
   VENSTER naar schijf, ook als er duizend regels binnenkomen. Een vertaling
   die bij een harde crash verloren gaat, wordt de volgende keer gewoon opnieuw
   gemaakt -- dit is afgeleide toestand, geen werk van een lid, en gaat daarom
   met opzet NIET langs lib/duurzaam.js. */
const SCHRIJFVENSTER = 3000;

function veiligeTaal(code) {
  return /^[a-z]{2,3}$/.test(String(code || '')) ? String(code) : null;
}

/* Alle gemaakte kasten, zodat het afsluiten er een kan spoelen zonder dat
   opzet/luister.js een verwijzing hoeft door te geven. Zelfde vorm als
   kern/journaalbestand.spoelAlle(): write-behind spoelt per venster, dus wat
   op dat moment nog in de stapel staat, staat nog nergens. */
const kasten = new Set();
function spoelAlle() {
  for (const k of kasten) { try { k.leegNu(); } catch (e) {} }
}

function maakVertaalkast(opties) {
  const map = (opties && opties.dir) ? path.join(opties.dir, 'vertaalkast') : null;
  const maxPerTaal = (opties && opties.maxPerTaal) || MAX_PER_TAAL;
  const venster = (opties && opties.venster != null) ? opties.venster : SCHRIJFVENSTER;
  const talen = new Map();          // taal -> Map(bron -> vertaling)
  const vuil = new Set();           // talen met ongeschreven regels
  const klokken = new Map();        // taal -> timer
  let schijf = false;
  let treffers = 0, missers = 0, bewaard = 0;

  if (map) {
    try { fs.mkdirSync(map, { recursive: true }); schijf = true; }
    catch (e) { schijf = false; }
  }

  function pad(taal) { return path.join(map, taal + '.json'); }

  function tabel(taal) {
    let t = talen.get(taal);
    if (t) return t;
    t = new Map();
    talen.set(taal, t);
    if (schijf) {
      try {
        const rauw = JSON.parse(fs.readFileSync(pad(taal), 'utf8'));
        if (rauw && typeof rauw === 'object') {
          for (const k of Object.keys(rauw)) {
            const v = rauw[k];
            if (typeof v === 'string' && v) t.set(k, v);
          }
        }
      } catch (e) { /* geen bestand of stukke JSON: een lege kast is geen fout */ }
      /* Een bestand dat groter binnenkwam dan de grens van vandaag wordt hier
         meteen teruggesnoeid, anders blijft een verlaagde grens zonder effect. */
      while (t.size > maxPerTaal) t.delete(t.keys().next().value);
    }
    return t;
  }

  /* Atomair: eerst een buurbestand, dan hernoemen. Een lezer ziet zo nooit een
     half geschreven tabel, ook niet als het proces er middenin omvalt. */
  function schrijf(taal) {
    klokken.delete(taal);
    if (!schijf || !vuil.delete(taal)) return;
    const t = talen.get(taal);
    if (!t) return;
    const uit = {};
    for (const [k, v] of t) uit[k] = v;
    const tijdelijk = pad(taal) + '.' + process.pid + '.tmp';
    try {
      fs.writeFileSync(tijdelijk, JSON.stringify(uit), { mode: 0o600 });
      fs.renameSync(tijdelijk, pad(taal));
    } catch (e) {
      try { fs.unlinkSync(tijdelijk); } catch (x) {}
    }
  }

  function plan(taal) {
    if (!schijf || klokken.has(taal)) return;
    const k = setTimeout(() => schrijf(taal), venster);
    if (k.unref) k.unref();   // een wachtende schrijfklok houdt geen proces open
    klokken.set(taal, k);
  }

  const kast = {
    /* Een gemiste lees is `null` en niet `undefined`: de aanroeper moet het
       verschil tussen "niet in de kast" en "leeg vertaald" niet hoeven raden. */
    lees(taal, bron) {
      taal = veiligeTaal(taal);
      if (!taal || !bron) return null;
      const v = tabel(taal).get(bron);
      if (v == null) { missers++; return null; }
      treffers++;
      return v;
    },
    schrijf(taal, bron, vertaling) {
      taal = veiligeTaal(taal);
      if (!taal || !bron || !vertaling) return false;
      /* Een regel die gelijk is aan zijn bron is geen vertaling maar een
         mislukking die zich als antwoord voordoet. Diezelfde regel staat in
         translate.js bij de geheugencache, en om dezelfde reden: hem bewaren
         zet een storing van vandaag vast als het antwoord van morgen. */
      if (vertaling === bron) return false;
      const t = tabel(taal);
      if (t.get(bron) === vertaling) return false;
      t.delete(bron);
      t.set(bron, vertaling);
      while (t.size > maxPerTaal) t.delete(t.keys().next().value);
      bewaard++;
      vuil.add(taal);
      plan(taal);
      return true;
    },
    /* Voor het afsluiten en voor de toets: alles wat nog wacht nu wegschrijven. */
    leegNu() {
      for (const taal of Array.from(vuil)) {
        const k = klokken.get(taal);
        if (k) clearTimeout(k);
        schrijf(taal);
      }
    },
    stand() {
      const totaal = treffers + missers;
      const perTaal = {};
      for (const [taal, t] of talen) perTaal[taal] = t.size;
      return {
        schijf, map: map || null, maxPerTaal,
        talen: talen.size, regels: Object.values(perTaal).reduce((a, b) => a + b, 0),
        perTaal, treffers, missers, bewaard,
        ratio: totaal ? treffers / totaal : 0
      };
    }
  };
  kasten.add(kast);
  return kast;
}

module.exports = { maakVertaalkast, spoelAlle, MAX_PER_TAAL };
