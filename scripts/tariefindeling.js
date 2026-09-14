/* WELKE VRAAG BEPAALT DE BTW-CATEGORIE -- per land, met de rechtsgrond erbij.

   DIT BESTAND BESLIST NIETS. Het beschrijft en het meet. `kern/fiscaal/tarief.js`
   deelt vandaag in, en blijft dat doen; hier staat waar die indeling volgens de
   wet van elk land op HOORT te rusten, en waar zij daarvan afwijkt.

   WAAROM HET ER IS. `scripts/omzetproef.js` vond bevinding B1: de btw-categorie
   wordt afgeleid uit de WERKPLEK (`station === 'bar'` -> `drank` -> het hoge
   tarief), terwijl de landentabel er zelf bij zegt dat in NL "eten en
   NIET-alcoholische dranken 9%" zijn. Een Flat White uit de bar valt daardoor op
   21%. De vraag die daaruit volgde -- is de bron van het tarief de werkplek of
   het product? -- is nagezocht, en het antwoord is geen van beide:

     DE VRAAG DIE HET TARIEF BEPAALT, VERSCHILT PER LAND.

   In NL en FR beslist ALCOHOL: eten en niet-alcoholische dranken krijgen het
   verlaagde tarief, alcohol het standaardtarief. In BE en DE beslist DRANK: elke
   drank ter plaatse valt hoog, alcoholvrij of niet -- daar is "is dit een drank"
   precies wat `station` al zegt, en is de werkplek dus niet fout maar toevallig
   goed. In ES beslist de DIENST en niet het product: wat ter plaatse als
   horecadienst wordt geserveerd valt laag, alcohol inbegrepen, terwijl datzelfde
   glas wijn in een winkel hoog valt. In JP beslist de PLAATS samen met alcohol.

   Een enkel veld `alcoholisch` op het product zou NL en FR repareren en in BE,
   DE en ES de verkeerde vraag stellen. Daarom staat hier een regel per land en
   geen vlag per product.

   WAT DIT BESTAND NIET ZEGT. Het zegt niet wat een zaak moet aanrekenen -- dat
   doet `tarief.js` -- en het zegt niets over de 183 landen die `./wereld.js`
   aanvult: die dragen `onbekend`, en dat is met opzet geen `klopt`. Een land
   waarvan niemand de regel heeft nagezocht, hoort niet groen te kleuren omdat
   zijn getal toevallig hetzelfde is.

   HET GEZAG IS HIER OVERAL `indicatief`, EN DAT IS EEN BEPERKING VAN DE MACHINE
   EN NIET VAN DE REGEL. Het vocabulaire komt uit ./bronnen/index.js: `officieel`
   is de instantie zelf, `afgeleid` een spiegel daarvan, `indicatief` een
   verzameling zonder officiele herkomst. De primaire teksten (belastingdienst.nl,
   hogeraad.nl, bofip.impots.gouv.fr) zijn vanaf deze machine niet te lezen -- de
   uitgaande proxy weigert overheidsdomeinen -- dus is elke regel hieronder
   gelezen via secundaire bronnen. De rechtsgrond staat er woordelijk bij zodat
   een mens hem kan natrekken en de graad kan verhogen; wie dat doet, zet
   `gezag` om en noteert waar hij het gelezen heeft. Zolang dat niet is gebeurd,
   draagt geen enkel getal hieruit een hardere claim dan `indicatief`.

   WAAROM HIJ IN scripts/ WOONT EN NIET IN server/kern/fiscaal/. Hij BESLIST
   niets, en dat is geen bescheidenheid maar de grens zelf: zodra een rekenplek
   hem leest, is hij een tweede waarheid naast `kern/fiscaal/tarief.js` over
   welke categorie welk tarief krijgt -- precies de fout die tarief.js zelf heeft
   opgeruimd (LAT.md regel 4). Het model is scripts/gezagsnoemer.js, die om
   dezelfde reden buiten server/ staat, en test/tariefindeling.test.js zakt zodra
   iets uit server/ deze module importeert.

   Dat is ook wat hem van ../server/kern/fiscaal/bronnen/ onderscheidt: dat
   register gaat over WAAR de tarieven vandaan komen en heeft gezag over de
   getallen; dit gaat over WELKE VRAAG een land stelt, en heeft gezag over niets.

   Aanroeper: test/tariefindeling.test.js. */
'use strict';

/* De eigenschap waar het tarief in dit land op scharniert. Vier waardes, en ze
   sluiten elkaar niet uit -- JP draagt er twee. */
