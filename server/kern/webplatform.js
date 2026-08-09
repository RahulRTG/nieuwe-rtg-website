/* RTG Web Platform -- de laag tussen het bedrijfsprofiel en het eigen web.

   Twee taken, allebei rond hetzelfde principe: "automatic first,
   customizable forever".

   1. GENEREREN. Zodra een partner zijn zaakprofiel heeft, kan RTG daar in een
      keer een complete site van maken op naam.rtg -- geen kale profielpagina
      maar een echte mini-site in de bestaande bloktaal. De ondernemer begint
      dus nooit vanaf nul; daarna is het zijn ontwerp en past hij alles aan.

   2. LIVE BLOKKEN. Een gegenereerde site bevat 'zaakdata'-blokken die geen
      kopie van het profiel dragen maar een VERWIJZING (bron: menu, agenda,
      fotos...). Bij het openen in de browser worden ze op dat moment uit het
      zaakprofiel opgelost naar gewone blokken. Er bestaat dus een
      Business Master Record: wijzigt het menu in de zaak-app, dan staat het
      op de site zonder dat iemand de site aanraakt. Het scherm hoeft er niets
      voor te kennen -- opgeloste blokken zijn gewone kop/tekst/galerij-blokken.

   De module kent zelf geen leveranciers; hij krijgt het zaakobject aangereikt
   door de route (die via supplierAuth/findSupplier al weet wie het is). */
