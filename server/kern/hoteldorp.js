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

/* De afdelingsdata (afdelingen, sets en meters) staat als pure data in een
   deelmodule. */
const { AFDELINGEN, HOTEL_SET, CLUB_SET, RESTO_SET, BEACH_SET, CLUB_TYPES, METERS } = require('./hoteldorp/afdelingen');

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
