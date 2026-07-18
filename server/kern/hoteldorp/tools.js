/* De dorpstools (kern/hoteldorp): het specialistische gereedschap per
   afdeling - snelknoppen, logacties en het volledige dorpTools-overzicht dat
   elke afdeling zijn eigen werkscherm geeft. Verbatim afgesplitst uit
   kern/hoteldorp.js; de postenmotor en de meters wonen daar en komen via de
   context binnen. */
module.exports = (ctx) => {
  const { db, AFDELINGEN, METERS, posten, dorpSet } = ctx;

  const SNELKNOPPEN = {
    frontoffice: ['Late check-out', 'Vroege check-in', 'Wake-up call', 'Taxi geregeld', 'Bagage opgeslagen'],
    guest: ['Verjaardag', 'Allergie', 'Jubileum', 'Terugkerende gast', 'Reisgezelschap'],
    relations: ['Klacht geluid', 'Klacht schoonmaak', 'Compliment voor het team', 'Attentie sturen', 'Upgrade aangeboden'],
    concierge: ['Tafel reserveren', 'Transfer regelen', 'Tickets regelen', 'Boot charteren', 'Personal shopper'],
    parking: ['Voorrijden', 'Wagen wassen', 'Laadpaal aansluiten', 'Valet-inname', 'Sleutel in de kluis'],
    security: ['Ronde poolbar', 'Ronde garage', 'Deur controleren', 'Camera-check', 'Escorte naar de lobby'],
    gym: ['Handdoeken aanvullen', 'Toestel-storing', 'Personal training', 'Water aanvullen', 'Zaal reserveren'],
    spa: ['Massage 60 minuten', 'Gezichtsbehandeling', 'Sauna klaarzetten', 'Duo-behandeling', 'Laat tijdslot'],
    amenities: ['Badjassen', 'Kussenmenu', 'Kinderbedje', 'Strijkplank', 'Tandenborstel-set', 'Extra dekbed'],
    patissier: ['Verjaardagstaart', 'Turndown-zoet', 'Glutenvrij gebak', 'Fruitmand', 'Petit fours', 'Champagne-aardbeien'],
    klussen: ['Lamp vervangen', 'Kraan lekt', 'Airco maakt geluid', 'Deur klemt', 'Schilderwerk bijwerken'],
    it: ['Wifi traag', 'TV-storing', 'Keycard defect', 'Printer receptie', 'Kassa hangt'],
    sales: ['Bedrijfsuitje', 'Bruiloft-aanvraag', 'Groepsboeking', 'Site inspection', 'Partnerdeal'],
    events: ['Bruiloft', 'Congres', 'Verjaardagsfeest', 'Sunset dinner', 'DJ boeken'],
    florist: ['Lobby-boeket', 'Tafelstukken', 'Bruidswerk', 'Roos op de kamer', 'Plantenservice'],
    kidsclub: ['Kind aanmelden', 'Lunch voor de kids', 'Zwemles', 'Knutselmiddag', 'Ophaalmelding'],
    watersport: ['Paddleboard', 'Jetski', 'Snorkelset', 'Zeiltocht', 'Kajak'],
    entree: ['Op de gastenlijst', 'Groep aan de deur', 'ID-check', 'Stempel en bandje', 'Taxi voor een gast'],
    garderobe: ['Jas aangenomen', 'Tas aangenomen', 'Helm aangenomen', 'Nummer zoekgeraakt', 'Gevonden voorwerp'],
    bar: ['IJs aanvullen', 'Glazen bijvullen', 'Fust wisselen', 'Garnering snijden', '86 doorgeven'],
    vip: ['Tafel reserveren', 'Fles op tafel', 'Sparklers', 'Verjaardag op tafel', 'Rekening op tafel'],
    dj: ['Verzoekje', 'Set wisselen', 'Mic voor de MC', 'Happy birthday inzetten', 'Volume-klacht'],
    techniek: ['Licht valt uit', 'Geluid valt weg', 'Rookmachine bijvullen', 'Monitor stuk', 'Kabel tapen'],
    vloer: ['Glaswerk ophalen', 'Dweilen bij de bar', 'Toiletten checken', 'Asbakken legen', 'Terras vegen'],
    promo: ['Story met de line-up', 'Post voor vanavond', 'Gastenlijst-actie', 'Flyer-team sturen', 'Fotograaf boeken'],
    inkoop: ['Drank bijbestellen', 'IJs bestellen', 'Rietjes en bekers', 'Schoonmaakmiddel', 'Leverancier bellen'],
    kantoor: ['Facturen inboeken', 'Rooster rondsturen', 'Kas opmaken', 'Vergunning checken', 'Post verwerken'],
    host: ['Tafel voor twee', 'Groep aangemeld', 'Op de wachtlijst', 'Kinderstoel klaarzetten', 'Taxi voor een gast'],
    bediening: ['Extra couvert', 'Wijnadvies gevraagd', 'Allergie doorgeven', 'Kaarsje bij het dessert', 'Rekening gevraagd'],
    keuken: ['86 doorgeven', 'Mise en place bijna op', 'Spoedbon', 'Speciale wens', 'Pas op: allergie'],
    ligbedden: ['Bed reserveren', 'Handdoeken brengen', 'Parasol bijzetten', 'IJsemmer brengen', 'Bed ombouwen voor de avond']
  };
  const LOGACTIES = {
    frontoffice: 'Overdracht gedaan', guest: 'Voorkeuren bijgewerkt', relations: 'Belrondje gedaan',
    concierge: 'Tips bijgewerkt', parking: 'Garage-ronde gelopen', security: 'Ronde gelopen',
    gym: 'Zaal gecheckt', spa: 'Cabines klaargezet', amenities: 'Voorraadkast geteld',
    patissier: 'Vitrine gevuld', klussen: 'Werkplaats opgeruimd', it: 'Back-up gecontroleerd',
    sales: 'Follow-ups gedaan', events: 'Draaiboek doorgenomen', florist: 'Water ververst',
    kidsclub: 'Koppen geteld', watersport: 'Materiaal geteld',
    entree: 'Rij geteld', garderobe: 'Rekken geteld', bar: 'Bar gespoeld',
    vip: 'Tafels gecheckt', dj: 'Set gewisseld', techniek: 'Rondje techniek gelopen',
    vloer: 'Rondje vloer gelopen', promo: 'Bereik gecheckt', inkoop: 'Voorraad geteld',
    kantoor: 'Administratie bijgewerkt',
    host: 'Boek doorgenomen', bediening: 'Ronde langs de tafels', keuken: 'Doorgifte gecheckt',
    ligbedden: 'Rijen geteld'
  };

  function dorpTools(s, key) {
    const afd = (dorpSet(s) || []).includes(key) ? AFDELINGEN[key] : null;
    if (!afd) return { status: 400, error: 'Onbekende afdeling.' };
    const alle = posten(s).filter(p => p.afdeling === key);
    const vandaag = new Date().toISOString().slice(0, 10);
    const opDag = iso => String(iso || '').slice(0, 10) === vandaag;
    const minuten = iso => Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
    const eind = afd.keten[afd.keten.length - 1];
    const open = alle.filter(p => p.status !== eind);
    const tools = [];

    // 1. de dagcijfers: nieuw, afgerond en open, voor elke afdeling hetzelfde
    tools.push({ type: 'cijfers', titel: 'Vandaag', items: [
      { label: 'nieuw', waarde: alle.filter(p => opDag(p.at)).length },
      { label: 'afgerond', waarde: alle.filter(p => p.status === eind && opDag(p.updatedAt)).length },
      { label: 'open', waarde: open.length }
    ] });

    // 2. het vakspecifieke bord
    if (key === 'frontoffice') {
      const van = (db.data.verblijven || []).filter(v => v.supplierCode === s.code);
      tools.push({ type: 'cijfers', titel: 'Dagstaat', items: [
        { label: 'aankomsten', waarde: van.filter(v => v.status === 'bevestigd' && v.aankomst <= vandaag).length },
        { label: 'vertrekken', waarde: van.filter(v => v.status === 'ingecheckt' && v.vertrek <= vandaag).length },
        { label: 'in huis', waarde: van.filter(v => v.status === 'ingecheckt').length },
        { label: 'bezet', waarde: (s.rooms || []).filter(r => r.hk && r.hk.status === 'bezet').length + '/' + (s.rooms || []).length },
        { label: 'aanvragen', waarde: van.filter(v => v.status === 'aangevraagd').length }
      ] });
    }
    if (key === 'guest') {
      const inHuis = (db.data.verblijven || []).filter(v => v.supplierCode === s.code && v.status === 'ingecheckt');
      tools.push({ type: 'lijst', titel: 'Gastenkaart, wie slaapt er', leeg: 'Niemand in huis.',
        rijen: inHuis.slice(0, 20).map(v => ({ icoon: String.fromCodePoint(0x1F6CF), tekst: v.codenaam + ' - ' + v.roomName,
          sub: posten(s).filter(p => p.waar && v.roomName.toLowerCase().includes(p.waar.toLowerCase().split(',')[0].trim()) && p.waar.length > 2).slice(0, 4)
            .map(p => ((AFDELINGEN[p.afdeling] || {}).icon || '') + ' ' + p.tekst + ' (' + p.status + ')').join(' - '),
          rechts: 'tot ' + v.vertrek })) });
    }
    if (key === 'relations') {
      tools.push({ type: 'lijst', titel: 'Vandaag nabellen', leeg: 'Niemand om na te bellen.',
        rijen: alle.filter(p => p.status === 'opgelost').map(p => ({ icoon: String.fromCodePoint(0x1F4DE), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst })) });
    }
    if (key === 'concierge') {
      tools.push({ type: 'lijst', titel: 'Vandaag geregeld', leeg: 'Nog niets geregeld vandaag.',
        rijen: alle.filter(p => p.status === eind && opDag(p.updatedAt)).slice(0, 8).map(p => ({ icoon: String.fromCodePoint(0x2728), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst })) });
    }
    if (key === 'parking') {
      tools.push({ type: 'lijst', titel: 'Voorrijd-wachtrij', leeg: 'Niemand wacht.',
        rijen: alle.filter(p => p.status === 'voorrijden').sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
          .map(p => ({ icoon: String.fromCodePoint(0x1F697), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.updatedAt) + ' min', rood: minuten(p.updatedAt) >= 5 })) });
      tools.push({ type: 'cijfers', titel: 'Garage', items: [{ label: 'gestald', waarde: alle.filter(p => p.status === 'geparkeerd').length }] });
    }
    if (key === 'security') {
      const rondes = alle.filter(p => /ronde/i.test(p.tekst) && p.status === eind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      tools.push({ type: 'lijst', titel: 'Rondeklok', leeg: 'Nog geen ronde gelopen vandaag.',
        rijen: rondes.slice(0, 3).map(p => ({ icoon: String.fromCodePoint(0x1F6E1), tekst: p.tekst + ' (' + p.door + ')', rechts: minuten(p.updatedAt) + ' min' })) });
    }
    if (key === 'spa') {
      tools.push({ type: 'lijst', titel: 'Dagagenda', leeg: 'Geen afspraken.',
        rijen: open.slice().sort((a, b) => (a.waar || '').localeCompare(b.waar || '')).map(p => ({ icoon: String.fromCodePoint(0x1F486), tekst: (p.waar || '?') + ' - ' + p.tekst, rechts: p.status })) });
    }
    if (key === 'amenities') {
      tools.push({ type: 'lijst', titel: 'Onderweg naar de kamers', leeg: 'Niets onderweg.',
        rijen: alle.filter(p => p.status === 'onderweg').map(p => ({ icoon: String.fromCodePoint(0x1F9F4), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst })) });
    }
    if (key === 'patissier') {
      tools.push({ type: 'lijst', titel: 'In de maak', leeg: 'De oven is leeg.',
        rijen: alle.filter(p => p.status === 'in de maak').map(p => ({ icoon: String.fromCodePoint(0x1F370), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst })) });
    }
    if (key === 'klussen') {
      tools.push({ type: 'lijst', titel: 'Defecten uit housekeeping', leeg: 'Geen kamers defect gemeld.',
        rijen: (s.rooms || []).filter(r => r.hk && r.hk.status === 'defect').map(r => ({ icoon: String.fromCodePoint(0x26A0), tekst: r.kamer || r.name, sub: (r.hk && r.hk.note) || '', rood: true })) });
    }
    if (key === 'it') {
      tools.push({ type: 'lijst', titel: 'Storingen open', leeg: 'Alles draait.',
        rijen: open.map(p => ({ icoon: String.fromCodePoint(0x1F5A5), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) >= 60 ? Math.round(minuten(p.at) / 60) + ' uur' : minuten(p.at) + ' min', rood: minuten(p.at) >= 60 })) });
    }
    if (key === 'sales' || key === 'events') {
      tools.push({ type: 'cijfers', titel: 'Pijplijn', items: afd.keten.map(fase => ({ label: fase, waarde: alle.filter(p => p.status === fase).length })) });
      if (key === 'events') tools.push({ type: 'lijst', titel: 'Eerstvolgend', leeg: 'Niets gepland.',
        rijen: open.slice().sort((a, b) => (a.waar || '').localeCompare(b.waar || '')).slice(0, 5).map(p => ({ icoon: String.fromCodePoint(0x1F3AA), tekst: (p.waar || '?') + ' - ' + p.tekst, rechts: p.status })) });
    }
    if (key === 'florist') {
      tools.push({ type: 'lijst', titel: 'Toe aan vers', leeg: 'Alles staat er vers bij.',
        rijen: alle.filter(p => p.status === eind && minuten(p.updatedAt) > 5 * 1440).map(p => ({ icoon: String.fromCodePoint(0x1F490), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: Math.round(minuten(p.updatedAt) / 1440) + ' dagen', rood: true })) });
    }
    if (key === 'kidsclub') {
      tools.push({ type: 'lijst', titel: 'Presentielijst', leeg: 'Geen kinderen binnen.',
        rijen: alle.filter(p => p.status === 'binnen').map(p => ({ icoon: String.fromCodePoint(0x1F9F8), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: Math.round(minuten(p.updatedAt) / 6) / 10 + ' uur' })) });
    }
    if (key === 'watersport') {
      tools.push({ type: 'lijst', titel: 'Op het water', leeg: 'Iedereen is binnen.',
        rijen: alle.filter(p => p.status === 'op het water').map(p => ({ icoon: String.fromCodePoint(0x1F3C4), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.updatedAt) + ' min' + (minuten(p.updatedAt) > 120 ? ' !' : ''), rood: minuten(p.updatedAt) > 120 })) });
    }
    // de borden van het clubdorp: van de deur tot het kantoor
    if (key === 'entree') {
      tools.push({ type: 'cijfers', titel: 'Deurstaat', items: [
        { label: 'op de lijst', waarde: alle.filter(p => p.status === 'op de lijst').length },
        { label: 'aan de deur', waarde: alle.filter(p => p.status === 'aan de deur').length },
        { label: 'binnen vanavond', waarde: alle.filter(p => p.status === eind && opDag(p.updatedAt)).length }
      ] });
      tools.push({ type: 'lijst', titel: 'Gastenlijst', leeg: 'Nog niemand op de lijst.',
        rijen: alle.filter(p => p.status === 'op de lijst').slice(0, 12).map(p => ({ icoon: String.fromCodePoint(0x1F4CB), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst })) });
    }
    if (key === 'garderobe') {
      const hangt = alle.filter(p => p.status === 'in bewaring');
      tools.push({ type: 'lijst', titel: 'In bewaring (' + hangt.length + ')', leeg: 'De rekken zijn leeg.',
        rijen: hangt.slice(0, 12).map(p => ({ icoon: String.fromCodePoint(0x1F9E5), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) >= 60 ? Math.round(minuten(p.at) / 60) + ' uur' : minuten(p.at) + ' min' })) });
    }
    if (key === 'bar') {
      tools.push({ type: 'lijst', titel: 'Aanvullen en 86', leeg: 'De bar staat er strak bij.',
        rijen: open.map(p => ({ icoon: String.fromCodePoint(0x1F378), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min', rood: minuten(p.at) > 30 })) });
    }
    if (key === 'vip') {
      tools.push({ type: 'lijst', titel: 'Tafels vanavond', leeg: 'Nog geen tafels geboekt.',
        rijen: open.slice().sort((a, b) => (a.waar || '').localeCompare(b.waar || '')).map(p => ({ icoon: String.fromCodePoint(0x1F37E), tekst: (p.waar || '?') + ' - ' + p.tekst, rechts: p.status })) });
    }
    if (key === 'dj') {
      tools.push({ type: 'lijst', titel: 'Verzoekjes in de wachtrij', leeg: 'Geen verzoekjes; de dj bepaalt.',
        rijen: alle.filter(p => p.status === 'in de wachtrij').map(p => ({ icoon: String.fromCodePoint(0x1F3B5), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min' })) });
    }
    if (key === 'techniek') {
      tools.push({ type: 'lijst', titel: 'Storingen open', leeg: 'Licht en geluid draaien.',
        rijen: open.map(p => ({ icoon: String.fromCodePoint(0x1F39B), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min', rood: minuten(p.at) >= 30 })) });
    }
    if (key === 'vloer') {
      tools.push({ type: 'lijst', titel: 'Meldingen op de vloer', leeg: 'De vloer ligt er netjes bij.',
        rijen: open.map(p => ({ icoon: String.fromCodePoint(0x1F9F9), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min', rood: minuten(p.at) > 20 })) });
      // de bijvullijst van de runners: alles wat de bar open heeft staan
      const barEind = AFDELINGEN.bar.keten[AFDELINGEN.bar.keten.length - 1];
      const bijvul = posten(s).filter(p => p.afdeling === 'bar' && p.status !== barEind);
      tools.push({ type: 'lijst', titel: 'Bijvullen voor de bar', leeg: 'De bar vraagt niets; loop je ronde.',
        rijen: bijvul.map(p => ({ icoon: String.fromCodePoint(0x1F4E6), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min', rood: minuten(p.at) > 30 })) });
    }
    if (key === 'promo') {
      tools.push({ type: 'cijfers', titel: 'Campagnebord', items: afd.keten.map(fase => ({ label: fase, waarde: alle.filter(p => p.status === fase).length })) });
    }
    if (key === 'inkoop') {
      tools.push({ type: 'lijst', titel: 'Onderweg naar de zaak', leeg: 'Niets onderweg.',
        rijen: alle.filter(p => p.status === 'onderweg').map(p => ({ icoon: String.fromCodePoint(0x1F69A), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst })) });
    }
    if (key === 'kantoor') {
      tools.push({ type: 'lijst', titel: 'Ligt op het bureau', leeg: 'Het bureau is leeg.',
        rijen: open.slice().sort((a, b) => a.at.localeCompare(b.at)).map(p => ({ icoon: String.fromCodePoint(0x1F5C2), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) >= 1440 ? Math.round(minuten(p.at) / 1440) + ' dagen' : minuten(p.at) >= 60 ? Math.round(minuten(p.at) / 60) + ' uur' : minuten(p.at) + ' min', rood: minuten(p.at) >= 1440 })) });
    }
    // de borden van het restaurantdorp en het strand
    if (key === 'host') {
      tools.push({ type: 'lijst', titel: 'Het boek van vandaag', leeg: 'Nog geen reserveringen op het bord.',
        rijen: open.slice().sort((a, b) => (a.waar || '').localeCompare(b.waar || '')).map(p => ({ icoon: String.fromCodePoint(0x1F4D6), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: p.status })) });
    }
    if (key === 'bediening') {
      tools.push({ type: 'lijst', titel: 'Tafels die iets vragen', leeg: 'Alle tafels zijn geholpen.',
        rijen: open.map(p => ({ icoon: String.fromCodePoint(0x1F937), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min', rood: minuten(p.at) > 10 })) });
    }
    if (key === 'keuken') {
      tools.push({ type: 'lijst', titel: 'Doorgiftes en 86', leeg: 'De pas is stil.',
        rijen: open.map(p => ({ icoon: String.fromCodePoint(0x1F52A), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min', rood: /86|allergie/i.test(p.tekst) })) });
    }
    if (key === 'ligbedden') {
      tools.push({ type: 'cijfers', titel: 'Strandstaat', items: [
        { label: 'gereserveerd', waarde: alle.filter(p => p.status === 'gereserveerd').length },
        { label: 'bezet', waarde: alle.filter(p => p.status === 'bezet').length },
        { label: 'vrijgegeven vandaag', waarde: alle.filter(p => p.status === eind && opDag(p.updatedAt)).length }
      ] });
      tools.push({ type: 'lijst', titel: 'Nu op het strand', leeg: 'De bedden zijn vrij.',
        rijen: alle.filter(p => p.status === 'bezet').slice(0, 12).map(p => ({ icoon: String.fromCodePoint(0x1F3D6), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.updatedAt) >= 60 ? Math.round(minuten(p.updatedAt) / 60) + ' uur' : minuten(p.updatedAt) + ' min' })) });
    }
    // security checkt leeftijden aan de deur: ja/nee op codenaam, zonder
    // gegevens (de paspoort-bevestiging doet het echte werk en logt alles)
    if (key === 'security' || key === 'entree') {
      tools.push({ type: 'leeftijd', titel: 'Leeftijdscheck', hint: 'Codenaam van de gast; het lid krijgt automatisch een melding van de check.' });
    }

    // 3. de bewaking: wat langer dan vier uur open staat, kleurt rood
    tools.push({ type: 'lijst', titel: 'Staat te lang open', leeg: 'Niets staat te lang open.',
      rijen: open.filter(p => minuten(p.at) > 240).map(p => ({ icoon: String.fromCodePoint(0x23F0), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: Math.round(minuten(p.at) / 60) + ' uur', rood: true })) });
    // 4. snelknoppen voor het veelgevraagde werk
    tools.push({ type: 'knoppen', titel: 'Veelgevraagd', knoppen: SNELKNOPPEN[key] || [] });
    // 5. het logmoment: een tik en het staat geklokt (direct afgerond)
    tools.push({ type: 'actie', titel: 'Logmoment', knop: LOGACTIES[key] || 'Gedaan', tekst: LOGACTIES[key] || 'Gedaan' });
    // 6. de eigen meter van de afdeling
    const m = METERS[key] || METERS.standaard;
    tools.push({ type: 'meter', titel: m.titel, opties: m.opties, stand: ((s.dorpStanden || {})[key]) || (key === 'gym' ? s.gymDrukte : null) || null });

    return { ok: true, afdeling: key, tools };
  }

  // de meter van een afdeling: een stand, gezet door wie er staat

  return { dorpTools };
};
