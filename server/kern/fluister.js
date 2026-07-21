/* De Butler-motor: de persoonlijke assistent van het hele ecosysteem.
   Voor leden heet hij De Butler (een gezicht, geen tweede assistent naast
   de bestaande AI: dit IS die AI); voor personeel en zaken is dezelfde
   motor "uw assistent". Iedereen gebruikt hem voor zichzelf, en hij leert
   de gebruiker kennen. De interne naam fluister blijft, zodat opslag en
   routes stabiel zijn.

   Twee soorten geheugen, allebei van de gebruiker zelf:
   - weetjes: wat je hem expliciet vertelt ("onthoud dat ik cava drink,
     nooit rode wijn"); wisbaar per stuk of in een keer, en altijd
     opvraagbaar ("wat weet je over mij?") - volledige transparantie.
   - focus: welke schermen en kaarten je het meest gebruikt (geteld door de
     inklap-laag in de apps). Daarmee weet hij waar je heen wilt en klapt
     de app precies open wat jouw ogen nodig hebben.

   Antwoorden komen van Claude als er een sleutel is, anders van de eigen
   regels; het geheugen en de actuele stand van het lid (bestellingen,
   reserveringen, assets) reizen als context mee.

   En hij fluistert ook zelf: seintjes. Uit datums in je eigen weetjes
   (een verjaardag), uit je agenda (reserveringen, check-in, je
   24-uursblokken) en uit lopende zaken (bedenktijd, terugkoop). Verder
   onthoudt hij de laatste beurten van het gesprek, zodat een vervolgvraag
   gewoon begrepen wordt; ook dat gesprek wist "vergeet alles".

   Nieuwe seintjes worden een echte melding op het toestel (fluisterPush,
   met dedupe zodat niets twee keer piept). En hij kan het ook dóén:
   "zet mijn 24 uur op 3 augustus" boekt het blok, "reserveer bij Sal de
   Mar morgen om 20:00 met 2 personen" vraagt de tafel aan, "stuur 15
   euro naar Noordelijke Ster" maakt een Tik - alleen voor het lid zelf,
   en het antwoord zegt eerlijk wat er is gebeurd.

   De drempel: alles met geld (een Tik) of een claim op een gedeeld
   object (het 24-uursblok) wordt eerst een voorstel dat u bevestigt met
   "ja" (of afblaast met "nee"). Een tafelreservering blijft direct:
   gratis en altijd annuleerbaar. */