const BESLIST = {
  alcohol: 'of de drank alcohol bevat, boven de wettelijke drempel',
  drank: 'of het een drank is, ongeacht of er alcohol in zit',
  dienst: 'of het als horecadienst ter plaatse wordt geserveerd',
  plaats: 'of er ter plaatse wordt gegeten of wordt meegenomen',
};

const INDELING = {
  NL: {
    verwacht: { eten: 9, alcoholvrij: 9, alcohol: 21 },
    beslist: ['alcohol'],
    regel: 'Voedingsmiddelen 9%, en niet-alcoholische dranken horen daarbij. Alcoholhoudende ' +
      'dranken zijn uitgezonderd en vallen op 21%, ook als ze bij een 9%-maaltijd worden geschonken.',
    drempel: { bier: 0.5, overig: 1.2, eenheid: 'volumeprocent' },
    rechtsgrond: 'Tabel I bij de Wet op de omzetbelasting 1968, post a.1 (voedingsmiddelen) en ' +
      'post b.12 (het verstrekken van spijzen en dranken voor gebruik ter plaatse)',
    uitspraak: 'Hoge Raad, november 2019: alcohol bij een maaltijd houdt het hoge tarief',
    gezag: 'indicatief',
    gelezenVia: 'tweedekamer.nl (kamerstuk over het verlaagde tarief), samenvattingen van belastingdienst.nl en hogeraad.nl',
    gepeild: '2026-09-14',
  },
  BE: {
    verwacht: { eten: 12, alcoholvrij: 21, alcohol: 21 },
    beslist: ['drank'],
    regel: 'Restaurant- en cateringdiensten 12%, maar ALLE dranken die ter plaatse worden ' +
      'geschonken 21% -- ook de alcoholvrije. Alcohol is hier dus niet de scheidslijn.',
    rechtsgrond: 'KB nr. 20 bij het btw-Wetboek, tabel B',
    let: 'Er loopt een hervorming per 2026 (12% op hotel, camping, afhaal en alcoholvrije dranken in de ' +
      'horeca). Of de verlaging van 21% naar 12% voor alcoholvrije dranken BINNEN een restaurantdienst ' +
      'is doorgegaan, spreken de gelezen bronnen elkaar over tegen. Niet ingevuld tot een mens het naleest.',
    gezag: 'indicatief',
    gelezenVia: 'news.belgium.be, practicali.be, horecabrussels.be',
    gepeild: '2026-09-14',
  },
  DE: {
    verwacht: { eten: 7, alcoholvrij: 19, alcohol: 19 },
    beslist: ['drank'],
    regel: 'Sinds 1 januari 2026 vallen spijzen in de horeca op 7% -- ter plaatse, afhaal en bezorging ' +
      'gelijkgetrokken. Dranken blijven 19%. Uitzondering: dranken met meer dan 75% melk vallen op 7%.',
    rechtsgrond: 'Par. 12 Abs. 2 UStG, zoals gewijzigd door het Steueraenderungsgesetz 2025',
    let: 'Voor een vaste combiprijs (brunch met drank inbegrepen) staat het BMF toe 30% van het totaal ' +
      'als drankdeel op 19% te behandelen.',
    gezag: 'indicatief',
    gelezenVia: 'grantthornton.de, meridianglobalservices.com, vatupdate.com',
    gepeild: '2026-09-14',
  },
  FR: {
    verwacht: { eten: 10, alcoholvrij: 10, alcohol: 20 },
    beslist: ['alcohol'],
    regel: 'Consumptie ter plaatse 10%, inclusief niet-alcoholische dranken en water. Zodra een drank ' +
      'alcohol bevat is het 20%, ongeacht de verpakking of het moment van drinken.',
    rechtsgrond: 'Artikel 279 m van de Code general des impots',
    let: 'Verpakte alcoholvrije dranken om mee te nemen (fles, blik, pak) vallen op 5,5%; die categorie ' +
      'kent de RTG-tabel niet.',
    gezag: 'indicatief',
    gelezenVia: 'samenvatting van BOI-TVA-LIQ-30-20-10-20 (bofip), comptaresto.com, l-expert-comptable.com',
    gepeild: '2026-09-14',
  },
  ES: {
    verwacht: { eten: 10, alcoholvrij: 10, alcohol: 10 },
    beslist: ['dienst'],
    regel: 'Alles wat als horecadienst ter plaatse wordt geserveerd valt op 10%, alcohol inbegrepen. ' +
      'Het criterium is de dienst en niet het product: hetzelfde glas wijn is 21% in een winkel en ' +
      '10% in het restaurant.',
    rechtsgrond: 'Artikel 91 van de Ley 37/1992 del IVA',
    gezag: 'indicatief',
    gelezenVia: 'supercontable.com, hitsystems.es, covermanager.com',
    gepeild: '2026-09-14',
  },
  JP: {
    verwacht: { eten: 10, alcoholvrij: 10, alcohol: 10 },
    beslist: ['plaats', 'alcohol'],
    regel: 'Ter plaatse eten 10%. Afhaal van eten en alcoholvrije dranken 8% (het verlaagde tarief). ' +
      'Alcohol valt altijd op 10% en is van het verlaagde tarief uitgesloten.',
    rechtsgrond: 'Het verlaagde tarief (keigen zeiritsu) bij de Japanse consumption tax',
    let: 'Aangekondigd in augustus 2026: vanaf april 2027 twee jaar lang 1% op eten en alcoholvrije ' +
      'dranken in de WINKEL; restaurantmaaltijden blijven uitgezonderd. Nog niet ingegaan.',
    gezag: 'indicatief',
    gelezenVia: 'jetro.go.jp-samenvatting, eu-japan.eu, mailmate.jp',
    gepeild: '2026-09-14',
  },
};

