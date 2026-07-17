/* Domein "supplier" (deelmodule): financien van de zaak (dagcijfers, export en de
   AI-boekhouder). Draait op de gedeelde kern. */
module.exports = (kern) => {
  const { ALT_IDEE, BOEK_KETEN, DEMO, DEMO_SUPPLIER, HK_STATUSES, LANDEN, POS_METHODS, RIT_KETEN, RIT_LEGACY, TABLE_STATUSES, VAC_SOORTEN, ZAAK_OPTIES, accounts, addTicket, aiFindDoor, aiFindRoom, alcoholGrensVan, anthropic, app, applyChatPubliek, applyChatVertaald, auth, beslisReservering, isFavoriet, broadcastSync,
    zetCollectie, zetArtikel, pasVoorraad, releaseDrop, klantProfiel, zetKlantMaten, voegKlantnotitie,
    legApart, vraagPaskamer, paskamerBreng, stuurStyling, retailVerkoop, voorraadZoek, retailState,
    RETAIL_MATEN, RETAIL_SEIZOENEN, PASPOORT_NIVEAUS, paspoortVraag, paspoortBekijk, paspoortIncident, paspoortPartner,
    cannedBoekhouder, cateringDishes, chatStuur, checkCred, coachCache, coachRules, crypto, db, ensureApplyChat, eventCovers, express, fallbackRunsheet, financeVoor, factuur, facturatie, boekhoudkennis, talen, findSupplier, gcCode, geborenVan, guestsFor, hasCred, i18n, ledenPrijs, leeftijdVan, logActivity, keyVanCodenaam, magBezorgen, haversine, etaMinutes, ticketsVoorSlot, loginFails, managerOnly, noteFailedTry, notify, notifyApplicant, notifySupplier, parseRunsheetText, pickupCode, pinFails, posDay, publicSupplier, pushLive, rememberSession, ritBezetting, ritVerder, runItem, salonNaarVolgers, salonProfielCompleet, salonItemsVan, save, scheduleFor, schoon, sectiesForOrder, sessionFor, setRoomHk, sortRunsheet, sseClients, sseSend, sseToCustomer, sseToOffice, sseToSupplier, stationsForOrder, supplierAuth, supplierState, tooManyTries, trChat, unlockDoor, weekdagFactor,
    zaakBoard, zaakZet, zaakFunctieAan, klantSalon, media,
    dpVerzoekMaak, dpVerzoekIntrek, dpOntvangsten, logInlog, pay,
    tafelplanning, reserveringTafel, reserveringKomst, walkIn, shiftSamenvatting,
    fluisterZeg, orderMetRef, ordersVanZaak, ordersVoegToe, boekingenVanZaak } = kern;

app.post('/api/supplier/finance', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  res.json(financeVoor(req.supplier));
});

/* Boekhouding exporteren: als PDF-overzicht of als CSV voor de eigen boekhouder.
   Zelf gebouwd, geen externe pakketten. */
app.post('/api/supplier/finance/export', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const f = financeVoor(req.supplier);
  const naam = req.supplier.name || 'Zaak';
  const omzetMaand = (f.btw || []).reduce((s, r) => s + (r.omzet || 0), 0);
  const loon = (f.personeel && f.personeel.totaal) || 0;
  const nettoOver = Math.round((omzetMaand - (f.btwTotaal || 0) - loon) * 100) / 100;
  if (req.body.formaat === 'csv') {
    const rijen = [['RTG boekhoudoverzicht', naam, f.maand]];
    rijen.push([]);
    rijen.push(['Btw per genre', 'omzet', 'grondslag', 'tarief %', 'btw']);
    for (const r of (f.btw || [])) rijen.push([r.label, r.omzet, r.grondslag, r.tarief, r.btw]);
    rijen.push(['Af te dragen btw', '', '', '', f.btwTotaal]);
    rijen.push([]);
    rijen.push(['Personeel', 'uren', f.personeel.uren, 'totaal', f.personeel.totaal]);
    rijen.push(['Cadeaukaarten', 'verkocht', f.giftcards.verkocht, 'openstaand', f.giftcards.open]);
    rijen.push([]);
    rijen.push(['Omzet deze maand', omzetMaand]);
    rijen.push(['Blijft over (indicatie)', nettoOver]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="RTG-boekhouding-' + f.maand + '.csv"');
    return res.send(factuur.csv(rijen));
  }
  const rijen = [];
  rijen.push({ label: 'Omzet deze maand', waarde: factuur.euroTekst(omzetMaand) });
  rijen.push({ label: 'RTG-commissie', waarde: factuur.euroTekst(0) });
  for (const r of (f.btw || [])) rijen.push({ label: 'Btw ' + r.label + ' (' + r.tarief + '%)', waarde: factuur.euroTekst(r.btw) });
  rijen.push({ label: 'Af te dragen btw', waarde: factuur.euroTekst(f.btwTotaal || 0), bold: true, streep: true });
  rijen.push({ label: 'Loonkosten (' + f.personeel.uren + ' uur)', waarde: factuur.euroTekst(loon) });
  rijen.push({ label: 'Cadeaukaarten openstaand', waarde: factuur.euroTekst(f.giftcards.open) });
  rijen.push({ label: 'Blijft over (indicatie)', waarde: factuur.euroTekst(nettoOver), bold: true, streep: true });
  const pdf = factuur.overzichtPdf(
    { titel: 'Boekhoudoverzicht ' + f.maand, periode: f.landNaam || '', opnaam: naam },
    rijen);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="RTG-boekhouding-' + f.maand + '.pdf"');
  res.send(pdf);
});

