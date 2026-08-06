/* Mobility OS (deelmodule): de vervoersopdracht. Een directe taxirit, een
   geplande luchthaventransfer, een pendelrit, een rolstoelrit en een
   helikoptertransfer zijn hier ALLEMAAL hetzelfde ding, met een andere
   ritsoort en andere eisen. Dat is de hele winst: dispatch, matching,
   meldingen en afrekening hoeven maar een vorm te kennen.

   De statusketen staat in ./keten, de voortgang in ./voortgang, het oplossen
   van vertrek en bestemming in ./plekken. Hier staat wat een opdracht IS en
   hoe hij ontstaat.

   DE PRIJS STAAT VAST BIJ HET AANVRAGEN. Het prijsmodel wordt op de opdracht
   GEKOPIEERD en niet als verwijzing bewaard. Zet een vervoerder morgen zijn
   tarief omhoog, dan verandert de prijs van een rit die gisteren geboekt is
   niet mee. Een verwijzing had dat wel gedaan, stil, en dat is precies het
   soort fout dat pas op een factuur zichtbaar wordt. */

const { CATEGORIEEN } = require('./voertuigcatalogus');

/* Ritsoort -> de module die aan moet staan. Een ritsoort waarvan de module
   uit staat, bestaat in dat gebied niet; de aanvraag wordt geweigerd met de
   reden uit het register. */
const RITSOORT_MODULE = {
  direct: 'ride_hailing',
  gepland: 'scheduled_rides',
  retour: 'scheduled_rides',
  uurrit: 'ride_hailing',
  daghuur: 'scheduled_rides',
  luchthaven: 'ride_hailing',
  gedeeld: 'shared_rides',
  pendel: 'corporate_shuttles',
  school: 'school_transport',
  medisch: 'medical_transport',
  evenement: 'event_transport',
  ervaring: 'experience_transport',
  multimodaal: 'public_transport_planner'
  // 'charter' staat er bewust NIET in: welke module daarvoor moet draaien
  // hangt aan het voertuig (helikopter, vliegtuig of boot) en wordt hieronder
  // uit de categorie gehaald. Een vaste keuze hier zou een botcharter door de
  // helikopterpoort laten lopen.
};
const RITSOORTEN = Object.keys(RITSOORT_MODULE).concat('charter');

// het standaard prijsmodel als een vervoerder niets heeft ingesteld (in centen)
const STANDAARD_TARIEF = { basis: 350, perKm: 220, perMin: 40, minimum: 700, wachtPerMin: 45 };

