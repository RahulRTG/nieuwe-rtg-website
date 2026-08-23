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

   ER IS GEEN WIJK. Een sectie-indeling ("tafels 1 tot 8 zijn van Sanne")
   bestaat nergens in de data, dus doet deze lijst niet alsof: hij toont de hele
   zaak. Wie hem per wijk wil, heeft eerst een wijk nodig -- en dat is een
   ontwerpbesluit en geen veld. */
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
  alles: { naam: 'Alles', soorten: ['verzoek', 'pas', 'belofte', 'opnemen'] }
};

const MIN = 60000;
const minutenSinds = (at, nuMs) => at ? Math.max(0, Math.round((nuMs - Date.parse(at)) / MIN)) : 0;
const hhmm = (ms) => {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

module.exports = ({ horeca, schoon, verzoeklaag }) => {
  const pas = require('./pas')({ horeca, schoon });
  /* De grenzen per soort komen uit de verzoekenlaag ZELF en worden hier niet
     nagemaakt. Een tweede tabel met dezelfde getallen is een tweede waarheid,
     en die loopt uit elkaar op de dag dat iemand er een aanpast. */
  const SOORTEN = verzoeklaag.SOORTEN || {};

  /* ---- de drie soorten met een bestaande grens ---- */

  function vanVerzoeken(code, nuMs) {
    const rij = verzoeklaag.wachtrij(code).verzoeken || [];
    return rij.map((v) => {
      const grens = (SOORTEN[v.soort] || {}).oudNa;
      return {
        soort: 'verzoek', id: 'verzoek:' + v.id, bronId: v.id,
        tafel: v.tafel || null, rekeningId: v.rekeningId || null,
        wat: v.naam + (v.tekst ? ' -- ' + v.tekst : ''),
        wacht: v.minuten, grens: typeof grens === 'number' ? grens : null,
        over: typeof grens === 'number' ? v.minuten - grens : null,
        door: v.opgepaktDoor || null,
        rekensom: 'Staat ' + v.minuten + ' min open; voor "' + v.naam + '" rekent het huis ' +
          (typeof grens === 'number' ? grens + ' min' : 'geen grens') + '.'
      };
    });
  }

  function vanPas(h, nuMs) {
    return pas.gereed(h).map((g) => ({
      soort: 'pas', id: 'pas:' + g.rekeningId + ':' + g.gang,
      tafel: g.tafel || null, rekeningId: g.rekeningId, gang: g.gang,
      wat: 'Gang ' + g.gang + ' staat compleet bij de pas (' + g.borden + ' bord' +
        (g.borden === 1 ? '' : 'en') + ')',
      wacht: g.gereedSinds, grens: PASMARGE, over: g.gereedSinds - PASMARGE,
      door: g.claim ? g.claim.naam : null,
      /* De runner draagt borden en geen regels: welk bord naar welke stoel gaat
         en welke allergie eraan hangt, hoort MEE en niet een scherm verderop.
         Een allergie die de drager niet ziet, is precies de fout die dit huis
         niet mag maken (HORECA.md, grens 1). */
      borden: g.regels, allergieen: g.allergieen,
      rekensom: 'Compleet sinds ' + g.gereedSinds + ' min; de keuken plant ' + PASMARGE +
        ' min tussen de pas en de tafel.'
    }));
  }

  /* Een gang die zijn eigen serveermoment voorbij is en nog niet compleet is.
     Compleet-en-te-laat staat al in de paslijst hierboven -- twee taken voor
     hetzelfde bord zou de lijst dubbel maken en de mens laten kiezen welke van
     de twee hij wegwerkt. */
  function vanBelofte(h, nuMs) {
    const uit = [];
    for (const rek of Object.values(h.rekeningen || {})) {
      if (rek.status !== 'open' && rek.status !== 'betaald') continue;
      for (const g of cadans.cadansVanRekening(h, rek, nuMs)) {
        if (g.compleet) continue;
        if (g.doelOver >= 0) continue;
        uit.push({
          soort: 'belofte', id: 'belofte:' + rek.id + ':' + g.gang,
          tafel: rek.tafel || rek.kanaal, rekeningId: rek.id, gang: g.gang,
          wat: 'Gang ' + g.gang + ' is over zijn serveermoment (' + g.klaar + ' van ' + g.totaal + ' klaar)',
          wacht: -g.doelOver, grens: 0, over: -g.doelOver, door: null,
          rekensom: 'Zou om ' + hhmm(Date.parse(g.doelOm)) + ' op tafel staan. ' + g.rekensom
        });
      }
    }
    return uit;
  }

  /* ---- en de soort zonder grens ---- */

  function vanOpnemen(h, nuMs) {
    const uit = [];
    for (const rek of Object.values(h.rekeningen || {})) {
      if (rek.status !== 'open') continue;
      if ((rek.regels || []).length) continue;
      uit.push({
        soort: 'opnemen', id: 'opnemen:' + rek.id,
        tafel: rek.tafel || rek.kanaal, rekeningId: rek.id,
        wat: 'Open zonder bestelling' + (rek.gasten ? ' (' + rek.gasten + ' gasten)' : ''),
        wacht: minutenSinds(rek.geopendAt || rek.at, nuMs),
        grens: null, over: null, door: rek.door || null,
        rekensom: 'Geopend om ' + hhmm(Date.parse(rek.geopendAt || rek.at)) +
          '. Er is nergens vastgelegd hoe lang een tafel zonder bestelling mag staan.'
      });
    }
    return uit;
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
    if (soorten.includes('opnemen')) alles = alles.concat(vanOpnemen(h, nuMs));

    const nu = alles.filter((t) => typeof t.over === 'number' && t.over > 0)
      .sort((a, b) => b.over - a.over || b.wacht - a.wacht);
    const open = alles.filter((t) => !(typeof t.over === 'number' && t.over > 0))
      .sort((a, b) => b.wacht - a.wacht);

    return {
      modus, modi: Object.keys(MODI).map((id) => ({ id, naam: MODI[id].naam })),
      nu, open,
      let: 'De volgorde van "nu" is hoeveel minuten een taak over een grens is die ' +
        'het huis zelf heeft vastgelegd. Wat geen grens heeft, staat eronder op ' +
        'minuten en zonder rangorde -- daar is niets aan gemeten.'
    };
  }

  return { werklijst, MODI, PASMARGE };
};
