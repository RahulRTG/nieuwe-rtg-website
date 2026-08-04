/* Horeca OS (deellaag): het managementbeeld -- omzet per kanaal, de
   dagafsluiting per betaalwijze, en de signalen die een manager 's avonds echt
   wil zien.

   Het bestaande dagrapport van de kassa (routes/supplier/kassa/premium.js)
   blijft wat het is: de X van die ene kassa. Dit is het beeld over ALLE
   kanalen die het horecasysteem kent -- tafel, bar, club, terras, afhaal,
   bezorging, roomservice, hotelrestaurant, kiosk, QR.

   Drie regels die dit beeld eerlijk houden:

   1. ELK CIJFER DRAAGT ZIJN NOEMER. Een gemiddelde besteding zonder het aantal
      bonnen is een getal waar je alles mee kunt beweren. Waar een deling in
      zit, staat de teller en de noemer erbij.
   2. FOOI IS GEEN OMZET, EN ONINBAAR VERDWIJNT NIET. Beide staan apart in het
      overzicht: de fooi omdat hij naar het personeel gaat, het oninbare omdat
      een gat in de kas geen administratieve handeling is.
   3. ER WORDT NIETS VOORSPELD WAT WE NIET METEN. Er staat geen omzetprognose
      in dit bestand. Wat er wel staat, is wat er NU open staat en wat er
      vandaag is binnengekomen -- feiten met een tijdstempel. Een voorspelling
      hoort pas te bestaan als er genoeg dagen historie zijn om hem te toetsen,
      en die belofte doen we hier niet. */