/* WAT DE METER VRAAGT. Wat rekent RTG vandaag, en wat verwacht de regel van dit land --
   op alle drie de vragen tegelijk, want de interessantste uitkomst is niet een
   verkeerd getal maar een ONTBREKENDE BAK.

   RTG kent twee categorieen waar het hier om gaat: `eten` en `drank`. De regel
   van een land kent er drie: eten, alcoholvrije drank, alcohol. Zolang de laatste
   twee in dat land HETZELFDE tarief dragen, is een bak genoeg en is de indeling
   op werkplek (`station === 'bar'`) niet fout maar toevallig goed. Verschillen ze,
   dan KAN geen enkel getal in `drank` beide gevallen goed doen -- dat is een
   structureel tekort en geen instelling die iemand vergat bij te werken.

   PUUR: de tabel komt binnen, er wordt niets opgeslagen en niets veranderd. */
function meetLand(cc, tar) {
  const r = INDELING[cc];
  if (!r) return { land: cc, stand: 'onbekend', reden: 'de regel van dit land is niet nagezocht' };
  const v = r.verwacht;
  const eenBakGenoeg = v.alcoholvrij === v.alcohol;
  const punten = [];
  if (tar.eten !== v.eten) {
    punten.push({ wat: 'eten', nu: tar.eten, volgensRegel: v.eten, soort: 'verouderd' });
  }
  if (!eenBakGenoeg) {
    punten.push({ wat: 'drank', nu: tar.drank, volgensRegel: v.alcoholvrij + '/' + v.alcohol,
      soort: 'bakOntbreekt' });
  } else if (tar.drank !== v.alcoholvrij) {
    punten.push({ wat: 'drank', nu: tar.drank, volgensRegel: v.alcoholvrij, soort: 'verouderd' });
  }
  return {
    land: cc, beslist: r.beslist, gezag: r.gezag, rechtsgrond: r.rechtsgrond,
    eenBakGenoeg, verwacht: v, nu: { eten: tar.eten, drank: tar.drank },
    stand: punten.length ? 'wijktAf' : 'klopt', punten,
  };
}

function meet(LANDEN) {
  const rijen = Object.keys(LANDEN).map(cc => meetLand(cc, (LANDEN[cc] || {}).tarieven || {}));
  const nagezocht = rijen.filter(x => x.stand !== 'onbekend');
  const punten = [].concat(...nagezocht.map(x => x.punten || []));
  return {
    rijen,
    telling: {
      landen: rijen.length,
      nagezocht: nagezocht.length,
      /* `onbekend` is met opzet geen `klopt`: een land waarvan niemand de regel
         heeft nagezocht, hoort niet groen te kleuren omdat zijn getal toevallig
         hetzelfde is als dat van de buren. */
      onbekend: rijen.length - nagezocht.length,
      klopt: nagezocht.filter(x => x.stand === 'klopt').length,
      wijktAf: nagezocht.filter(x => x.stand === 'wijktAf').length,
      /* De twee soorten afwijking worden NOOIT opgeteld. `verouderd` is een getal
         dat iemand kan bijwerken (en waar de Regelwacht een jaargang voor heeft);
         `bakOntbreekt` is een tekort in de VORM van de tabel, en dat lost geen
         enkel getal op. */
      verouderd: punten.filter(p => p.soort === 'verouderd').length,
      bakOntbreekt: punten.filter(p => p.soort === 'bakOntbreekt').length,
    },
  };
}

module.exports = { INDELING, BESLIST, meet, meetLand };
