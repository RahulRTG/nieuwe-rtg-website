/* Spel "magnaat" (kern/spellen): TWEE VORMEN, EEN SPEL.

   vorm: 'bord'      -- het bordspel met veertig velden, dobbelstenen, huizen en
                        de cel. Staat in ./bordspel.js en is niet veranderd.
   vorm: 'economie'  -- de economische simulatie: een echte stad, kavels met
                        economische eigenschappen, bedrijven met personeel en
                        een klok die doorloopt. Staat in ./economie.js.

   DAT HET EEN SPEL BLIJFT IS EEN BESLUIT. De economie is groter, ambitieuzer en
   heeft niets van het bord nodig; er had net zo goed een tweede spel kunnen
   staan. Maar dan zou er in de lobby "Magnaat" en "Magnaat Economie" naast
   elkaar staan, en zou de vraag "welke moet ik hebben" bij elke speler
   terugkomen. Nu is het een keuze BINNEN het spel, en de variantlaag draagt hem
   (zie ../variant.js).

   WAAROM HET BORD BLIJFT: het is de enige Magnaat die met zes mensen binnen een
   uur aan tafel te spelen is. Een werkend spel weggooien omdat er een groter
   spel naast komt, is het soort verlies dat niemand opmerkt tot het weg is.

   DIT BESTAND IS DE WISSEL EN VERDER NIETS. Elke regel hier kiest een vorm en
   geeft door; wat een vorm DOET staat in zijn eigen bestand. Staat hier ooit
   een spelregel, dan hoort die ergens anders. */
const { STEDENLIJST, stadNaam } = require('./kaart');

