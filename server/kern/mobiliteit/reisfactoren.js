/* Mobility OS (deelmodule): de factoren waarmee reisopties vergeleken worden.
   Uitstoot, betrouwbaarheid, wachttijd en wat een reis aan comfort vraagt.

   DE EERLIJKHEID ZIT HIER IN WAT ER *NIET* WORDT BEWEERD.

   UITSTOOT is een SCHATTING en het antwoord zegt dat ook. De getallen hieronder
   zijn indicatieve gemiddelden per reizigerskilometer, geen meting aan het
   voertuig waar u in stapt: een volle bus is per persoon veel schoner dan een
   lege, en een trein op groene stroom haalt bijna nul. Waar wij het WEL weten
   -- omdat het voertuig in onze eigen vloot staat en elektrisch rijdt -- wordt
   de schatting bijgesteld, en dat staat er dan bij. Een getal met twee cijfers
   achter de komma zou hier precisie voorwenden die er niet is; daarom wordt er
   afgerond en heet het een schatting.

   BETROUWBAARHEID komt uit ONZE EIGEN gegevens: de storingen die de vervoerder
   zelf heeft gemeld (kern/mobiliteit/storing.js). Geen voorspelling, geen
   percentage dat een model heeft verzonnen -- een telling met een venster
   erbij. Zijn er geen gegevens, dan is het antwoord "niet bekend" en niet
   "100%". Dat is dezelfde regel als bij de schoolsignalen: liever geen cijfer
   dan een cijfer dat niets betekent.

   COMFORT is geen score. Een getal van 1 tot 5 over comfort is smaak met een
   cijfer eromheen. Wat een reiziger echt wil weten zijn de feiten: hoe vaak
   moet ik overstappen, hoe ver moet ik lopen, en zit ik zeker. Die staan er
   los, in gewone taal. */

/* Indicatieve uitstoot in gram CO2 per reizigerskilometer. Bewust grove,
   ronde getallen: ze zijn bedoeld om opties met elkaar te VERGELIJKEN, niet om
   een voetafdruk mee te berekenen. */
const CO2 = {
  lopen: 0, fiets: 0, scooter: 60,
  taxi: 150, auto: 150, taxibus: 90, rolstoelbus: 90, limousine: 190,
  bus: 80, shuttlebus: 70, touringcar: 30,
  tram: 30, metro: 30, trein: 35,
  veerboot: 120, watertaxi: 200,
  helikopter: 900, vliegtuig: 400, privejet: 700
};
// een elektrisch voertuig in onze eigen vloot: dan weten we meer dan het gemiddelde
const CO2_ELEKTRISCH_DEEL = 0.25;

const STORING_VENSTER_DAGEN = 30;

module.exports = (ctx) => {
  const { db } = ctx;

  /* De uitstoot van een etappe. Geeft altijd terug HOE het getal tot stand
     kwam, zodat een reiziger die het napluist niet op een blote 312 stuit. */
  function co2Van(wijze, km, opties = {}) {
    const basis = CO2[wijze] != null ? CO2[wijze] : CO2.auto;
    const elektrisch = opties.energie === 'elektrisch' || opties.energie === 'waterstof';
    const perKm = elektrisch ? Math.round(basis * CO2_ELEKTRISCH_DEEL) : basis;
    return { gram: Math.round(perKm * (km || 0)), perKm, geschat: true,
      uitleg: elektrisch
        ? 'schatting: ' + perKm + ' g/km (elektrisch voertuig uit onze vloot)'
        : 'schatting: ' + perKm + ' g/km, indicatief gemiddelde voor ' + wijze };
  }

  /* Betrouwbaarheid van een lijn: het aantal storingen dat de vervoerder zelf
     heeft gemeld in het venster. Geen gegevens is "niet bekend". */
  function betrouwbaarheidVan(vervoerder, lijnId) {
    const storingen = db.data.mobStoringen || [];
    if (!storingen.length)
      return { bekend: false, storingen: 0, uitleg: 'Nog geen storingsgegevens over deze lijn.' };
    const vanaf = Date.now() - STORING_VENSTER_DAGEN * 24 * 3600 * 1000;
    const raak = storingen.filter(s => s.vervoerder === vervoerder && s.lijnId === lijnId &&
      new Date(s.gemeld).getTime() >= vanaf);
    return { bekend: true, storingen: raak.length,
      uitleg: raak.length
        ? raak.length + ' storing(en) gemeld in de afgelopen ' + STORING_VENSTER_DAGEN + ' dagen'
        : 'geen storingen gemeld in de afgelopen ' + STORING_VENSTER_DAGEN + ' dagen' };
  }

  /* De wachttijd op een halte. Rijdt er een voertuig live op de lijn, dan is
     dat de echte aanrijtijd; anders het boekje (gemiddeld de halve frequentie).
     Welke van de twee het is, staat erbij -- "over 4 minuten" uit een
     dienstregeling is iets anders dan "over 4 minuten" uit GPS. */
  function wachttijdVan(vervoerder, lijn, halte) {
    const vers = (db.data.ovVoertuigen || []).filter(v => v.code === vervoerder && v.lijnId === lijn.id &&
      Date.now() - new Date(v.at).getTime() < 120 * 1000);
    if (vers.length && halte) {
      /* Zelfde nul-is-vals-val als in ./reisplan: een voertuig dat precies op
         de halte staat heeft afstand 0, en `0 || 1e9` maakte daar oneindig ver
         van -- dan viel de live tijd juist weg op het moment dat de bus er is. */
      const m = Math.min(...vers.map(v => { const d = ctx.haversine(v, halte); return d == null ? Infinity : d; }));
      if (Number.isFinite(m))
        return { minuten: ctx.etaMinutes(m, 'driving') || 1, live: true, uitleg: 'live positie van het voertuig' };
    }
    const f = Number(lijn.frequentieMin) || 15;
    return { minuten: Math.round(f / 2), live: false, uitleg: 'uit de dienstregeling (elke ' + f + ' min)' };
  }

  /* Wat een reis van een mens vraagt, als feiten en niet als cijfer. */
  function comfortVan(etappes) {
    const ov = etappes.filter(e => e.wijze === 'ov');
    const loopM = etappes.filter(e => e.wijze === 'lopen').reduce((n, e) => n + (e.meters || 0), 0);
    const overstappen = Math.max(0, ov.length - 1);
    const zit = etappes.every(e => e.wijze === 'taxi' || e.zitplaats);
    const punten = [];
    if (!overstappen && ov.length) punten.push('geen overstap');
    if (overstappen) punten.push(overstappen + ' keer overstappen');
    if (loopM > 0) punten.push(Math.round(loopM) + ' meter lopen');
    if (!loopM) punten.push('geen loopafstand');
    if (zit) punten.push('zitplaats');
    return { overstappen, loopM: Math.round(loopM), zitplaats: zit, punten };
  }

  return { CO2, co2Van, betrouwbaarheidVan, wachttijdVan, comfortVan, STORING_VENSTER_DAGEN };
};
