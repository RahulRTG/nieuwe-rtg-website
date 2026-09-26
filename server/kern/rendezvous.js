/* Rendez-vous: besloten introductions en Society op codenaam. */
module.exports = ({ db, save, crypto, codenaamVan, anthropic, notify, accounts, leeftijdVan, tableZet, handleVanPin, sociaalRate,
  connectionBlocking, media, sseToCustomer, connectionMediaTicketSecret, partnerSuppliers, partnerBookings }) => {
  const Projection = require('./connection-projection');
  const ConnectionPartner = require('./connection-partner');
  const nu = () => new Date().toISOString();
  const { ontmoetPoort } = require('./ontmoetpoort').maakOntmoetpoort({ accounts, leeftijdVan });
  const mag = key => ontmoetPoort(key, 'Rendez-vous');
  /* Presence leest uitsluitend wat het lid hier zelf deelt, nooit TravelOS. */
  const AW = require('./rendezvous-aanwezig');
  /* Private Availability deelt pas na een match de doorsnede. */
  const B = require('./beschikbaar');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const lijstUit = (v, max, elk) => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => schoon(x, elk || 40)).filter(Boolean).slice(0, max || 12);

  const eigen = require('./eigencollectie')({ db, domein: 'kern/rendezvous', bezit: { rendezvous: 'kaart' } });

  function R() {
    const r = eigen.bak('rendezvous', (b) =>
      Object.assign(b, { profielen: {}, likes: {}, passes: {}, blokkades: {}, meldingen: [] }));
    for (const v of ['profielen', 'likes', 'passes', 'blokkades']) if (!r[v] || typeof r[v] !== 'object') r[v] = {};
    if (!Array.isArray(r.meldingen)) r.meldingen = [];
    return r;
  }
  /* Codenaam komt uit de accountgids, niet uit sessiecontext. */
  const codenaam = key => (codenaamVan ? codenaamVan(key) : '') || 'Een lid';
  const leveranciers = () => typeof partnerSuppliers === 'function' ? partnerSuppliers() : [];
  const boekingen = () => typeof partnerBookings === 'function' ? partnerBookings() : [];
  const partnerCandidates = (program, context) => ConnectionPartner.candidates(leveranciers(), program,
    { ...(context || {}), bookings: boekingen() }).map(s => Projection.project(Projection.NAMES.CONNECTION_PARTNER_OFFICE, {
      code: s.code, name: s.name, city: s.city, location: s.loc && s.loc.label, program,
      services: ConnectionPartner.stored(s, program).services
    }));
  const partnerEligible = (code, program, context) => {
    const s = leveranciers().find(x => x.code === code);
    const reserveringen = boekingen();
    return !!(s && ConnectionPartner.eligible(s, program, { ...(context || {}), bookings: reserveringen,
      activeBookings: ConnectionPartner.activeBookings(reserveringen, code, context && context.date, context && context.time) }).ok);
  };
  /* Uit de dating-premium-ronde op main: een blokkade werkt in BEIDE richtingen,
     wie u blokkeerde ziet u ook niet meer. */
  const geblokkeerd = (r, a, b) => !!((r.blokkades[a] && r.blokkades[a][b]) || (r.blokkades[b] && r.blokkades[b][a])
    || (connectionBlocking && connectionBlocking.isGeblokkeerd(a, b)));
  // overlap van twee locatielijsten, hoofdletterongevoelig, met de oorspronkelijke schrijfwijze
  function gedeeld(a, b) {
    const bl = (b || []).map(x => x.toLowerCase());
    return (a || []).filter(x => bl.includes(x.toLowerCase()));
  }
  const { rvKies, rvMeldingen } = require('./rendezvous-acties')({
    R, save, crypto, notify, schoon, nu, codenaam, gedeeld, geblokkeerd, mag, connectionBlocking, Projection
  });

  function rvProfielGet(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const r = R();
    const p = r.profielen[key] || { aan: false, over: '', zoekt: '', wensen: [], locaties: [] };
    /* Alles wat we van u weten staat hier, ook de aanwezigheid: ONTMOETEN.md
       par. 2.1 eist dat een lid het kan zien en kan wissen. */
    return { status: 200, ...Projection.project(Projection.NAMES.RENDEZVOUS_PROFILE_OWNER,
      { codenaam: codenaam(key), rooster: B.rooster(),
        profiel: { aan: !!p.aan, over: p.over || '', zoekt: p.zoekt || '', wensen: p.wensen || [],
        locaties: p.locaties || [], thuis: p.thuis || '', aanwezig: AW.schoonAanwezig(p.aanwezig, schoon),
        beschikbaar: B.schoonBeschikbaar(p.beschikbaar), media: profileMedia ? profileMedia.projecteer(key, key, 'owner') : [] } }) };
  }
  function rvProfiel(key, b) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const r = R();
    const p = r.profielen[key] || { at: nu() };
    if (b.aan !== undefined) p.aan = b.aan === true;
    if (b.over !== undefined) p.over = schoon(b.over, 600);
    if (b.zoekt !== undefined) p.zoekt = schoon(b.zoekt, 300);
    if (b.wensen !== undefined) p.wensen = lijstUit(b.wensen, 12, 40);
    if (b.locaties !== undefined) p.locaties = lijstUit(b.locaties, 12, 40);
    if (b.thuis !== undefined) p.thuis = schoon(b.thuis, 40);
    // de lijst wordt VERVANGEN, niet aangevuld; zie de kop van ./rendezvous-aanwezig.js
    if (b.aanwezig !== undefined) p.aanwezig = AW.schoonAanwezig(b.aanwezig, schoon);
    if (b.beschikbaar !== undefined) p.beschikbaar = B.schoonBeschikbaar(b.beschikbaar);
    p.bij = nu();
    r.profielen[key] = p; save();
    return { status: 200, ok: true };
  }

  // wie mag ik zien: andere leden met een actief profiel, niet ikzelf, niet weggeveegd
  function matchesVan(key) {
    const r = R();
    const mijn = r.likes[key] || {};
    const mij = r.profielen[key] || { locaties: [] };
    const uit = [];
    for (const t of Object.keys(mijn)) {
      if (!geblokkeerd(r, key, t) && r.likes[t] && r.likes[t][key] && r.profielen[t]) {
        const g = gedeeld(mij.locaties, r.profielen[t].locaties);
        const samen = AW.overlapTussen(mij, r.profielen[t]);
        // waar u tegelijk bent gaat voor op waar u allebei weleens komt
        uit.push(Projection.project(Projection.NAMES.RENDEZVOUS_MATCH,
          { id: t, codenaam: codenaam(t), gedeeldeLocaties: g, samen,
          // pas hier, na de wederzijdse like: een dagdeel of niets
          wanneer: B.zin(mij.beschikbaar, r.profielen[t].beschikbaar),
          voorstel: (samen[0] && samen[0].stad) || g[0] || null, sinds: mijn[t],
          media: profileMedia ? profileMedia.projecteer(key, t, 'match') : [] }));
      }
    }
    uit.sort((a, b) => String(b.sinds).localeCompare(String(a.sinds)));
    return uit;
  }
  function rvMatches(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    return { status: 200, matches: matchesVan(key) };
  }
  /* Alles weghalen wat u over uw aanwezigheid heeft opgegeven, in een handeling.
     ONTMOETEN.md par. 2.1 eist dat een lid ziet wat er van hem bekend is en het
     kan wissen; "zet elk venster los terug op leeg" is dat niet. Dit raakt
     alleen de aanwezigheid -- uw profiel, uw matches en uw gesprekken blijven. */
  function rvAanwezigWis(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const r = R();
    const p = r.profielen[key];
    if (p) { p.aanwezig = []; p.thuis = ''; p.bij = nu(); save(); }
    return { status: 200, ok: true, aanwezig: [], thuis: '' };
  }

  const { profileMedia, communication } = require('./rendezvous-connection-setup')({ R, db, save, crypto,
    media, schoon, mag, geblokkeerd, connectionBlocking, connectionMediaTicketSecret, notify, sseToCustomer });

  // Together: twee eenzijdige verklaringen, "samen" is de projectie erover
  const samen = require('./rendezvous-samen')({ R, mag, codenaam, nu, save, geblokkeerd, Projection });
  const ontdek = require('./rendezvous-ontdek')({ R, AW, B, mag, codenaam, gedeeld, save, notify, nu, geblokkeerd, Projection, profileMedia,
    partnerVan: samen.rvPartnerVan });
  // The Table, Moment en Encounter (een tweezijdige ja, twee momenten)
  const kring = require('./rendezvous-kring')({ R, mag, codenaam, schoon, nu, save, crypto, notify, handleVanPin, sociaalRate, geblokkeerd, Projection, profileMedia, partnerCandidates, partnerEligible });
  const { rvDate } = require('./rendezvous-date')({ R, AW, B, mag, codenaam, schoon, matchesVan, anthropic, Projection });
  // Arrange It: Rahul stelt samen, beiden keuren goed, De Rechterhand regelt
  const arrange = require('./rendezvous-arrange')({ R, AW, B, mag, codenaam, schoon, nu, save,
    matchesVan, tableZet, notify, Projection, partnerCandidates, partnerEligible });
  const concierge = require('./rendezvous-concierge')({ R, mag, schoon, nu, save, crypto, notify, partnerCandidates, partnerEligible });
  const circles = require('./rendezvous-circles')({ R, mag, schoon, nu, save, crypto, notify, geblokkeerd });

  const stateApi = require('./rendezvous-state')({ R, mag, nu, geblokkeerd, ontdek, samen, matchesVan, communication });
  /* rvKies en rvMeldingen komen uit de dating-premium-ronde (main): kiezen met
     drie acties (like/pas/blokkeer) en de meldingen voor kantoor. De routelaag
     stuurt like en pas daar al langs, dus rvLike/rvPas uit ontdek bestaan niet
     meer -- twee mutatiepaden naar dezelfde like is precies de dubbeling die de
     samenvoeging eerder in het reisscherm liet zien. */
  return { rvProfielGet, rvProfiel, ...ontdek, ...kring, rvMatches, rvDate, rvAanwezigWis,
    rvFotoUpload: profileMedia.upload, rvFotoPubliceer: profileMedia.publiceer,
    rvFotoVerwijder: profileMedia.verwijder, rvFotoOrden: profileMedia.orden, rvFotoLever: profileMedia.lever,
    rvCommStatus: communication.status, rvCommConsent: communication.consent, rvCommText: communication.sendText,
    rvCommRemove: communication.removeMessage, rvCommReport: communication.reportMessage,
    rvCommMedia: communication.sendMedia, rvCommCallStart: communication.startCall,
    rvCommCallAnswer: communication.answer, rvCommCallSignal: communication.sendSignal,
    rvCommCallPoll: communication.poll, rvCommCallEnd: communication.end, rvCommMediaLever: communication.deliver,
    rvKies, rvMeldingen, ...concierge, ...circles,
    ...stateApi,
    rvArrange: arrange.rvArrange, rvAkkoord: arrange.rvAkkoord,
    rvArrangeQueue: arrange.rvArrangeQueue, rvArrangeFulfil: arrange.rvArrangeFulfil,
    rvSamen: samen.rvSamen, rvSamenZet: samen.rvSamenZet };
};
