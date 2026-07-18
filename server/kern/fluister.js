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
module.exports = ({ db, save, schoon, anthropic, notify, reserveerTafel, annuleerReservering, assetGebruik, zorgVoor, pay, acties }) => {
  /* De acties-registry: vermogens die pas na deze module op de kern komen
     (bestellen, tickets, ritten worden in routes/member.js geregistreerd,
     want daar wonen die regels). Het contract: elke actie is een functie
     (session, body) die { ok, ... } of { status, error } teruggeeft -
     exact dezelfde functie die de app-knoppen bedient, dus geen drift. */
  const nu = () => new Date().toISOString();
  // hetzelfde brein, een passend gezicht: De Butler voor leden, "uw
  // assistent" voor personeel en zaken
  const wieBen = key => /^(staff|zaak):/.test(String(key)) ? 'uw assistent' : 'uw Butler';
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

  /* ---- rem op de motor: hooguit 60 berichten per minuut per gebruiker.
     Beschermt de AI-kosten en de doe-laag tegen scripts en vastlopende
     spraak-loops; een mens merkt er niets van. ---- */
  const rem = new Map();
  function teSnel(key) {
    const t = Date.now();
    if (rem.size > 50000) rem.clear(); // nooit onbegrensd geheugen
    const b = rem.get(key) || { vanaf: t, n: 0 };
    if (t - b.vanaf > 60000) { b.vanaf = t; b.n = 0; }
    b.n += 1;
    rem.set(key, b);
    return b.n > 60;
  }

  /* ---- de bronnen voor seintjes: per gebruiker los (de route), of uit
     een vooraf gebouwde index (de halfuurlijkse sweep), zodat die ronde
     over alle gebruikers maar een keer door de data hoeft ---- */
  function maakSeintjesIndex() {
    const idx = { res: new Map(), vb: new Map(), gebruik: new Map(), tickets: new Map(), terugkoop: new Map() };
    const stop = (m, k, x) => { const l = m.get(k); if (l) l.push(x); else m.set(k, [x]); };
    for (const r of db.data.reserveringen || []) stop(idx.res, r.customerKey, r);
    for (const v of db.data.verblijven || []) stop(idx.vb, v.customerKey || v.key, v);
    for (const g of db.data.assetGebruik || []) stop(idx.gebruik, g.key, g);
    for (const t of db.data.assetTickets || []) stop(idx.tickets, t.key, t);
    for (const v of db.data.assetTerugkoop || []) stop(idx.terugkoop, v.key, v);
    return idx;
  }
  const bronnenVoor = (key, idx) => idx ? {
    res: idx.res.get(key) || [], vb: idx.vb.get(key) || [], gebruik: idx.gebruik.get(key) || [],
    tickets: idx.tickets.get(key) || [], terugkoop: idx.terugkoop.get(key) || []
  } : {
    res: (db.data.reserveringen || []).filter(r => r.customerKey === key),
    vb: (db.data.verblijven || []).filter(v => (v.customerKey || v.key) === key),
    gebruik: (db.data.assetGebruik || []).filter(g => g.key === key),
    tickets: (db.data.assetTickets || []).filter(t => t.key === key),
    terugkoop: (db.data.assetTerugkoop || []).filter(v => v.key === key)
  };

  /* ---- proactief: Fluister fluistert zelf, nog voordat je iets vraagt ---- */
  const BEDENKTIJD_DAGEN = 14; // gelijk aan kern/assets.js
  function fluisterSeintjes(key, idx) {
    const p = van(key);
    const bron = bronnenVoor(key, idx);
    const s = [];
    // 1. datums in je eigen weetjes: verjaardagen en afspraken die naderen
    for (const w of p.weetjes) {
      const d = datumUit(w.tekst);
      if (!d) continue;
      const dgn = dagenTot(d);
      if (dgn > 21) continue;
      s.push({ icoon: /verjaardag|jarig|birthday/i.test(w.tekst) ? '🎂' : '📅', tekst: w.tekst + ' · ' + wanneer(dgn) + ' (' + d + ')' });
    }
    // 2. de eerstvolgende reservering, zodra hij dichtbij komt
    const res = bron.res
      .filter(r => ['aangevraagd', 'bevestigd'].includes(r.status) && r.datum >= vandaag())
      .sort((a, b) => (a.datum + a.tijd).localeCompare(b.datum + b.tijd))[0];
    if (res && dagenTot(res.datum) <= 2)
      s.push({ icoon: '🪑', tekst: wanneer(dagenTot(res.datum)) + ' ' + res.tijd + ' gereserveerd bij ' + res.supplierName + (res.status === 'aangevraagd' ? ' (wacht nog op bevestiging)' : '') });
    // 3. verblijf: de check-in nadert, of het is tijd om uit te checken
    for (const v of bron.vb) {
      if (v.status === 'bevestigd' && v.aankomst >= vandaag() && dagenTot(v.aankomst) <= 7)
        s.push({ icoon: '🏨', tekst: 'Check-in ' + v.roomName + ' bij ' + v.supplierName + ' · ' + wanneer(dagenTot(v.aankomst)) });
      if (v.status === 'ingecheckt' && v.vertrek && dagenTot(v.vertrek) <= 1)
        s.push({ icoon: '🧳', tekst: 'Uitchecken bij ' + v.supplierName + ' · ' + wanneer(dagenTot(v.vertrek)) });
    }
    // 4. een geboekt 24-uursblok van een Shared Asset dat eraan komt
    for (const g of bron.gebruik.filter(g => g.datum >= vandaag() && dagenTot(g.datum) <= 7))
      s.push({ icoon: '🔑', tekst: 'Uw 24 uur bij ' + g.assetNaam + ' · ' + wanneer(dagenTot(g.datum)) + ' (' + g.datum + ')' });
    // 5. lopende asset-zaken: bedenktijd die nog loopt, terugkoop onderweg
    const bedenk = bron.tickets.filter(t => t.status === 'actief' &&
      Date.now() - Date.parse(t.at) < BEDENKTIJD_DAGEN * 86400000);
    if (bedenk.length) {
      const rest = Math.ceil(BEDENKTIJD_DAGEN - (Date.now() - Date.parse(bedenk[0].at)) / 86400000);
      s.push({ icoon: '↩️', tekst: 'Nog ' + rest + ' dag(en) bedenktijd op ' + bedenk.length + ' ticket(s); herroepen is kosteloos' });
    }
    for (const v of bron.terugkoop.filter(v => v.status === 'aangevraagd'))
      s.push({ icoon: '⏳', tekst: 'Terugkoop ' + v.assetNaam + ': uiterlijk ' + v.uiterlijk + ' staat het bedrag in uw tegoed' });
    // 6. een vriendelijke duw: het jaar loopt en uw 24 uur staat nog nergens
    if (vandaag().slice(5, 7) >= '07') {
      const jaar = vandaag().slice(0, 4);
      const stil = bron.tickets.find(t => t.status === 'actief' &&
        Date.now() - Date.parse(t.at) >= BEDENKTIJD_DAGEN * 86400000 &&
        !bron.gebruik.some(g => g.assetId === t.assetId && g.datum.slice(0, 4) === jaar));
      if (stil) s.push({ icoon: '💡', tekst: 'Uw 24 uur van dit jaar bij ' + (((db.data.sharedAssets || []).find(a => a.id === stil.assetId) || {}).naam || 'uw object') + ' staat nog niet gepland' });
    }
    return s.slice(0, 5);
  }

  /* Een nieuw seintje wordt vanzelf een melding op het toestel (de bel plus
     web-push). Met geheugen: elk seintje piept precies een keer. */
  function fluisterPush(key, idx) {
    if (String(key).startsWith('staff:') || !notify) return { ok: true, gepusht: 0 };
    const p = van(key);
    if (!p.geseind) p.geseind = {};
    let n = 0;
    for (const s of fluisterSeintjes(key, idx)) {
      if (p.geseind[s.tekst]) continue;
      p.geseind[s.tekst] = nu();
      notify(key, { icon: s.icoon, title: 'Uw Butler', body: s.tekst, scope: 'fluister' });
      n++;
    }
    // het piep-geheugen blijft klein: de oudste vermeldingen vallen eraf
    const ks = Object.keys(p.geseind);
    if (ks.length > 60) for (const k of ks.sort((a, b) => p.geseind[a].localeCompare(p.geseind[b])).slice(0, ks.length - 60)) delete p.geseind[k];
    if (n) save();
    return { ok: true, gepusht: n };
  }

  // de halfuurlijkse ronde over alle gebruikers: een index, een datapass
  function fluisterPushAlle() {
    const idx = maakSeintjesIndex();
    let n = 0;
    for (const k of Object.keys(db.data.fluister || {})) n += fluisterPush(k, idx).gepusht;
    return { ok: true, gepusht: n };
  }

  function fluisterProfiel(key) {
    const p = van(key);
    return { ok: true, weetjes: p.weetjes, top: topFocus(p, 5), seintjes: fluisterSeintjes(key), gesprek: p.gesprek.length };
  }

  // de actuele stand van dit lid, kort: dat maakt de antwoorden persoonlijk
  function standVan(key) {
    const delen = [];
    const orders = require('../db').ordersVanKlant(key).filter(o => !['geserveerd', 'geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status));
    if (orders.length) delen.push(orders.length + ' lopende bestelling(en)');
    const res = (db.data.reserveringen || []).filter(r => r.customerKey === key && ['aangevraagd', 'bevestigd'].includes(r.status));
    if (res.length) delen.push('eerstvolgende reservering ' + res[0].datum + ' ' + res[0].tijd + ' bij ' + res[0].supplierName);
    const vb = (db.data.verblijven || []).filter(v => (v.customerKey || v.key) === key && ['bevestigd', 'ingecheckt'].includes(v.status));
    if (vb.length) delen.push('verblijf: ' + vb[0].roomName + ' (' + vb[0].status + ')');
    const tickets = (db.data.assetTickets || []).filter(t => t.key === key && t.status === 'actief');
    if (tickets.length) delen.push(tickets.length + ' Shared Asset-ticket(s)');
    return delen;
  }

  /* Een bevestigd voorstel echt uitvoeren; het antwoord zegt eerlijk wat er
     is gebeurd, ook als het alsnog misgaat. */

  /* ---- het doe-deel: voerUit + fluisterZeg wonen in fluister/acties.js ----
     Het geheugen, de seintjes en de stand blijven hier; de acties krijgen ze
     via de context mee. */
  const { voerUit, fluisterZeg } = require('./fluister/acties')({
    db, save, schoon, anthropic, notify, reserveerTafel, annuleerReservering,
    assetGebruik, zorgVoor, pay, acties, nu, wieBen, lijsten, van,
    fluisterOnthoud, fluisterVergeet, teSnel, fluisterSeintjes, standVan, topFocus, eur, datumInZin });

  return { fluisterZeg, fluisterOnthoud, fluisterVergeet, fluisterFocus, fluisterProfiel, fluisterSeintjes, fluisterPush, fluisterPushAlle };
};