module.exports = (kern) => {
  const { app, schoon, supplierAuth, horeca } = kern;
  const { H, nu, centen, totaal, openstaand } = horeca;

  app.post('/api/supplier/horeca/dagbeeld', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const datum = schoon(req.body.datum, 10) || nu().slice(0, 10);
    const alle = Object.values(h.rekeningen);
    const vandaagGesloten = alle.filter(r => (r.geslotenAt || '').slice(0, 10) === datum);
    const betaald = vandaagGesloten.filter(r => r.status === 'betaald');
    const oninbaar = vandaagGesloten.filter(r => r.status === 'oninbaar');
    const open = alle.filter(r => r.status === 'open');

    const perKanaal = {};
    for (const r of betaald) {
      const t = totaal(r);
      const k = perKanaal[r.kanaal] || (perKanaal[r.kanaal] = { kanaal: r.kanaal, bonnen: 0, omzetCenten: 0, fooiCenten: 0, gasten: 0 });
      k.bonnen++; k.omzetCenten += t.netto; k.fooiCenten += t.fooi; k.gasten += r.gasten || 0;
    }
    for (const k of Object.values(perKanaal)) {
      k.gemiddeldePerBon = k.bonnen ? Math.round(k.omzetCenten / k.bonnen) : null;
      k.gemiddeldePerGast = k.gasten ? Math.round(k.omzetCenten / k.gasten) : null;
    }

    const perWijze = {};
    for (const r of betaald) for (const b of (r.betalingen || []))
      perWijze[b.wijze] = (perWijze[b.wijze] || 0) + centen(b.centen);

    const omzet = betaald.reduce((t, r) => t + totaal(r).netto, 0);
    const fooi = betaald.reduce((t, r) => t + totaal(r).fooi, 0);
    const korting = betaald.reduce((t, r) => t + totaal(r).korting, 0);
    const gasten = betaald.reduce((t, r) => t + (r.gasten || 0), 0);

    res.json({ ok: true, datum,
      omzetCenten: omzet, bonnen: betaald.length, gasten,
      gemiddeldePerBon: betaald.length ? Math.round(omzet / betaald.length) : null,
      gemiddeldePerGast: gasten ? Math.round(omzet / gasten) : null,
      fooiCenten: fooi, kortingCenten: korting,
      oninbaar: { bonnen: oninbaar.length, centen: oninbaar.reduce((t, r) => t + centen((r.oninbaar || {}).centen || 0), 0),
        redenen: oninbaar.map(r => (r.oninbaar || {}).reden).filter(Boolean).slice(0, 20) },
      perKanaal: Object.values(perKanaal).sort((a, b) => b.omzetCenten - a.omzetCenten),
      perBetaalwijze: perWijze,
      nogOpen: { rekeningen: open.length, centen: open.reduce((t, r) => t + openstaand(r), 0),
        oudste: open.map(r => r.geopendAt).sort()[0] || null },
      let: 'Fooi staat apart en telt niet mee in de omzet; oninbaar staat er met de redenen bij. Elk gemiddelde noemt zijn noemer.' });
  });

  /* ---------- signalen ----------
     Wat vraagt nu aandacht? Alleen dingen die uit de eigen gegevens volgen, elk
     met het getal waarop ze berusten. Geen "u zou meer moeten verkopen". */
  app.post('/api/supplier/horeca/signalen', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const uit = [];
    const nuMs = Date.now();
    const minuten = (at) => at ? Math.round((nuMs - Date.parse(at)) / 60000) : 0;

    for (const r of Object.values(h.rekeningen)) {
      if (r.status !== 'open') continue;
      const oud = minuten(r.geopendAt);
      if (oud > 180) uit.push({ soort: 'lange rekening', tafel: r.tafel || r.kanaal,
        tekst: (r.tafel || r.kanaal) + ' staat al ' + Math.round(oud / 60) + ' uur open (' + (totaal(r).netto / 100).toFixed(2) + ' euro).' });
      for (const regel of (r.regels || [])) {
        if (!regel.vrijAt || regel.stand === 'uitgegeven' || regel.stand === 'klaar') continue;
        const loopt = minuten(regel.startAt || regel.vrijAt);
        if (loopt > 40) uit.push({ soort: 'keuken', tafel: r.tafel || r.kanaal,
          tekst: regel.naam + ' voor ' + (r.tafel || r.kanaal) + ' loopt al ' + loopt + ' minuten.' });
      }
    }
    const banden = Object.values((h.club || {}).banden || {});
    const openSaldo = banden.reduce((t, b) => t + ((h.bonnen[b.bonCode] || {}).saldo || 0), 0);
    if (openSaldo) uit.push({ soort: 'polsbanden', tekst: 'Er staat nog ' + (openSaldo / 100).toFixed(2) + ' euro op ' +
      banden.filter(b => (h.bonnen[b.bonCode] || {}).saldo).length + ' polsband(en); dat is geld van gasten.' });

    const folios = Object.values(h.folios || {}).filter(f => f.status === 'open');
    const zonderNacht = folios.filter(f => !f.nachten.includes(nu().slice(0, 10)));
    if (folios.length && zonderNacht.length === folios.length)
      uit.push({ soort: 'nachtrun', tekst: 'De nachtrun van vandaag is nog niet gedraaid (' + folios.length + ' open gastrekening(en)).' });

    const ha = h.haccp || {};
    const gemist = Object.values(ha.punten || {}).filter(p => !(ha.metingen || []).some(m => m.puntId === p.id && m.datum === nu().slice(0, 10)));
    if (gemist.length) uit.push({ soort: 'haccp', tekst: gemist.length + ' meetpunt(en) zijn vandaag nog niet gemeten: ' + gemist.map(p => p.naam).join(', ') + '.' });
    const afw = (ha.metingen || []).filter(m => m.datum === nu().slice(0, 10) && m.afwijking);
    if (afw.length) uit.push({ soort: 'haccp', tekst: afw.length + ' temperatuurafwijking(en) vandaag, elk met een genoteerde actie.' });

    res.json({ ok: true, aantal: uit.length, signalen: uit.slice(0, 50),
      let: 'Elk signaal komt uit de eigen gegevens en noemt het getal waarop het berust. Er staat geen advies bij dat wij niet kunnen onderbouwen.' });
  });
};
