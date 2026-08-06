/* Mobility OS (deelmodule): de bouwstenen van een reisoptie. Een looptappe,
   een taxi-etappe, een OV-etappe, en hoe die tot een optie met totalen worden
   opgeteld. De planner die ermee zoekt staat in ./reisplan.

   Afgesplitst omdat het geheel over de 10 kB-grens liep. De naad valt waar hij
   hoort: hier wordt een etappe GEMAAKT, daar wordt er tussen gekozen. */

const LOOP_MAX_M = 1200;          // verder dan dit stuurt niemand je te voet

module.exports = (ctx) => {
  const { haversine, etaMinutes, modAan, ovPrijsVan,
    co2Van, betrouwbaarheidVan, wachttijdVan, comfortVan, magVerkopen, STANDAARD_TARIEF } = ctx;

  const rond = (n, d = 1) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d);

  /* Afstand met een EXPLICIETE "onbekend". Hier stond `haversine(a,b) || 9e9`,
     en dat is de klassieke nul-is-vals-val: sta je precies op de halte, dan is
     de afstand 0, en `0 || 9e9` maakt daar oneindig ver van. Gevolg: de halte
     waar je bij stond werd als LAATSTE gesorteerd, de planner koos de verste
     halte van de lijn, en de omwegtoets gooide de hele optie eruit. De planner
     was dus precies dan het slechtst wanneer hij het makkelijkst had moeten
     hebben. Alleen een ONBEKENDE afstand (null) is oneindig. */
  const afst = (a, b) => { const m = haversine(a, b); return m == null ? Infinity : m; };

  // een looptappe; alleen zinnig over korte afstanden
  function loopEtappe(van, naar) {
    const m = afst(van, naar);
    return { wijze: 'lopen', van, naar, meters: Math.round(m), km: rond(m / 1000, 2),
      minuten: etaMinutes(m, 'walking') || 1, prijs: 0,
      co2: co2Van('lopen', m / 1000) };
  }

  // een taxi-etappe; de prijs volgt hetzelfde tarief als een gewone rit
  function taxiEtappe(van, naar) {
    const m = afst(van, naar);
    const km = m / 1000;
    const minuten = etaMinutes(m, 'driving') || 1;
    const t = STANDAARD_TARIEF;
    const prijs = Math.max(t.minimum || 0, Math.round(t.basis + t.perKm * km + t.perMin * minuten));
    return { wijze: 'taxi', van, naar, km: rond(km, 1), minuten, prijs,
      co2: co2Van('taxi', km) };
  }

  /* Het voor- of natransport: lopen als het kort is, anders een taxi. De grens
     is geen smaak maar het verschil tussen een reisadvies en een grap: een
     kilometer lopen naar een halte is te doen, drie kilometer niet. */
  const aanloop = (van, naar) => afst(van, naar) <= LOOP_MAX_M ? loopEtappe(van, naar) : taxiEtappe(van, naar);

  /* Een OV-etappe over een lijn, tussen twee van zijn haltes. De prijs komt uit
     dezelfde formule als het uitchecken (ovPrijsVan); de wachttijd uit de live
     positie als die er is, anders uit het boekje. */
  function ovEtappe(zaak, lijn, a, b, waar) {
    const m = afst(a, b);
    const km = m / 1000;
    const wacht = wachttijdVan(zaak.code, lijn, a);
    const wijze = lijn.soort || 'bus';
    /* Of er een kaartje te koop is, wordt met DEZELFDE twee vragen bepaald als
       bij de verkoop zelf: staat de module aan, en dekt de overeenkomst dit.
       Hier stond alleen de overeenkomst, en dan belooft de planner een kaartje
       terwijl de kaartverkoop in dit gebied uit staat -- het boeken liep dan
       stuk op een belofte die de planner zelf had gedaan. */
    const modKaart = modAan('public_transport_ticketing', Object.assign({ vervoerder: zaak.code }, waar || {}));
    const kaart = modKaart.aan ? magVerkopen(zaak.code, lijn.id, 'enkel')
      : { mag: false, reden: modKaart.reden };
    return { wijze: 'ov', vervoerder: zaak.code, vervoerderNaam: zaak.name,
      lijnId: lijn.id, lijnNaam: lijn.naam, soort: lijn.soort,
      van: { id: a.id, naam: a.naam, lat: a.lat, lng: a.lng },
      naar: { id: b.id, naam: b.naam, lat: b.lat, lng: b.lng },
      km: rond(km, 1), minuten: (etaMinutes(m, wijze === 'veerboot' ? 'sailing' : 'driving') || 1) + wacht.minuten,
      wachtMin: wacht.minuten, wachtLive: wacht.live, wachtUitleg: wacht.uitleg,
      prijs: ovPrijsVan(lijn, km), co2: co2Van(wijze, km),
      betrouwbaarheid: betrouwbaarheidVan(zaak.code, lijn.id),
      // is hier ook echt een kaartje voor te koop, of alleen in te checken?
      kaartTeKoop: kaart.mag, kaartReden: kaart.mag ? null : kaart.reden };
  }

  function optieVan(id, naam, etappes, uitleg) {
    const minuten = etappes.reduce((n, e) => n + (e.minuten || 0), 0);
    const prijs = etappes.reduce((n, e) => n + (e.prijs || 0), 0);
    const co2 = etappes.reduce((n, e) => n + ((e.co2 && e.co2.gram) || 0), 0);
    const km = rond(etappes.reduce((n, e) => n + (e.km || 0), 0), 1);
    const comfort = comfortVan(etappes);
    const ov = etappes.filter(e => e.wijze === 'ov');
    return { id, naam, etappes, uitleg,
      totaal: { minuten, prijs, km, co2Gram: co2, co2Geschat: true,
        overstappen: comfort.overstappen, loopM: comfort.loopM,
        wachtMin: ov.reduce((n, e) => n + (e.wachtMin || 0), 0) },
      comfort,
      betrouwbaarheid: ov.length ? ov.map(e => e.betrouwbaarheid) : [{ bekend: true, storingen: 0,
        uitleg: 'een taxi rijdt op afspraak; er is geen dienstregeling die kan uitvallen' }] };
  }

  return { LOOP_MAX_M, afst, rond, loopEtappe, taxiEtappe, aanloop, ovEtappe, optieVan };
};
