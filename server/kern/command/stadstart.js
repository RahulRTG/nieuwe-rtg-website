/* STADSSTART -- een stad inrichten, en eerlijk zeggen wat een knop niet kan.

   WAT ER ECHT GEBEURT als je hier een stad start:
     - de stad krijgt een regel met een naam, een land en een datum;
     - het landpakket van dat land moet erbij liggen, anders gaat het niet door
       (een stad in een land dat niet is ingericht, is een stad zonder munt,
       zonder tarieven en zonder loonregels);
     - de per-plaats-as van de schakelkast wordt gezet voor de functies die in
       deze stad dicht moeten. Die as bestond al (server/functies/toegang.js) en
       werkt op de genormaliseerde woonplaats van het lid.

   WAT ER NIET GEBEURT, EN WAAROM DAT HIER STAAT. Het stadsweefsel
   (kern/stadsweefsel) draagt vandaag EEN geografie: zes zones op een raster
   rond een middelpunt. Er is geen sleutel "welke stad" in die boom. Een tweede
   stad met eigen zones, eigen Stadsdozen en eigen tijdreeksen is dus geen knop
   maar een verbouwing van die laag.

   Dat had verstopt kunnen worden achter een groene melding. Dat is precies de
   duurste soort knop: iemand start Antwerpen, ziet "ingericht", en ontdekt een
   maand later dat elke meting in de zones van de eerste stad is geboekt. Dus
   meldt deze laag het weefsel als OPENSTAAND, met de reden erbij, en telt hij
   het mee in de mensenwerk-lijst.

   DE STAND IS DUS EERLIJKER DAN DE KNOP. Dat is de bedoeling. */
'use strict';

const MAX_STEDEN = 100;

