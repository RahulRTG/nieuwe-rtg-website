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
  concierge: { label: 'Concierge', icon: '🎩', waar: 'Kamer', wat: 'Wens van de gast, bijv. tafel voor twee om 21:00', keten: ['open', 'bezig', 'geregeld'] },
  parking: { label: 'Parking', icon: '🚗', waar: 'Plek, bijv. P2-14', wat: 'Auto en kamer, bijv. blauwe Defender, Sea-view suite', keten: ['geparkeerd', 'voorrijden', 'staat voor'] },
  security: { label: 'Security', icon: '🛡️', waar: 'Plek', wat: 'Melding of ronde, bijv. poolronde gelopen', keten: ['gemeld', 'bezig', 'afgehandeld'] },
  gym: { label: 'Gym', icon: '🏋️', waar: 'Toestel of zaal', wat: 'Melding, bijv. loopband 2 piept', keten: ['open', 'klaar'] },
  spa: { label: 'Spa', icon: '💆', waar: 'Tijd en kamer, bijv. 15:00, Garden kamer', wat: 'Behandeling, bijv. massage 60 minuten', keten: ['gepland', 'bezig', 'klaar'] },
  klussen: { label: 'Klusjesman', icon: '🔧', waar: 'Plek', wat: 'Klus, bijv. lamp op het terras vervangen', keten: ['open', 'bezig', 'klaar'] },
  it: { label: 'IT', icon: '🖥️', waar: 'Systeem of plek', wat: 'Storing, bijv. wifi in de lobby traag', keten: ['open', 'bezig', 'opgelost'] }
};

module.exports = ({ save, crypto, schoon, sseToSupplier, notifySupplier }) => {
  const nu = () => new Date().toISOString();
  const posten = s => (s.hotelPosten = Array.isArray(s.hotelPosten) ? s.hotelPosten : []);

  function dorpPost(s, afdelingIn, waar, tekst, wie) {
    const key = String(afdelingIn || '');
    const afd = AFDELINGEN[key];
    if (!afd) return { status: 400, error: 'Onbekende afdeling.' };
    const wat = schoon(tekst, 140);
    if (!wat) return { status: 400, error: 'Schrijf kort op wat er speelt.' };
    const post = {
      id: crypto.randomBytes(4).toString('hex'), afdeling: key,
      waar: schoon(waar, 60) || '', tekst: wat,
      status: afd.keten[0], door: schoon(wie, 40) || 'team',
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

  return { HOTEL_AFDELINGEN: AFDELINGEN, dorpPost, dorpVerder, dorpOverzicht };
};
