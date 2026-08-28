/* ============================================================================
   VAN EEN AANBOD-RIJ NAAR EEN KOOPBAAR -- wat de knop belooft, en wat de rij
   waar kan maken.

   ER KOMT GEEN TWEEDE AANBODVORM. kern/mall/aanbod.js projecteert de domeinen
   al op een gedeelde vorm, schrijft niets, en kern/mall/aanbodvorm.js draagt de
   typen. Die vorm is hier de INVOER. Een eigen normalisator ernaast zou binnen
   een maand een ander idee hebben van wat een aanbieder is (LAT-regel 4), en
   het zou de enige plek zijn die niemand bijwerkt omdat er niet in gewerkt
   wordt.

   WAT DIT BESTAND TOEVOEGT is precies het stuk dat daar ontbrak: de WERKWOORDEN.
   De Mall weet wat er te koop staat; ze weet niet of je het kunt reserveren,
   annuleren of terugsturen. Dat is de vraag waar COMMERCE.json over gaat.

   DE TYPEN ZEGGEN AL WAT DE GEBRUIKER DOET, en dat is geen toeval: aanbodvorm.js
   zegt het met zoveel woorden in zijn kop, en geeft elk type een `cta`. "Kopen"
   en "Offerte aanvragen" zijn niet hetzelfde en mogen er ook niet hetzelfde
   uitzien -- dus mogen ze ook niet dezelfde werkwoorden hebben. De tabel hieronder
   is die cta, uitgeschreven in werkwoorden. Verzin er geen type bij: komt er een
   type in aanbodvorm.js bij, dan hoort het HIER een regel te krijgen, en
   test/commerce-koopbaar.test.js zakt zolang dat niet is gebeurd.

   EN DAN DE TWEEDE HELFT, DIE BELANGRIJKER IS. Wat het type BELOOFT is de
   bovengrens, niet de uitkomst. Een productrij zonder prijs kan niet bevestigd
   worden, hoe stellig het type ook "Kopen" zegt. Daarom gaat elke belofte langs
   de rij zelf, en wat de rij niet waarmaakt valt weg -- mét de weggevallen
   afhankelijkheden (kern/commerce/werkwoorden.js `zonder`) en mét de reden.

   DE REDEN REIST MEE EN DAT IS HET HELE PUNT. Een scherm dat alleen de koopknop
   weglaat, laat de ondernemer raden waarom zijn artikel niet te koop staat. Een
   koopbaar draagt daarom `ontbreekt`: welk werkwoord het type beloofde, waarom
   het niet doorging, en wat eraan hangt. Dat is LAT-regel 5 op de plek waar hij
   het meeste scheelt.
   ========================================================================== */
'use strict';

const { verklaar, zonder } = require('./werkwoorden');
const { TYPE_WERKWOORDEN, REDEN, LEVERT_ZELF, vastBedragCenten, heeftBedrag, TYPEN } = require('./koopbaarlijst');
const { geldig: vraagGeldig, publiek: vraagPubliek } = require('./prijsvraag');

/* De vertaling. `rij` is een genormaliseerd aanbod-object uit
   kern/mall/aanbod.js; `extra` laat een domein werkwoorden TOEVOEGEN die het
   werkelijk uitvoert en die het type niet beloofde -- nooit andersom. Dat is met
   opzet asymmetrisch: een domein mag zijn eigen kunnen aanmelden, maar niet de
   belofte van een type oprekken naar iets wat de rij niet waarmaakt. */
