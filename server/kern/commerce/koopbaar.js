/* ============================================================================
   VAN EEN AANBOD-RIJ NAAR EEN KOOPBAAR -- wat de knop belooft, en wat de rij
   waar kan maken.

   ER KOMT GEEN TWEEDE AANBODVORM. kern/mall/aanbod.js projecteert de domeinen
   al op een gedeelde vorm, schrijft niets, en kern/mall/aanbodvorm.js draagt de
   typen. Die vorm is hier de INVOER. Een eigen normalisator ernaast zou binnen
   een maand een ander idee hebben van wat een aanbieder is (LAT-regel 4), en
   het zou de enige plek zijn die niemand bijwerkt omdat er niet in gewerkt
   wordt.

   WAT DIT BESTAND TOEVOEGT is precies het stuk dat daar ontbrak: de VERMOGENS.
   De Mall weet wat er te koop staat; ze weet niet of je het kunt reserveren,
   annuleren of terugsturen. Dat is de vraag waar COMMERCE.json over gaat.

   DE TYPEN ZEGGEN AL WAT DE GEBRUIKER DOET, en dat is geen toeval: aanbodvorm.js
   zegt het met zoveel woorden in zijn kop, en geeft elk type een `cta`. "Kopen"
   en "Offerte aanvragen" zijn niet hetzelfde en mogen er ook niet hetzelfde
   uitzien -- dus mogen ze ook niet dezelfde vermogens hebben. De tabel hieronder
   is die cta, uitgeschreven in vermogens. Verzin er geen type bij: komt er een
   type in aanbodvorm.js bij, dan hoort het HIER een regel te krijgen, en
   test/commerce-koopbaar.test.js zakt zolang dat niet is gebeurd.

   EN DAN DE TWEEDE HELFT, DIE BELANGRIJKER IS. Wat het type BELOOFT is de
   bovengrens, niet de uitkomst. Een productrij zonder prijs kan niet bevestigd
   worden, hoe stellig het type ook "Kopen" zegt. Daarom gaat elke belofte langs
   de rij zelf, en wat de rij niet waarmaakt valt weg -- mét de weggevallen
   afhankelijkheden (kern/commerce/vermogens.js `zonder`) en mét de reden.

   DE REDEN REIST MEE EN DAT IS HET HELE PUNT. Een scherm dat alleen de koopknop
   weglaat, laat de ondernemer raden waarom zijn artikel niet te koop staat. Een
   koopbaar draagt daarom `ontbreekt`: welk vermogen het type beloofde, waarom
   het niet doorging, en wat eraan hangt. Dat is LAT-regel 5 op de plek waar hij
   het meeste scheelt.
   ========================================================================== */
'use strict';

const { verklaar, zonder } = require('./vermogens');
const { TYPEN } = require('../mall/aanbodvorm');

/* Wat het type belooft. Gelezen als: dit is wat de cta van aanbodvorm.js
   aankondigt, niet wat een bepaalde zaak heeft ingericht.

   Drie typen beloven met opzet WEINIG:
     marktplaats  "Bekijken" -- kern/markt regelt de deal tussen twee mensen
                  zelf, met een eigen chat en een eigen bewijs. Er komt hier geen
                  tweede weg naar dezelfde handel.
     offerte      "Offerte aanvragen" -- er is per definitie nog geen bedrag.
     abonnement   "Aanmelden" -- een doorlopende afschrijving is een bevoegdheid
                  en geen vermogen; zie NIET_GEBOUWD.abonnement in ./vermogens.js.
                  Tot die er is, blijft het bij tonen en een prijs noemen. */
const TYPE_VERMOGENS = {
  product: ['prijs', 'beschikbaarheid', 'bevestig', 'lever', 'annuleer', 'retour'],
  dienst: ['prijs', 'beschikbaarheid', 'reserveer', 'bevestig', 'annuleer'],
  boeking: ['beschikbaarheid', 'reserveer', 'bevestig', 'annuleer'],
  huur: ['prijs', 'beschikbaarheid', 'reserveer', 'bevestig', 'annuleer'],
  ticket: ['prijs', 'beschikbaarheid', 'bevestig', 'lever'],
  reis: ['prijs', 'bevestig'],
  verblijf: ['prijs', 'beschikbaarheid', 'reserveer', 'bevestig', 'annuleer'],
  eten: ['prijs', 'beschikbaarheid', 'bevestig', 'lever'],
  vervoer: ['prijs', 'beschikbaarheid', 'bevestig', 'annuleer'],
  marktplaats: [],
  abonnement: ['prijs'],
  offerte: []
};

/* Een prijs is er, of hij is er niet. kern/mall/aanbod.js zet `prijs` op null
   wanneer een bron er geen kent, en dat is met opzet iets anders dan nul: nul is
   gratis, null is onbekend. Een bedrag van nul houdt dus WEL het vermogen
   `prijs` -- gratis is een prijs. */
const heeftBedrag = (p) => !!(p && (Number.isFinite(Number(p.centen)) || Number.isFinite(Number(p.bedrag)) || Number.isFinite(Number(p.vanaf))));

/* Waarom een belofte het niet haalt, in een zin die een ondernemer kan lezen en
   waarop hij kan handelen. Geen "niet beschikbaar" -- dat zegt niets over wat
   hij moet doen. */
