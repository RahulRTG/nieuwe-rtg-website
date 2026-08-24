/* Horeca (kern): DE WERKLIJST -- wat is mijn eerstvolgende handeling?

   Dit is de rekensom achter PDA SERVICE, de belangrijkste van de zes
   werkstanden (HORECA.md). De vaste schermen informeren en regisseren; op de
   PDA wordt de service werkelijk uitgevoerd. De vraag van dat scherm is niet
   "wat is de stand" maar "wat moet ik nu doen", en dat is een ANDERE vraag: de
   stand is per tafel, de handeling is per mens.

   WAT ER NIET GEBEURT, EN DAT IS DE HELE KUNST. Er komt geen prioriteitsscore.
   Een lijst die "urgentie 82" naast "urgentie 74" zet, verzint een weging
   tussen dingen die niet in dezelfde eenheid staan -- en dan is de volgorde een
   mening die eruitziet als een meting (HORECA.md, grens 7). Er komt ook geen
   ranglijst van medewerkers: hoeveel taken iemand deed staat hier niet, en gaat
   hier ook nooit staan (grens 5).

   WAT ER WEL GEBEURT: elke taak wordt vergeleken met een grens DIE AL BESTOND,
   en de volgorde is hoeveel minuten hij daar overheen is.

     verzoek   `SOORTEN[soort].oudNa` in kern/gast/verzoek.js -- 3 minuten voor
               "er is iets niet goed", 12 voor "mag dit weg?". Die grenzen staan
               er al jaren en worden al gebruikt voor `oud`.
     pas       PASMARGE uit kern/horeca/cadans.js -- de twee minuten tussen
               "alles staat bij de pas" en "het staat op tafel". Een gang die
               langer staat, is over de marge waarmee de keuken zelf plande.
     belofte   het serveermoment zelf, dus grens nul. Een gang die zijn eigen
               doel voorbij is, is te laat -- en de bediening hoort dat te weten
               vóór de gast het vraagt.
     aankomst  het afgesproken AANKOMSTmoment van een Arrival Pass. Een belofte
               die nog openstaat terwijl de gast al binnen is, is een ander soort
               te laat dan een die nog twee uur heeft.

   EN WAT GEEN GRENS HEEFT, KRIJGT ER GEEN. Een tafel die openstaat zonder
   bestelling wacht ergens op, maar er is nergens vastgelegd hoe lang dat mag
   duren -- dat hangt af van het huis, het uur en de tafel. Die taken staan
   daarom in een TWEEDE lijst met hun minuten erbij en zonder rangorde. Liever
   twee eerlijke lijsten dan één lijst met een verzonnen getal erin.

   DE MODUS IS EEN LENS EN GEEN RECHT. Bediening, runner en alles filteren welke
   soorten je ziet; ze veranderen niets aan wat je mag. Wie de PDA opent is al
   ingelogd als medewerker van deze zaak, en dat is waar de rechten zitten. Een
   modus die iets zou afschermen, zou een tweede rechtenmodel zijn -- en dat is
   precies wat CONCERN.md verbiedt.

   DE WIJK IS EEN TWEEDE LENS, NAAST DE MODUS, en met opzet een andere. De
   modus filtert op SOORT werk (verzoek, pas, belofte); de wijk filtert op WIENS
   tafel het is. Twee vragen, twee knoppen -- ze in een keuzelijst samenvoegen
   zou "runner in mijn wijk" onmogelijk maken, en dat is juist een bestaande
   werkstand.

   EN DE WIJK VERBERGT NOOIT ZONDER HET TE ZEGGEN. Filtert deze lijst op wijk,
   dan staat er bij hoeveel taken hij daarmee NIET toont. Een filter dat zwijgt
   over wat het wegliet, is een filter waarin werk verdwijnt -- en op een drukke
   avond is dat precies de tafel waar het misgaat. Zie kern/horeca/wijk.js voor
   de drie regels die de verdeling veilig houden. */
'use strict';

const cadans = require('./cadans');
const klok = require('../../lib/klok');

/* De pasmarge komt uit de cadans zelf en wordt hier niet overgeschreven: zou
   dit getal hier een eigen waarde krijgen, dan plant de keuken met twee minuten
   en klaagt de PDA na drie. */
const PASMARGE = cadans.PASMARGE;

/* Welke soort taak hoort bij welke lens. Bewust hier en niet op het scherm: de
   client mag de lijst tonen, niet bepalen wat erin hoort. */
const MODI = {
  bediening: { naam: 'Bediening', soorten: ['verzoek', 'belofte', 'opnemen'] },
  runner: { naam: 'Runner', soorten: ['pas'] },
  /* De host werkt op de aankomststroom: beloften die op een persoonlijke
     controle wachten VOORDAT de gast er is. `opnemen` staat erbij omdat een
     tafel die net is gezet en nog niets besteld heeft, ook aan de host hangt. */
  host: { naam: 'Host', soorten: ['aankomst', 'opnemen'] },
  alles: { naam: 'Alles', soorten: ['verzoek', 'pas', 'belofte', 'aankomst', 'opnemen'] }
};

/* WAAROM ER GEEN MODUS "WIJKHOOFD" IN DEZE LIJST STAAT. Een wijkhoofd stelt een
   andere vraag dan de rest: niet "wat moet ik nu doen" maar "wie heeft ons nu
   nodig, en hoe verdelen we dat". Dat is de vraag van VLOER, en het antwoord is
   geen takenlijst maar een verdeling -- welke wijk draagt hoeveel, en wie draagt
   hem. Dat staat als eigen blok in het antwoord (`wijkbeeld`) en niet als vierde
   knop, want een knop die iets heel anders toont dan de drie ernaast, leert
   niemand kennen. */