module.exports = ({ db, save, schoon, anthropic, notify, reserveerTafel, annuleerReservering, assetGebruik, zorgVoor, pay, acties, verblijfBoek, retailLegApart, retailKlantProfiel }) => {
  /* De acties-registry: vermogens die pas na deze module op de kern komen
     (bestellen, tickets, ritten worden in routes/member.js geregistreerd,
     want daar wonen die regels). Het contract: elke actie is een functie
     (session, body) die { ok, ... } of { status, error } teruggeeft -
     exact dezelfde functie die de app-knoppen bedient, dus geen drift. */
  const nu = () => new Date().toISOString();
  // hetzelfde brein, een passend gezicht: De Butler voor leden, "uw
  // assistent" voor personeel en zaken
  const wieBen = () => 'Rahul'; // het ene AI-hart: iedereen praat met Rahul
  const lijsten = () => { if (!db.data.fluister) db.data.fluister = {}; };
  const van = key => {
    lijsten();
    const p = db.data.fluister[key] || (db.data.fluister[key] = { weetjes: [], focus: {}, at: nu() });
    if (!Array.isArray(p.gesprek)) p.gesprek = [];
    return p;
  };

  function fluisterOnthoud(key, tekstIn) {
    // alleen een echte tekst kan een weetje worden; een array/object laat
    // schoon() zelf vallen (dus geen "1,2,3" uit een gecoerced array)
    const rauw = typeof tekstIn === 'string' ? tekstIn.replace(/^onthoud\s+(dat\s+|alsjeblieft\s+)?/i, '') : tekstIn;
    const tekst = schoon(rauw, 200);
    if (!tekst) return { status: 400, error: 'Vertel me wat ik moet onthouden.' };
    const p = van(key);
    if (!p.weetjes.some(w => w.tekst.toLowerCase() === tekst.toLowerCase())) {
      p.weetjes.push({ tekst, at: nu() });
      p.weetjes = p.weetjes.slice(-30);
      save();
    }
    return { ok: true, weetjes: p.weetjes };
  }
  function fluisterVergeet(key, wat) {
    const p = van(key);
    if (wat === 'alles') p.weetjes = [];
    else {
      const i = parseInt(wat, 10);
      if (!(i >= 0) || i >= p.weetjes.length) return { status: 404, error: 'Dat weetje ken ik niet.' };
      p.weetjes.splice(i, 1);
    }
    save();
    return { ok: true, weetjes: p.weetjes };
  }
  // de inklap-laag stuurt door wat je het meest gebruikt; alleen tellers, nooit inhoud
  function fluisterFocus(key, scoresIn) {
    const p = van(key);
    const scores = scoresIn && typeof scoresIn === 'object' ? scoresIn : {};
    for (const [naam, n] of Object.entries(scores).slice(0, 40)) {
      const k = schoon(naam, 40);
      // alleen een echt getal telt; een array/object als waarde negeren we
      // (Number() op een diep geneste array laat anders de stack overlopen)
      if (k && (typeof n === 'number' || typeof n === 'string') && Number.isFinite(Number(n)))
        p.focus[k] = Math.min(100000, Math.max(0, Math.round(Number(n))));
    }
    save();
    return { ok: true };
  }
  const topFocus = (p, n) => Object.entries(p.focus).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);

  /* ---- datums verstaan: "3 augustus" in een weetje wordt een echt seintje ---- */
  const MAANDEN = {
    januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6, juli: 7,
    augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
    january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, august: 8, october: 10
  };
  const vandaag = () => new Date().toISOString().slice(0, 10);
  function datumUit(tekst) {
    const m = String(tekst).toLowerCase().match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|january|february|march|may|june|july|august|october)/);
    if (!m) return null;
    const dag = parseInt(m[1], 10), maand = MAANDEN[m[2]];
    if (!(dag >= 1 && dag <= 31)) return null;
    const jaar = new Date().getUTCFullYear();
    const dd = j => j + '-' + String(maand).padStart(2, '0') + '-' + String(dag).padStart(2, '0');
    return dd(jaar) >= vandaag() ? dd(jaar) : dd(jaar + 1);
  }
  const dagenTot = datum => Math.round((Date.parse(datum) - Date.parse(vandaag())) / 86400000);
  const plusDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const wanneer = d => d <= 0 ? 'vandaag' : d === 1 ? 'morgen' : 'over ' + d + ' dagen';
  const eur = c => '€ ' + (c / 100).toFixed(2).replace('.', ',');
  // een dag uit een zin: 2026-08-03, "vandaag", "morgen" of "3 augustus"
  const datumInZin = txt => (String(txt).match(/\d{4}-\d{2}-\d{2}/) || [])[0] ||
    (/\bvandaag\b/i.test(txt) ? vandaag() : /\bovermorgen\b/i.test(txt) ? plusDagen(2) : /\bmorgen\b/i.test(txt) ? plusDagen(1) : datumUit(txt));

  /* De seintjesmotor draait als submodule op een gedeelde context, een
     keer opgebouwd bij het opstarten. */
  const ctx = { db, save, schoon, anthropic, notify, reserveerTafel, annuleerReservering, assetGebruik, zorgVoor, pay, acties,
    nu, wieBen, lijsten, van, topFocus, MAANDEN, vandaag, datumUit, dagenTot, plusDagen, wanneer, eur, datumInZin };
  const { teSnel, maakSeintjesIndex, bronnenVoor, fluisterSeintjes, fluisterPush, fluisterPushAlle, fluisterProfiel, standVan } = require('./fluister/seintjes')(ctx);

  /* Sparren (kern/fluister/sparren.js): Rahul denkt mee om het idee beter te
     maken (niet om zijn gelijk te halen), en komt op een geparkeerde gedachte
     terug als je rustig thuis bent met een lege agenda. */
  const sparren = require('./fluister/sparren')({ db, save, schoon, notify, van, nu });
  ctx.sparHouding = sparren.sparHouding;
  ctx.sparParkeer = sparren.parkeer;

  /* Een bevestigd voorstel echt uitvoeren; het antwoord zegt eerlijk wat er
     is gebeurd, ook als het alsnog misgaat. */

  /* ---- het doe-deel: voerUit + fluisterZeg wonen in fluister/acties.js ----
     Het geheugen, de seintjes en de stand blijven hier; de acties krijgen ze
     via de context mee. */
  /* De reislaag (hele reis op een vraag, kleding, voorspellen) draait als
     eigen submodule en haakt via de context in fluisterZeg en voerUit. */
  const { butlerExtra, voerReisUit, voerKledingUit } = require('./fluister/reis')({
    db, save, acties, reserveerTafel, zorgVoor, eur, datumInZin, plusDagen, nu,
    verblijfBoek, retailLegApart, retailKlantProfiel });

  const { voerUit, fluisterZeg } = require('./fluister/acties')({
    db, save, schoon, anthropic, notify, reserveerTafel, annuleerReservering,
    assetGebruik, zorgVoor, pay, acties, nu, wieBen, lijsten, van,
    fluisterOnthoud, fluisterVergeet, teSnel, fluisterSeintjes, standVan, topFocus, eur, datumInZin,
    butlerExtra, voerReisUit, voerKledingUit, sparHouding: sparren.sparHouding, sparParkeer: sparren.parkeer });

  return { fluisterZeg, fluisterOnthoud, fluisterVergeet, fluisterFocus, fluisterProfiel, fluisterSeintjes, fluisterPush, fluisterPushAlle,
    sparParkeer: sparren.parkeer, sparLijst: sparren.lijst, sparStatus: sparren.status,
    sparHouding: sparren.sparHouding, sparRustMoment: sparren.rustMoment, sparSweepVoor: sparren.sweepVoor, sparSweepAlle: sparren.sweepAlle };
};