const REDEN = {
  prijs: 'Deze rij draagt geen bedrag. Zet een prijs op het artikel; zonder bedrag valt er niets te kopen.',
  bevestig: 'Dit type belooft "Kopen", en kopen zonder bedrag bestaat niet. Zet een prijs, dan komt de koopknop terug.',
  beschikbaarheid: 'Er is niets gemeten: geen voorraad, geen tijdslot en geen open/dicht. Stilte is geen beschikbaarheid.',
  lever: 'Deze aanbieder heeft geen bezorging of afhaal ingericht, en dit type wordt niet digitaal uitgegeven.'
};

/* De typen die zonder bezorgschakelaar toch geleverd worden, omdat de levering
   digitaal of ter plekke is. Een ticket komt in de app, eten komt aan tafel. */
const LEVERT_ZELF = new Set(['ticket', 'eten']);

/* De vertaling. `rij` is een genormaliseerd aanbod-object uit
   kern/mall/aanbod.js; `extra` laat een domein vermogens TOEVOEGEN die het
   werkelijk uitvoert en die het type niet beloofde -- nooit andersom. Dat is met
   opzet asymmetrisch: een domein mag zijn eigen kunnen aanmelden, maar niet de
   belofte van een type oprekken naar iets wat de rij niet waarmaakt. */
function vanAanbod(rij, extra) {
  if (!rij || !rij.id || !TYPEN[rij.type]) return null;

  const belooft = TYPE_VERMOGENS[rij.type];
  if (!belooft) return null;                 // een type zonder regel hier is een fout, geen leeg lijstje
  const gevraagd = [...new Set([...belooft, ...(Array.isArray(extra) ? extra : [])])];
  const eerst = verklaar(gevraagd);

  /* Wat de rij niet waarmaakt. Alleen deze drie zijn uit de rij zelf af te
     leiden; de rest (reserveer, annuleer, retour) hangt aan wat de aanbieder
     heeft ingericht en komt via `extra` binnen of komt niet. */
  const weg = [];
  /* GEEN BEDRAG BIJ EEN TYPE DAT ER EEN BELOOFT, HAALT OOK DE KOOPKNOP WEG -- en
     dat staat HIER en niet in de vermogensgraaf. Die graaf liet `bevestig` eerst
     aan `prijs` hangen, en COMMERCE.json sloeg dat eruit: 25 domeinen bevestigen
     zonder prijs, want een tafel en een bezichtiging kosten niets.

     Maar een PRODUCT is iets anders dan een tafel. Het type belooft "Kopen"
     (aanbodvorm.js), en kopen zonder bedrag bestaat niet. Het verschil zit dus in
     wat het type belooft, niet in wat het vermogen vereist -- en daarom valt
     `bevestig` alleen weg bij een type dat `prijs` in zijn belofte had staan.
     Een boeking zonder bedrag houdt zijn bevestiging gewoon. */
  const beloofdePrijs = belooft.includes('prijs');
  if (eerst.heeft.includes('prijs') && !heeftBedrag(rij.prijs)) {
    weg.push('prijs');
    if (beloofdePrijs && eerst.heeft.includes('bevestig')) weg.push('bevestig');
  }
  if (eerst.heeft.includes('beschikbaarheid') && rij.beschikbaar == null && rij.open == null) weg.push('beschikbaarheid');
  if (eerst.heeft.includes('lever') && !rij.bezorgt && !LEVERT_ZELF.has(rij.type)) weg.push('lever');

  const na = zonder(eerst.heeft, weg);
  /* `ontbreekt` noemt per weggevallen vermogen of het RECHTSTREEKS is
     weggevallen (dan is er een reden voor de aanbieder) of MEEGEVALLEN met iets
     anders (dan is de reden die van dat andere). Twee verschillende dingen, en
     een scherm dat ze op een hoop gooit zegt "geen prijs" onder een knop die
     wegviel omdat er niet geleverd wordt. */
  const recht = new Set(weg);
  const ontbreekt = na.weg.map(w => ({
    vermogen: w.vermogen,
    door: recht.has(w.vermogen) ? 'rij' : w.door,
    reden: recht.has(w.vermogen) ? (REDEN[w.vermogen] || 'Deze rij maakt dit vermogen niet waar.')
      : 'Hangt aan ' + w.door + ', en dat vermogen viel weg.'
  }));

  return {
    id: rij.id,
    bron: rij.bron,
    type: rij.type,
    typeLabel: TYPEN[rij.type].label,
    cta: TYPEN[rij.type].cta,
    titel: rij.titel,
    aanbieder: rij.aanbieder,
    plek: rij.plek || null,
    prijs: rij.prijs || null,
    /* De stand van NU, los van het vermogen. Een gesloten zaak kan nog steeds
       bevestigen (bestellen voor morgen); een zaak zonder koopknop niet. Die
       twee door elkaar halen is de fout waar kern/mall/stand.js over gaat. */
    open: rij.open != null ? rij.open : null,
    beschikbaar: rij.beschikbaar || null,
    vermogens: na.heeft,
    ontbreekt,
    /* Wat een domein aanmeldde en hier niet bestaat, gaat niet stil verloren. */
    geweigerd: eerst.geweigerd,
    pagina: rij.pagina || null
  };
}

/* Elk type uit aanbodvorm.js hoort hier een regel te hebben. Als functie en niet
   als losse controle, zodat de toets hem kan aanroepen zonder de hele Mall op te
   bouwen -- en zodat een nieuw type in aanbodvorm.js meteen zichtbaar wordt in
   plaats van stilletjes op `null` uit te komen. */
const typenZonderRegel = () => Object.keys(TYPEN).filter(t => !TYPE_VERMOGENS[t]);

module.exports = { vanAanbod, TYPE_VERMOGENS, typenZonderRegel };
