/* DE VERKLAARDE RANDEN -- wat een mens over een rand heeft vastgesteld.

   scripts/verstrengeling.js kan drie soorten AFLEIDEN (laagrand, eigen data,
   gemeten primitief) en de rest niet. Die rest heet ONBEKEND, en dat getal moet
   naar nul -- niet door de meter slimmer te maken maar door hier een regel bij
   te schrijven met een reden die klopt.

   Een regel is: { van, naar, soort, reden }. Van en naar zijn knopen in de vorm
   laag:domein, precies zoals ze in het rapport staan.

   DE REDEN IS HET HELE PUNT. 'hoort zo' verklaart niets; het onderdrukt alleen
   een melding. Wie een rand niet in een zin kan uitleggen, heeft hem niet
   begrepen en laat hem beter op ONBEKEND staan -- daar is dat woord voor.

   LEGACY is een eerlijke soort: bekend, fout, en niet vandaag op te lossen.
   Een rand daarheen verplaatsen is een besluit dat je kunt terugvinden; hem
   DOMEINRELATIE noemen om van het getal af te zijn, is de meter kapotmaken. */
module.exports = [
  /* DE RAILS ONDER EEN MOTOR. server/ai.js kiest tussen vier modelaanbieders en
     server/betaal.js tussen betaalproviders. Dat is geen verstrengeling maar de
     enige plek waar zo'n keuze hoort: een adapter per rail, en een motor die
     hem uitkiest. MAGNAATLAB.md zegt het andersom voor de betaalkant -- een
     simulatie-adapter vervangt de RAIL, nooit de poort -- en dat kan alleen
     omdat de rails hier los naast elkaar liggen. */
  { van: 'motor:ai', naar: 'motor:anthropic', soort: 'DOMEINRELATIE',
    reden: 'modelrail: server/ai.js r.13 kiest tussen vier aanbieders, elk een eigen dunne client' },
  { van: 'motor:ai', naar: 'motor:openai', soort: 'DOMEINRELATIE',
    reden: 'modelrail: zie motor:ai -> motor:anthropic' },
  { van: 'motor:ai', naar: 'motor:gemini', soort: 'DOMEINRELATIE',
    reden: 'modelrail: zie motor:ai -> motor:anthropic' },
  { van: 'motor:ai', naar: 'motor:local-ai', soort: 'DOMEINRELATIE',
    reden: 'modelrail, en de enige die zonder externe verbinding werkt (RTG_EXTERNE_AI_UIT=1 laat deze over)' },
  { van: 'motor:betaal', naar: 'motor:stripe', soort: 'DOMEINRELATIE',
    reden: 'betaalrail: server/betaal.js r.36 laadt de client alleen met een sleutel, in een try -- geen sleutel is geen rail' },
  { van: 'motor:betaal', naar: 'motor:mollie', soort: 'DOMEINRELATIE',
    reden: 'betaalrail: zie motor:betaal -> motor:stripe' },

  /* DE MUTATIEPOORT. kern/mutatie.js is de plek waar een schrijfroute zijn
     herhaalgedrag verklaart (MUTATIECONTRACT.md). Elke schrijvende module hoort
     hem aan te roepen; dat is de bedoeling en niet een rand die weg moet. */
  { van: 'domein:appstore', naar: 'domein:mutatie', soort: 'BELEID',
    reden: 'kern/appstore/brug.js r.83 roept mutatie.poort() aan: het huis van de mutatiesemantiek (MUTATIECONTRACT.md)' },

  /* DE IDENTITEITSKLUIS EN ZIJN EIGEN OPSLAG. accounts/ draagt de echte namen;
     migraties en pgaccounts zijn zijn schema en zijn PostgreSQL-kant, geen
     vreemde domeinen. Ze heten alleen 'lek' omdat de kluis veel gebruikers
     heeft -- dat is precies wat je van een kluis verwacht. */
  { van: 'motor:accounts', naar: 'motor:migraties', soort: 'EIGEN_DATA',
    reden: 'accounts/index.js r.29: het schema van de identiteitskluis zelf' },
  { van: 'motor:accounts', naar: 'motor:pgaccounts', soort: 'EIGEN_DATA',
    reden: 'accounts/mirror.js r.93: de PostgreSQL-kant van diezelfde kluis' }
];
