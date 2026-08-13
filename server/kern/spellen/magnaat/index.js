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
      'polis-sluiten', 'polis-opzeggen', 'hospitality-start','hospitality-stap',
      'hospitality-chaos','hospitality-besluit','hospitality-koppel','hospitality-delen',
      'universe-briefing','universe-vergelijk','universe-evidence',
      'human-open','human-ontwikkel','human-besluit','human-afronden'],
    init, zet,
    varianten: {
      vorm: { keuze: ['bord', 'economie'], standaard: 'bord' },
      stad: { keuze: STEDENLIJST.map(stadNaam), standaard: null },
      duur: { keuze: ['quick', 'avond', 'weekend'], standaard: null }
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