app.post('/api/supplier/accountant', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const vraag = String(req.body.question || '').trim().slice(0, 400);
  if (!vraag) return res.status(400).json({ error: 'Stel een vraag.' });
  const fin = financeVoor(req.supplier);
  const L = LANDEN[fin.land];
  const profiel = boekhoudkennis.genreProfiel(req.supplier.type);
  let answer = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 550,
        system: 'Je bent de AI-boekhouder van RTG voor ' + req.supplier.name + ' in ' + L.naam + '. Je kent de branche door en door en helpt de ondernemer concreet, met de eigen cijfers erbij. ' +
          boekhoudkennis.systeemContext(req.supplier, fin, L.naam) + ' ' +
          'Fiscale regels: ' + fin.regels.join(' ') + ' Zakelijke aftrek: ' + Object.values(L.zakelijk).join(' ') + ' ' +
          'Antwoord in het Nederlands, maximaal 150 woorden, praktisch en concreet, met een getal of percentage waar het kan, en waar passend een concrete volgende stap. Sluit af met: dit is voorlichting, geen bindend fiscaal advies.',
        messages: [{ role: 'user', content: vraag }]
      });
      answer = msg.content[0].text;
    } catch (err) { answer = null; }
  }
  if (!answer) answer = cannedBoekhouder(vraag, fin, L);
  res.json({ answer, land: fin.land, genre: profiel.label, ai: !!anthropic });
});

/* Proactieve adviezen: de AI-boekhouder stuurt de ondernemer bij op de eigen
   maandcijfers, branchegericht. Deterministisch (werkt zonder AI-sleutel); met
   een sleutel voegen we een korte, persoonlijke inleiding toe. */
app.post('/api/supplier/accountant/adviezen', supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const fin = financeVoor(req.supplier);
  const out = boekhoudkennis.adviezen(req.supplier, fin);
  let intro = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 160,
        system: 'Je bent de AI-boekhouder van RTG voor ' + req.supplier.name + ' (' + out.genre + '). Schrijf een korte, warme inleiding (maximaal 40 woorden) die de maand samenvat en de toon zet voor de adviezen hieronder. Nederlands, concreet, geen disclaimer.',
        messages: [{ role: 'user', content: 'Cijfers: omzet € ' + out.omzet + ', btw € ' + out.btw + ', loon € ' + out.loon + ', blijft over € ' + out.netto + '. Vat kort samen.' }]
      });
      intro = msg.content[0].text;
    } catch (err) { intro = null; }
  }
  res.json({ genre: out.genre, intro, adviezen: out.adviezen, cijfers: { omzet: out.omzet, btw: out.btw, loon: out.loon, netto: out.netto }, ai: !!anthropic });
});

/* De branchevragen die de AI-boekhouder voorstelt: genre-specifiek, zodat de
   ondernemer meteen ziet wat hij kan vragen. */
app.post('/api/supplier/accountant/vragen', supplierAuth, (req, res) => {
  const profiel = boekhoudkennis.genreProfiel(req.supplier.type);
  res.json({ genre: profiel.label, vragen: profiel.vragen });
});
};
