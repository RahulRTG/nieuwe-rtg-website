/* Het Privekantoor, deelbestand "termijnen": de Control Tower.

   De belofte van een privekantoor is niet dat het meldt wat er misgaat, maar dat
   het meldt wat er MIS GAAT GAAN. Dat verschil is dit bestand.

   Er was al van alles dat waarschuwde. Het Bezittingenregister seint over
   verzekeringen, Entourage over paspoorten, Reisboek over visa, Logboek over
   keuringen, Attenties over verjaardagen. Vijf apps, vijf lijstjes, en het lid
   dat ze alle vijf moest openen om te weten of er deze maand iets speelt. Precies
   het werk dat je uitbesteedt als je een kantoor huurt.

   Hier komen ze samen, in een vorm die het lid al kent uit zijn eigen agenda:
   deze week, deze maand, dit kwartaal, dit jaar. Plus het venster dat er in geen
   van die apps was en dat er het meest toe doet: ACHTERSTALLIG. Een verzekering
   die vorige maand afliep stond in het register netjes als "verlopen" -- maar
   alleen als je het register opende.

   De tower rekent niets uit dat de graaf niet weet. Hij sorteert. Dat is met
   opzet: elke datum hier komt uit een app waar het lid hem zelf heeft ingevuld,
   en de tower verzint er geen bij. Een voorspelling die op niets rust is erger
   dan geen voorspelling, want ernaar handelen kost echt geld.

   Gemount via ./index.js. */
'use strict';

/* De vensters. Zeven, dertig, negentig, een jaar -- de horizon uit de opdracht,
   en niet toevallig ook de horizon waarop dit soort dingen te repareren is: een
   paspoort verlengen kost weken, een taxatie plannen maanden. */
const VENSTERS = [
  { dagen: 7, sleutel: 'week', label: 'Deze week' },
  { dagen: 30, sleutel: 'maand', label: 'Binnen een maand' },
  { dagen: 90, sleutel: 'kwartaal', label: 'Binnen een kwartaal' },
  { dagen: 365, sleutel: 'jaar', label: 'Binnen een jaar' }
];

/* Wat telt als een zaak die het lid ECHT niet mag missen. Een verjaardag die
   voorbij is, is jammer; een visum dat verlopen is, is een geannuleerde reis.
   Dit onderscheid bepaalt de kop van de Situation Room, dus het staat hier met
   naam en niet als een gevoel in een if. */
const ZWAAR = new Set(['verzekering', 'paspoort', 'visum', 'rijbewijs', 'keuring', 'taxatie', 'vaccinatie']);

module.exports = (ctx) => {
  const { graaf } = ctx;
  const vandaag = () => new Date().toISOString().slice(0, 10);

  // hele dagen tussen twee kale datums; middag als klokstand zodat zomertijd
  // geen halve dag oplevert (dat kostte hier eerder een dag verschil)
  function dagenTussen(van, tot) {
    return Math.round((new Date(tot + 'T12:00:00Z') - new Date(van + 'T12:00:00Z')) / 86400000);
  }

  /* Alle termijnen van een lid, op volgorde, met de dagen erbij. De ouder komt
     mee als naam: "verzekering" zegt niets, "Villa Ibiza · verzekering" wel. */
  function alle(key, voorafG) {
    const g = voorafG || graaf(key);
    const t = vandaag();
    return g.knopen
      .filter(k => k.vervalt)
      .map(k => {
        const ouder = k.ouder ? g.perId.get(k.ouder) : null;
        return {
          id: k.id,
          naam: k.naam,
          wat: k.vervaltWat,
          kamer: k.kamer,
          bron: k.bron,
          datum: k.vervalt,
          dagen: dagenTussen(t, k.vervalt),
          waarvan: ouder ? ouder.naam : '',
          zwaar: ZWAAR.has(k.vervaltWat)
        };
      })
      .sort((a, b) => a.datum.localeCompare(b.datum));
  }

  /* De tower zelf: achterstallig plus de vier vensters. Een termijn valt in het
     EERSTE venster waar hij in past, niet in alle vier -- anders staat een
     paspoort dat over vijf dagen verloopt vier keer op het scherm en telt de kop
     hem vier keer mee. */
  function tower(key, voorafG) {
    const rijen = alle(key, voorafG);
    const achterstallig = rijen.filter(r => r.dagen < 0);
    const vensters = [];
    let vorige = 0;
    for (const v of VENSTERS) {
      const items = rijen.filter(r => r.dagen >= 0 && r.dagen >= vorige && r.dagen < v.dagen);
      vensters.push({ dagen: v.dagen, sleutel: v.sleutel, label: v.label, aantal: items.length, items });
      vorige = v.dagen;
    }
    const later = rijen.filter(r => r.dagen >= 365);
    return {
      achterstallig,
      achterstalligZwaar: achterstallig.filter(r => r.zwaar).length,
      vensters,
      later: later.length,
      totaal: rijen.length
    };
  }

  return { tower, termijnenAlle: alle, VENSTERS, dagenTussen };
};