module.exports = ({ db }) => {
  const BRONNEN = ['menu', 'diensten', 'kamers', 'agenda', 'fotos', 'reviews', 'contact'];

  const geld = p => (p == null || p === '' ? '' : '€ ' + p);
  // alleen eigen beeld (mediastore of campagne) komt in een galerij terecht
  const veiligBeeld = u => /^\/(media|campagne)\/[A-Za-z0-9._\/-]+$/.test(String(u || ''));

  function typeLabel(s) {
    const t = (db.data.supplierTypes || {})[s.type];
    return (t && t.label) || s.type || 'bedrijf';
  }
  function rating(s) {
    const rs = (db.data.reviewStats || {})[s.code];
    if (!rs || !rs.aantal) return null;
    return { score: Math.round((rs.som / rs.aantal) * 10) / 10, aantal: rs.aantal };
  }

  /* Een zaakdata-blok live oplossen naar gewone blokken. Een bron zonder
     inhoud lost op naar niets: een lege kop "Menu" op een site is erger dan
     geen kop. */
  function los(blok, s) {
    const uit = [];
    const kop = t => uit.push({ id: blok.id + '-k', type: 'kop', tekst: t });
    const item = (id, t) => uit.push({ id: blok.id + '-' + id, type: 'tekst', tekst: t });
    const regel = x => [x.name, x.desc].filter(Boolean).join(' -- ') + (x.price != null || x.prijs != null ? '  ·  ' + geld(x.price != null ? x.price : x.prijs) : '');
    const bron = blok.bron;

    if (bron === 'menu' && (s.menu || []).length) {
      kop('Menu');
      s.menu.slice(0, 30).forEach((x, i) => item('m' + i, regel(x)));
    } else if (bron === 'diensten' && (s.services || []).length) {
      kop('Diensten');
      s.services.slice(0, 30).forEach((x, i) => item('d' + i, regel(x)));
    } else if (bron === 'kamers') {
      const rooms = (s.rooms || []).filter(r => r.available);
      if (rooms.length) {
        kop('Kamers');
        rooms.slice(0, 30).forEach((x, i) => item('r' + i, regel(x)));
      }
    } else if (bron === 'agenda' && (s.activiteiten || []).length) {
      kop('Activiteiten');
      s.activiteiten.slice(0, 30).forEach((x, i) =>
        item('a' + i, regel(x) + (x.duur ? '  ·  ' + x.duur : '') + ((x.tijden || []).length ? '  ·  ' + x.tijden.join(' / ') : '')));
    } else if (bron === 'fotos') {
      const beelden = (s.photos || []).filter(veiligBeeld).slice(0, 12);
      if (beelden.length) uit.push({ id: blok.id + '-g', type: 'galerij', beelden });
    } else if (bron === 'reviews') {
      const r = rating(s);
      if (r) uit.push({ id: blok.id + '-q', type: 'citaat',
        tekst: r.score + ' gemiddeld, uit ' + r.aantal + ' beoordeling' + (r.aantal === 1 ? '' : 'en') + ' van leden.',
        bron: 'Geverifieerde RTG-reviews' });
    } else if (bron === 'contact') {
      kop('Bezoek ons');
      uit.push({ id: blok.id + '-c', type: 'kolommen',
        lk: s.city || 'Locatie', lt: (s.loc && s.loc.label) || s.city || '',
        rk: 'Via RTG', rt: 'Reserveren, bestellen en contact lopen via de RTG leden-app -- met je RTG-identiteit, zonder losse accounts.' });
    }
    return uit;
  }

  /* Alle zaakdata-blokken in een gepubliceerde site oplossen. Site zonder
     zaak (of zaak die weg is): de live blokken vallen stil weg in plaats van
     als lege dozen te blijven staan. */
  function losSite(site, s) {
    const blokken = [];
    (site.blokken || []).forEach(b => {
      if (b.type !== 'zaakdata') { blokken.push(b); return; }
      if (s) blokken.push(...los(b, s));
    });
    return Object.assign({}, site, { blokken });
  }

  /* De acties die de browser bij deze site mag aanbieden -- de browser
     begrijpt dan dat dit een bedrijf is, geen losse pagina. Alleen wat de
     zaak echt kan, komt terug. */
  function acties(s) {
    const caps = db.capsVan ? db.capsVan(s) : [];
    const a = [];
    if ((!s.settings || s.settings.reservationsOpen !== false) && (s.tables || []).length) a.push('reserveren');
    if ((!s.settings || s.settings.ordersOpen !== false) && (s.menu || []).length) a.push('bestellen');
    if ((s.activiteiten || []).length || (s.events || []).length) a.push('boeken');
    if ((s.services || []).length) a.push('diensten');
    if ((s.rooms || []).some(r => r.available)) a.push('kamers');
    if (caps.includes('chat') || caps.includes('gastcontact')) a.push('chat');
    return a;
  }
  function zaakInfo(s) {
    return { code: s.code, naam: s.name, type: s.type, typeLabel: typeLabel(s),
             stad: s.city || '', rating: rating(s), acties: acties(s) };
  }

  /* De automatische site: het hele zaakprofiel als bloktaal-ontwerp. Vaste
     kop en voet, en daartussen een live blok per bron die de zaak vandaag
     heeft -- wat er later bijkomt in het profiel, komt vanzelf mee omdat de
     blokken verwijzen en niet kopieren. */
  function genereer(s) {
    const blokken = [
      { id: 'g-hero', type: 'hero', kop: s.name,
        sub: (typeLabel(s) + (s.city ? ' · ' + s.city : '')),
        knop: 'Ontdek ' + s.name },
      { id: 'g-intro', type: 'tekst',
        tekst: s.name + ' is partner van Rahul Travel Group. Alles op deze pagina komt live uit ons bedrijfsprofiel -- wat u hier ziet, is wat er vandaag is.' }
    ];
    BRONNEN.filter(b => b !== 'contact').forEach((bron, i) => blokken.push({ id: 'g-z' + i, type: 'zaakdata', bron }));
    blokken.push({ id: 'g-zc', type: 'zaakdata', bron: 'contact' });
    blokken.push({ id: 'g-voet', type: 'voettekst', tekst: s.name + ' · op het RTG-web · onderdeel van het huis van Rahul Travel Group' });
    return { titel: s.name, thema: 'donker', accent: '#7F1634', blokken };
  }

  /* Universeel zoeken: niet alleen sites maar ook de bedrijven erachter.
     Alleen wat al publiek is (naam, stad, type) -- het zoekvak is geen
     achterdeur naar het zaakprofiel. */
  function zoekZaken(q, max) {
    const z = String(q || '').toLowerCase().trim();
    if (z.length < 2) return [];
    return (db.data.suppliers || [])
      .filter(s => !s.verborgen && ((s.name || '').toLowerCase().includes(z) ||
                                    (s.city || '').toLowerCase().includes(z) ||
                                    typeLabel(s).toLowerCase().includes(z)))
      .slice(0, max || 12)
      .map(s => ({ code: s.code, naam: s.name, stad: s.city || '', typeLabel: typeLabel(s) }));
  }

  return { BRONNEN, genereer, los, losSite, zaakInfo, zoekZaken };
};
