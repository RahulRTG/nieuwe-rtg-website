/* HET UITVOERINGSPLAFOND: hoe ver mag het stuur gaan bij DEZE vraag?

   WAAROM DIT BESTAAT. De vraagbalk van een lid ging naar /api/ai -- het model,
   rechtstreeks, zonder gereedschap. De keten die dit huis al heeft (resolver ->
   plan -> gevolg -> mandaat) hing aan /api/fluister en werd door die balk nooit
   geraakt. Het omleggen van die balk is de bedoeling, maar het draagt een risico
   dat groter is dan de winst als je het niet afgrendelt:

       GEEN ENKELE BESTAANDE VRAAG MAG DOOR EEN ROUTEWISSEL AUTOMATISCH
       EEN SIDE EFFECT KRIJGEN.

   Iemand die gisteren "wat kost premium?" typte kreeg tekst terug. Diezelfde
   zin mag morgen niet ineens iets in gang zetten omdat er een motor achter is
   gezet. Dit bestand is die grendel.

   HET IS GEEN VIJFDE GEZAGSSCHAAL, en dat is met opzet. `scripts/gezag.js`
   registreert er al vijf en INT-01 in INTELLIGENTIE.md verbiedt een zesde. Wat
   hier staat is een AFBEELDING tussen twee schalen die allebei al bestaan:

     GEZAGSNOEMER.json        kern/stuur/beleid.js
     ------------------       --------------------------------------------
     geen                     (niets)
     tonen                    lezen      de machine leest en verandert niets
     klaarzetten              voorstel   de machine bereidt voor, mens tekent
     uitvoeren                klein      de machine doet het zelf, omkeerbaar

   Let op de derde rij, want die is contra-intuïtief: `klein` staat HOGER dan
   `voorstel`. Niet omdat het gevaarlijker is -- het is juist klein en
   omkeerbaar -- maar omdat de machine het ALLEEN doet. De noemer meet
   zelfstandigheid en niet schade; wie die twee door elkaar haalt, geeft een
   plafond `klaarzetten` stilzwijgend het recht om dingen te doen.

   HET PLAFOND KAN ALLEEN VERLAGEN. Er is geen tak die een pad soepeler maakt
   dan `beleidVoor()` hem al had -- dezelfde eigenschap die de frictiebodem in
   beleid.js draagt, en dezelfde die `mandaat.js` draagt: een mandaat verleent
   nooit vermogen, het versmalt bestaand vermogen.

   ZONDER MANDAAT IS HET PLAFOND `tonen`, EN DAT IS GEEN KEUZE MAAR EEN GEVOLG.
   `mandaat.js` hanteert `leeg is dicht`: geen geldig mandaat betekent niets
   zelfstandig. Deze module maakt dat zichtbaar in plaats van het af te leiden. */
'use strict';
const { beleidVoor, NIVEAUS } = require('./beleid');
const { speelruimte, mandaatGeldig } = require('./mandaat');

/* De vier treden van GEZAGSNOEMER.json, op volgorde van laag naar hoog. */
const TREDEN = Object.freeze(['geen', 'tonen', 'klaarzetten', 'uitvoeren']);

/* Welke beleidsniveaus vallen onder welke trede. Cumulatief: een hogere trede
   bevat alles van de lagere, want anders zou "meer mogen" ook "minder mogen"
   betekenen. */
const NIVEAUS_BIJ_TREDE = Object.freeze({
  geen: Object.freeze([]),
  tonen: Object.freeze([NIVEAUS.lezen]),
  klaarzetten: Object.freeze([NIVEAUS.lezen, NIVEAUS.voorstel]),
  uitvoeren: Object.freeze([NIVEAUS.lezen, NIVEAUS.voorstel, NIVEAUS.klein])
});

const STANDAARD = 'tonen';

function geldigeTrede(x) {
  const t = String(x || '').toLowerCase();
  return TREDEN.indexOf(t) >= 0 ? t : null;
}

