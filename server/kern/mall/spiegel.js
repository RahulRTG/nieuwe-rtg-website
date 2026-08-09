/* RTG Mall, deelbestand "spiegel": ZO STAAT U IN DE MALL.

   Een ondernemer werkt in zijn eigen systeem en ziet nooit wat daar aan de
   Mall-kant van terechtkomt. Dat is precies waar stille drift ontstaat: een
   zaak die denkt dat ze vindbaar is terwijl haar artikelen op nul staan, of
   die nooit in "Nu open" verschijnt omdat er geen openingstijden zijn
   ingevuld.

   Dit is dus geen dashboard met cijfers maar een spiegel: wat toont de Mall
   van u, welke stand leest zij uit uw eigen agenda en voorraad, en wat mist er
   nog. Bewust GEEN bezoekersaantallen of conversie -- dat is een
   leverancierdashboard en een eigen beslissing met een eigen privacyvraag. De
   zoekwoorden die er wel bij staan komen uit ./vraagbeeld.js en zijn per woord
   geteld, nooit per persoon. */
module.exports = (ctx) => {
  const { plek: P, stand, aanbodAlles } = ctx;

  /* "Zo staat u in de Mall" -- de andere kant van de koppeling.

     Een ondernemer werkt in zijn eigen systeem en ziet nooit wat daar aan de
     Mall-kant van terechtkomt. Dat is precies waar stille drift ontstaat: een
     zaak die denkt dat ze vindbaar is terwijl haar artikelen op nul staan, of
     die nooit in "Nu open" verschijnt omdat er geen openingstijden zijn
     ingevuld. Deze weergave is dus geen dashboard met cijfers maar een
     spiegel: wat toont de Mall van u, en wat mist er nog.

     Bewust GEEN zoekvragen, bezoekersaantallen of conversie: die horen bij een
     leverancierdashboard en dat is een eigen beslissing met een eigen
     privacyvraag. Dit toont alleen wat er van deze zaak zelf al bekend is. */
  function spiegelVanZaak(code) {
    const s = (ctx.db.data.suppliers || []).find(x => x.code === String(code || ''));
    if (!s) return { status: 404, error: 'Zaak niet gevonden.' };
    const { aanbod } = aanbodAlles();
    const mijn = aanbod.filter(a => a.aanbieder.code === s.code);
    const st = stand.openNu(s);
    const uren = stand.vakUrenVan(s);
    const uit = mijn.filter(a => a.beschikbaar && a.beschikbaar.uit);

    /* Wat er ontbreekt, met de reden erbij. Elke regel is iets dat de
       ondernemer zelf in zijn eigen systeem kan oplossen; een lijst met
       verwijten zonder handeling erachter hoort hier niet. */
    const ontbreekt = [];
    if (st.open === null) ontbreekt.push({ wat: 'openingstijden', gevolg: 'U verschijnt niet in het filter "Nu open".', waar: 'uw agenda' });
    if (!mijn.length) ontbreekt.push({ wat: 'aanbod', gevolg: 'U staat wel in de Mall, maar zonder iets dat te vinden is.', waar: 'uw kaart, artikelen of diensten' });
    if (uit.length) ontbreekt.push({ wat: 'voorraad', gevolg: uit.length + (uit.length === 1 ? ' artikel staat' : ' artikelen staan') + ' als uitverkocht in de Mall.', waar: 'uw voorraad' });
    if (!(s.mall && s.mall.bereik)) ontbreekt.push({ wat: 'werkgebied', gevolg: 'De Mall neemt aan wat uw genre meebrengt; u staat mogelijk in te weinig of te veel plaatsen.', waar: 'uw Mall-instellingen' });
    const zone = stand.zoneVoor(s);
    if (zone.aangenomen) ontbreekt.push({ wat: 'tijdzone', gevolg: 'De Mall rekent met ' + zone.zone + '; staat u elders, dan klopt "Nu open" niet.', waar: 'uw zaakinstellingen' });

    return {
      ok: true,
      zaak: { code: s.code, naam: s.name, stad: s.city || null, genre: s.type },
      aanbod: mijn.map(a => ({ id: a.id, titel: a.titel, type: a.type, typeLabel: a.typeLabel,
        verdieping: a.verdieping, prijs: a.prijs, beschikbaar: a.beschikbaar, pagina: a.pagina })),
      aantal: mijn.length,
      stand: { open: st, uren: uren || null, neemtBestellingen: stand.neemtAan(s, 'orders'), neemtReserveringen: stand.neemtAan(s, 'reserveren') },
      tijdzone: stand.zoneVoor(s),
      extern: stand.extern.stand(s),
      bereik: P.bereikVan(s),
      ontbreekt,
      bron: stand.bronnen(),
      vraag: ctx.vraagbeeld ? ctx.vraagbeeld.voorZaak(s) : null,
      opmerking: 'Wat u in uw eigen systeem verandert, verandert hier mee: de Mall leest dezelfde rijen. Er is geen tweede administratie.'
    };
  }

  return { mallVoorZaak: spiegelVanZaak };
};