module.exports = (ctx) => {
  const { db, save, id, schoon, nu, haversine, etaMinutes, modAan, plekBepaal,
    findSupplier, codenaamVan } = ctx;

  function ensureOpdrachten() {
    if (!Array.isArray(db.data.mobOpdrachten)) db.data.mobOpdrachten = [];
  }
  const opdrachtMet = ref => { ensureOpdrachten(); return db.data.mobOpdrachten.find(o => o.ref === ref) || null; };

  /* Welke module hoort bij deze aanvraag? Voor een charter komt het antwoord
     uit het voertuig, voor de rest uit de ritsoort. */
  function moduleVoor(ritsoort, categorie) {
    if (ritsoort === 'charter') {
      const c = CATEGORIEEN[categorie];
      if (!c) return null;
      return c.module;
    }
    return RITSOORT_MODULE[ritsoort] || null;
  }

  function tariefVan(vervoerderCode) {
    const s = vervoerderCode ? findSupplier(vervoerderCode) : null;
    const t = (s && s.settings && s.settings.mobTarief) || null;
    if (!t) return Object.assign({}, STANDAARD_TARIEF);
    return { basis: Number(t.basis) || 0, perKm: Number(t.perKm) || 0, perMin: Number(t.perMin) || 0,
      minimum: Number(t.minimum) || 0, wachtPerMin: Number(t.wachtPerMin) || 0 };
  }

  // basis + kilometers + minuten, met een bodem. Alles in centen.
  function prijsUit(tarief, km, minuten) {
    const rauw = tarief.basis + tarief.perKm * km + tarief.perMin * minuten;
    return Math.max(tarief.minimum || 0, Math.round(rauw));
  }

  /* Een opdracht aanmaken. `actor` beschrijft wie hem plaatst: een lid
     (session), een dispatcher namens een beller, of een bedrijfsplanner.
     Wat er in de opdracht belandt is altijd de CODENAAM, nooit de echte naam
     -- de chauffeur hoeft te weten waar hij heen moet, niet wie hij ophaalt. */
  function opdrachtMaak(actor, body = {}) {
    ensureOpdrachten();
    const ritsoort = RITSOORTEN.includes(body.ritsoort) ? body.ritsoort : 'direct';
    const categorie = CATEGORIEEN[body.categorie] ? body.categorie : null;
    const waar = { stad: schoon(body.stad, 40) || actor.stad || null, land: schoon(body.land, 2) || null,
      org: actor.org || null, groep: actor.groep || null, key: actor.key || null, vervoerder: schoon(body.vervoerder, 20) || null };

    const modId = moduleVoor(ritsoort, categorie);
    if (!modId) return { status: 400, error: 'Kies een voertuigcategorie voor een charter.' };
    const m = modAan(modId, waar);
    if (!m.aan) return { status: 409, error: 'Dit vervoer is hier niet beschikbaar: ' + m.reden, module: modId };

    const van = plekBepaal(body.van, actor.session);
    if (van.error) return { status: 400, error: 'Vertrekpunt: ' + van.error };
    const naar = plekBepaal(body.naar, actor.session);
    if (naar.error) return { status: 400, error: 'Bestemming: ' + naar.error };

    const stops = [];
    for (const s of (Array.isArray(body.stops) ? body.stops : []).slice(0, 8)) {
      const p = plekBepaal(s, actor.session);
      if (p.error) return { status: 400, error: 'Tussenstop: ' + p.error };
      stops.push(p);
    }

    // afstand over de punten heen, dus mét de tussenstops erin
    const punten = [van].concat(stops, [naar]);
    let meters = 0;
    for (let i = 1; i < punten.length; i++) meters += haversine(punten[i - 1], punten[i]) || 0;
    const km = Math.round((meters / 1000) * 10) / 10;
    const cat = categorie ? CATEGORIEEN[categorie] : null;
    const wijze = cat && cat.laag === 'lucht' ? 'flying' : (cat && cat.laag === 'water' ? 'sailing' : 'driving');
    const minuten = etaMinutes(meters, wijze) || Math.max(5, Math.round(km * 2));

    const tarief = tariefVan(waar.vervoerder);
    const reizigers = Math.min(60, Math.max(1, Math.round(Number(body.reizigers) || 1)));
    const bagage = Math.min(99, Math.max(0, Math.round(Number(body.bagage) || 0)));

    /* Boekingsvorm: 'aanvraag' en 'ervaring' gaan NOOIT automatisch naar een
       chauffeur. Daar zit een mens tussen, en dat is geen ontwerpluxe maar de
       reden dat de module bestaat -- zie modulecatalogus.js. */
    const boeking = cat ? cat.boeking : 'direct';

    /* Op rekening van een bedrijf? Dan langs de zakelijke poort (./zakelijk):
       werkt deze reiziger daar, past de rit in het beleid, moet er iemand
       naar kijken. Hier, want ELKE zakelijke rit komt hierlangs. */
    const prijs = prijsUit(tarief, km, minuten);
    const zk = ctx.zakelijkePoort(actor, { prijs, ritsoort, stad: waar.stad,
      kostenplaats: body.kostenplaats, wanneer: body.vertrek });
    if (zk.error) return zk;

    const o = {
      ref: 'RTG-M-' + ctx.crypto.randomBytes(3).toString('hex').toUpperCase(),
      ritsoort, module: modId, categorie, boeking,
      van, naar, stops,
      vertrekWens: schoon(body.vertrek, 25) || null,        // ISO, of leeg = zo snel mogelijk
      aankomstWens: schoon(body.aankomst, 25) || null,
      reizigers, bagage,
      eisen: {
        rolstoel: !!body.rolstoel,
        kinderzitje: Math.min(4, Math.max(0, Math.round(Number(body.kinderzitjes) || 0))),
        huisdier: !!body.huisdier,
        categorie
      },
      // wie reist, wie betaalt, wie boekt: drie verschillende partijen kunnen dat zijn
      reiziger: actor.key || null,
      reizigerCodenaam: actor.key ? codenaamVan(actor.key) : (schoon(body.naamOpDeRit, 40) || 'Telefonische boeking'),
      betaler: body.betaler === 'organisatie' && actor.org ? { soort: 'organisatie', code: actor.org } : { soort: 'reiziger', key: actor.key || null },
      organisatie: actor.org || null,
      medewerkerNaam: zk.medewerker || null, goedkeuring: zk.goedkeuring || null,
      kostenplaats: schoon(body.kostenplaats, 40) || null,
      geboektDoor: actor.soort || 'lid',
      vervoerder: waar.vervoerder, voertuig: null, chauffeur: null,
      km, minuten, tarief, prijs,
      annulering: { gratisTotMin: 5, kostenDeel: 0.5 },
      veiligheid: { deelCode: ctx.crypto.randomBytes(4).toString('hex'), noodcontact: !!body.noodcontact },
      notitie: schoon(body.notitie, 200) || null,
      status: 'aangevraagd', gemaakt: nu(),
      gebeurtenissen: [{ soort: 'ride.requested', at: nu(), door: actor.soort || 'lid' }],
      stad: waar.stad
    };
    db.data.mobOpdrachten.unshift(o);
    save();
    return { ok: true, opdracht: opdrachtBeeld(o) };
  }

  /* Wat de reiziger en de dispatcher zien. `vol` geeft de chauffeurs- en
     veiligheidsgegevens erbij; die horen niet in een lijstweergave. */
  function opdrachtBeeld(o, vol) {
    const b = { ref: o.ref, ritsoort: o.ritsoort, module: o.module, categorie: o.categorie, boeking: o.boeking,
      van: o.van, naar: o.naar, stops: o.stops || [],
      vertrekWens: o.vertrekWens, aankomstWens: o.aankomstWens,
      reizigers: o.reizigers, bagage: o.bagage, eisen: o.eisen,
      reizigerCodenaam: o.reizigerCodenaam, betaler: o.betaler, organisatie: o.organisatie,
      medewerker: o.medewerkerNaam || null, goedkeuring: o.goedkeuring || null,
      kostenplaats: o.kostenplaats, geboektDoor: o.geboektDoor,
      vervoerder: o.vervoerder, voertuig: o.voertuig, chauffeur: o.chauffeur,
      km: o.km, minuten: o.minuten, prijs: o.prijs, tarief: o.tarief,
      status: o.status, gemaakt: o.gemaakt, stad: o.stad, notitie: o.notitie,
      annulering: o.annulering, afgerekend: o.afgerekend || null };
    if (vol) { b.veiligheid = o.veiligheid; b.gebeurtenissen = o.gebeurtenissen || []; }
    return b;
  }

  const opdrachtenVan = key => { ensureOpdrachten(); return db.data.mobOpdrachten.filter(o => o.reiziger === key); };
  const opdrachtenVanVervoerder = code => { ensureOpdrachten(); return db.data.mobOpdrachten.filter(o => o.vervoerder === code); };
  // een rit die op akkoord van de werkgever wacht, hoort op geen enkel planbord
  const wachtOpAkkoord = o => !!(o.goedkeuring && o.goedkeuring.status === 'wacht');
  const opdrachtenOpen = () => { ensureOpdrachten();
    return db.data.mobOpdrachten.filter(o => !['afgerekend', 'geannuleerd'].includes(o.status) && !wachtOpAkkoord(o)); };

  return { RITSOORTEN, RITSOORT_MODULE, STANDAARD_TARIEF, ensureOpdrachten, opdrachtMet, opdrachtMaak,
    opdrachtBeeld, opdrachtenVan, opdrachtenVanVervoerder, opdrachtenOpen, wachtOpAkkoord,
    moduleVoor, tariefVan, prijsUit };
};
