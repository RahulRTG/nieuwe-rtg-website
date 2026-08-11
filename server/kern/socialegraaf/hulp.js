/* Sociale graaf, deelbestand "hulp": de vorm van een moment, en verder niets.

   DE VORM IS HET HELE PUNT VAN DIT BESTAND. Negen bronnen leveren negen soorten
   rijen aan -- een gesprek, een bijeenkomst, een uitnodiging, een match -- en
   zonder een plek waar de vorm wordt AFGEDWONGEN levert elke bron aan wat zijn
   eigen domein toevallig teruggaf. Dat is geen theorie: de bestaande
   samenhanglaag (kern/socialewereld.js) las `x.titel` van een bijeenkomst
   terwijl het domein `wat` levert, en toonde daardoor elke bijeenkomst zonder
   titel. Niets klaagde, want een lege string is een geldige string.

   WAAROM `wacht` HET BELANGRIJKSTE VELD IS. De geldgraaf heeft `richting`: geld
   gaat in of uit. Deze wereld heeft daar geen equivalent van, en het veld dat
   zijn plaats inneemt is `wacht`: wacht er iemand op MIJ, wacht ik op EEN ANDER,
   of wacht er niemand. Dat is de enige as waarop sociale dingen dringend zijn.
   Een gesprek van drie weken oud is niets; een gesprek van drie weken oud waar
   iemand op antwoord wacht is iets anders.

   `wacht` staat daarom NOOIT op 'ik' omdat een bron dat wel gezellig vindt: het
   staat er alleen als het domein het feitelijk weet (ongelezen > 0, geen
   antwoord gegeven, een verzoek dat aan mij gericht is). Waar een domein het
   niet weet, blijft het veld leeg. Een verzonnen "iemand wacht op u" is precies
   de kunstmatige urgentie die CLAUDE.md verbiedt.

   WAT HIER NIET IN STAAT: een score, een gewicht, een rangorde per persoon. Zie
   LIFE.md par. 4.4 -- er komt geen cijfer op het leven tussen mensen. */
'use strict';

/* Uit levensgraaf/hulp, waar ze al wonen. Niet overtikken: een sociale graaf
   die "welke dag was dit" nét anders uitlegt dan de Control Tower geeft een
   vooruitblik die een dag verschilt met de lijst eronder, en niemand kan
   aanwijzen waarom (LAT.md regel 4). */
const { vandaag, isDatum, dagVan, lijst } = require('../levensgraaf/hulp');

/* De wachtstanden, en meer zijn het er niet. 'ik' betekent: er ligt iets bij
   mij. 'ander' betekent: ik heb iets gedaan en het ligt bij een ander. Leeg
   betekent dat er niemand wacht -- de meeste momenten. */
const WACHT = new Set(['ik', 'ander']);

const LINK = (app) => '/apps/' + app + '.html';

/* De enige plek waar een moment ontstaat. Een bron die een kapotte datum of een
   verzonnen wachtstand aanlevert, komt hier niet doorheen als iets dat op een
   moment lijkt maar het niet is.

   `wie` draagt een CODENAAM of een groepsnaam, nooit een naam uit de kluis: elk
   domein dat hier binnenkomt draait zelf al op codenamen, en de kluis blijft
   buiten deze laag (CLAUDE.md, privacy by design).

   De vooruitblik (./vooruitblik.js) gaat NIET door deze vorm heen, en dat is
   bewust: die levert termijnrijen door zoals de levensgraaf ze maakt, met de
   naam die het lid zelf in zijn eigen dossier typte ("Sam · paspoort"). Dat is
   zijn eigen aantekening en geen kluisgegeven -- en zonder die naam is een
   waarschuwing over een verlopend document nutteloos. */
function moment(o) {
  const m = {
    soort: String(o.soort || ''),
    titel: String(o.titel == null ? '' : o.titel).slice(0, 120),
    wie: String(o.wie == null ? '' : o.wie).slice(0, 80),
    wanneer: isDatum(o.wanneer) ? o.wanneer : null,
    wacht: WACHT.has(o.wacht) ? o.wacht : '',
    aantal: Number.isFinite(o.aantal) && o.aantal > 0 ? Math.round(o.aantal) : null,
    bron: String(o.bron || ''),
    link: String(o.link || LINK('sociaal'))
  };
  if (o.tijd) m.tijd = String(o.tijd);
  if (o.kenmerk) m.kenmerk = String(o.kenmerk).slice(0, 60);
  return m;
}

module.exports = { vandaag, isDatum, dagVan, lijst, moment, LINK, WACHT };
