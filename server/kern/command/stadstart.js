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

const { NIVEAUS } = require('../frictie');

const MAX_STEDEN = 100;

function maakStadstart({ opslag, save, journaal, landpakket, functies, plaatsNorm, weefsel }) {
  /* Het weefsel mag lui binnenkomen: het hangt pas aan de kern na de aanbouw,
     en deze laag wordt daarvoor gebouwd. Dezelfde late binding als bij
     genrepuls en de API-poort. */
  const W = () => (typeof weefsel === 'function' ? weefsel() : weefsel);
  const norm = typeof plaatsNorm === 'function' ? plaatsNorm : (v => String(v || '').toLowerCase().trim());

  const staat = () => opslag.gedeeld.schakelkast();
  function alle() {
    return opslag.bak('steden');
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

    /* Het weefsel. Deze stap STOND op "kan een knop niet doen": de boom droeg
       een geografie zonder sleutel "welke stad". Sinds die verbouwing
       (kern/stadsweefsel/steden.js) draagt hij meerdere wortels, en meet deze
       stap of DEZE stad er echt in staat -- met haar eigen zones. */
    let zones = null;
    try { const w = W(); zones = w && typeof w.weefselZones === 'function' ? w.weefselZones(stad.naam) : null; }
    catch (e) { zones = null; }
    const heeft = Array.isArray(zones) && zones.length > 0;
    uit.push({ stap: 'stadsweefsel', bron: 'kern/stadsweefsel', gedaan: heeft, aard: 'gemeten',
      uitleg: heeft
        ? zones.length + ' zones met hun straatsegmenten staan in het weefsel (' + zones.join(', ') + ')'
        : 'deze stad staat niet in het weefsel. Start hem opnieuw, of zet hem er met de hand in; ' +
          'zonder gebieden hoort een melding uit deze stad nergens bij.' });
    return uit;
  }

  /* WAT ER NA HET STARTEN NOG MENSENWERK BLIJFT. Deze lijst is korter geworden
     doordat het weefsel meerdere steden ging dragen, maar hij is niet leeg --
     en de twee die erbij kwamen zijn eerlijker dan de ene die eraf ging. */
  const MENSENWERK = [
    'de zones hernoemen: een nieuwe stad krijgt het generieke startraster (Centrum, Marina, Boulevard...), en die namen kloppen zelden',
    'er ligt geen wegennet onder een tweede stad; kern/navigatie kent er een, en dat is dat van de eerste stad',
    'Stadsdozen plaatsen: het weefsel kent de zones, maar er staat nog geen sensor in',
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
    /* HET PAKKET MOET AANSTAAN en niet alleen bestaan. Hier stond `!pak.error`,
       en dat was lakser dan de melding eronder belooft: een land waarvan het
       pakket klaarligt maar uitstaat, is precies het geval dat die zin
       beschrijft -- geen munt, geen tarieven, geen loonregels. Gevonden door de
       routetoets, die de melding las en het gedrag ernaast legde. */
    if (!land || !pak || pak.error || !pak.actief) {
      return { error: 'Zet eerst het landpakket van ' + (land || 'dat land') + ' aan. Een stad in een land ' +
        'dat niet is ingericht, is een stad zonder munt, zonder tarieven en zonder loonregels.', status: 409 };
    }

    lijst[sleutel] = { naam: String(naam).slice(0, 60), sleutel, land,
      gestart: new Date().toISOString(), door: String(o.door || 'onbekend'), sluit: [] };

    /* HET WEEFSEL ERBIJ, en dit is de stap die deze knop tot voor kort niet kon
       doen. Hij mag mislukken (geen middelpunt opgegeven, een stad die
       overlapt) -- dan blijft de stap gewoon openstaan met de reden erbij, en
       staat de administratie er alvast. Wat hij NIET doet is de fout inslikken
       en groen melden. */
    const wf = W();
    if (wf && typeof wf.weefselStadErbij === 'function' && o.lat != null && o.lng != null) {
      try {
        const w = wf.weefselStadErbij({ naam: String(naam), lat: o.lat, lng: o.lng, sleutel });
        lijst[sleutel].weefsel = w && w.stad ? { id: w.stad.id, zones: (w.zones || []).length }
          : { fout: (w && w.error) || 'onbekende reden' };
      } catch (e) { lijst[sleutel].weefsel = { fout: e.message }; }
    } else {
      lijst[sleutel].weefsel = { fout: 'geen middelpunt opgegeven (lat en lng), dus er is geen geografie gebouwd' };
    }

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
      journaal.noteer({ actie: 'stad gestart', actor: o.door, niveau: NIVEAUS.hand,
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
    if (journaal) journaal.noteer({ actie: 'stad gestopt', actor: door, niveau: NIVEAUS.hand,
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
