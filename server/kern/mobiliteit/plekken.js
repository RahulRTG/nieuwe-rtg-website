/* Mobility OS (deelmodule): waar een rit begint en eindigt.

   HIER ZIT DE KOPPELING MET DE REST VAN RTG. Een bestemming is bij ons zelden
   een adres dat iemand intikt -- het is het restaurant waar om acht uur een
   tafel staat, het hotel waar de kamer op naam staat, de halte van lijn 1, of
   gewoon thuis. Die dingen bestaan al in dit huis. Een vervoerslaag die
   daarnaast een eigen adresboek opzet, zou een tweede waarheid bijhouden over
   waar Sal de Mar staat (LAT.md regel 4), en die twee lopen uiteen.

   Een plek komt daarom binnen als een VERWIJZING en wordt hier opgelost:

     { zaak: 'KIKUNOI' }   -> een RTG-leverancier: horeca, hotel, club, zorg
     { halte: 'h-air' }    -> een halte van een OV-lijn
     { favoriet: 'fv12' }  -> een plek die het lid zelf heeft bewaard
     { hier: true }        -> de live locatie van het lid
     { lat, lng, label }   -> een vrij punt op de kaart

   Wat eruit komt is altijd hetzelfde: lat, lng, een label en de bron. De rest
   van de kern kent alleen die vorm en hoeft dus niets van horeca te weten.

   WAAROM "THUIS" HIER GEEN BRON IS. Het woonadres van een lid staat in de
   identiteitskluis (member_state.adres, versleuteld en gebonden) en is alleen
   via de gegevenspoort te benaderen. Een vervoerslaag die daar even langs gaat
   om een vertrekpunt te vullen, omzeilt precies de scheiding die CLAUDE.md
   verbiedt te omzeilen -- en zou het adres bovendien als coordinaat in elke
   rit laten belanden. Een lid bewaart zijn eigen vertrekpunten hier, in de
   vervoersapp, op codenaam. Dat is een favoriet, geen dossiergegeven, en het
   lid kan hem weggooien zonder dat er iets aan zijn paspoort verandert. */

