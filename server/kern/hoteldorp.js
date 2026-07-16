/* Het hoteldorp (toren hotel): een hotel is een dorp apart. Negen afdelingen
   krijgen hetzelfde lichte gereedschap: een eigen postenlijst met een korte,
   eigen statusketen. Een post is altijd "waar + wat + wie", en een tik zet
   hem een stap verder in de keten. Het dorpsplein telt alles bij elkaar op,
   zodat de leiding in een oogopslag ziet welke afdeling aandacht vraagt.

   Bewust EEN motor voor alle afdelingen: de conciergewens, de voorrijklus
   van parking, de spa-afspraak en de wifi-storing zijn hetzelfde ding met
   een andere keten. Dat houdt de vloer voorspelbaar (alles werkt hetzelfde)
   en de code klein. */

const AFDELINGEN = {
  frontoffice: { label: 'Front office', icon: '🛎️', waar: 'Kamer of plek', wat: 'Overdracht of actie, bijv. late check-out geregeld', keten: ['open', 'klaar'] },
  guest: { label: 'Guest manager', icon: '🤝', waar: 'Kamer', wat: 'Voorkeur of bijzonderheid, bijv. verjaardag morgen', keten: ['open', 'opgevolgd'] },
  relations: { label: 'Guest relations', icon: '🌹', waar: 'Kamer of gast', wat: 'Signaal, bijv. klacht over geluid, compliment voor het team', keten: ['gemeld', 'in gesprek', 'opgelost', 'nagebeld'] },
  concierge: { label: 'Concierge', icon: '🎩', waar: 'Kamer', wat: 'Wens van de gast, bijv. tafel voor twee om 21:00', keten: ['open', 'bezig', 'geregeld'] },
  parking: { label: 'Parking', icon: '🚗', waar: 'Plek, bijv. P2-14', wat: 'Auto en kamer, bijv. blauwe Defender, Sea-view suite', keten: ['geparkeerd', 'voorrijden', 'staat voor'] },
  security: { label: 'Security', icon: '🛡️', waar: 'Plek', wat: 'Melding of ronde, bijv. poolronde gelopen', keten: ['gemeld', 'bezig', 'afgehandeld'] },
  gym: { label: 'Gym', icon: '🏋️', waar: 'Toestel of zaal', wat: 'Melding, bijv. loopband 2 piept', keten: ['open', 'klaar'] },
  spa: { label: 'Spa', icon: '💆', waar: 'Tijd en kamer, bijv. 15:00, Garden kamer', wat: 'Behandeling, bijv. massage 60 minuten', keten: ['gepland', 'bezig', 'klaar'] },
  amenities: { label: 'Amenities', icon: '🧴', waar: 'Kamer', wat: 'Aanvulling of attentie, bijv. badjassen maat L, kussenmenu', keten: ['gevraagd', 'onderweg', 'op de kamer'] },
  patissier: { label: 'Patissier', icon: '🍰', waar: 'Voor wanneer en waar, bijv. 19:00, Sea-view suite', wat: 'Bestelling, bijv. verjaardagstaart voor acht', keten: ['besteld', 'in de maak', 'klaar', 'geserveerd'] },
  klussen: { label: 'Klusjesman', icon: '🔧', waar: 'Plek', wat: 'Klus, bijv. lamp op het terras vervangen', keten: ['open', 'bezig', 'klaar'] },
  it: { label: 'IT', icon: '🖥️', waar: 'Systeem of plek', wat: 'Storing, bijv. wifi in de lobby traag', keten: ['open', 'bezig', 'opgelost'] },
  sales: { label: 'Sales', icon: '📈', waar: 'Bedrijf of contact', wat: 'Lead, bijv. bedrijfsuitje twintig personen in september', keten: ['lead', 'offerte', 'gewonnen'] },
  events: { label: 'Events', icon: '🎪', waar: 'Datum en zaal', wat: 'Aanvraag, bijv. bruiloft 12 september, tachtig gasten', keten: ['aanvraag', 'voorstel', 'bevestigd', 'gedraaid'] },
  florist: { label: 'Florist', icon: '💐', waar: 'Waar het komt te staan', wat: 'Bestelling, bijv. boeket lobby en tafelstukken terras', keten: ['besteld', 'gemaakt', 'geplaatst'] },
  kidsclub: { label: 'Kids club', icon: '🧸', waar: 'Kind en kamer', wat: 'Aanmelding, bijv. Mia (6), Garden kamer, tot 16:00', keten: ['aangemeld', 'binnen', 'opgehaald'] },
  watersport: { label: 'Watersport', icon: '🏄', waar: 'Wie en wat', wat: 'Boeking, bijv. twee paddleboards, 14:00', keten: ['geboekt', 'op het water', 'terug'] }
};

