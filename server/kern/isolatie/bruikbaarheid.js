/* WAT ER ONDER EEN STAND NOG WERKT -- de andere helft van de vraag.

   ISOLATIEPROEF.json telt wat er DICHTGAAT. Dat is de halve waarheid, en het is
   de helft die een verkeerd gevoel geeft: hoe meer er dicht is, hoe beter het
   lijkt. Een isolatiestand die niemand durft aan te zetten, beschermt niemand --
   en of iemand hem durft aan te zetten hangt af van wat er nog KAN.

   Apple's Lockdown Mode schakelt het toestel ook niet uit. Dat is geen
   vriendelijkheid: het is de reden dat de stand gebruikt wordt.

   DE LIJST IS MET DE HAND EN DAT IS DE BEDOELING. Een verhaal als "ik kan zien
   wat er van mijn geld af ging" is geen route maar een SAMENHANG van routes, en
   welke verhalen kritiek zijn is een oordeel. Wat de machine hier doet, is per
   verhaal de paden nalopen en zeggen of ze open staan -- niet bedenken welke
   verhalen ertoe doen.

   DRIE UITKOMSTEN, EN DE MIDDELSTE IS DE INTERESSANTE:

     werkt          elk pad van dit verhaal staat open
     werkt beperkt  een deel staat open; de mens kan lezen maar niet handelen
     werkt niet     geen enkel pad staat open

   Een verhaal dat op `werkt beperkt` staat, is precies waar een ontwerpbesluit
   zit: is dat acceptabel, of hoort dit verhaal heel te blijven? Die vraag is
   niet aan deze module. */
'use strict';

/* DE LIJST STAAT ERNAAST, in ./verhalen.js (de mens-baan) en ./verhalen-zaak.js
   (de zaak-baan). Dat bestand draagt het OORDEEL -- welke verhalen ertoe doen --
   en dit bestand de MACHINE. Ze schuiven om verschillende redenen: de lijst
   groeit mee met de app, de meter verandert bijna nooit. Wie ze samen laat, past
   op een dag de meter aan om een verhaal kwijt te raken.

   `VERHALEN` blijft hier als export staan, want scripts/isolatieproef.js en
   test/bruikbaarheid.test.js halen hem hiervandaan. Hem verplaatsen zou de
   aanroepers verbouwen zonder dat er iets beter van wordt -- en twee wegen naar
   dezelfde lijst zijn twee lijsten in de dop. */
const { MENSBAAN } = require('./verhalen');
const { ZAAKBAAN } = require('./verhalen-zaak');

const VERHALEN = Object.freeze([].concat(MENSBAAN, ZAAKBAAN));

/* De banen die het scherm van een LID mag zien. Hij staat hier en niet in de
   route: twee filters zijn twee waarheden, en een client die de rijen binnen
   krijgt die hij niet mag tonen, toont ze op een dag. */
const LEDENBANEN = Object.freeze(['iedereen', 'lid', 'gezin']);

/* Een pad draagt zijn eigen methode: 'GET /api/...' of, zonder voorvoegsel,
   POST. Dat moest, want de meter legde elk pad hard op POST -- waar voor de
   negen verhalen die er stonden, en niet voor het gezinsportaal, waar een ouder
   juist via GET leest. Een GET die als POST wordt gemeten krijgt een strenger
   antwoord dan de werkelijkheid, en dan meldt de meter een gat dat er niet is. */
function ontleedPad(regel) {
  const m = /^([A-Z]+)\s+(\/.*)$/.exec(String(regel));
  return m ? { methode: m[1], pad: m[2] } : { methode: 'POST', pad: String(regel) };
}

/* TWEE OORDELEN, EN ZE WORDEN NOOIT SAMENGETELD.

   Deze meter mat tegen `isolatie.besluit()` -- de BESLUITLAAG. De laag die in de
   HTTP-keten werkelijk iets tegenhoudt is `beschermstand.houdtTegen()`, en die
   kent de leesset-redding uit besluit.js niet. Het verschil is geen detail:
   gemeten onder huis=`beschermd` staat het verhaal `geld-lezen` -- een belofte
   met `moetHeel` -- volgens de besluitlaag op WERKT en volgens de handhavende
   weg op WERKT NIET, want /api/pay/overzicht, /api/bank/afschrift en
   /api/bank/overzicht vallen alle drie dicht op de categorie "Geld".

   Het register meldde ondertussen `beloftesGezakt: []`. De belofte die dit huis
   het hardst heeft opgeschreven ("de eerste handeling van iemand die zijn account
   niet vertrouwt") was gebroken op de enige weg die telt, en de meter zei dat het
   goed was. Dat is precies de faalvorm die deze hele laag moest vinden: groen
   licht boven een gat.

   Vandaar twee kolommen. `besluit` is wat de laag BELOOFT (en wat het AI-filter
   afdwingt); `afgedwongen` is wat een draaiende server met een gewoon
   HTTP-verzoek doet. Ze optellen zou van allebei een halve waarheid maken -- en
   de belofte hangt aan de TWEEDE, want dat is wat een mens merkt. */
