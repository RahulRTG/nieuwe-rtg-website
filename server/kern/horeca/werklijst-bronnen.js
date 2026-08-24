/* Horeca (kern): DE BRONNEN VAN DE WERKLIJST -- waar een taak vandaan komt.

   WAAROM DIT EEN EIGEN BESTAND IS. ./werklijst.js liep over de 10 kB-grens van
   keuringsregel 13 toen de wijk erbij kwam. De snede ligt op een echte naad:
   hier staat WAAR een taak vandaan komt (een verzoek, de pas, een gebroken
   belofte, een tafel zonder bestelling), in werklijst.js staat hoe die taken
   worden GEORDEND en gefilterd.

   Die twee gaan over verschillende dingen en veranderen om verschillende
   redenen: een bron erbij is een nieuwe soort werk, een verandering in de
   ordening raakt alle soorten tegelijk. Zie de kop van ./werklijst.js voor de
   regel waar alles om draait: de volgorde is minuten OVER een grens die het
   huis zelf heeft vastgelegd, en wat geen grens heeft krijgt er geen. */
'use strict';

const cadans = require('./cadans');

const PASMARGE = cadans.PASMARGE;
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

  /* DE AANKOMSTSTROOM -- de bron van de host.

     Een Arrival Pass draagt BELOFTEN, en sommige daarvan wachten expliciet op
     een mens: een toegankelijke route, een allergiebriefing voor de keuken, een
     bijzonder moment. Die staan er al jaren (routes/supplier/horeca/
     invisible-arrival.js); wat ontbrak is dat ze op een werklijst kwamen.

     DE GRENS IS HET AFGESPROKEN AANKOMSTMOMENT ZELF, en die is niet verzonnen:
     de gast heeft een tijd gekregen en die staat op de pass. Een belofte die
     nog openstaat terwijl de gast al binnen is, is te laat -- en dat is een
     ander soort te laat dan "we hebben er nog twee uur voor".

     `wacht` telt vanaf het moment dat de aanvraag binnenkwam: zo lang staat de
     belofte al open. `grens` is hoeveel minuten er tussen die aanvraag en de
     aankomst zaten. Dat maakt `over` precies wat je wilt weten -- hoeveel
     minuten geleden de gast er had moeten zijn terwijl wij nog niets hadden
     afgetekend. */
  function vanAankomst(h, nuMs) {
    const uit = [];
    for (const a of Object.values(h.arrivals || {})) {
      if (!a || !Array.isArray(a.beloften)) continue;
      if (a.vervaltAt && Date.parse(a.vervaltAt) < nuMs) continue;
      const open = a.beloften.filter((p) => /wacht|voorgesteld/.test(String(p.status || '')));
      if (!open.length) continue;
      const aankomstMs = Date.parse(String(a.datum) + 'T' + String(a.tijd) + ':00');
      const aanvraagMs = Date.parse(a.at || '');
      if (isNaN(aankomstMs) || isNaN(aanvraagMs)) continue;
      const wacht = Math.max(0, Math.round((nuMs - aanvraagMs) / MIN));
      const grens = Math.max(0, Math.round((aankomstMs - aanvraagMs) / MIN));
      uit.push({
        soort: 'aankomst', id: 'aankomst:' + a.id, bronId: a.id,
        tafel: a.tafel || null, rekeningId: null,
        wat: 'Aankomst ' + a.tijd + ', ' + a.personen + ' gast(en): ' + open.length +
          ' belofte(n) wachten op een persoonlijke controle',
        wacht, grens, over: wacht - grens,
        door: null,
        /* De open beloften reizen mee, want een host die niet ziet WELKE
           belofte wacht, moet eerst een ander scherm openen -- en dan is dit
           geen werklijst maar een verwijzing. */
        beloften: open.map((p) => ({ id: p.id, label: p.label, status: p.status, bewijs: p.bewijs || null })),
        rekensom: 'Aangevraagd om ' + hhmm(aanvraagMs) + ', de gast wordt om ' + a.tijd +
          ' verwacht. ' + (wacht > grens
            ? 'Dat moment is ' + (wacht - grens) + ' min voorbij.'
            : 'Er is nog ' + (grens - wacht) + ' min.')
      });
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

  return { vanVerzoeken, vanPas, vanBelofte, vanOpnemen, vanAankomst, PASMARGE };
};
