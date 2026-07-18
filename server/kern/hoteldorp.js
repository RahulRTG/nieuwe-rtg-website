/* Het dorp achter de zaak: een hotel is een dorp apart, en een club net zo.
   Elke afdeling krijgt hetzelfde lichte gereedschap: een eigen postenlijst
   met een korte, eigen statusketen. Een post is altijd "waar + wat + wie",
   en een tik zet hem een stap verder in de keten. Het dorpsplein telt alles
   bij elkaar op, zodat de leiding in een oogopslag ziet welke afdeling
   aandacht vraagt.

   Bewust EEN motor voor alle afdelingen: de conciergewens, de voorrijklus
   van parking, het verzoekje bij de dj en de wifi-storing zijn hetzelfde
   ding met een andere keten. Dat houdt de vloer voorspelbaar (alles werkt
   hetzelfde) en de code klein. Welke afdelingen een zaak ziet, hangt van
   de zaak af: kamers geven het hoteldorp, bar/club/beachclub het clubdorp. */

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
  watersport: { label: 'Watersport', icon: '🏄', waar: 'Wie en wat', wat: 'Boeking, bijv. twee paddleboards, 14:00', keten: ['geboekt', 'op het water', 'terug'] },
  // het clubdorp: de nachtzaak van deur tot kantoor
  entree: { label: 'Entree & deur', icon: '🚪', waar: 'Naam of groep', wat: 'Gastenlijst of deur, bijv. groep van zes, tafel Marbella', keten: ['op de lijst', 'aan de deur', 'binnen'] },
  garderobe: { label: 'Garderobe', icon: '🧥', waar: 'Nummer, bijv. 214', wat: 'Wat er hangt, bijv. jas en helm', keten: ['in bewaring', 'opgehaald'] },
  bar: { label: 'Bar', icon: '🍸', waar: 'Station, bijv. bar links', wat: 'Wat er nodig is, bijv. ijs en limoenen aanvullen', keten: ['gevraagd', 'bezig', 'klaar'] },
  vip: { label: 'VIP & tafels', icon: '🍾', waar: 'Tafel, bijv. booth 3', wat: 'Reservering of fles, bijv. tafel voor acht, magnum om 01:00', keten: ['aangevraagd', 'bevestigd', 'zit', 'afgerekend'] },
  dj: { label: 'DJ & muziek', icon: '🎧', waar: 'Set of moment', wat: 'Verzoek of wissel, bijv. verzoekje verjaardag om 00:30', keten: ['in de wachtrij', 'gedraaid'] },
  techniek: { label: 'Licht & geluid', icon: '🎛️', waar: 'Plek of toestel', wat: 'Storing, bijv. spot boven de vloer valt uit', keten: ['gemeld', 'bezig', 'verholpen'] },
  vloer: { label: 'Vloer & runners', icon: '🧹', waar: 'Plek', wat: 'Melding, bijv. glaswerk bij de dansvloer ophalen', keten: ['gemeld', 'bezig', 'klaar'] },
  promo: { label: 'Promo & marketing', icon: '📣', waar: 'Kanaal of avond', wat: 'Actie, bijv. story met de line-up van vrijdag', keten: ['idee', 'gepland', 'live', 'afgerond'] },
  inkoop: { label: 'Inkoop & voorraad', icon: '📦', waar: 'Leverancier of product', wat: 'Bestelling, bijv. tien kratten cava bijbestellen', keten: ['besteld', 'onderweg', 'binnen'] },
  kantoor: { label: 'Kantoor & administratie', icon: '🗂️', waar: 'Map of onderwerp', wat: 'Taak, bijv. facturen van het weekend inboeken', keten: ['open', 'bezig', 'afgehandeld'] },
  // het restaurantdorp: van het boek tot de pas
  host: { label: 'Host & reserveringen', icon: '📖', waar: 'Tijd en gezelschap', wat: 'Reservering of ontvangst, bijv. 20:00, vier personen, raamtafel', keten: ['gereserveerd', 'ontvangen', 'aan tafel'] },
  bediening: { label: 'Bediening', icon: '🤵', waar: 'Tafel', wat: 'Wens of signaal, bijv. tafel 4 vraagt de kaart nog een keer', keten: ['gevraagd', 'bezig', 'geserveerd'] },
  keuken: { label: 'Keuken', icon: '🔪', waar: 'Sectie of gerecht', wat: 'Doorgifte, bijv. 86 op de zeebaars, mise en place bijna op', keten: ['gemeld', 'bezig', 'klaar'] },
  // en het strand van de beachclub
  ligbedden: { label: 'Ligbedden & strand', icon: '🏖️', waar: 'Rij en bed, bijv. eerste rij 4', wat: 'Reservering of wens, bijv. twee bedden, champagne-emmer om 15:00', keten: ['gereserveerd', 'bezet', 'vrijgegeven'] }
};

