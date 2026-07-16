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

  /* Specialistisch gereedschap per afdeling, bovenop de postenmotor. Elke
     afdeling krijgt het bord dat bij het vak past: de receptie een dagstaat,
     parking een voorrijd-wachtrij, de kids club een presentielijst, en zo
     verder. De meeste tools zijn afgeleiden van de eigen posten; een paar
     zijn bruggen naar de rest van het huis (defecten uit housekeeping, de
     gastenkaart uit de verblijven). */
  function dorpTools(s, key) {
    const afd = AFDELINGEN[key];
    if (!afd) return { status: 400, error: 'Onbekende afdeling.' };
    const alle = posten(s).filter(p => p.afdeling === key);
    const vandaag = new Date().toISOString().slice(0, 10);
    const opDag = iso => String(iso || '').slice(0, 10) === vandaag;
    const minutenGeleden = iso => Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
    const eind = afd.keten[afd.keten.length - 1];
    const open = alle.filter(p => p.status !== eind);

    if (key === 'frontoffice') {
      // de dagstaat: aankomsten, vertrekken en wie er in huis is, in cijfers
      const van = (db.data.verblijven || []).filter(v => v.supplierCode === s.code);
      return { ok: true, soort: 'dagstaat', dagstaat: {
        aankomsten: van.filter(v => v.status === 'bevestigd' && v.aankomst <= vandaag).length,
        vertrekken: van.filter(v => v.status === 'ingecheckt' && v.vertrek <= vandaag).length,
        inHuis: van.filter(v => v.status === 'ingecheckt').length,
        aanvragen: van.filter(v => v.status === 'aangevraagd').length,
        bezet: (s.rooms || []).filter(r => r.hk && r.hk.status === 'bezet').length,
        totaal: (s.rooms || []).length
      } };
    }
    if (key === 'guest') {
      // de gastenkaart: wie slaapt er, met alles wat het dorp over zijn kamer weet
      const inHuis = (db.data.verblijven || []).filter(v => v.supplierCode === s.code && v.status === 'ingecheckt');
      return { ok: true, soort: 'gastenkaart', gasten: inHuis.slice(0, 20).map(v => ({
        codenaam: v.codenaam, kamer: v.roomName, tot: v.vertrek, personen: v.personen,
        posten: posten(s).filter(p => p.waar && v.roomName.toLowerCase().includes(p.waar.toLowerCase().split(',')[0].trim()) && p.waar.length > 2).slice(0, 5)
          .map(p => ({ afdeling: (AFDELINGEN[p.afdeling] || {}).icon || '', tekst: p.tekst, status: p.status }))
      })) };
    }
    if (key === 'relations') {
      // de hersteltracker: wat te lang open staat, en wie er nagebeld moet worden
      return { ok: true, soort: 'herstel',
        verouderd: open.filter(p => minutenGeleden(p.at) > 240).map(p => ({ id: p.id, tekst: p.tekst, waar: p.waar, uren: Math.round(minutenGeleden(p.at) / 60) })),
        nabellen: alle.filter(p => p.status === 'opgelost').map(p => ({ id: p.id, tekst: p.tekst, waar: p.waar })) };
    }
    if (key === 'parking') {
      // de voorrijd-wachtrij: wie staat er aangevraagd, oudste eerst
      return { ok: true, soort: 'wachtrij',
        voorrijden: alle.filter(p => p.status === 'voorrijden').sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
          .map(p => ({ id: p.id, tekst: p.tekst, waar: p.waar, minuten: minutenGeleden(p.updatedAt) })),
        geparkeerd: alle.filter(p => p.status === 'geparkeerd').length };
    }
    if (key === 'security') {
      // de rondeklok: wanneer is er voor het laatst gelopen, plus vandaag in cijfers
      const rondes = alle.filter(p => /ronde/i.test(p.tekst) && p.status === eind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return { ok: true, soort: 'rondeklok',
        laatsteRonde: rondes[0] ? { tekst: rondes[0].tekst, minuten: minutenGeleden(rondes[0].updatedAt), door: rondes[0].door } : null,
        vandaagMeldingen: alle.filter(p => opDag(p.at) && !/ronde/i.test(p.tekst)).length };
    }
    if (key === 'gym') {
      // de druktemeter: rustig, normaal of druk, gezet door wie er staat
      return { ok: true, soort: 'drukte', drukte: s.gymDrukte || null };
    }
    if (key === 'spa') {
      // de dagagenda: afspraken op tijd gesorteerd (de tijd staat vooraan in "waar")
      return { ok: true, soort: 'agenda',
        agenda: open.slice().sort((a, b) => (a.waar || '').localeCompare(b.waar || '')).map(p => ({ id: p.id, waar: p.waar, tekst: p.tekst, status: p.status })) };
    }
    if (key === 'amenities') {
      return { ok: true, soort: 'snelknoppen', knoppen: ['Badjassen', 'Kussenmenu', 'Kinderbedje', 'Strijkplank', 'Tandenborstel-set', 'Extra dekbed'] };
    }
    if (key === 'patissier') {
      return { ok: true, soort: 'snelknoppen', knoppen: ['Verjaardagstaart', 'Turndown-zoet', 'Glutenvrij gebak', 'Fruitmand', 'Petit fours', 'Champagne-aardbeien'] };
    }
    if (key === 'klussen') {
      // de brug naar housekeeping: gemelde defecten zijn de werkvoorraad
      return { ok: true, soort: 'defecten',
        defecten: (s.rooms || []).filter(r => r.hk && r.hk.status === 'defect').map(r => ({ kamer: r.name, note: (r.hk && r.hk.note) || '' })) };
    }
    if (key === 'it') {
      // storingen: wat er open staat en wat er vandaag is opgelost
      return { ok: true, soort: 'storingen',
        open: open.map(p => ({ id: p.id, waar: p.waar, tekst: p.tekst, minuten: minutenGeleden(p.at) })),
        vandaagOpgelost: alle.filter(p => p.status === eind && opDag(p.updatedAt)).length };
    }
    if (key === 'sales' || key === 'events') {
      // de funnel: hoeveel er in elke fase zit
      return { ok: true, soort: 'funnel',
        funnel: afd.keten.map(fase => ({ fase, aantal: alle.filter(p => p.status === fase).length })) };
    }
    if (key === 'florist') {
      // de ververslijst: wat er langer dan vijf dagen staat, moet vers
      return { ok: true, soort: 'ververs',
        teVerversen: alle.filter(p => p.status === eind && minutenGeleden(p.updatedAt) > 5 * 1440).map(p => ({ id: p.id, waar: p.waar, tekst: p.tekst, dagen: Math.round(minutenGeleden(p.updatedAt) / 1440) })) };
    }
    if (key === 'kidsclub') {
      // de presentielijst: wie is er binnen, en hoe lang al
      return { ok: true, soort: 'presentie',
        binnen: alle.filter(p => p.status === 'binnen').map(p => ({ id: p.id, tekst: p.tekst, waar: p.waar, minuten: minutenGeleden(p.updatedAt) })) };
    }
    if (key === 'watersport') {
      // het op-het-water-bord: wie is er buiten; boven de twee uur kleurt het
      return { ok: true, soort: 'buiten',
        buiten: alle.filter(p => p.status === 'op het water').map(p => ({ id: p.id, tekst: p.tekst, waar: p.waar, minuten: minutenGeleden(p.updatedAt), teLang: minutenGeleden(p.updatedAt) > 120 })) };
    }
    // de concierge heeft zijn buurt al als specialistisch gereedschap
    return { ok: true, soort: 'geen' };
  }

  // de druktemeter van de gym: een stand, gezet door wie er staat
  function dorpDrukte(s, standIn, wie) {
    const stand = ['rustig', 'normaal', 'druk'].includes(standIn) ? standIn : null;
    if (!stand) return { status: 400, error: 'Kies rustig, normaal of druk.' };
    s.gymDrukte = { stand, door: schoon(wie, 40) || 'team', at: nu() };
    save();
    sseToSupplier(s.code, 'sync', { scope: 'dorp' });
    return { ok: true, drukte: s.gymDrukte };
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