function maakBruikbaarheid({ isolatie, functies, beschermstand }) {

  /* Per verhaal: staat elk pad open onder deze stand? De methode komt uit het
     PAD en niet uit een aanname -- zie ontleedPad hierboven. `banen` versmalt tot
     de rollen die de aanroeper mag zien; leeg betekent alles. */
  function meet(context, banen) {
    const uit = [];
    const kies = Array.isArray(banen) && banen.length ? banen : null;
    for (const v of VERHALEN) {
      if (kies && !kies.includes(v.wie)) continue;
      const paden = v.paden.map(regel => {
        const { methode, pad } = ontleedPad(regel);
        const b = isolatie.besluit({ pad, methode, context });
        /* WAT ER WERKELIJK WORDT AFGEDWONGEN. Zonder beschermstand blijft dit
           `null` en niet `true`: "we hebben niet gekeken" is iets anders dan
           "het staat open", en een meter die dat verschil wegpoetst, is de
           meter die dit gat maakte. */
        const hard = beschermstand ? !beschermstand.houdtTegen(pad, methode) : null;
        return { pad, methode, open: b.toegestaan, reden: b.toegestaan ? null : b.reden,
          uitleg: b.uitleg, afgedwongenOpen: hard };
      });
      const open = paden.filter(p => p.open).length;
      const stand = open === paden.length ? 'werkt' : (open ? 'werkt beperkt' : 'werkt niet');
      const hardOpen = beschermstand ? paden.filter(p => p.afgedwongenOpen).length : null;
      const hardStand = beschermstand
        ? (hardOpen === paden.length ? 'werkt' : (hardOpen ? 'werkt beperkt' : 'werkt niet'))
        : null;
      uit.push({ id: v.id, wie: v.wie, wat: v.wat, moetHeel: v.moetHeel === true,
        stand, open, van: paden.length, paden,
        /* De tweede kolom staat NAAST de eerste en niet in plaats daarvan. */
        afgedwongen: hardStand,
        afgedwongenOpen: hardOpen,
        /* EEN GEBROKEN BELOFTE IS EEN EIGEN UITKOMST en geen regel in een lijst.
           Wie `moetHeel` draagt en niet op `werkt` staat, hoort er als BELOFTE
           GEZAKT uit te komen -- niet als een rij tussen de rest. */
        beloftegezakt: v.moetHeel === true && stand !== 'werkt',
        /* DE BELOFTE HANGT AAN WAT ER WORDT AFGEDWONGEN, want dat is wat een mens
           merkt. Zolang er geen beschermstand is meegegeven, valt hij terug op de
           besluitlaag -- met `afgedwongen: null` ernaast, zodat zichtbaar blijft
           dat er niet is gekeken. */
        belofteGezaktAfgedwongen: v.moetHeel === true && hardStand !== null && hardStand !== 'werkt',
        waarom: v.waarom || null });
    }
    return uit;
  }

  /* De samenvatting per stand, voor het register en het scherm. Geen percentage:
     negenendertig verhalen zijn geen steekproef van de duizenden routes, en een
     percentage zou suggereren dat ze dat wel zijn. De rij zelf zegt meer. */
  function overStanden(standen, opties) {
    const uit = {};
    const banen = opties && Array.isArray(opties.banen) ? opties.banen : null;
    for (const stand of standen || ['normaal', 'beschermd', 'isolatie']) {
      const ctx = { standen: { huis: 'normaal', proef: stand } };
      /* De stand wordt als losse drager aangeboden; de join maakt er de
         effectieve stand van, precies zoals in het echt. */
      const rijen = meet({ standen: { huis: stand } }, banen);
      uit[stand] = {
        werkt: rijen.filter(r => r.stand === 'werkt').length,
        beperkt: rijen.filter(r => r.stand === 'werkt beperkt').length,
        werktNiet: rijen.filter(r => r.stand === 'werkt niet').length,
        belofteGezakt: rijen.filter(r => r.beloftegezakt).map(r => ({ id: r.id, stand: r.stand,
          dicht: r.paden.filter(p => !p.open).map(p => p.pad) })),
        /* WAT ER WERKELIJK ZAKT. Deze lijst is de belangrijkste van de twee: hij
           zegt wat een mens vandaag met een gewoon HTTP-verzoek te zien krijgt. */
        belofteGezaktAfgedwongen: rijen.filter(r => r.belofteGezaktAfgedwongen)
          .map(r => ({ id: r.id, stand: r.afgedwongen,
            dicht: r.paden.filter(p => p.afgedwongenOpen === false).map(p => p.pad) })),
        perBaan: perBaan(rijen),
        rijen
      };
      void ctx;
    }
    return uit;
  }

  /* Per BAAN uitgesplitst, want een totaal over vier banen verbergt precies wat
     je wilt weten: dat de mens-baan er goed doorkomt en de zaak-baan niet. */
  function perBaan(rijen) {
    const uit = {};
    for (const r of rijen) {
      const b = uit[r.wie] || (uit[r.wie] = { werkt: 0, beperkt: 0, werktNiet: 0 });
      if (r.stand === 'werkt') b.werkt++;
      else if (r.stand === 'werkt beperkt') b.beperkt++;
      else b.werktNiet++;
    }
    return uit;
  }

  return { VERHALEN, LEDENBANEN, meet, overStanden, perBaan, ontleedPad };
}

module.exports = { maakBruikbaarheid, VERHALEN, LEDENBANEN };
