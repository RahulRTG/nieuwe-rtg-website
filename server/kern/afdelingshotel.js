/* Elke afdeling zijn eigen hotel. Niet als luxe-speeltje, maar omdat een
   afdeling die mensen laat overkomen -- een lab dat een gastonderzoeker
   haalt, HR met sollicitanten uit een andere stad, de meldkamer met een
   nachtdienst die niet meer veilig naar huis rijdt -- een eigen plek nodig
   heeft die zij zelf beheert.

   Elk hotel hangt aan een kamer-id van RTG Kantoren (dezelfde afdelingen).
   Bij het eerste bezoek staat het er: een klein, af hotel met vier
   kamertypen, en de afdeling stelt de rest zelf in. Boekingen gaan op
   codenaam (privacy by design) en zijn nooit "betaald" -- een interne
   overnachting wordt intern verrekend, en dat zeggen we ook zo. */
module.exports = ({ db, save, crypto }) => {
  const nu = () => new Date().toISOString();
  const d = () => db.data;
  const hotels = () => { if (!d().afdHotels || typeof d().afdHotels !== 'object') d().afdHotels = {}; return d().afdHotels; };
  const boekingen = () => { if (!Array.isArray(d().afdHotelBoekingen)) d().afdHotelBoekingen = []; return d().afdHotelBoekingen; };

  /* De standaardkamers waarmee elk afdelingshotel opent. Bewust klein: een
     afdeling die groeit, zet er zelf kamers bij. */
  const STANDAARD = [
    { soort: 'werkkamer', naam: 'Werkkamer', beschrijving: 'Eenpersoons, groot bureau, snelle lijn.', aantal: 4 },
    { soort: 'rustkamer', naam: 'Rustkamer', beschrijving: 'Verduisterd, voor wie na een nachtdienst niet meer rijdt.', aantal: 2 },
    { soort: 'gastensuite', naam: 'Gastensuite', beschrijving: 'Voor bezoek van buiten: ruim, eigen zit.', aantal: 2 },
    { soort: 'gezinskamer', naam: 'Gezinskamer', beschrijving: 'Twee slaapkamers, voor wie met gezin overkomt.', aantal: 1 }
  ];

  const schoonTekst = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n);
  const geldigeDatum = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const raakt = (aVan, aTot, bVan, bTot) => aVan < bTot && bVan < aTot;

  /* Het hotel van een afdeling; komt er bij het eerste bezoek vanzelf. */
  function hotelVan(kamerId, kamerNaam) {
    const id = String(kamerId || '').trim();
    if (!id) return null;
    const h = hotels();
    if (!h[id]) {
      h[id] = { kamer: id, naam: (kamerNaam || id) + ' Huis',
        motto: 'Het huis van de afdeling: dichtbij het werk, ver van de drukte.',
        kamers: STANDAARD.map((k, i) => Object.assign({ id: 'K' + (i + 1) }, k)),
        open: true, geopend: nu() };
      save();
    }
    return h[id];
  }

  const eenheden = (hotel) => hotel.kamers.reduce((s, k) => s + k.aantal, 0);

  function vrijeKamers(kamerId, van, tot) {
    const hotel = hotels()[kamerId];
    if (!hotel) return [];
    const bezet = {};
    for (const b of boekingen()) {
      if (b.kamer !== kamerId || b.status === 'geannuleerd') continue;
      if (!raakt(van, tot, b.van, b.tot)) continue;
      bezet[b.soort] = (bezet[b.soort] || 0) + 1;
    }
    return hotel.kamers.map(k => Object.assign({}, k, { vrij: Math.max(0, k.aantal - (bezet[k.soort] || 0)) }));
  }

  function overzicht(kamerId, kamerNaam) {
    const hotel = hotelVan(kamerId, kamerNaam);
    if (!hotel) return { status: 400, error: 'Onbekende afdeling.' };
    const vandaag = new Date().toISOString().slice(0, 10);
    const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const lopend = boekingen().filter(b => b.kamer === kamerId && b.status !== 'geannuleerd' && raakt(vandaag, morgen, b.van, b.tot));
    return { ok: true, hotel: { kamer: hotel.kamer, naam: hotel.naam, motto: hotel.motto, open: hotel.open },
      kamers: vrijeKamers(kamerId, vandaag, morgen), eenheden: eenheden(hotel),
      vannacht: lopend.length,
      bezettingPct: eenheden(hotel) ? Math.round(lopend.length / eenheden(hotel) * 100) : 0,
      komend: boekingen().filter(b => b.kamer === kamerId && b.status !== 'geannuleerd' && b.van >= vandaag).slice(0, 20),
      verrekening: 'Overnachtingen worden intern verrekend met de afdeling; er wordt niets afgeschreven van een persoon.' };
  }

  function hotelZet(kamerId, data) {
    const hotel = hotels()[kamerId];
    if (!hotel) return { status: 404, error: 'Deze afdeling heeft nog geen hotel.' };
    data = data || {};
    if (data.naam) hotel.naam = schoonTekst(data.naam, 60);
    if (data.motto) hotel.motto = schoonTekst(data.motto, 160);
    if (typeof data.open === 'boolean') hotel.open = data.open;
    if (data.kamerSoort) {
      const k = hotel.kamers.find(x => x.soort === data.kamerSoort);
      const n = Math.round(Number(data.aantal));
      if (!k) return { status: 404, error: 'Dat kamertype heeft dit hotel niet.' };
      if (!Number.isFinite(n) || n < 0 || n > 200) return { status: 400, error: 'Kies tussen 0 en 200 kamers.' };
      k.aantal = n;
    }
    save();
    return { ok: true, hotel };
  }

  /* Een overnachting boeken, op codenaam. De afdeling boekt voor wie
     overkomt; het systeem bewaakt alleen dat er plek is. */
  function boek(kamerId, kamerNaam, data) {
    const hotel = hotelVan(kamerId, kamerNaam);
    if (!hotel) return { status: 400, error: 'Onbekende afdeling.' };
    if (!hotel.open) return { status: 409, error: 'Dit afdelingshuis is tijdelijk gesloten.' };
    data = data || {};
    const van = data.van, tot = data.tot;
    if (!geldigeDatum(van) || !geldigeDatum(tot) || van >= tot) return { status: 400, error: 'Kies een geldige periode (van voor tot).' };
    const soort = String(data.soort || '');
    const kamer = hotel.kamers.find(k => k.soort === soort);
    if (!kamer) return { status: 404, error: 'Dat kamertype bestaat hier niet.' };
    const vrij = vrijeKamers(kamerId, van, tot).find(k => k.soort === soort);
    if (!vrij || vrij.vrij <= 0) return { status: 409, error: 'Dit kamertype is die nachten vol; kies een ander type of andere datums.' };
    const voor = schoonTekst(data.voor, 40);
    if (!voor) return { status: 400, error: 'Voor wie is de kamer? (codenaam)' };
    const b = {
      ref: 'AH-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      kamer: kamerId, kamerNaam: hotel.naam, soort, soortNaam: kamer.naam,
      voor, reden: schoonTekst(data.reden, 160),
      van, tot, status: 'geboekt', at: nu()
    };
    boekingen().unshift(b);
    if (boekingen().length > 20000) boekingen().length = 20000;
    save();
    return { ok: true, boeking: b };
  }

  function annuleer(kamerId, ref) {
    const b = boekingen().find(x => x.ref === String(ref || '') && x.kamer === kamerId);
    if (!b) return { status: 404, error: 'Die boeking staat niet bij deze afdeling.' };
    if (b.status === 'geannuleerd') return { status: 409, error: 'Deze boeking is al geannuleerd.' };
    b.status = 'geannuleerd';
    save();
    return { ok: true, ref: b.ref };
  }

  /* Het overzicht voor de boardroom: alle afdelingshuizen naast elkaar. */
  function alle() {
    const vandaag = new Date().toISOString().slice(0, 10);
    const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const rijen = Object.values(hotels()).map(h => {
      const vannacht = boekingen().filter(b => b.kamer === h.kamer && b.status !== 'geannuleerd' && raakt(vandaag, morgen, b.van, b.tot)).length;
      return { kamer: h.kamer, naam: h.naam, open: h.open, eenheden: eenheden(h), vannacht,
        bezettingPct: eenheden(h) ? Math.round(vannacht / eenheden(h) * 100) : 0 };
    }).sort((a, b) => b.bezettingPct - a.bezettingPct);
    return { ok: true, huizen: rijen,
      totaal: { huizen: rijen.length, eenheden: rijen.reduce((s, r) => s + r.eenheden, 0),
        vannacht: rijen.reduce((s, r) => s + r.vannacht, 0) } };
  }

  return { afdelingshotel: { STANDAARD, overzicht, hotelZet, boek, annuleer, alle, vrijeKamers } };
};
