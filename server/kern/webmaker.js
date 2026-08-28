/* RTG Website-maker (leden) + de RTG-browser.

   Een lid dat een eigen bedrijf begint, bouwt hier met de muis een website uit
   blokken (dezelfde bloktaal als de Website-studio van het Atelier). Zet hij
   hem "online", dan krijgt de site een RTG-adres (naam.rtg) en verschijnt hij
   in de RTG-browser -- een eigen, besloten web binnen het huis. Geen echte
   domeinen, geen extern hosten: alles blijft in het ecosysteem, op codenaam.

   Alles wordt geschoond en begrensd; beeld verwijst naar eigen RTG-campagne of
   Salon, we bewaren alleen de verwijzing. */
module.exports = ({ db, save, crypto, schoon, media, merkHuisstijl }) => {
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
  // wie deed wat, wanneer (./webmaker-spoor.js) -- het verslag onder de goedkeuringsflow
  const spoor = require('./webmaker-spoor')({ store, save, scho });
  /* Cijfers over een site (./webmaker-meting.js): tellingen van gebeurtenissen,
     nooit van mensen. */
  const meting = require('./webmaker-meting')({ store, save });
  /* Een eigen adres buiten het RTG-web (./webdomein.js). Staat standaard uit;
     de boardroom-schakelaar zit op de functie 'dom-eigendomein'. */
  const domeinlaag = require('./webdomein')({ store, save, scho, spoor });
  /* Hoe een bewaard ontwerp eruitziet -- en vooral: WAT EEN BEWARING OVERLEEFT.
     Dat laatste is drie keer misgegaan (de bevroren stand, het geplande moment
     en het gekoppelde domein verdwenen elk stilletjes bij de eerstvolgende
     opslag), dus het staat op een eigen plek: ./webmaker-ontwerp.js. */
  const bouwOntwerp = require('./webmaker-ontwerp')({ scho, crypto, schoonBlok, schoonKleuren });

  /* ---- concept en wat er online staat ----

     Wat de maker bewerkt is het CONCEPT; wat bezoekers zien is de bevroren
     stand van het laatste publiceren (d.live). Zonder dat onderscheid gaat
     elke halve zin die iemand intypt meteen het web op, en dat is voor een
     bedrijfssite geen werkbare manier van werken.

     Een site van voor deze laag heeft nog geen bevroren stand; die serveert
     gewoon zijn concept, zodat er niets omvalt en niemand zijn site kwijt is. */
  function bevries(d) { d.live = versielaag.ontwerpVan(d); d.liveOp = new Date().toISOString(); }
  const wacht = d => !!d.online && !!d.liveOp && new Date(d.bij) > new Date(d.liveOp);

  const kort = d => ({ id: d.id, titel: d.titel, adres: d.adres || '', online: !!d.online, bezoeken: d.bezoeken || 0, bij: d.bij, blokken: (d.blokken || []).length, wacht: wacht(d), merk: d.merk || '', domein: d.domein || '' });
  const publiek = d => {
    const o = d.live || d;   // geen bevroren stand (oude site): dan het concept
    return { titel: o.titel, thema: o.thema, accent: o.accent, kleuren: o.kleuren || null, blokken: o.blokken || [], paginas: o.paginas || [], volgorde: o.volgorde || null, adres: d.adres, eigenaar: d.eigenaar, zaakCode: d.zaakCode || '' };
  };

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
    const design = bouwOntwerp({ d, key, opts, bestaand });
    const vg = schoonVolgorde(d, design.blokken); if (vg) design.volgorde = vg;
    const pg = paginalaag.schoonPaginas(d); if (pg) design.paginas = pg;
    /* Hoort deze site bij een vestiging van een merk, dan komt de HUISSTIJL van
       het merk en niet van de vestiging -- bij elke bewaring opnieuw. De
       vestiging beheert haar eigen inhoud (openingstijden, foto's, kaart, team,
       dat staat in haar zaakprofiel en komt via de live blokken binnen); een
       vestiging die het merk kan omverven is precies waarom een keten centraal
       beheer wil. */
    if (merkHuisstijl && design.zaakCode) {
      const h = merkHuisstijl(design.zaakCode);
      if (h) {
        design.thema = h.thema; design.accent = h.accent; design.kleuren = h.kleuren || null;
        design.merk = h.merk;
      }
    }
    // de stand die we gaan overschrijven eerst wegleggen
    if (bestaand) versielaag.leg(bestaand, (opts && opts.reden) || 'bewaard');
    spoor.noteer(design.id, bestaand ? ((opts && opts.reden) || 'bewaard') : 'gemaakt', opts && opts.wie);
    if (bestaand) { const i = s.lijst.indexOf(bestaand); s.lijst[i] = design; }
    else { s.lijst.unshift(design); s.lijst = s.lijst.slice(0, TOTAAL); }
    save();
    return { ok: true, design };
  }

  function verwijder(key, id) {
    const s = store();
    const weg = s.lijst.find(x => x.id === scho(id, 20) && x.eigenaar === key);
    s.lijst = s.lijst.filter(x => !(x.id === scho(id, 20) && x.eigenaar === key));
    if (weg) { versielaag.wis(weg.id); spoor.wis(weg.id); meting.wis(weg.id); }   // een site die weg is, laat niets achter
    save();
    return { ok: true };
  }
  /* Vier vragen die allemaal eerst "is deze site van jou?" stellen. Die
     controle staat in haal(); hem vier keer overschrijven is vier plekken waar
     hij kan gaan afwijken. */
  const vanMij = (key, id, doe) => { const d = haal(key, id); return d ? doe(d) : { error: 'Website niet gevonden.', status: 404 }; };
  const versies = (key, id) => vanMij(key, id, d => ({ ok: true, lijst: versielaag.lijst(d) }));
  const herstel = (key, id, i, wie) => vanMij(key, id, d => {
    const r = versielaag.herstel(d, i);
    if (!r.error) { spoor.noteer(d.id, 'oudere versie teruggezet', wie); save(); }
    return r;
  });
  // een eigen adres buiten het RTG-web, en de cijfers over deze site
  const domein = (key, id, host, wie) => vanMij(key, id, d => domeinlaag.koppel(d, host, wie));
  const cijfers = (key, id) => vanMij(key, id, d => ({ ok: true, cijfers: meting.cijfers(d) }));

  /* Alles wat bepaalt WAT ER BUITEN STAAT -- online gaan, wijzigingen
     publiceren, een moment plannen, uit de lucht halen, en het spoor daarvan --
     staat in ./webmaker-publiceren.js. Dat is een ander soort werk dan het
     bouwen van een ontwerp, en het is de kant waar de leiding over gaat. */
  const pub = require('./webmaker-publiceren')({ store, save, slug, haal, bevries, spoor });

  /* De browser-kant (gids, openen, zoeken) staat in ./webmaker-blader.js:
     bekijken is ander werk dan bouwen. */
  const blader = require('./webmaker-blader')({ store, save, slug, publiek, rijp: d => pub.rijp(d), meting });

  /* haal() geeft met opzet de LEVENDE regel terug (publiceer, herstel en
     zetLive schrijven erin), dus de afgeleide "wacht"-vlag hangen we er niet
     aan vast maar reiken we los aan -- zo staat de regel nog steeds op een
     plek en breken we het schrijven niet. */
  return { mijn, haal, bewaar, verwijder, slug, versies, herstel, wacht, cijfers, domein, publiekeStand: publiek, siteVoorHost: domeinlaag.siteVoorHost, siteVanZaak: domeinlaag.siteVanZaak, webOverzicht: meting.overzicht, telFormulier: meting.formulier,
           publiceer: pub.publiceer, zetLive: pub.zetLive, offline: pub.offline, plan: pub.plan, spoorVan: pub.spoorVan, planVeeg: pub.veeg,
           gids: blader.gids, open: blader.open, zoek: blader.zoek, adresVanZaak: blader.adresVanZaak, zaakVanAdres: blader.zaakVanAdres, eigenaarVanAdres: blader.eigenaarVanAdres, idVanAdres: blader.idVanAdres,
           fotos, fotoBewaar, fotoWeg, TYPES };
};
