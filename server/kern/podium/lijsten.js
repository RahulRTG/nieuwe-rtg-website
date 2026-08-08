/* RTG Podium, deelbestand "lijsten": WAT IEMAND TE ZIEN KRIJGT.

   Drie lijsten, en het verschil ertussen is het hele idee van de zones:

   1. kanalen(key, zone) -- de zaal van EEN wereld. Je vraagt niet "de kanalen"
      maar "de kanalen van deze wereld", en wat in een andere wereld staat komt
      hier niet voorbij, ook niet als je daar wel in mag.
   2. gedeeld(key) -- alles uit de zones die in de GEDEELDE index horen, voor de
      Media OS. Niet "alle kanalen": 18+, besloten en zaak horen daar niet in,
      en die grens staat daarom op precies een plek.
   3. mijnPodium(key) -- het eigen kanaal van de maker.

   Krijgt de gedeelde ctx van kern/podium/index.js. */
module.exports = (ctx) => {
  const { db, lijsten, kanaalVan, kijkBeeld, eigenBeeld, poort, zones, CADEAUS, GENRES } = ctx;

  /* Een zone die niet in de gedeelde index staat (besloten, zaak) toont alleen
     wat voor JOU openstaat; de 18+-zone heeft een eigen index en dus een eigen
     lijst, die nergens anders voorbijkomt. */
  function kanalen(key, zoneId) {
    const zone = zones.ZONES[zoneId] ? zoneId : zones.STANDAARD;
    const m = poort.magZone(key, zone);
    if (!m.ok) return { status: 403, error: m.reden, mag: false, zone, zones: zones.zoneLijst(key, poort) };
    lijsten();
    const rijen = db.data.podiumKanalen
      .filter(k => k.status === 'goedgekeurd' && zones.zoneVan(k) === zone)
      .filter(k => zones.ZONES[zone].index !== 'geen' || poort.magKanaal(key, k).ok)
      .map(k => kijkBeeld(k, key))
      .sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || b.kijkers - a.kijkers);
    const eigen = kanaalVan(key);
    return { status: 200, mag: true, zone, zoneNaam: zones.ZONES[zone].naam,
      zoneUitleg: zones.ZONES[zone].omschrijving, zones: zones.zoneLijst(key, poort),
      geld: zones.ZONES[zone].geld,
      /* De zaken waar dit lid de leiding heeft. Alleen daarmee kan het scherm
         de vraag stellen die de zakenwereld nodig heeft ("namens welke zaak?");
         wie nergens leidt, krijgt een lege lijst en dus geen keuze. */
      zaken: (ctx.zakenVan ? ctx.zakenVan(key) : []).filter(z => z.leiding).map(z => ({ code: z.code, naam: z.naam })),
      cadeaus: CADEAUS, genres: GENRES, kanalen: rijen, mijn: eigen ? eigenBeeld(eigen) : null };
  }

  function gedeeld(key) {
    lijsten();
    const open = Object.keys(zones.ZONES)
      .filter(z => zones.ZONES[z].index === 'gedeeld' && poort.magZone(key, z).ok);
    const rijen = db.data.podiumKanalen
      .filter(k => k.status === 'goedgekeurd' && open.includes(zones.zoneVan(k)))
      .filter(k => poort.magKanaal(key, k).ok)
      .map(k => kijkBeeld(k, key))
      .sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || b.kijkers - a.kijkers);
    return { status: 200, mag: true, zones: open, cadeaus: CADEAUS, kanalen: rijen };
  }

  /* De interne livekanalen (zone 'zaak') van de zaken waar dit lid werkt --
     de live-kant van Media for Business. Hij staat naast gedeeld() en niet
     erin: die is voor de OPENBARE index, en een town hall hoort daar niet in.
     De deur is dezelfde als overal (poort.magKanaal vergelijkt de zaakCode van
     het kanaal met de werkplekken van de kijker). */
  function zaakKanalen(key) {
    lijsten();
    return db.data.podiumKanalen
      .filter(k => k.status === 'goedgekeurd' && zones.zoneVan(k) === 'zaak')
      .filter(k => poort.magKanaal(key, k).ok)
      .map(k => kijkBeeld(k, key))
      .sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || b.kijkers - a.kijkers);
  }

  function mijnPodium(key) {
    const k = kanaalVan(key);
    return { status: 200, mag: true, kanaal: k ? eigenBeeld(k) : null,
      zones: zones.zoneLijst(key, poort),
      chat: k ? (db.data.podiumChat[k.id] || []).slice(-40) : [] };
  }

  return { kanalen, gedeeld, mijnPodium, zaakKanalen };
};