module.exports = (ctx) => {
  const bord = require('./bordspel')(ctx);
  const eco = require('./economie')(ctx);

  // welke vorm draagt dit potje? 'bord' is de stille standaard, zodat een potje
  // van voor de economie gewoon blijft werken
  const isEco = (potje) => ((potje && potje.variant) || {}).vorm === 'economie';

  const init = (potje) => (isEco(potje) ? eco.init(potje) : bord.magnaatInit(potje));
  const zet = (potje, h, z) => (isEco(potje) ? eco.zet(potje, h, z) : bord.magnaatZet(potje, h, z));

  const spel = {
    sleutel: 'magnaat', naam: 'Magnaat', max: 6, wereld: 'rtg', vormen: ['live', 'async'],
    /* De vrije acties, en dit is de lijst waar Long Play op staat of valt (zie
       GAMEHALL.md paragraaf 12.3). Zonder deze staat een partij van zes met 24
       uur per beurt zes dagen stil tussen twee van jouw handelingen; met deze
       heb je altijd iets te doen zonder dat iemand tegelijk online hoeft te
       zijn. `bouw` en `verkoop` horen bij het bord, `beleid` bij de economie --
       prijs, personeel, marketing en onderhoud mogen altijd. Wat er NIET in
       staat is even belangrijk: openen, uitbreiden en sluiten zijn grote zetten
       en horen bij je beurt.

       ONDERHANDELEN STAAT ER SINDS FASE B BIJ, en dat is geen uitbreiding maar
       de reden dat fase B kan bestaan: een contract dat op je beurt moet wachten
       is in een partij van zes met 24 uur per beurt een week werk. Tekenen is
       ook vrij -- het bindt je capaciteit, maar het verandert de kaart niet, en
       dat is de scheidslijn. */
    buitenBeurt: ['bouw', 'verkoop', 'beleid',
      'contract-voorstel', 'contract-antwoord', 'contract-opzeggen',
      'veiling-start', 'veiling-bod', 'veiling-intrekken',
      'belang-voorstel', 'belang-antwoord',
      'krediet-opnemen', 'krediet-aflossen', 'krediet-herzien',
      'polis-sluiten', 'polis-opzeggen',
      'onderzoek-starten', 'onderzoek-budget', 'onderzoek-uitrollen', 'onderzoek-subsidie',
      /* Je manager instellen verandert de kaart niet en gaat niemand aan. Juist
         daarom mag het altijd: wie halverwege een partij op vakantie gaat, moet
         dat op dat moment kunnen regelen. */
      'beheer-aan', 'beheer-uit', 'beheer-regels',
      /* Vakantiemodus (fase C) om dezelfde reden als het beheer zelf: wie
         halverwege een partij weg moet, hoort dat op dat moment te kunnen
         zeggen en niet pas als hij aan de beurt is. */
      'vakantie-aan', 'vakantie-uit',
      /* Uitstappen (fase C) hoort al helemaal niet op een beurt te wachten:
         wie eruit stapt is er niet, en de vier anderen zitten intussen te
         wachten op iemand die niet meer komt. */
      'uitstappen',
      'beurs-aanbieden', 'beurs-kopen', 'beurs-intrekken',
      'overname-bod', 'overname-antwoord', 'overname-intrekken',
      /* LOONDIENST (VERHAAL.md stap 1) staat er om dezelfde reden als de
         contracten: een sollicitatie die op je beurt moet wachten duurt in een
         partij van zes een week, en solliciteren doe je omdat je een vacature
         ZIET en niet omdat je aan de beurt bent. `werk-beleid` hoort erbij
         omdat `beleid` er ook in staat -- het is diezelfde handeling, door
         iemand met een rol in plaats van door de eigenaar. */
      'functie-openen', 'functie-intrekken', 'solliciteren', 'aannemen',
      'dienst-opzeggen', 'werk-beleid',
      /* STEMMEN over wat de Foundation bouwt (fase C, ./governance.js). Vrij,
         want een stemming met een beurt eraan vast is een deadline -- en dat is
         de kunstmatige urgentie die CLAUDE.md verbiedt. */
      'foundation-stem',
      /* BESTUUR (fase D) om dezelfde reden als `werk-beleid`: het is dezelfde
         handeling, door iemand met een rol in plaats van door de eigenaar. Wat
         hij aanroept kan wel op een beurt moeten wachten -- dat bewaakt de
         actie zelf, want hij loopt door de gewone tabel. */
      'bestuur-zet'],
    /* DE VOLWASSEN LAAG (VERHAAL.md par. 0c). Wat een zestienjarige NIET kan:
       ondernemen, lenen, mensen aannemen, besturen, aandelen verhandelen,
       verzekeren, veilen. Dat is geen bescherming die erbovenop ligt -- het is
       wat in het echt ook niet kan, en het gevolg is dat een volwassene een
       minderjarige niet aan zich kan binden met schuld, zeggenschap of
       werkgeverschap.

       WAT ER NIET IN STAAT is de bijbaan: solliciteren, opzeggen, meewerken in
       de zaak waar je in dienst bent, meestemmen over wat de Foundation in je
       stad bouwt, en er even niet zijn. Zie ../grens.js -- de lijst DAAR is wit,
       dus deze lijst is een tweede slot en geen enige. */
    volwassenLaag: ['open', 'uitbreiden', 'sluiten', 'uitstappen',
      'krediet-opnemen', 'krediet-aflossen', 'krediet-herzien',
      'functie-openen', 'functie-intrekken', 'aannemen', 'bestuur-zet',
      'belang-voorstel', 'belang-antwoord', 'beurs-aanbieden', 'beurs-kopen', 'beurs-intrekken',
      'overname-bod', 'overname-antwoord', 'overname-intrekken',
      'veiling-start', 'veiling-bod', 'veiling-intrekken',
      'polis-sluiten', 'polis-opzeggen',
      'contract-voorstel', 'contract-antwoord', 'contract-opzeggen',
      'onderzoek-starten', 'onderzoek-budget', 'onderzoek-uitrollen', 'onderzoek-subsidie',
      'beheer-aan', 'beheer-uit', 'beheer-regels', 'beleid', 'bouw', 'verkoop'],
    init, zet,
    varianten: {
      vorm: { keuze: ['bord', 'economie'], standaard: 'bord' },
      stad: { keuze: STEDENLIJST.map(stadNaam), standaard: null },
      duur: { keuze: ['quick', 'avond', 'weekend'], standaard: null },
      /* WAAR JE MEE BEGINT (VERHAAL.md par. 0d). `mens` is de echte start: geen
         bedrijf, bijna geen geld, en een stad die al draait en personeel zoekt.
         `ondernemer` is de snelle variant en blijft de standaard zolang het
         werkscherm nog niet af is -- een startvorm waarin je niets kunt doen
         omdat de knop ontbreekt, is geen keuze maar een val. */
      start: { keuze: ['ondernemer', 'mens'], standaard: 'ondernemer' }
    },
    /* De vraag over de velden heen: stad en duur horen bij de economie. Het
       bordspel heeft geen stad en geen speelduur, en zwijgend negeren zou
       betekenen dat iemand IJmuiden kiest en veertig velden krijgt. */
    variantFout: (v) => {
      if (v.vorm !== 'economie') return (v.stad || v.duur)
        ? 'Een stad en een speelduur horen bij de economie; kies eerst die vorm.' : null;
      if (!v.stad || !v.duur) return 'Kies bij de economie ook een stad en een speelduur.';
      return null;
    },
    statisch: (potje) => (isEco(potje)
      // de kaart is groot en verandert nooit: hij reist mee bij het openen en
      // niet bij elke poll van 2,5 seconde
      ? { kavels: eco.kaartVan((potje.staat || {}).stad).kavels, sectoren: eco.SECTORLIJST }
      : bord.statisch(potje)),
    zicht: {
      speler: (p, st, mij) => (isEco(p) ? eco.zicht(p, st, mij) : bord.zicht.speler(p, st, mij)),
      /* Het BORD is openbaar: alles ligt op tafel, dus een kijker en een gedeeld
         scherm zien hetzelfde als een speler.

         DE ECONOMIE NIET, en dat is precies de waarschuwing die hier al stond
         voordat zij bestond: zodra er boeken zijn, is "iedereen ziet alles" niet
         meer waar. Een kijker krijgt daarom de PUBLIEKE weergave -- de stad, de
         maand, wie waar zit -- en niet iemands kas. Vandaar geen ZONDER_SPELER:
         die claim zou hier onwaar zijn, en de lektoets pakt hem. */
      kijker: (p, st) => (isEco(p) ? eco.publiek(p, st) : bord.zicht.speler(p, st, null)),
      publiek: (p, st) => (isEco(p) ? eco.publiek(p, st) : bord.zicht.speler(p, st, null))
    }
  };

  return { spel, magnaatInit: bord.magnaatInit, magnaatZet: bord.magnaatZet, M_VELDEN: bord.M_VELDEN, eco };
};