module.exports = ({ db, save, crypto, schoon, sseToSupplier, notifySupplier, haversine }) => {
  const nu = () => new Date().toISOString();
  const posten = s => (s.hotelPosten = Array.isArray(s.hotelPosten) ? s.hotelPosten : []);

  function dorpPost(s, afdelingIn, waar, tekst, wie, directKlaar) {
    const key = String(afdelingIn || '');
    const afd = AFDELINGEN[key];
    if (!afd) return { status: 400, error: 'Onbekende afdeling.' };
    const wat = schoon(tekst, 140);
    if (!wat) return { status: 400, error: 'Schrijf kort op wat er speelt.' };
    const post = {
      id: crypto.randomBytes(4).toString('hex'), afdeling: key,
      waar: schoon(waar, 60) || '', tekst: wat,
      // directKlaar is voor logmomenten (een gelopen ronde): meteen afgerond
      status: directKlaar ? afd.keten[afd.keten.length - 1] : afd.keten[0],
      door: schoon(wie, 40) || 'team',
      at: nu(), updatedAt: nu()
    };
    posten(s).unshift(post);
    if (s.hotelPosten.length > 500) s.hotelPosten.length = 500;
    save();
    // security is de enige afdeling waar een nieuwe post meteen mag rinkelen
    if (key === 'security') try { notifySupplier(s.code, { icon: '🛡️', title: 'Security: ' + (post.waar || 'melding'), body: post.tekst + ' (' + post.door + ')' }); } catch (e) {}
    sseToSupplier(s.code, 'sync', { scope: 'dorp' });
    return { ok: true, post };
  }

  function dorpVerder(s, id, wie) {
    const post = posten(s).find(p => p.id === id);
    if (!post) return { status: 404, error: 'Post niet gevonden.' };
    const keten = (AFDELINGEN[post.afdeling] || { keten: ['open', 'klaar'] }).keten;
    const i = keten.indexOf(post.status);
    if (i < 0 || i >= keten.length - 1) return { status: 409, error: 'Deze post is al ' + post.status + '.' };
    post.status = keten[i + 1];
    post.door = schoon(wie, 40) || post.door;
    post.updatedAt = nu();
    save();
    sseToSupplier(s.code, 'sync', { scope: 'dorp' });
    return { ok: true, post };
  }

  /* Afdelingen praten met elkaar: een post reist door naar een andere
     afdeling en begint daar vooraan in de keten, met het spoor erbij
     ("via guest relations"). Zo wordt een klacht over een kapotte kraan
     met een tik een klus, en een conciergewens een spa-afspraak. */
  function dorpStuurDoor(s, id, naarIn, wie) {
    const post = posten(s).find(p => p.id === id);
    if (!post) return { status: 404, error: 'Post niet gevonden.' };
    const naar = String(naarIn || '');
    const afd = AFDELINGEN[naar];
    if (!afd) return { status: 400, error: 'Onbekende afdeling.' };
    if (naar === post.afdeling) return { status: 409, error: 'De post staat al bij ' + afd.label + '.' };
    const vanLabel = (AFDELINGEN[post.afdeling] || { label: post.afdeling }).label;
    post.via = Array.isArray(post.via) ? post.via : [];
    post.via.push(vanLabel);
    if (post.via.length > 6) post.via = post.via.slice(-6);
    post.afdeling = naar;
    post.status = afd.keten[0];
    post.door = schoon(wie, 40) || post.door;
    post.updatedAt = nu();
    save();
    sseToSupplier(s.code, 'sync', { scope: 'dorp' });
    return { ok: true, post };
  }

  /* De buurt op het conciergescherm: alles wat om de hoek ligt (restaurants,
     activiteiten, verhuur, watersport...) op afstand gesorteerd, zodat de
     concierge met een tik een naam en een afstand bij de hand heeft. */
  function dorpBuurt(s) {
    if (!s.loc) return { ok: true, buurt: [] };
    const types = db.data.supplierTypes || {};
    const buurt = (db.data.suppliers || [])
      .filter(x => x.code !== s.code && x.loc && x.loc.lat != null)
      .map(x => ({
        code: x.code, naam: x.name, stad: x.city,
        soort: (types[x.type] || {}).label || x.type,
        icon: (types[x.type] || {}).icon || '📍',
        km: Math.round((haversine(s.loc, x.loc) || 0) / 100) / 10
      }))
      .filter(x => x.km > 0 && x.km <= 30)
      .sort((a, b) => a.km - b.km)
      .slice(0, 14);
    return { ok: true, buurt };
  }

  /* De gereedschapskist per afdeling: minimaal vijf tools, als widgets die
     de schermen generiek kunnen tekenen. Elke afdeling krijgt standaard de
     dagcijfers, de te-lang-open-bewaking, snelknoppen voor het veelgevraagde
     werk, een logmoment-knop en een eigen meter; daarbovenop komt het
     vakspecifieke bord (dagstaat, wachtrij, presentielijst...). Widgets:
     cijfers {items}, lijst {rijen, leeg}, knoppen {knoppen}, actie {knop,
     tekst}, meter {opties, stand}. */
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
    watersport: ['Paddleboard', 'Jetski', 'Snorkelset', 'Zeiltocht', 'Kajak']
  };
  const LOGACTIES = {
    frontoffice: 'Overdracht gedaan', guest: 'Voorkeuren bijgewerkt', relations: 'Belrondje gedaan',
    concierge: 'Tips bijgewerkt', parking: 'Garage-ronde gelopen', security: 'Ronde gelopen',
    gym: 'Zaal gecheckt', spa: 'Cabines klaargezet', amenities: 'Voorraadkast geteld',
    patissier: 'Vitrine gevuld', klussen: 'Werkplaats opgeruimd', it: 'Back-up gecontroleerd',
    sales: 'Follow-ups gedaan', events: 'Draaiboek doorgenomen', florist: 'Water ververst',
    kidsclub: 'Koppen geteld', watersport: 'Materiaal geteld'
  };
  const METERS = {
    standaard: { titel: 'Drukte', opties: ['rustig', 'normaal', 'druk'] },
    security: { titel: 'Status', opties: ['kalm', 'let op', 'verhoogd'] },
    it: { titel: 'Systemen', opties: ['alles draait', 'storing', 'onderhoud'] },
    florist: { titel: 'Voorraad', opties: ['gevuld', 'aanvullen', 'op'] },
    amenities: { titel: 'Voorraadkast', opties: ['gevuld', 'aanvullen', 'leeg'] },
    patissier: { titel: 'Vitrine', opties: ['gevuld', 'aanvullen', 'leeg'] },
    sales: { titel: 'Seizoen', opties: ['rustig', 'normaal', 'piek'] },
    events: { titel: 'Seizoen', opties: ['rustig', 'normaal', 'piek'] }
  };

  function dorpTools(s, key) {
    const afd = AFDELINGEN[key];
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
  function dorpDrukte(s, keyIn, standIn, wie) {
    const key = AFDELINGEN[keyIn] ? keyIn : 'gym';
    const m = METERS[key] || METERS.standaard;
    if (!m.opties.includes(standIn)) return { status: 400, error: 'Kies ' + m.opties.join(', ') + '.' };
    s.dorpStanden = s.dorpStanden || {};
    s.dorpStanden[key] = { stand: standIn, door: schoon(wie, 40) || 'team', at: nu() };
    save();
    sseToSupplier(s.code, 'sync', { scope: 'dorp' });
    return { ok: true, drukte: Object.assign({ afdeling: key }, s.dorpStanden[key]) };
  }

  /* Het dorpsplein: per afdeling de open posten (en de laatste afgeronde),
     plus de telling waarmee de leiding het hele dorp overziet. */
  function dorpOverzicht(s) {
    const alle = posten(s);
    const afdelingen = Object.entries(AFDELINGEN).map(([key, afd]) => {
      const van = alle.filter(p => p.afdeling === key);
      const eind = afd.keten[afd.keten.length - 1];
      return {
        key, label: afd.label, icon: afd.icon, keten: afd.keten,
        waarHint: afd.waar, watHint: afd.wat,
        open: van.filter(p => p.status !== eind).slice(0, 30),
        klaar: van.filter(p => p.status === eind).slice(0, 3),
        openAantal: van.filter(p => p.status !== eind).length
      };
    });
    return { ok: true, afdelingen, totaalOpen: afdelingen.reduce((n, a) => n + a.openAantal, 0) };
  }

  return { HOTEL_AFDELINGEN: AFDELINGEN, dorpPost, dorpVerder, dorpStuurDoor, dorpBuurt, dorpOverzicht, dorpTools, dorpDrukte };
};