module.exports = ({ horeca, schoon, verzoeklaag }) => {
  const wijklaag = require('./wijk')({ horeca, schoon });
  /* Waar een taak vandaan komt, staat in ./werklijst-bronnen.js -- zie de kop
     daar voor waarom die naad daar ligt. Dit bestand ordent en filtert. */
  const { vanVerzoeken, vanPas, vanBelofte, vanOpnemen, vanAankomst } =
    require('./werklijst-bronnen')({ horeca, schoon, verzoeklaag });

  /* Hoeveel open werk draagt elke wijk, en wie draagt hem. Bewust GEEN score en
     geen vergelijking tussen mensen (grens 5): het getal is het aantal taken,
     hoort bij de WIJK en niet bij de mens, en de naam staat er alleen bij zodat
     iemand weet wie hij moet aanspreken. Tafels die in geen enkele wijk zitten
     staan als "zonder wijk" -- die zijn van iedereen en horen niet te
     verdwijnen omdat ze nergens bij horen. */
  function wijkbeeldVan(h, taken) {
    const wijken = wijklaag.lijst(h);
    const beeld = wijken.map((w) => ({ id: w.id, naam: w.naam, tafels: w.tafels.length,
      van: w.van ? w.van.naam : null, taken: 0, nu: 0 }));
    const zonder = { id: null, naam: 'Zonder wijk', tafels: null, van: null, taken: 0, nu: 0 };
    for (const t of taken) {
      const w = wijken.find((x) => x.tafels.includes(String(t.tafel || '')));
      const vak = w ? beeld.find((b) => b.id === w.id) : zonder;
      vak.taken++;
      if (typeof t.over === 'number' && t.over > 0) vak.nu++;
    }
    if (zonder.taken) beeld.push(zonder);
    return beeld.sort((a, b) => b.nu - a.nu || b.taken - a.taken);
  }

  /* De lijst zelf. TWEE groepen, en de scheiding is de hele belofte van deze
     module: `nu` bevat alleen taken die over een grens zijn die het huis zelf
     heeft opgeschreven, geordend op hoe ver eroverheen. `open` bevat de rest,
     geordend op minuten, zonder enige bewering over urgentie. */
  function werklijst(h, code, opties) {
    /* Dezelfde klok als de cadans (lib/klok), en niet de OS-tijd: anders rekent
       de PDA met een andere "nu" dan het scherm waar hij naast staat. */
    const nuMs = klok.nu();
    const modus = MODI[String((opties && opties.modus) || 'alles')] ? String(opties.modus) : 'alles';
    const soorten = MODI[modus].soorten;

    let alles = [];
    if (soorten.includes('verzoek')) alles = alles.concat(vanVerzoeken(code, nuMs));
    if (soorten.includes('pas')) alles = alles.concat(vanPas(h, nuMs));
    if (soorten.includes('belofte')) alles = alles.concat(vanBelofte(h, nuMs));
    if (soorten.includes('aankomst')) alles = alles.concat(vanAankomst(h, nuMs));
    if (soorten.includes('opnemen')) alles = alles.concat(vanOpnemen(h, nuMs));

    /* De wijklens. `mijn` toont alleen tafels die van mij zijn -- en "van mij"
       is ruim: een tafel zonder wijk en een wijk zonder mens zijn van iedereen
       (kern/horeca/wijk.js). Wat wegvalt wordt GETELD en teruggegeven; het
       verdwijnt niet stil. */
    const opWijk = (opties && opties.wijk === 'mijn') && (opties && opties.staffId != null);
    const ongefilterd = alles;
    let verborgen = 0;
    if (opWijk) {
      alles = alles.filter((t) => wijklaag.vanMij(h, t.tafel, opties.staffId));
      verborgen = ongefilterd.length - alles.length;
    }

    const nu = alles.filter((t) => typeof t.over === 'number' && t.over > 0)
      .sort((a, b) => b.over - a.over || b.wacht - a.wacht);
    const open = alles.filter((t) => !(typeof t.over === 'number' && t.over > 0))
      .sort((a, b) => b.wacht - a.wacht);

    return {
      modus, modi: Object.keys(MODI).map((id) => ({ id, naam: MODI[id].naam })),
      nu, open,
      wijk: opWijk ? 'mijn' : 'alles',
      mijnWijken: (opties && opties.staffId != null) ? wijklaag.mijne(h, opties.staffId).map((w) => w.naam) : [],
      verborgen,
      /* HET WIJKBEELD: hoeveel open werk draagt elke wijk, en wie draagt hem.
         Geteld over ALLE taken van deze modus, ook die de wijklens wegfilterde --
         anders zou een wijkhoofd de drukte van een collega niet zien, en dat is
         nou juist de vraag die hij stelt. */
      wijkbeeld: wijkbeeldVan(h, ongefilterd),
      let: 'De volgorde van "nu" is hoeveel minuten een taak over een grens is die ' +
        'het huis zelf heeft vastgelegd. Wat geen grens heeft, staat eronder op ' +
        'minuten en zonder rangorde -- daar is niets aan gemeten.' +
        (verborgen ? ' ' + verborgen + ' taak(en) staan buiten uw wijk en worden hier niet getoond.' : '')
    };
  }

  return { werklijst, MODI, PASMARGE };
};
