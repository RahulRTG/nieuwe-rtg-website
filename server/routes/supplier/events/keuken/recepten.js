/* Supplier-events-keuken (deelmodule): de receptkaart per gerecht en de
   gerechtenkennis (recept, bereiding, allergenen, pairing) op het
   keukenscherm. Draait op de gedeelde kern; gemount vanuit
   routes/supplier/events/keuken.js. */
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
  const { dagContext } = require('../../../../kern/context');

app.post('/api/supplier/menu/recipe', supplierAuth, async (req, res) => {
  const m = (req.supplier.menu || []).find(x => x.id === req.body.itemId);
  if (!m) return res.status(404).json({ error: 'Gerecht niet gevonden.' });
  let recept = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 700,
        system: 'Je bent een chef-kok die werkinstructies schrijft voor nieuwe keukenkrachten. Antwoord in het Nederlands, platte tekst, maximaal 10 korte genummerde stappen: mise en place, bereiding, afwerking en bord. Concreet, geen inleiding.',
        messages: [{ role: 'user', content: 'Gerecht: ' + m.name + (m.desc ? ' (' + m.desc + ')' : '') + '. Keuken: ' + req.supplier.name + '. Allergenen: ' + ((m.allergens || []).join(', ') || 'geen') + '.' }]
      });
      recept = String(msg.content[0].text || '').trim().slice(0, 1500);
    } catch (err) { recept = null; }
  }
  if (!recept) {
    recept = '1. Mise en place: alle ingredienten voor ' + m.name + ' afwegen en klaarzetten.\n' +
      (m.desc ? '2. Basis: ' + m.desc + '\n' : '2. Basis volgens de huisreceptuur van ' + req.supplier.name + '.\n') +
      '3. Bereiden op de eigen sectie (' + (m.sectie || 'warm') + '); tussentijds proeven.\n' +
      ((m.allergens || []).length ? '4. LET OP allergenen: ' + m.allergens.join(', ') + '. Bij een allergie-bon strikt gescheiden werken.\n' : '') +
      '5. Afwerking en garnituur; bord vegen.\n' +
      '6. Doorgeven aan de pas; chef proeft steekproefsgewijs.\n' +
      '(Laat de manager dit recept aanscherpen in het Kantoor, of zet een ANTHROPIC_API_KEY voor een uitgewerkt recept.)';
  }
  m.recept = recept;
  save();
  logActivity(req.supplier.code, req.actor, 'zette het recept van ' + m.name + ' op de bon');
  // bewust geen sync-broadcast: het scherm dat het recept opvroeg werkt zijn
  // eigen menukopie bij, andere schermen zien het bij hun eerstvolgende refresh
  res.json({ ok: true, recept, ai: !!anthropic });
});

/* De gerechtenkennis op het keukenscherm: tik op een gerecht en vraag het
   recept, de bereidingswijze, de allergenen met vervangers of een drank-
   suggestie op. Elke soort wordt een keer gemaakt (Claude waar mogelijk,
   anders een vakkundige fallback) en daarna op het gerecht bewaard. */