module.exports = (ctx) => {
  const { db, schoon, haversine } = ctx;

  const zaakMet = code => (db.data.suppliers || []).find(s => s.code === code) || null;

  // alle haltes van alle OV-zaken, met hun lijn erbij
  function haltes() {
    const uit = [];
    for (const s of db.data.suppliers || []) {
      for (const l of s.lijnen || []) {
        for (const h of l.haltes || []) {
          if (Number.isFinite(h.lat) && Number.isFinite(h.lng))
            uit.push({ id: h.id, naam: h.naam, lat: h.lat, lng: h.lng, lijn: l.naam, lijnId: l.id, soort: l.soort, zaak: s.code });
        }
      }
    }
    return uit;
  }

  const favsVan = key => {
    if (!db.data.mobFavorieten || typeof db.data.mobFavorieten !== 'object') db.data.mobFavorieten = {};
    return db.data.mobFavorieten[key] || [];
  };

  /* Los een plek op. `session` mag ontbreken (een dispatcher die een
     telefoonboeking intikt heeft geen sessie van de reiziger), maar dan
     werken 'favoriet' en 'hier' natuurlijk niet -- en dat zegt hij ook. */
  function plekBepaal(spec, session) {
    if (!spec || typeof spec !== 'object') return { error: 'Geef een vertrekpunt en een bestemming op.' };

    if (spec.zaak) {
      const s = zaakMet(schoon(spec.zaak, 20));
      if (!s) return { error: 'Onbekende RTG-zaak.' };
      if (!s.loc || !Number.isFinite(s.loc.lat)) return { error: s.name + ' heeft geen locatie op de kaart.' };
      return { lat: s.loc.lat, lng: s.loc.lng, label: s.name, bron: 'zaak', zaak: s.code, genre: s.type };
    }

    if (spec.halte) {
      const h = haltes().find(x => x.id === schoon(spec.halte, 40));
      if (!h) return { error: 'Onbekende halte.' };
      return { lat: h.lat, lng: h.lng, label: h.naam + ' (' + h.lijn + ')', bron: 'halte', halte: h.id, lijnId: h.lijnId };
    }

    if (spec.favoriet) {
      if (!session) return { error: 'Een favoriete plek kan alleen het lid zelf kiezen.' };
      const f = favsVan(session.key).find(x => x.id === schoon(spec.favoriet, 40));
      if (!f) return { error: 'Onbekende favoriete plek.' };
      return { lat: f.lat, lng: f.lng, label: f.naam, bron: 'favoriet', favoriet: f.id };
    }

    if (spec.hier) {
      if (!session) return { error: 'Een live locatie hoort bij een ingelogde reiziger.' };
      const L = (db.data.live || {})[session.key];
      if (!L || !Number.isFinite(L.lat)) return { error: 'Uw locatie is niet bekend; zet GPS aan of kies een plek.' };
      return { lat: L.lat, lng: L.lng, label: 'Huidige locatie', bron: 'live' };
    }

    if (Number.isFinite(spec.lat) && Number.isFinite(spec.lng)) {
      if (Math.abs(spec.lat) > 90 || Math.abs(spec.lng) > 180) return { error: 'Dat punt ligt niet op de aarde.' };
      return { lat: spec.lat, lng: spec.lng, label: schoon(spec.label, 80) || 'Punt op de kaart', bron: 'kaart' };
    }
    return { error: 'Onbekende plek; kies een zaak, een halte, thuis of een punt op de kaart.' };
  }

  /* Wat kun je kiezen? Dit voedt de bestemmingslijst in de app, en het is
     precies de reden dat dit huis een vervoersapp kan bouwen die andere apps
     niet hebben: de bestemmingen zijn onze eigen zaken, met hun genre erbij.
     Dichtbij eerst als er een punt meegegeven is.

     ZOEKEN EN FILTEREN ZIJN GEEN LUXE. RTG heeft honderden zaken. Een lijst die
     op de dichtstbijzijnde zestig afkapt, verbergt het hotel op dertien
     kilometer volledig -- en dat is precies de bestemming waar iemand vervoer
     voor nodig heeft. Dat is hier ook echt gebeurd: de eerste versie kapte af
     en het enige hotel in de startdata viel eruit. Wie zoekt of op genre
     filtert, zoekt daarom over ALLES en pas daarna wordt er afgekapt. */
  function plekLijst(bij, session, opties = {}) {
    const vanaf = bij && Number.isFinite(bij.lat) ? bij : null;
    const afst = p => vanaf ? haversine(vanaf, p) : null;
    const zoek = schoon(opties.zoek, 60).toLowerCase();
    const genre = schoon(opties.genre, 30).toLowerCase();
    const limiet = Math.min(200, Math.max(10, Math.round(Number(opties.limiet) || 60)));

    const zaken = (db.data.suppliers || [])
      .filter(s => s.loc && Number.isFinite(s.loc.lat))
      .map(s => ({ soort: 'zaak', code: s.code, naam: s.name, genre: s.type, stad: s.city || null,
        lat: s.loc.lat, lng: s.loc.lng, afstandM: afst(s.loc) }));
    const hal = haltes().map(h => ({ soort: 'halte', code: h.id, naam: h.naam, genre: h.soort, lijn: h.lijn,
      lat: h.lat, lng: h.lng, afstandM: afst(h) }));

    let alles = zaken.concat(hal);
    if (genre) alles = alles.filter(p => String(p.genre || '').toLowerCase() === genre);
    if (zoek) alles = alles.filter(p => (p.naam + ' ' + (p.stad || '')).toLowerCase().includes(zoek));
    if (vanaf) alles.sort((a, b) => (a.afstandM == null ? 1e12 : a.afstandM) - (b.afstandM == null ? 1e12 : b.afstandM));

    const eigen = session
      ? favsVan(session.key).map(f => ({ soort: 'favoriet', code: f.id, naam: f.naam, lat: f.lat, lng: f.lng, afstandM: afst(f) }))
      : [];
    // de genres die er ECHT zijn, zodat de app zijn filter niet hoeft te raden
    const genres = [...new Set(zaken.map(z => z.genre).concat(hal.map(h => h.genre)))].filter(Boolean).sort();
    return { ok: true, plekken: eigen.concat(alles.slice(0, limiet)),
      totaal: alles.length, afgekapt: Math.max(0, alles.length - limiet), genres };
  }

  /* Favorieten van het lid zelf. Bewust maar tien: een lijst van honderd
     opgeslagen punten is een bewegingsprofiel, en dat willen we hier niet
     aanleggen. Weghalen wist echt, want dit is het enige exemplaar. */
  function favZet(session, body = {}) {
    if (!db.data.mobFavorieten || typeof db.data.mobFavorieten !== 'object') db.data.mobFavorieten = {};
    const lijst = db.data.mobFavorieten[session.key] || (db.data.mobFavorieten[session.key] = []);
    const favId = schoon(body.id, 40);
    if (body.weg) {
      const voor = lijst.length;
      db.data.mobFavorieten[session.key] = lijst.filter(f => f.id !== favId);
      ctx.save();
      return voor === db.data.mobFavorieten[session.key].length
        ? { status: 404, error: 'Onbekende favoriete plek.' } : { ok: true, weg: favId };
    }
    const plek = plekBepaal(body.plek, session);
    if (plek.error) return { status: 400, error: plek.error };
    const naam = schoon(body.naam, 40) || plek.label;
    const bestaand = favId ? lijst.find(f => f.id === favId) : null;
    if (favId && !bestaand) return { status: 404, error: 'Onbekende favoriete plek.' };
    if (!bestaand && lijst.length >= 10) return { status: 409, error: 'Tien favoriete plekken is het maximum; haal er eerst een weg.' };
    const f = bestaand || { id: ctx.id('fv') };
    Object.assign(f, { naam, lat: plek.lat, lng: plek.lng, bron: plek.bron });
    if (!bestaand) lijst.push(f);
    ctx.save();
    return { ok: true, favoriet: f };
  }

  const favLijst = session => ({ ok: true, favorieten: favsVan(session.key) });

  return { plekBepaal, plekLijst, ovHaltes: haltes, favZet, favLijst };
};