/* De laagste van twee treden wint. Zo kan een aanroeper wel STRENGER vragen dan
   het mandaat toestaat, en nooit soepeler -- precies de kant op die veilig is. */
function laagste(a, b) {
  return TREDEN[Math.min(TREDEN.indexOf(a), TREDEN.indexOf(b))];
}

/* Wat staat het MANDAAT toe, als bovengrens uitgedrukt in een trede?

   Dit is de eerste productie-lezer van kern/stuur/mandaat.js. Hij vraagt niet
   "welke paden" maar "hoe hoog": bestaat er geen geldig mandaat, dan is het
   antwoord `tonen` en draagt het zijn reden. Bestaat er wel een, dan telt of er
   ook maar EEN pad zelfstandig uitvoerbaar uit komt; zo niet, dan is `tonen`
   nog steeds het eerlijke antwoord. */
function mandaatPlafond(paden, wereld, mandaat, nu) {
  const g = mandaatGeldig(mandaat, nu);
  if (!g.ok) return { trede: STANDAARD, reden: 'geen geldig mandaat (' + g.reden + '); leeg is dicht' };
  const ruimte = speelruimte(paden, wereld, mandaat, { nu });
  if (!ruimte.paden.length) {
    return { trede: STANDAARD, reden: 'er is een mandaat, maar geen enkel pad is ermee zelfstandig ' +
      'uitvoerbaar: ' + ruimte.reden };
  }
  return { trede: 'uitvoeren', reden: 'het mandaat laat ' + ruimte.paden.length + ' van ' +
    ruimte.aantalVoor + ' paden zelfstandig toe' };
}

/* DE POORT.

   Geeft altijd: welke trede geldt, welke paden daarbinnen vallen, wat eruit
   viel MET reden per niveau, en waarom het plafond is wat het is. Nooit een
   kale lijst: een versmalling die niet zegt wat hij weghield, is precies de
   faalvorm waar EXECUTIE.md blok 0 voor waarschuwt. */
function plafondVan(opties) {
  const o = opties || {};
  const wereld = String(o.wereld || '');
  const alles = Array.isArray(o.paden) ? o.paden.filter(p => typeof p === 'string') : [];

  const vanMandaat = mandaatPlafond(alles, wereld, o.mandaat, o.nu);
  /* Een aanroeper mag STRENGER vragen dan het mandaat toestaat. Vraagt hij iets
     wat geen geldige trede is, dan telt dat als niet gevraagd -- niet als
     `uitvoeren`, want een typefout hoort geen bevoegdheid te openen. */
  const gevraagd = geldigeTrede(o.gevraagd);
  const trede = gevraagd ? laagste(gevraagd, vanMandaat.trede) : vanMandaat.trede;

  const toegestaneNiveaus = NIVEAUS_BIJ_TREDE[trede] || [];
  const paden = [], geweerd = [];
  for (const pad of alles) {
    const niveau = beleidVoor(pad, wereld).niveau;
    if (toegestaneNiveaus.indexOf(niveau) >= 0) paden.push(pad);
    else geweerd.push({ pad, niveau });
  }

  const perNiveau = {};
  for (const g of geweerd) perNiveau[g.niveau] = (perNiveau[g.niveau] || 0) + 1;

  return {
    trede,
    paden,
    aantalVoor: alles.length,
    geweerd: perNiveau,
    plafondUitMandaat: vanMandaat.trede,
    gevraagd: gevraagd || null,
    reden: vanMandaat.reden + (gevraagd && gevraagd !== vanMandaat.trede
      ? '; de aanroeper vroeg strenger (' + gevraagd + ') en dat wint' : ''),
    grens: 'Dit plafond kan alleen VERLAGEN. Alles wat erin zit was al toegestaan door beleid.js; ' +
      'er is geen tak die een pad soepeler maakt dan de allowlist hem gaf.'
  };
}

module.exports = { plafondVan, TREDEN, NIVEAUS_BIJ_TREDE, STANDAARD };