const KENNIS_SOORTEN = {
  recept: {
    sys: 'Je bent een chef-kok die werkinstructies schrijft voor nieuwe keukenkrachten. Antwoord in het Nederlands, platte tekst, maximaal 10 korte genummerde stappen: mise en place, bereiding, afwerking en bord. Concreet, geen inleiding.',
    val: (s, m) => '1. Mise en place: alle ingredienten voor ' + m.name + ' afwegen en klaarzetten.\n' +
      (m.desc ? '2. Basis: ' + m.desc + '\n' : '2. Basis volgens de huisreceptuur van ' + s.name + '.\n') +
      '3. Bereiden op de eigen sectie (' + (m.sectie || 'warm') + '); tussentijds proeven.\n' +
      ((m.allergens || []).length ? '4. LET OP allergenen: ' + m.allergens.join(', ') + '. Bij een allergie-bon strikt gescheiden werken.\n' : '') +
      '5. Afwerking en garnituur; bord vegen.\n6. Doorgeven aan de pas; chef proeft steekproefsgewijs.'
  },
  bereiding: {
    sys: 'Je bent een sous-chef die de bereidingswijze uitlegt aan de kok op de sectie. Antwoord in het Nederlands, platte tekst, maximaal 8 genummerde stappen met concrete temperaturen, tijden en garingspunten (pan, oven, kerntemperatuur). Sluit af met een regel over de valkuil van dit gerecht. Geen inleiding.',
    val: (s, m) => {
      const tijd = { warm: 12, snack: 8, koud: 6, dessert: 5 }[m.sectie || 'warm'] || 8;
      return '1. Sectie ' + (m.sectie || 'warm') + ', richttijd ~' + tijd + ' min per uitgifte.\n' +
        '2. Werkplek en pannen voorverwarmen; gereedschap klaar.\n' +
        (m.desc ? '3. Kern: ' + m.desc + '\n' : '3. Volg de huisbereiding van ' + s.name + '.\n') +
        '4. Garing checken (kleur, kern, textuur) voor het doorgeven.\n' +
        '5. Warm doorgeven aan de pas; niet laten staan.\n' +
        'Valkuil: te vroeg starten; kijk naar het vuurplan op de bon zodat de tafel samen uitgaat.';
    }
  },
  allergenen: {
    sys: 'Je bent een chef-kok en allergenenexpert. Antwoord in het Nederlands, platte tekst, maximaal 8 regels: welke allergenen dit gerecht bevat, hoe kruisbesmetting op de lijn voorkomen wordt, en per allergeen een volwaardig vervangend ingredient of variant. Geen inleiding.',
    val: (s, m) => {
      const al = m.allergens || [];
      if (!al.length) return 'Geen geregistreerde allergenen voor ' + m.name + '.\nBij een allergie-bon toch altijd doorvragen en strikt gescheiden werken: schone snijplank, schoon gereedschap, aparte pan.';
      return al.map(a => {
        const idee = ALT_IDEE[a];
        return '⚠ ' + a + (idee ? ': vervang met ' + idee[0] + ' (' + idee[1] + ').' : ': overleg met de chef over een vervanger.');
      }).join('\n') + '\nAltijd: schone snijplank, schoon gereedschap, aparte pan; de allergie-bon gaat als laatste check langs de pas.';
    }
  },
  pairing: {
    sys: 'Je bent een sommelier. Antwoord in het Nederlands, platte tekst, maximaal 6 regels: twee wijnsuggesties (per glas), een cocktail of mocktail en een alcoholvrij alternatief bij dit gerecht, elk met een korte reden. Geen inleiding.',
    val: (s, m) => {
      const bar = (s.menu || []).filter(x => x.station === 'bar').slice(0, 3);
      return (bar.length ? 'Van de eigen kaart: ' + bar.map(b => b.name).join(', ') + '.\n' : '') +
        'Wit en fris bij lichte en koude gerechten; rond en rood bij ' + ((m.sectie || 'warm') === 'warm' ? 'dit warme gerecht' : 'de warme kant') + '.\n' +
        'Alcoholvrij: huisgemaakte citrus-tonic of verse munt-gember.';
    }
  }
};
app.post('/api/supplier/menu/kennis', supplierAuth, async (req, res) => {
  const m = (req.supplier.menu || []).find(x => x.id === req.body.itemId);
  if (!m) return res.status(404).json({ error: 'Gerecht niet gevonden.' });
  const soort = String(req.body.soort || '');
  const def = KENNIS_SOORTEN[soort];
  if (!def) return res.status(400).json({ error: 'Onbekende kennissoort.' });
  m.kennis = m.kennis || {};
  const bestaand = soort === 'recept' ? (m.recept || m.kennis.recept) : m.kennis[soort];
  if (bestaand && !req.body.opnieuw) return res.json({ ok: true, tekst: bestaand, cached: true, ai: !!anthropic });
  let tekst = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 700, system: def.sys,
        messages: [{ role: 'user', content: 'Gerecht: ' + m.name + (m.desc ? ' (' + m.desc + ')' : '') + '. Keuken: ' + req.supplier.name + '. Sectie: ' + (m.sectie || 'warm') + '. Allergenen: ' + ((m.allergens || []).join(', ') || 'geen') + '. ' + dagContext().zin }]
      });
      tekst = String(msg.content[0].text || '').trim().slice(0, 1500);
    } catch (err) { tekst = null; }
  }
  if (!tekst) tekst = def.val(req.supplier, m);
  m.kennis[soort] = tekst;
  if (soort === 'recept') m.recept = tekst;
  save();
  logActivity(req.supplier.code, req.actor, 'vroeg ' + soort + ' van ' + m.name + ' op');
  res.json({ ok: true, tekst, ai: !!anthropic });
});

};