/* Welke afdelingen een zaak ziet: kamers geven het hoteldorp, een nachtzaak
   het clubdorp, een restaurant het restaurantdorp en een beachclub het
   restaurantdorp plus het strand. Security, klussen, IT, sales en events
   zitten overal in: dat werk is overal hetzelfde. */
const HOTEL_SET = ['frontoffice', 'guest', 'relations', 'concierge', 'parking', 'security', 'gym', 'spa', 'amenities', 'patissier', 'klussen', 'it', 'sales', 'events', 'florist', 'kidsclub', 'watersport'];
const CLUB_SET = ['entree', 'garderobe', 'bar', 'vip', 'dj', 'techniek', 'vloer', 'promo', 'security', 'klussen', 'it', 'sales', 'events', 'inkoop', 'kantoor'];
const RESTO_SET = ['host', 'bediening', 'keuken', 'bar', 'vloer', 'promo', 'inkoop', 'kantoor', 'security', 'klussen', 'it', 'sales', 'events'];
const BEACH_SET = [...RESTO_SET, 'ligbedden', 'watersport'];
const CLUB_TYPES = ['bar', 'club'];

module.exports = ({ db, save, crypto, schoon, sseToSupplier, notifySupplier, haversine }) => {
  const nu = () => new Date().toISOString();
  const posten = s => (s.hotelPosten = Array.isArray(s.hotelPosten) ? s.hotelPosten : []);
  const dorpSet = s => Array.isArray(s.rooms) ? HOTEL_SET
    : CLUB_TYPES.includes(s.type) ? CLUB_SET
    : s.type === 'restaurant' ? RESTO_SET
    : s.type === 'beachclub' ? BEACH_SET
    : null;
  const dorpKan = s => !!dorpSet(s);

  function dorpPost(s, afdelingIn, waar, tekst, wie, directKlaar) {
    const key = String(afdelingIn || '');
    const afd = (dorpSet(s) || []).includes(key) ? AFDELINGEN[key] : null;
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
    const afd = (dorpSet(s) || []).includes(naar) ? AFDELINGEN[naar] : null;
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
  const METERS = {
    standaard: { titel: 'Drukte', opties: ['rustig', 'normaal', 'druk'] },
    security: { titel: 'Status', opties: ['kalm', 'let op', 'verhoogd'] },
    it: { titel: 'Systemen', opties: ['alles draait', 'storing', 'onderhoud'] },
    florist: { titel: 'Voorraad', opties: ['gevuld', 'aanvullen', 'op'] },
    amenities: { titel: 'Voorraadkast', opties: ['gevuld', 'aanvullen', 'leeg'] },
    patissier: { titel: 'Vitrine', opties: ['gevuld', 'aanvullen', 'leeg'] },
    sales: { titel: 'Seizoen', opties: ['rustig', 'normaal', 'piek'] },
    events: { titel: 'Seizoen', opties: ['rustig', 'normaal', 'piek'] },
    entree: { titel: 'Rij aan de deur', opties: ['geen rij', 'rij', 'rij tot de hoek'] },
    bar: { titel: 'Voorraad', opties: ['gevuld', 'aanvullen', 'op'] },
    dj: { titel: 'De vloer', opties: ['warmt op', 'goed vol', 'piek'] },
    techniek: { titel: 'Systemen', opties: ['alles draait', 'storing', 'onderhoud'] },
    inkoop: { titel: 'Voorraad', opties: ['gevuld', 'aanvullen', 'op'] },
    promo: { titel: 'Campagne', opties: ['stil', 'loopt', 'piek'] },
    host: { titel: 'Bezetting', opties: ['rustig', 'goed bezet', 'vol'] },
    keuken: { titel: 'De pas', opties: ['rustig', 'loopt', 'vol'] },
    ligbedden: { titel: 'Het strand', opties: ['rustig', 'goed bezet', 'vol'] }
  };


  /* ---- de dorpstools (snelknoppen, logacties, werkschermen) wonen in
     hoteldorp/tools.js; de motor en de meters blijven hier. ---- */
  const { dorpTools } = require('./hoteldorp/tools')({ db, AFDELINGEN, METERS, posten, dorpSet });

  function dorpDrukte(s, keyIn, standIn, wie) {
    const set = dorpSet(s) || [];
    const key = set.includes(keyIn) ? keyIn : (set.includes('gym') ? 'gym' : set[0]);
    if (!key) return { status: 409, error: 'Deze zaak heeft geen afdelingenbord.' };
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
    const afdelingen = (dorpSet(s) || []).map(key => {
      const afd = AFDELINGEN[key];
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

  return { HOTEL_AFDELINGEN: AFDELINGEN, dorpKan, dorpPost, dorpVerder, dorpStuurDoor, dorpBuurt, dorpOverzicht, dorpTools, dorpDrukte };
};