function maakStadstart({ db, save, journaal, landpakket, functies, plaatsNorm, weefsel }) {
  const norm = typeof plaatsNorm === 'function' ? plaatsNorm : (v => String(v || '').toLowerCase().trim());

  function staat() {
    db.data.techniek = db.data.techniek || {};
    return (db.data.techniek.functies = db.data.techniek.functies || {});
  }
  function alle() {
    if (!db.data.steden || typeof db.data.steden !== 'object') db.data.steden = {};
    return db.data.steden;
  }

  /* Wat er per stad nodig is, met per stap waar het antwoord vandaan komt. */
  function stappen(stad) {
    const uit = [];
    let landOk = false;
    let landUitleg = 'geen land opgegeven';
    if (stad.land) {
      try {
        const st = landpakket ? landpakket.stand(stad.land) : null;
        if (!st || st.error) landUitleg = 'er is geen landpakket voor ' + stad.land;
        else { landOk = !!st.actief; landUitleg = st.actief ? 'het landpakket van ' + stad.land + ' staat aan'
          : 'het landpakket van ' + stad.land + ' bestaat maar staat niet aan'; }
      } catch (e) { landUitleg = 'het landregister is onleesbaar (' + e.message + ')'; }
    }
    uit.push({ stap: 'landpakket', bron: 'LANDEN.json', gedaan: landOk, aard: 'gemeten', uitleg: landUitleg });

    const st = staat();
    const dicht = Object.keys(st).filter(id => st[id] && st[id].perPlaats && st[id].perPlaats[stad.sleutel] === false);
    uit.push({ stap: 'schakelkast', bron: 'server/functies (per-plaats-as)', gedaan: true, aard: 'gemeten',
      uitleg: dicht.length ? dicht.length + ' functie(s) staan hier dicht: ' + dicht.join(', ')
        : 'geen enkele functie staat in deze stad dicht' });

    /* Het weefsel. Dit is de stap die een knop NIET kan doen, en hij staat er
       daarom als openstaand in plaats van als vinkje. */
    let zones = null;
    try { zones = weefsel && typeof weefsel.weefselZones === 'function' ? weefsel.weefselZones() : null; } catch (e) { zones = null; }
    uit.push({ stap: 'stadsweefsel', bron: 'kern/stadsweefsel', gedaan: false, aard: 'gemeten',
      uitleg: 'het weefsel draagt vandaag EEN geografie' +
        (zones ? ' (' + zones.length + ' zones)' : '') + ' zonder sleutel "welke stad". Een tweede stad ' +
        'met eigen zones, Stadsdozen en tijdreeksen is een verbouwing van die laag en geen knop hier.' });
    return uit;
  }

  const MENSENWERK = [
    'de zones, straten en Stadsdozen van deze stad in het weefsel zetten (dat is vandaag een verbouwing, zie de stap hierboven)',
    'een gemeente of beheerder die de openbare-ruimtebesluiten neemt',
    'de lokale tarieven en openingstijden nalopen; het landpakket dekt het land en niet de stad'
  ];

  function kaart(s) {
    const stapjes = stappen(s);
    return {
      naam: s.naam, sleutel: s.sleutel, land: s.land, gestart: s.gestart, door: s.door,
      stappen: stapjes, open: stapjes.filter(x => !x.gedaan).map(x => x.stap),
      mensenwerk: MENSENWERK,
      let: 'deze stand is met opzet eerlijker dan de knop: "gestart" betekent dat de administratie ' +
        'klaarstaat, niet dat de stad draait.'
    };
  }

  function start(naam, opties) {
    const o = opties || {};
    const sleutel = norm(naam);
    if (!sleutel) return { error: 'Een stad heeft een naam nodig.', status: 400 };
    const lijst = alle();
    if (lijst[sleutel]) return { error: 'Die stad staat er al.', status: 409 };
    if (Object.keys(lijst).length >= MAX_STEDEN) return { error: 'Er staan al ' + MAX_STEDEN + ' steden.', status: 409 };

    const land = String(o.land || '').toUpperCase();
    let pak = null;
    try { pak = landpakket ? landpakket.stand(land) : null; } catch (e) { pak = null; }
    if (!land || !pak || pak.error) {
      return { error: 'Kies eerst een land waarvoor een landpakket ligt. Een stad in een land dat niet ' +
        'is ingericht, is een stad zonder munt, zonder tarieven en zonder loonregels.', status: 409 };
    }

    lijst[sleutel] = { naam: String(naam).slice(0, 60), sleutel, land,
      gestart: new Date().toISOString(), door: String(o.door || 'onbekend'), sluit: [] };

    const st = staat();
    for (const id of (Array.isArray(o.sluit) ? o.sluit : [])) {
      if (functies && functies.OP_ID && !functies.OP_ID[id]) continue;
      const cur = (st[id] = st[id] || {});
      cur.perPlaats = cur.perPlaats || {};
      cur.perPlaats[sleutel] = false;
      lijst[sleutel].sluit.push(id);
    }
    save();
    if (journaal) {
      journaal.noteer({ actie: 'stad gestart', actor: o.door, niveau: 'hand',
        objectType: 'stad', objectId: sleutel,
        reden: 'in ' + land + '; ' + MENSENWERK.length + ' punten blijven mensenwerk' });
    }
    return kaart(lijst[sleutel]);
  }

  function stop(naam, door) {
    const sleutel = norm(naam);
    const s = alle()[sleutel];
    if (!s) return { error: 'Die stad staat er niet.', status: 404 };
    const st = staat();
    for (const id of (s.sluit || [])) {
      if (st[id] && st[id].perPlaats) delete st[id].perPlaats[sleutel];
    }
    delete alle()[sleutel];
    save();
    if (journaal) journaal.noteer({ actie: 'stad gestopt', actor: door, niveau: 'hand',
      objectType: 'stad', objectId: sleutel, reden: 'de per-plaats-standen zijn weer weg' });
    return { gestopt: sleutel };
  }

  function stand(naam) {
    const lijst = alle();
    if (naam) {
      const s = lijst[norm(naam)];
      return s ? kaart(s) : { error: 'Die stad staat er niet.', status: 404 };
    }
    return {
      steden: Object.keys(lijst).map(k => kaart(lijst[k])),
      max: MAX_STEDEN,
      let: 'het stadsweefsel draagt vandaag EEN geografie. Een tweede stad met eigen zones en ' +
        'Stadsdozen is een verbouwing van die laag; deze knop richt de administratie in en doet ' +
        'niet alsof hij meer doet.'
    };
  }

  return { start, stop, stand };
}

module.exports = { maakStadstart, MAX_STEDEN };
