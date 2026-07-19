/* Supplier-submodule "ai": De AI-assistent van de zaak: vraagt en doet, met de coach-regels en de
   kennis van de eigen administratie.
   Verbatim afgesplitst uit routes/supplier.js; alleen de routes, de helpers
   komen via het kern-object binnen. */
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



app.post('/api/supplier/ai', supplierAuth, async (req, res) => {
  const s = req.supplier;
  const q = String(req.body.q || '').trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: 'Stel een vraag.' });
  const ql = q.toLowerCase();
  const A = (reply, did) => res.json({ reply, did: !!did });

  // het persoonlijke geheugen (dezelfde motor als De Butler van de leden):
  // onthouden, opvragen en wissen, per persoon binnen deze zaak
  if (fluisterZeg && (/^onthoud\b/i.test(q) || /vergeet alles/i.test(q) || /wat (weet|onthoud) je (over|van) mij/i.test(q) || /plan (mijn|onze|de) (service)?dag|dagplan|servicedag/i.test(q))) {
    const fKey = 'zaak:' + s.code + ':' + (req.actor && req.actor.staffId != null ? req.actor.staffId : 'eigenaar');
    const r = await fluisterZeg(fKey, (req.actor && req.actor.name) || s.name, q);
    if (!r.error) return A(r.antwoord, !!r.geleerd);
  }

  // ---- ambtenaar: de rijks-/gemeentebalie behandelt zaken via Rahul ----
  // "ken RTG-TS-… toe", "wijs RTG-SB-… af", "verleen RTG-G-…", "zet RTG-M-… op opgelost",
  // en een concrete briefing mét referenties zodat je meteen kunt door-acteren.
  {
    const O = kern.overheid, G = kern.gemeente;
    const rijkAmbt = O && O.magBehandelen && O.magBehandelen(s);
    const gemAmbt = G && G.magBehandelen && G.magBehandelen(s);
    if (rijkAmbt || gemAmbt) {
      const wieAmbt = (req.actor && req.actor.name) || s.name;
      // let op: Nederlandse scheidbare werkwoorden ("ken … toe", "wijs … af")
      const goed = /(ken\b.*?\btoe|toeken|toekennen|keur\s+goed|goedkeur|verleen|honoreer|gegrond|toewijs|toewijzen|akkoord)/i.test(q);
      const af = /(wijs\b.*?\baf|afwijz|weiger|afkeur|ongegrond|afgewezen|afgekeurd)/i.test(q);
      const opgelost = /\b(opgelost|afgehandeld|gereed|klaar)\b/i.test(q);
      const mref = q.match(/RTG-([A-Za-z]{1,3})-[0-9A-Fa-f]{4,8}/);
      if (mref) {
        const refc = mref[0].toUpperCase(), t = mref[1].toUpperCase();
        let r = null, wat = '';
        if (rijkAmbt && t === 'TS') { r = O.toeslagBeslis(wieAmbt, refc, { besluit: goed ? 'toegekend' : af ? 'afgewezen' : 'in behandeling' }); wat = 'toeslag'; }
        else if (rijkAmbt && t === 'SZ') { r = O.uitkeringBeslis(wieAmbt, refc, { besluit: goed ? 'toegekend' : af ? 'afgewezen' : 'in behandeling' }); wat = 'uitkering'; }
        else if (rijkAmbt && t === 'SB') { r = O.subsidieBeslis(wieAmbt, refc, { besluit: goed ? 'toegekend' : af ? 'afgewezen' : 'in behandeling' }); wat = 'subsidie'; }
        else if (rijkAmbt && t === 'BZ') { r = O.bezwaarBeslis(wieAmbt, refc, { besluit: goed ? 'gegrond' : af ? 'ongegrond' : 'in behandeling' }); wat = 'bezwaar'; }
        else if (rijkAmbt && t === 'WM') { r = O.waterMeldingZet(wieAmbt, refc, { status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' }); wat = 'watermelding'; }
        else if (gemAmbt && t === 'M') { r = G.meldingZet(wieAmbt, refc, { status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' }); wat = 'melding'; }
        else if (gemAmbt && t === 'G') { r = G.vergunningBeslis(wieAmbt, refc, { besluit: goed ? 'verleend' : af ? 'geweigerd' : 'in behandeling' }); wat = 'vergunning'; }
        if (r && r.error) return A(r.error, false);
        if (r) return A('De ' + wat + ' ' + refc + ' is bijgewerkt.', true);
      } else if ((goed || af || opgelost) && /\b(eerste|eerstvolgende|volgende|deze|die)\b/i.test(q)) {
        // zonder ref: pak het eerste open item van het genoemde type
        const pak = (arr, doe, naam) => { if (!arr[0]) return A('Er staan geen ' + naam + ' open.', false); doe(arr[0].ref); return A(naam.replace(/en$/, '') + ' ' + arr[0].ref + ' is bijgewerkt.', true); };
        if (rijkAmbt && /toeslag/i.test(q)) return pak(O.toeslagenLijst({}).toeslagen, ref => O.toeslagBeslis(wieAmbt, ref, { besluit: goed ? 'toegekend' : 'afgewezen' }), 'toeslagen');
        if (rijkAmbt && /uitkering|\bww\b|bijstand|aow|kinderbijslag/i.test(q)) return pak(O.uitkeringenLijst({}).uitkeringen, ref => O.uitkeringBeslis(wieAmbt, ref, { besluit: goed ? 'toegekend' : 'afgewezen' }), 'uitkeringen');
        if (rijkAmbt && /bezwaar/i.test(q)) return pak(O.bezwarenLijst({}).bezwaren, ref => O.bezwaarBeslis(wieAmbt, ref, { besluit: goed ? 'gegrond' : 'ongegrond' }), 'bezwaren');
        if (rijkAmbt && /subsidie/i.test(q)) return pak(O.subsidiesLijst({}).subsidies, ref => O.subsidieBeslis(wieAmbt, ref, { besluit: goed ? 'toegekend' : 'afgewezen' }), 'subsidies');
        if (rijkAmbt && /watermelding|wateroverlast|verontreiniging/i.test(q)) return pak(O.waterMeldingenLijst({}).meldingen, ref => O.waterMeldingZet(wieAmbt, ref, { status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' }), 'watermeldingen');
        if (gemAmbt && /vergunning/i.test(q)) return pak(G.vergunningenLijst({}).vergunningen, ref => G.vergunningBeslis(wieAmbt, ref, { besluit: goed ? 'verleend' : 'geweigerd' }), 'vergunningen');
        if (gemAmbt && /melding/i.test(q)) return pak(G.meldingenLijst({}).meldingen, ref => G.meldingZet(wieAmbt, ref, { status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' }), 'meldingen');
      }
      // stemming openen/sluiten (rijk)
      if (rijkAmbt && /\bstemming|referendum\b/i.test(q) && /\b(sluit|dicht|stop)\b/i.test(q)) { O.verkiezingSluit(false); return A('De stemming is gesloten.', true); }
      if (rijkAmbt && /\bstemming|referendum\b/i.test(q) && /\b(open|heropen|start)\b/i.test(q)) { O.verkiezingSluit(true); return A('De stemming is heropend.', true); }
      // een briefing met referenties (geen actie, maar wel concreet en handig)
      if (/\bbriefing|overzicht|samenvatting|wat (staat|ligt|wacht)|urgent|vat .* samen\b/i.test(q)) {
        if (rijkAmbt) {
          const sec = [
            ['Toeslagen', O.toeslagenLijst({}).toeslagen.map(x => x.ref + ' ' + x.soortLabel)],
            ['Uitkeringen', O.uitkeringenLijst({}).uitkeringen.map(x => x.ref + ' ' + x.soortLabel)],
            ['Bezwaren', O.bezwarenLijst({}).bezwaren.map(x => x.ref + ' tegen ' + x.tegen)],
            ['Subsidies', O.subsidiesLijst({}).subsidies.map(x => x.ref + ' ' + x.regelingLabel)],
            ['Watermeldingen', O.waterMeldingenLijst({}).meldingen.map(x => x.ref + ' ' + x.soortLabel)]
          ];
          const txt = 'Openstaand bij de rijksbalie:\n' + sec.map(([n, a]) => '· ' + n + ' (' + a.length + ')' + (a.length ? ': ' + a.slice(0, 4).join('; ') : '')).join('\n') +
            '\n\nZeg bijv. "ken RTG-TS-… toe" of "wijs RTG-SB-… af".';
          return A(txt, false);
        }
        const meld = G.meldingenLijst({}).meldingen.map(x => x.ref + ' ' + x.categorieLabel);
        const verg = G.vergunningenLijst({}).vergunningen.map(x => x.ref + ' ' + x.soortLabel);
        const txt = 'Openstaand bij de gemeentebalie:\n· Meldingen (' + meld.length + ')' + (meld.length ? ': ' + meld.slice(0, 4).join('; ') : '') +
          '\n· Vergunningen (' + verg.length + ')' + (verg.length ? ': ' + verg.slice(0, 4).join('; ') : '') +
          '\n\nZeg bijv. "zet RTG-M-… op opgelost" of "verleen RTG-G-…".';
        return A(txt, false);
      }
    }
  }

  // ---- acties ----
  // kamerstatus: "zet <kamer> op schoon/vuil/bezig/bezet" of "meld <kamer> defect: reden"
  const hkWord = { schoon:'schoon', clean:'schoon', vuil:'vuil', dirty:'vuil', bezig:'bezig', bezet:'bezet', occupied:'bezet', defect:'defect', kapot:'defect', stuk:'defect' };
  const hkHit = Object.keys(hkWord).find(w => ql.includes(w));
  const room = aiFindRoom(s, ql);
  if (room && hkHit && /\b(zet|meld|maak|markeer|set|mark|is)\b/.test(ql)) {
    const status = hkWord[hkHit];
    const note = (q.split(/[:,]/)[1] || '').trim().slice(0, 140);
    setRoomHk(s, room, status, status === 'defect' ? (note || 'gemeld via AI') : '', req.actor);
    return A(status === 'defect'
      ? room.name + ' staat op defect: uit de verkoop en er staat een klus klaar voor onderhoud.'
      : room.name + ' staat nu op "' + status + '".', true);
  }
  // deuren: "open de voordeur" / "vergrendel machiya 1"
  if (/\b(open|vergrendel|lock|sluit)\b/.test(ql) && (s.doors || []).length) {
    const door = aiFindDoor(s, ql);
    if (door) {
      if (/\b(vergrendel|lock|sluit)\b/.test(ql)) {
        door.locked = true; door.lastBy = req.actor.name; door.lastAt = new Date().toISOString(); save();
        logActivity(s.code, req.actor, 'vergrendelde "' + door.name + '" via de AI-assistent');
        sseToSupplier(s.code, 'sync', { scope: 'doors' });
        return A(door.name + ' is vergrendeld.', true);
      }
      unlockDoor(s, door, req.actor.name);
      logActivity(s.code, req.actor, 'opende "' + door.name + '" via de AI-assistent');
      return A(door.name + ' is open en vergrendelt zichzelf over 10 seconden.', true);
    }
  }
  // klus melden: "meld klus: lamp kapot" / "nieuwe klus ..."
  const klusMatch = q.match(/(?:meld(?:\s+een)?\s+klus|nieuwe\s+klus|new\s+job)[:\s]+(.{3,})/i);
  if (klusMatch) {
    const t = addTicket(s.code, req.actor, klusMatch[1].trim(), room ? room.name : null);
    save();
    logActivity(s.code, req.actor, 'meldde een klus via de AI-assistent: ' + t.text.slice(0, 50));
    sseToSupplier(s.code, 'sync', { scope: 'rooms' });
    return A('Klus genoteerd' + (t.room ? ' voor ' + t.room : '') + ': "' + t.text + '". Onderhoud ziet hem in de klussenlijst.', true);
  }

  // ---- vragen ----
  if (/(omzet|dagtotaal|z.rapport|verdiend|revenue|kassa)/.test(ql)) {
    const p = posDay(s.code);
    const methods = Object.entries(p.byMethod).map(([m, v]) => m + ' € ' + v).join(', ');
    const open = Object.entries(p.openRooms || {}).map(([r, v]) => r + ' € ' + v.total).join(', ');
    return A('Vandaag ontvangen: € ' + p.total + ' over ' + p.count + ' bon(nen)' + (methods ? ' (' + methods + ')' : '') +
      (open ? '. Nog open op kamers: ' + open + '.' : '.'));
  }
  if (/(vuil|schoon|status|kamers?\b).*(kamer|room|status)|welke kamers/.test(ql) && (s.rooms || []).length) {
    const lines = s.rooms.map(r => r.name + ': ' + ((r.hk && r.hk.status) || 'schoon') + (r.available ? '' : ' (uit de verkoop)'));
    return A('Kamerstatus. ' + lines.join('. ') + '.');
  }
  if (/(klus|onderhoud|jobs?|tickets?)/.test(ql)) {
    const open = (db.data.tickets[s.code] || []).filter(t => t.status !== 'klaar');
    return A(open.length
      ? 'Er staan ' + open.length + ' klus(sen) open: ' + open.map(t => t.text + (t.room ? ' (' + t.room + ')' : '') + (t.status === 'bezig' ? ', wordt opgepakt' : '')).join('; ') + '.'
      : 'Er zijn geen openstaande klussen.');
  }
  if (/(onderweg|gast(en)?\b|eta|guests?)/.test(ql)) {
    const g = guestsFor(s.code);
    return A(g.length
      ? g.map(x => x.codename + (x.arrived ? ' is gearriveerd' : x.etaMin != null ? ' arriveert over ~' + x.etaMin + ' min' : ' is onderweg')).join('. ') + '.'
      : 'Er is nu geen gast live onderweg naar u.');
  }
  if (/(bericht|chat|onbeantwoord|messages?)/.test(ql)) {
    const chats = Object.values(db.data.guestChats).filter(c => c.supplierCode === s.code && c.unreadPartner > 0);
    return A(chats.length
      ? 'U heeft ' + chats.reduce((n, c) => n + c.unreadPartner, 0) + ' onbeantwoord(e) bericht(en): ' + chats.map(c => c.codename + ' (' + (c.dept || 'Team') + '): "' + c.messages[c.messages.length - 1].text.slice(0, 40) + '"').join('; ') + '.'
      : 'Alle gastberichten zijn beantwoord.');
  }
  if (/(minibar)/.test(ql) && Array.isArray(s.minibar)) {
    const today = new Date().toISOString().slice(0, 10);
    const counted = [...new Set((db.data.minibarCounts[s.code] || []).filter(e => e.at.slice(0, 10) === today).map(e => e.room))];
    const todo = (s.rooms || []).map(r => r.name).filter(n => !counted.includes(n));
    return A(todo.length ? 'Nog te tellen: ' + todo.join(', ') + '.' : 'Alle minibars zijn vandaag geteld.');
  }
  if (/(bestelling|orders?|bon(nen)?\b)/.test(ql)) {
    const open = ordersVanZaak(s.code).filter(o => !['geserveerd', 'geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status));
    return A(open.length
      ? open.length + ' open bestelling(en): ' + open.map(o => o.customerCodename + ' € ' + o.total + ' (' + o.status + ', code ' + o.pickup + ')').join('; ') + '.'
      : 'Er zijn geen open bestellingen.');
  }
  if (/(rooster|dienst|schedule|shift)/.test(ql)) {
    const wk = scheduleFor(s.code);
    const today = wk.days[0];
    return A('Vandaag: ' + today.staff.map(x => x.name + ' ' + x.shift).join('; ') + '. Het volledige rooster staat in de personeels-app.');
  }

  // vrije vraag: Rahul aan het stuur; hij beantwoordt niet alleen, hij DOET
  // (alles wat de zaak zelf kan, met de eigen inlog en de geld-drempel)
  if (kern.stuurLus) {
    const p = posDay(s.code);
    const ctx = 'Bedrijf: ' + s.name + ' (' + s.type + ', ' + s.city + '). Vandaag ontvangen: € ' + p.total + '. ' +
      'Kamers: ' + (s.rooms || []).map(r => r.name + '=' + ((r.hk && r.hk.status) || 'schoon')).join(', ') + '. ' +
      'Open klussen: ' + (db.data.tickets[s.code] || []).filter(t => t.status !== 'klaar').length + '.';
    const lus = await kern.stuurLus(req, {
      vraag: q,
      filter: pd => pd.startsWith('/api/supplier') || pd.startsWith('/api/staff'),
      systeem: require('../../kern/rahul').RAHUL_LEAD +
        'Je bent de AI-assistent van een RTG-partner (ingelogd: ' + ((req.actor && req.actor.name) || 'Beheer') + '). Context: ' + ctx
    });
    if (lus && lus.tekst) return A(lus.tekst, lus.acties.some(a => a.status < 400));
  }
  return A('Dat begrijp ik nog niet helemaal. U kunt mij bijvoorbeeld vragen: "dagomzet", "welke kamers zijn vuil", "zet Riverside suite op schoon", "meld Garden kamer defect: douche lekt", "open de voordeur", "meld klus: lamp vervangen", "wie is er onderweg", "onbeantwoorde berichten", "welke minibars nog tellen" of "open bestellingen".');
});

};
