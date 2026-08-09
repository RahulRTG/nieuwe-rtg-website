/* RTG Website-maker (leden) + de RTG-browser.

   Een lid dat een eigen bedrijf begint, bouwt hier met de muis een website uit
   blokken (dezelfde bloktaal als de Website-studio van het Atelier). Zet hij
   hem "online", dan krijgt de site een RTG-adres (naam.rtg) en verschijnt hij
   in de RTG-browser -- een eigen, besloten web binnen het huis. Geen echte
   domeinen, geen extern hosten: alles blijft in het ecosysteem, op codenaam.

   Alles wordt geschoond en begrensd; beeld verwijst naar eigen RTG-campagne of
   Salon, we bewaren alleen de verwijzing. */
module.exports = ({ db, save, crypto, schoon, media }) => {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  /* De schoonmaak van de bloktaal (wat een blok mag bevatten, hoe lang, hoe
     een adres en een kleur eruitzien) staat in ./webmaker-schoon.js -- elke
     ingang die iets van buiten aanneemt loopt daarlangs. */
  const { TYPES, slug, schoonBlok, schoonVolgorde, schoonKleuren } = require('./webmaker-schoon')({ scho, crypto });
  const PER_LID = 12;         // hoeveel sites een lid mag hebben
  const TOTAAL = 20000;       // harde bovengrens op de opslag

  function store() {
    if (!db.data.ledenSites || !Array.isArray(db.data.ledenSites.lijst)) db.data.ledenSites = { lijst: [] };
    if (!db.data.ledenSites.fotos || typeof db.data.ledenSites.fotos !== 'object') db.data.ledenSites.fotos = {};
    return db.data.ledenSites;
  }
  /* De fotobibliotheek staat in ./webmaker-fotos.js: die kant raakt de
     mediastore (een foto die eraf valt of wordt weggehaald, moet ook van
     schijf) en dat is een ander soort werk dan het bouwen van een pagina. */
  const fotolaag = require('./webmaker-fotos')({ store, save, media });
  const { fotos, fotoBewaar, fotoWeg } = fotolaag;
  // meerdere pagina's per site: schoonmaak in ./webmaker-paginas.js
  const paginalaag = require('./webmaker-paginas')({ scho, schoonBlok, crypto, slug });
  /* De versiegeschiedenis staat in ./webmaker-versies.js: bij elke bewaring
     gaat de vorige stand daarheen, zodat de AI-knop en "opnieuw genereren"
     een weg terug hebben. */
  const versielaag = require('./webmaker-versies')({ store, save, scho });

  const kort = d => ({ id: d.id, titel: d.titel, adres: d.adres || '', online: !!d.online, bezoeken: d.bezoeken || 0, bij: d.bij, blokken: (d.blokken || []).length });
  const publiek = d => ({ titel: d.titel, thema: d.thema, accent: d.accent, kleuren: d.kleuren || null, blokken: d.blokken || [], paginas: d.paginas || [], volgorde: d.volgorde || null, adres: d.adres, eigenaar: d.eigenaar, zaakCode: d.zaakCode || '' });

  function mijn(key) { return store().lijst.filter(d => d.eigenaar === key).map(kort); }
  function haal(key, id) { const d = store().lijst.find(x => x.id === scho(id, 20) && x.eigenaar === key); return d || null; }

  /* opts.zaakCode wordt alleen door de zaak-route meegegeven (na supplierAuth):
     dat een site bij een bedrijf hoort is een feit uit de inlog, geen veld dat
     een lid zelf in zijn ontwerp kan zetten. Bij een gewone save blijft de
     bestaande koppeling staan. */
  function bewaar(key, d, opts) {
    d = d || {};
    const s = store();
    let bestaand = null;
    if (d.id) bestaand = s.lijst.find(x => x.id === scho(d.id, 20) && x.eigenaar === key);
    if (!bestaand && s.lijst.filter(x => x.eigenaar === key).length >= PER_LID) {
      return { error: 'Je hebt het maximum aantal websites bereikt. Verwijder er eerst een.', status: 400 };
    }
    const design = {
      id: bestaand ? bestaand.id : ('w' + crypto.randomBytes(5).toString('hex')),
      eigenaar: key,
      titel: scho(d.titel, 80) || 'Mijn website',
      thema: ['licht', 'donker'].includes(d.thema) ? d.thema : 'donker',
      accent: /^#[0-9a-fA-F]{6}$/.test(String(d.accent || '')) ? d.accent : '#7F1634',
      kleuren: schoonKleuren(d.kleuren),
      blokken: (Array.isArray(d.blokken) ? d.blokken : []).slice(0, 60).map(schoonBlok),
      zaakCode: (opts && opts.zaakCode) ? scho(opts.zaakCode, 30) : (bestaand ? (bestaand.zaakCode || '') : ''),
      adres: bestaand ? (bestaand.adres || '') : '',
      online: bestaand ? !!bestaand.online : false,
      bezoeken: bestaand ? (bestaand.bezoeken || 0) : 0,
      gemaakt: bestaand ? bestaand.gemaakt : new Date().toISOString(),
      bij: new Date().toISOString()
    };
    const vg = schoonVolgorde(d, design.blokken); if (vg) design.volgorde = vg;
    const pg = paginalaag.schoonPaginas(d); if (pg) design.paginas = pg;
    // de stand die we gaan overschrijven eerst wegleggen
    if (bestaand) versielaag.leg(bestaand, (opts && opts.reden) || 'bewaard');
    if (bestaand) { const i = s.lijst.indexOf(bestaand); s.lijst[i] = design; }
    else { s.lijst.unshift(design); s.lijst = s.lijst.slice(0, TOTAAL); }
    save();
    return { ok: true, design };
  }

  function verwijder(key, id) {
    const s = store();
    const weg = s.lijst.find(x => x.id === scho(id, 20) && x.eigenaar === key);
    s.lijst = s.lijst.filter(x => !(x.id === scho(id, 20) && x.eigenaar === key));
    if (weg) versielaag.wis(weg.id);   // een site die weg is, laat geen geschiedenis achter
    save();
    return { ok: true };
  }
  /* De geschiedenis is van de eigenaar van de site: haal() controleert dat,
     en zonder site is er ook geen geschiedenis om in te kijken. */
  function versies(key, id) {
    const d = haal(key, id);
    if (!d) return { error: 'Website niet gevonden.', status: 404 };
    return { ok: true, lijst: versielaag.lijst(d) };
  }
  function herstel(key, id, i) {
    const d = haal(key, id);
    if (!d) return { error: 'Website niet gevonden.', status: 404 };
    return versielaag.herstel(d, i);
  }

  function publiceer(key, id, adresIn) {
    const d = haal(key, id);
    if (!d) return { error: 'Website niet gevonden.', status: 404 };
    const a = slug(adresIn || d.adres || d.titel);
    if (a.length < 2) return { error: 'Kies een adres van minstens twee tekens (letters, cijfers, koppelteken).', status: 400 };
    const bezet = store().lijst.find(x => x.adres === a && x.id !== d.id);
    if (bezet) return { error: 'Dit adres is al bezet. Kies een ander.', status: 409 };
    d.adres = a; d.online = true; d.bij = new Date().toISOString(); save();
    return { ok: true, adres: a, online: true };
  }
  function offline(key, id) {
    const d = haal(key, id);
    if (!d) return { error: 'Website niet gevonden.', status: 404 };
    d.online = false; save();
    return { ok: true, online: false };
  }

  /* De browser-kant (gids, openen, zoeken) staat in ./webmaker-blader.js:
     bekijken is ander werk dan bouwen. */
  const blader = require('./webmaker-blader')({ store, save, slug, publiek });

  return { mijn, haal, bewaar, verwijder, publiceer, offline, slug, versies, herstel,
           gids: blader.gids, open: blader.open, zoek: blader.zoek, adresVanZaak: blader.adresVanZaak, zaakVanAdres: blader.zaakVanAdres, eigenaarVanAdres: blader.eigenaarVanAdres,
           fotos, fotoBewaar, fotoWeg, TYPES };
};
