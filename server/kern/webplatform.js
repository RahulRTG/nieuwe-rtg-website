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
  const BRONNEN = ['menu', 'diensten', 'kamers', 'agenda', 'events', 'vacatures', 'openingstijden', 'fotos', 'reviews', 'contact'];
  const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

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

  /* Het oplossen van een live blok naar gewone blokken staat in
     ./webplatform-live.js: dat is per bron een eigen stukje kennis over hoe
     het zaakprofiel eruitziet, en dat hoort niet door deze laag heen te lopen. */
  const los = require('./webplatform-live')({ db, geld, veiligBeeld, rating, DAGEN });

  /* Alle zaakdata-blokken van een pagina oplossen. Site zonder zaak (of zaak
     die weg is): de live blokken vallen stil weg in plaats van als lege dozen
     te blijven staan. */
  function losBlokken(lijst, s, magFormulier) {
    const blokken = [];
    (lijst || []).forEach(b => {
      /* een formulier heeft een ontvanger nodig: bij een zaak is dat de
         werklijst, bij een lid het gesprek -- zonder ontvanger zou het een
         knop zijn die stilletjes niets doet, dus dan staat hij er niet */
      if (b.type === 'formulier') { if (magFormulier) blokken.push(b); return; }
      if (b.type !== 'zaakdata') { blokken.push(b); return; }
      if (s) blokken.push(...los(b, s));
    });
    return blokken;
  }
  /* Een pagina die alleen live blokken droeg en waarvan er niets overbleef,
     verdwijnt uit de site -- anders staat "Werken bij ons" in de navigatie van
     een zaak zonder vacatures, en dat is een deur naar een lege kamer. Pagina's
     die de maker zelf heeft gevuld blijven altijd staan, ook als ze leeg zijn:
     die verdwijnen zou hem overvallen. */
  const alleenLive = p => (p.blokken || []).length > 0 && (p.blokken || []).every(b => b.type === 'zaakdata');

  function losSite(site, s, magFormulier) {
    const mf = magFormulier === undefined ? !!s : magFormulier;
    return Object.assign({}, site, {
      blokken: losBlokken(site.blokken, s, mf),
      paginas: (site.paginas || [])
        .map(p => Object.assign({}, p, { blokken: losBlokken(p.blokken, s, mf), _live: alleenLive(p) }))
        .filter(p => p.blokken.length || !p._live)
        .map(p => { delete p._live; return p; })
    });
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
    const voet = n => ({ id: 'g-voet' + n, type: 'voettekst', tekst: s.name + ' · op het RTG-web · onderdeel van het huis van Rahul Travel Group' });
    // de voorpagina: wie we zijn, het beeld en wat gasten van ons vinden
    const blokken = [
      { id: 'g-hero', type: 'hero', kop: s.name,
        sub: (typeLabel(s) + (s.city ? ' · ' + s.city : '')),
        knop: 'Ontdek ' + s.name },
      { id: 'g-intro', type: 'tekst',
        tekst: s.name + ' is partner van Rahul Travel Group. Alles op deze site komt live uit ons bedrijfsprofiel -- wat u hier ziet, is wat er vandaag is.' },
      { id: 'g-zf', type: 'zaakdata', bron: 'fotos' },
      { id: 'g-zr', type: 'zaakdata', bron: 'reviews' },
      voet('h')
    ];
    // de aanbodpagina: alles wat de zaak vandaag verkoopt en organiseert, live
    const aanbod = ['menu', 'diensten', 'kamers', 'agenda', 'events']
      .map((bron, i) => ({ id: 'g-z' + i, type: 'zaakdata', bron }));
    const paginas = [
      { id: 'g-p-aanbod', naam: 'Aanbod', slug: 'aanbod', blokken: [...aanbod, voet('a')] },
      /* Alleen live blokken, met opzet: heeft de zaak geen openstaande
         vacatures, dan verdwijnt deze pagina vanzelf uit de navigatie. */
      { id: 'g-p-werk', naam: 'Werken bij ons', slug: 'werken-bij-ons', blokken: [
        { id: 'g-zv', type: 'zaakdata', bron: 'vacatures' }
      ] },
      { id: 'g-p-contact', naam: 'Contact', slug: 'contact', blokken: [
        { id: 'g-zc', type: 'zaakdata', bron: 'contact' },
        { id: 'g-zu', type: 'zaakdata', bron: 'openingstijden' },
        { id: 'g-form', type: 'formulier', kop: 'Stel ons een vraag', knop: 'Verstuur' },
        voet('c')
      ] }
    ];
    return { titel: s.name, thema: 'donker', accent: '#7F1634', blokken, paginas };
  }

  /* De persoonlijke site: ieders eigen plek op het RTG-web, op CODENAAM --
     de echte naam blijft in de kluis, ook hier. Zelfde principe als de
     bedrijfssite: een compleet startpunt, daarna van het lid zelf. */
  function genereerPersoon(codenaam) {
    return { titel: codenaam, thema: 'donker', accent: '#7F1634',
      blokken: [
        { id: 'gp-hero', type: 'hero', kop: codenaam, sub: 'Lid van Rahul Travel Group', knop: 'Maak kennis' },
        { id: 'gp-intro', type: 'tekst', tekst: 'Dit is mijn eigen plek op het RTG-web. Vertel hier wie je bent, wat je maakt of waar je van houdt -- open de Website-maker en maak hem van jou.' },
        { id: 'gp-kol', type: 'kolommen', lk: 'Wat ik doe', lt: 'Schrijf hier over je werk, je vak of je projecten.', rk: 'Waar ik van houd', rt: 'Reizen, muziek, eten -- wat je maar kwijt wilt.' },
        { id: 'gp-voet', type: 'voettekst', tekst: codenaam + ' · op het RTG-web' }
      ],
      paginas: [
        { id: 'gp-p-contact', naam: 'Contact', slug: 'contact', blokken: [
          { id: 'gp-ct', type: 'tekst', tekst: 'Een bericht via deze pagina komt binnen als gesprek in mijn leden-app. We moeten daarvoor wel verbonden zijn -- zo houden we het hier rustig.' },
          { id: 'gp-form', type: 'formulier', kop: 'Schrijf me', knop: 'Verstuur' },
          { id: 'gp-voet2', type: 'voettekst', tekst: codenaam + ' · op het RTG-web' }
        ] }
      ] };
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

  return { BRONNEN, genereer, genereerPersoon, los, losSite, zaakInfo, zoekZaken };
};