function vanAanbod(rij, extra) {
  if (!rij || !rij.id || !TYPEN[rij.type]) return null;

  const belooft = TYPE_WERKWOORDEN[rij.type];
  if (!belooft) return null;                 // een type zonder regel hier is een fout, geen leeg lijstje
  const gevraagd = [...new Set([...belooft, ...(Array.isArray(extra) ? extra : [])])];
  const eerst = verklaar(gevraagd);

  /* Wat de rij niet waarmaakt. Alleen deze drie zijn uit de rij zelf af te
     leiden; de rest (reserveer, annuleer, retour) hangt aan wat de aanbieder
     heeft ingericht en komt via `extra` binnen of komt niet. */
  const weg = [];
  const redenNu = {};
  /* GEEN BEDRAG BIJ EEN TYPE DAT ER EEN BELOOFT, HAALT OOK DE KOOPKNOP WEG -- en
     dat staat HIER en niet in de werkwoordgraaf. Die graaf liet `bevestig` eerst
     aan `prijs` hangen, en COMMERCE.json sloeg dat eruit: 26 domeinen bevestigen
     zonder prijs, want een tafel en een bezichtiging kosten niets.

     Maar een PRODUCT is iets anders dan een tafel. Het type belooft "Kopen"
     (aanbodvorm.js), en kopen zonder bedrag bestaat niet. Het verschil zit dus in
     wat het type belooft, niet in wat het werkwoord vereist -- en daarom valt
     `bevestig` alleen weg bij een type dat `prijs` in zijn belofte had staan.
     Een boeking zonder bedrag houdt zijn bevestiging gewoon. */
  const beloofdePrijs = belooft.includes('prijs');
  /* EEN PRIJSVRAAG IS EEN PRIJS, alleen nog niet beantwoord. Een huis met
     kamers die elk hun eigen exacte bedrag hebben, of een reis tegen een vaste
     nettoprijs per persoon: het bedrag BESTAAT en hangt van een keuze af. Zo'n
     rij houdt dus `prijs` en `bevestig` -- het antwoord komt uit de mand
     (kern/commerce/prijsvraag.js), niet uit deze projectie.

     Zonder dit onderscheid viel elk verblijf en elke reis uit de etalage met
     "zet een prijs", terwijl er drie kamerprijzen naast staan. */
  const vraag = vraagGeldig(rij.prijsvraag) ? rij.prijsvraag : null;
  if (eerst.heeft.includes('prijs') && !heeftBedrag(rij.prijs) && !vraag) {
    weg.push('prijs');
    // welke van de drie het is, bepaalt wat de ondernemer moet doen
    if (rij.prijsAard === 'niveau') { redenNu.prijs = REDEN.prijsNiveau; redenNu.bevestig = REDEN.bevestigNiveau; }
    else if (rij.prijs && rij.prijs.vanaf) { redenNu.prijs = REDEN.prijsVanaf; redenNu.bevestig = REDEN.bevestigVanaf; }
    if (beloofdePrijs && eerst.heeft.includes('bevestig')) weg.push('bevestig');
  }
  if (eerst.heeft.includes('beschikbaarheid') && rij.beschikbaar == null && rij.open == null) weg.push('beschikbaarheid');
  if (eerst.heeft.includes('lever') && !rij.bezorgt && !LEVERT_ZELF.has(rij.type)) weg.push('lever');

  const na = zonder(eerst.heeft, weg);
  /* `ontbreekt` noemt per weggevallen werkwoord of het RECHTSTREEKS is
     weggevallen (dan is er een reden voor de aanbieder) of MEEGEVALLEN met iets
     anders (dan is de reden die van dat andere). Twee verschillende dingen, en
     een scherm dat ze op een hoop gooit zegt "geen prijs" onder een knop die
     wegviel omdat er niet geleverd wordt. */
  const recht = new Set(weg);
  /* Een reden die alleen voor DEZE rij geldt, wint van de algemene. */
  const ontbreekt = na.weg.map(w => ({
    werkwoord: w.werkwoord,
    door: recht.has(w.werkwoord) ? 'rij' : w.door,
    reden: recht.has(w.werkwoord) ? (redenNu[w.werkwoord] || REDEN[w.werkwoord] || 'Deze rij maakt dit vermogen niet waar.')
      : 'Hangt aan ' + w.door + ', en dat werkwoord viel weg.'
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
    prijsAard: rij.prijsAard || null,
    /* De vraag die beantwoord moet worden voor er een bedrag is. `null` als er
       gewoon een vast bedrag staat -- dan valt er niets te vragen. */
    prijsvraag: vraag ? vraagPubliek(vraag) : null,
    /* De stand van NU, los van het werkwoord. Een gesloten zaak kan nog steeds
       bevestigen (bestellen voor morgen); een zaak zonder koopknop niet. Die
       twee door elkaar halen is de fout waar kern/mall/stand.js over gaat. */
    open: rij.open != null ? rij.open : null,
    beschikbaar: rij.beschikbaar || null,
    werkwoorden: na.heeft,
    ontbreekt,
    /* Wat een domein aanmeldde en hier niet bestaat, gaat niet stil verloren. */
    geweigerd: eerst.geweigerd,
    pagina: rij.pagina || null
  };
}

/* WAAROM STAAT DIT NIET TE KOOP? Twee heel verschillende antwoorden, en een
   ondernemer heeft aan het verkeerde niets.

   1. HET TYPE BELOOFDE HET NOOIT. Een offerte-aanvraag of een marktplaats-
      advertentie hoort geen koopknop te hebben; daar is niets aan kapot. Dan
      noemt de reden het type en wat er dan WEL gebeurt (de cta uit
      aanbodvorm.js), zodat er geen zoektocht ontstaat naar een instelling die
      niet bestaat.
   2. HET TYPE BELOOFDE HET WEL, maar de rij maakte het niet waar. Dan staat de
      reden al in `ontbreekt` en is er iets te DOEN -- een prijs zetten, bezorging
      inrichten.

   De eerste stond er als "Dit type wordt hier niet verkocht", en dat is precies
   de zin waar iemand een half uur mee kwijt is. */
function waaromNietTeKoop(k) {
  if (!k) return null;
  if ((k.werkwoorden || []).includes('bevestig')) return null;
  const gemist = (k.ontbreekt || []).find(o => o.werkwoord === 'bevestig');
  if (gemist) return gemist.reden;
  const belooft = TYPE_WERKWOORDEN[k.type] || [];
  if (!belooft.includes('bevestig')) {
    /* Het label is een KOP en geen zelfstandig naamwoord ("Op aanvraag",
       "Marktplaats"), dus het gaat tussen aanhalingstekens en niet achter een
       lidwoord -- anders staat er "Dit is een op aanvraag". */
    return 'Dit staat als "' + (TYPEN[k.type] ? TYPEN[k.type].label : k.type) +
      '" in de Mall; daar wordt niet op afgerekend. De knop is "' + (k.cta || 'Bekijken') + '", en daar is niets aan mis.';
  }
  return 'Deze rij maakt de koopbelofte van dit type niet waar.';
}

/* Elk type uit aanbodvorm.js hoort hier een regel te hebben. Als functie en niet
   als losse controle, zodat de toets hem kan aanroepen zonder de hele Mall op te
   bouwen -- en zodat een nieuw type in aanbodvorm.js meteen zichtbaar wordt in
   plaats van stilletjes op `null` uit te komen. */
const typenZonderRegel = () => Object.keys(TYPEN).filter(t => !TYPE_WERKWOORDEN[t]);

module.exports = { vanAanbod, TYPE_WERKWOORDEN, typenZonderRegel, vastBedragCenten, waaromNietTeKoop };
