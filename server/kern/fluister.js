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
    const tekst = schoon(String(tekstIn || '').replace(/^onthoud\s+(dat\s+|alsjeblieft\s+)?/i, ''), 200);
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
      if (k && Number.isFinite(Number(n))) p.focus[k] = Math.min(100000, Math.max(0, Math.round(Number(n))));
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
    const orders = (db.data.orders || []).filter(o => (o.customerKey || o.customerTier) === key && !['geserveerd', 'geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status));
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
  async function voerUit(key, codenaam, w, sess) {
    // bestellen: plaatsen en direct afrekenen via exact dezelfde functies
    // als de app-knoppen (ledenprijs, 86, leeftijd, zorgprofiel incluis)
    if (w.soort === 'bestelling' && sess && acties && acties.plaatsOrder) {
      const r = acties.plaatsOrder(sess, { supplierCode: w.supplierCode, items: w.items });
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      const b = acties.betaalOrder(sess, { ref: r.order.ref });
      if (b.error) return { tekst: 'De bestelling staat klaar (' + r.order.ref + '), maar het afrekenen lukte niet: ' + b.error + ' Rond hem af in de Bestellen-tab.', gedaan: true };
      return { tekst: 'Besteld en betaald bij ' + r.order.supplierName + ': ' + w.oms + ', samen ' + eur(b.order.total * 100) + '. Uw ophaalcode is ' + r.order.pickup + '; de zaak gaat er direct mee aan de slag.', gedaan: true };
    }
    if (w.soort === 'blok' && assetGebruik) {
      const r = assetGebruik({ key }, w.assetId, w.datum);
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      return { tekst: 'Geregeld: uw 24 uur bij ' + r.gebruik.assetNaam + ' staat op ' + w.datum + ' (nog ' + r.dagenTegoed + ' dag(en) tegoed dit jaar). Het team neemt vooraf contact op.', gedaan: true };
    }
    if (w.soort === 'tik' && pay) {
      const r = await pay.stuur({ van: codenaam, aanCodenaam: w.aan, centen: w.centen, oms: 'Via de Butler', soort: 'tik' });
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      return { tekst: 'Gedaan: ' + eur(w.centen) + ' aan ' + w.aan + ' gestuurd via een Tik. Uw saldo: ' + eur(r.saldo) + '.', gedaan: true };
    }
    // tickets voor een activiteit: boeken en direct afrekenen, entreecode terug
    if (w.soort === 'ticket' && sess && acties && acties.koopTicket) {
      const r = acties.koopTicket(sess, { supplierCode: w.supplierCode, activiteitId: w.activiteitId, datum: w.datum, tijd: w.tijd, personen: w.personen });
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      const b = acties.betaalBoeking(sess, { ref: r.ticket.ref });
      if (b.error) return { tekst: 'De tickets staan klaar (' + r.ticket.ref + '), maar het afrekenen lukte niet: ' + b.error, gedaan: true };
      return { tekst: 'Geboekt en betaald: ' + w.oms + ' op ' + w.datum + ' om ' + w.tijd + ', samen ' + eur((r.ticket.price || 0) * 100) + '. Uw entreecode is ' + r.ticket.code + '; laat hem bij de deur oplichten.', gedaan: true };
    }
    // een rit: aanvragen en (bij vooraf betalen) de offerte direct voldoen
    if (w.soort === 'rit' && sess && acties && acties.vraagRit) {
      const r = acties.vraagRit(sess, { supplierCode: w.supplierCode, to: w.to, toCode: w.toCode, passengers: w.personen, date: w.datum, time: w.tijd });
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      let slot = '';
      if (r.ride.status === 'wacht-op-betaling') {
        const b = acties.betaalRit(sess, { ref: r.ride.ref });
        if (b.error) return { tekst: 'De rit staat klaar (' + r.ride.ref + '), maar het afrekenen lukte niet: ' + b.error, gedaan: true };
        slot = ' De offerte van ' + eur(r.ride.quote * 100) + ' is betaald;';
      } else slot = ' Offerte: ' + eur(r.ride.quote * 100) + ' (' + r.ride.betaalMoment + ');';
      return { tekst: 'Geregeld: een rit met ' + r.ride.supplierName + ' naar ' + (r.ride.to || 'uw bestemming') + ' voor ' + r.ride.passengers + '.' + slot + ' de chauffeur wordt nu toegewezen en u volgt hem live in Reizen.', gedaan: true };
    }
    if (w.soort === 'klompjes' && pay) {
      let betaald = 0, mis = null;
      for (const id of w.ids || []) {
        const r = await pay.verzoekBetaal({ codenaam, verzoekId: id });
        if (r.error) { mis = r.error; continue; }
        betaald++;
      }
      if (!betaald) return { tekst: 'Dat lukt niet: ' + (mis || 'de verzoeken zijn al weg.') };
      return { tekst: 'Gedaan: ' + betaald + ' verzoek(en) betaald, samen ' + eur(w.totaal) + '.' + (mis ? ' Een verzoek lukte niet: ' + mis : ''), gedaan: true };
    }
    return { tekst: 'Dat voorstel ken ik niet meer; zeg het gerust opnieuw.' };
  }

  /* Het gesprek. Eerst de eigen commando's (onthouden, opvragen, vergeten);
     daarna Claude met het volledige persoonlijke beeld, of de eigen regels. */
  async function fluisterZeg(key, codenaam, qIn, sess) {
    const q = String(qIn || '').trim().slice(0, 600);
    if (!q) return { status: 400, error: 'Zeg iets.' };
    if (teSnel(key)) return { status: 429, error: 'Even op adem komen: te veel berichten achter elkaar. Probeer het over een minuutje weer.' };
    const p = van(key);
    // het antwoord gaat ook het gespreksgeheugen in (laatste 5 beurten);
    // voorstel=true betekent: er staat iets klaar dat op "ja" wacht
    const klaar = (antwoord, gedaan, voorstel) => {
      p.gesprek.push({ u: q, a: String(antwoord).slice(0, 400), at: nu() });
      p.gesprek = p.gesprek.slice(-5);
      save();
      return { ok: true, antwoord, gedaan: !!gedaan, voorstel: !!voorstel, pakte: true };
    };
    if (/^onthoud\b/i.test(q)) {
      const r = fluisterOnthoud(key, q);
      if (r.error) return r;
      return { ok: true, antwoord: 'Onthouden: "' + r.weetjes[r.weetjes.length - 1].tekst + '". U kunt dit altijd terugzien of wissen met "wat weet je over mij".', geleerd: true, pakte: true };
    }
    if (/vergeet alles/i.test(q)) {
      fluisterVergeet(key, 'alles');
      p.gesprek = [];
      p.focus = {};
      p.wacht = null;
      save();
      return { ok: true, antwoord: 'Alles gewist: uw weetjes, ons gesprek en de gebruikstellers. We beginnen met een schone lei.', geleerd: true, pakte: true };
    }
    if (/wat (weet|onthoud) je (over|van) mij/i.test(q)) {
      const regels = [];
      if (p.weetjes.length) regels.push('U vertelde me: ' + p.weetjes.map(w => '"' + w.tekst + '"').join(', ') + '.');
      const top = topFocus(p, 3);
      if (top.length) regels.push('En ik zie dat u het meest werkt met: ' + top.join(', ') + '.');
      if (!regels.length) regels.push('Nog niets. Vertel me iets met "onthoud dat..." of gebruik de app; ik leer vanzelf wat u belangrijk vindt.');
      if (p.gesprek.length) regels.push('Verder onthoud ik alleen de laatste ' + p.gesprek.length + ' beurt(en) van ons gesprek.');
      regels.push('Wissen kan per weetje of in een keer ("vergeet alles").');
      return { ok: true, antwoord: regels.join(' '), pakte: true };
    }
    // "wat kun je": een eerlijk overzicht van alles wat hij kan
    if (/\bwat (kun|kan) (je|jij|u)\b/i.test(q) || /^help[!?.]?$/i.test(q)) {
      const basis = 'Ik onthoud wat u vertelt ("onthoud dat..."), vertel precies wat ik weet ("wat weet je over mij"), wis alles op verzoek en geef seintjes bij alles wat nadert.';
      if (!sess) return { ok: true, antwoord: basis + ' Vraag me gerust naar de actuele stand van uw dienst.', pakte: true };
      return { ok: true, antwoord: basis + ' En ik regel het ook: zoeken door het hele aanbod ("zoek sushi"), uw dag plannen ("plan mijn dag"), een tafel reserveren of annuleren, bestellen en afrekenen ("bestel 2 sangria bij Sunset Ibiza"), tickets boeken ("boek 2 tickets voor de sunset cruise morgen"), een taxi of transfer regelen, uw 24-uursblok plannen, uw saldo opvragen, een Tik sturen, en betaalverzoeken maken, tonen en betalen. Alles met geld of een poolclaim vraagt altijd eerst uw "ja".', pakte: true };
    }
    /* ---- doen: Fluister voert het ook echt uit, alleen voor het lid zelf
       (sess reist alleen mee op de leden-route, nooit voor personeel).
       Boven de drempel (geld, of een claim op een gedeeld object) eerst
       een voorstel; pas op "ja" gebeurt het echt. ---- */
    if (sess) {
      const wachtVers = p.wacht && Date.now() - Date.parse(p.wacht.at) < 10 * 60000;
      // "ja": het openstaande voorstel uitvoeren
      if (/^(ja|yes|ok[eé]?|doe maar|graag|bevestig|akkoord|prima)[.!]?$/i.test(q)) {
        if (!wachtVers) return klaar('Er staat niets open om te bevestigen. Zeg gerust wat ik moet regelen.');
        const w = p.wacht;
        p.wacht = null;
        const r = await voerUit(key, codenaam, w, sess);
        return klaar(r.tekst, r.gedaan);
      }
      // "nee": het voorstel gaat van tafel
      if (/^(nee|nope|laat maar|annuleer|stop|toch niet)[.!]?$/i.test(q)) {
        if (!wachtVers) return klaar('Er stond niets open; alles blijft zoals het was.');
        p.wacht = null;
        save();
        return klaar('Goed, het gaat niet door. Het voorstel is van tafel.');
      }
      // "plan mijn dag": een echt dagprogramma uit het echte aanbod, met
      // voor elk onderdeel de zin waarmee ik het meteen regel
      if (/plan (mijn|de|m.n) dag|dagplan(ning)?\b/i.test(q)) {
        const alle = db.data.suppliers || [];
        const resto = alle.filter(x => x.type === 'restaurant');
        const beach = alle.find(x => x.type === 'beachclub');
        const actZaak = alle.find(x => (x.activiteiten || []).length);
        const act = actZaak && actZaak.activiteiten[0];
        const avond = alle.find(x => ['bar', 'club'].includes(x.type));
        const topper = s => ((s && s.menu) || [])[0];
        const regels = [];
        if (beach) regels.push('10:00 ligbedden bij ' + beach.name);
        if (resto[0] && topper(resto[0])) regels.push('13:00 lunch bij ' + resto[0].name + ' (bijv. ' + topper(resto[0]).name + ', ' + eur(Math.round((topper(resto[0]).price || 0) * 100)) + ')');
        if (act) regels.push(((act.tijden || [])[0] || '16:00') + ' ' + act.name + ' bij ' + actZaak.name + ' (' + eur(Math.round((act.prijs || 0) * 100)) + ' p.p., zeg: "boek 2 tickets voor ' + act.name + ' morgen")');
        if (resto[0]) regels.push('20:00 diner bij ' + resto[0].name + ' (zeg: "reserveer bij ' + resto[0].name + ' morgen om 20:00")');
        if (avond && topper(avond)) regels.push('23:00 ' + avond.name + ' (' + topper(avond).name + ', ' + eur(Math.round((topper(avond).price || 0) * 100)) + ')');
        const zorgNu = zorgVoor && zorgVoor(key);
        return klaar('Mijn voorstel voor uw dag: ' + regels.join(' | ') + '.' +
          (p.weetjes.length ? ' Ik hield rekening met uw weetjes.' : '') +
          (zorgNu && (zorgNu.allergenen || []).length ? ' Uw allergenen (' + zorgNu.allergenen.join(', ') + ') reizen overal automatisch mee.' : '') +
          ' Zeg het maar en ik regel elk onderdeel, van de tickets tot de taxi.');
      }
      // "wat is mijn saldo": de stand van RTG Pay, gewoon in het gesprek
      if (pay && /\bsaldo\b/i.test(q)) {
        const ov = pay.overzicht(codenaam);
        return klaar('Uw RTG Pay-saldo is ' + eur(ov.saldo) + '. Te weinig voor een plan? Bij elke betaling laad ik automatisch bij.');
      }
      // "annuleer mijn reservering (bij Sal de Mar)": kost niets, dus direct
      if (annuleerReservering && /^annuleer\b/i.test(q) && /reserver/i.test(q)) {
        const naam = (q.match(/\bbij\s+(.+?)[.?!]?\s*$/i) || [])[1];
        const mijnRes = (db.data.reserveringen || []).filter(r => r.customerKey === key && ['aangevraagd', 'bevestigd'].includes(r.status) &&
          (!naam || (r.supplierName || '').toLowerCase().includes(naam.toLowerCase().trim())));
        if (!mijnRes.length) return klaar('Ik zie geen lopende reservering' + (naam ? ' bij ' + naam : '') + ' om te annuleren.');
        const r = annuleerReservering(key, mijnRes[0].id);
        if (r.error) return klaar('Dat lukt niet: ' + r.error);
        return klaar('Geannuleerd: ' + mijnRes[0].supplierName + ', ' + mijnRes[0].datum + ' om ' + mijnRes[0].tijd + '. De zaak weet het meteen.', true);
      }
      // "boek 2 tickets voor de sunset cruise morgen (om 19:00)": geld,
      // dus eerst een voorstel; de entreecode komt na uw "ja"
      if (acties && acties.koopTicket && /\b(boek|koop|regel)\b/i.test(q) && /\b(tickets?|kaartjes?)\b/i.test(q)) {
        let zaak = null, act = null;
        const ql = q.toLowerCase();
        for (const x of (db.data.suppliers || [])) {
          for (const a of (x.activiteiten || [])) {
            if ((a.name || '').toLowerCase().split(/[^a-z0-9]+/).some(wrd => wrd.length > 3 && ql.includes(wrd))) { zaak = x; act = a; break; }
          }
          if (act) break;
        }
        if (!act) return klaar('Voor welke activiteit? Bijvoorbeeld: ' + (db.data.suppliers || []).flatMap(x => (x.activiteiten || []).map(a => '"' + a.name + '" bij ' + x.name)).slice(0, 3).join(', ') + '.');
        const datum = datumInZin(q);
        if (!datum) return klaar('Voor welke dag? Zeg bijvoorbeeld: "boek 2 tickets voor ' + act.name + ' morgen".');
        const tm = q.match(/(\d{1,2})[:.](\d{2})/);
        const tijd = (tm && (act.tijden || []).includes(tm[1].padStart(2, '0') + ':' + tm[2])) ? tm[1].padStart(2, '0') + ':' + tm[2] : (act.tijden || [])[0];
        const personen = parseInt((q.match(/(\d{1,2})\s*(tickets?|kaartjes?|personen|man)\b/i) || [])[1], 10) || 1;
        const oms = personen + ' ticket(s) voor ' + act.name + ' bij ' + zaak.name;
        p.wacht = { soort: 'ticket', supplierCode: zaak.code, activiteitId: act.id, datum, tijd, personen, oms, at: nu() };
        save();
        return klaar('Even checken: ' + oms + ' op ' + datum + ' om ' + tijd + ', samen ' + eur(Math.round((act.prijs || 0) * personen * 100)) + '. Ik boek en reken direct af via RTG Pay. Zeg "ja" en de entreecode komt eraan; "nee" en het gaat niet door.', false, true);
      }
      // "regel een taxi naar Sal de Mar (om 23:00, met 4 personen)": de
      // offerte volgt het tarief van de vervoerder; betalen na uw "ja"
      if (acties && acties.vraagRit && /\b(regel|boek|bestel|vraag)\b/i.test(q) && /\b(taxi|auto|rit|chauffeur|wagen|transfer)\b/i.test(q)) {
        const ql = q.toLowerCase();
        const rijders = (db.data.suppliers || []).filter(x => ((db.data.supplierTypes[x.type] || {}).caps || []).includes('rides') && x.type !== 'activiteit');
        const rijder = rijders.find(x => (x.name || '').toLowerCase().split(/\s+/).some(wrd => wrd.length > 3 && ql.includes(wrd))) ||
          rijders.find(x => x.type === 'taxi') || rijders[0];
        if (!rijder) return klaar('Ik zie nu geen vervoerspartner. Kijk anders even in Reizen.');
        const best = (q.match(/\bnaar\s+(.+?)(?=\s+(?:om|op|voor|met|morgen|overmorgen|vandaag)\b|[.?!]?\s*$)/i) || [])[1];
        const doel = best && (db.data.suppliers || []).find(x => (x.name || '').toLowerCase().includes(best.toLowerCase().trim()));
        const personen = parseInt((q.match(/(\d{1,2})\s*(personen|man)\b/i) || [])[1], 10) || 1;
        const tm = q.match(/(\d{1,2})[:.](\d{2})/);
        const datum = datumInZin(q);
        p.wacht = { soort: 'rit', supplierCode: rijder.code, to: best ? best.trim() : '', toCode: doel ? doel.code : null, personen, datum: datum || null, tijd: tm ? tm[1].padStart(2, '0') + ':' + tm[2] : null, at: nu() };
        save();
        return klaar('Even checken: een rit met ' + rijder.name + (best ? ' naar ' + best.trim() : '') + ' voor ' + personen + (datum ? ' (' + datum + (tm ? ' ' + tm[1].padStart(2, '0') + ':' + tm[2] : '') + ')' : ', zo snel mogelijk') + '? De prijs volgt het tarief van de vervoerder en reken ik direct af. Zeg "ja" en ik regel hem; "nee" en het gaat niet door.', false, true);
      }
      // "bestel 2 sangria en 1 bravas bij Sunset Ibiza": eten en drinken
      // wordt direct afgerekend via RTG Pay, dus boven de drempel
      if (acties && acties.plaatsOrder && /^bestel\b/i.test(q)) {
        if (sess.tier === 'guest') return klaar('Bestellen via mij kan alleen met een lidmaatschap; als gast kan het via de Bestellen-tab.');
        const naam = (q.match(/\bbij\s+(.+?)[.?!]?\s*$/i) || [])[1];
        const s = naam && (db.data.suppliers || []).find(x => (x.name || '').toLowerCase().includes(naam.toLowerCase().trim()));
        if (!s) return klaar('Bij welke zaak? Zeg bijvoorbeeld: "bestel 2 sangria bij Sunset Ibiza".');
        // alleen het stuk voor "bij ..." telt als boodschappenlijst, anders
        // matcht de zaaknaam zelf per ongeluk een gerecht (Hierbas Sunset)
        const ql = q.toLowerCase().replace(/\bbij\s+.*$/, '');
        const items = [];
        for (const m of (s.menu || [])) {
          if (m.uitverkocht) continue;
          const w = (m.name || '').toLowerCase().split(/[^a-z0-9]+/).find(x => x.length > 3 && ql.includes(x));
          if (!w) continue;
          const qty = parseInt((ql.match(new RegExp('(\\d{1,2})\\s+(?:[a-z]+\\s+){0,2}?' + w)) || [])[1], 10) || 1;
          items.push({ id: m.id, qty, naam: m.name, prijs: Number(m.price) || 0 });
        }
        if (!items.length) return klaar('Wat mag het zijn bij ' + s.name + '? Op de kaart staat onder meer: ' + (s.menu || []).slice(0, 5).map(m => m.name).join(', ') + '.');
        const oms = items.map(i => i.qty + 'x ' + i.naam).join(', ');
        const totaal = items.reduce((a, i) => a + i.prijs * i.qty, 0);
        p.wacht = { soort: 'bestelling', supplierCode: s.code, items: items.map(i => ({ id: i.id, qty: i.qty })), oms, at: nu() };
        save();
        return klaar('Even checken: ' + oms + ' bij ' + s.name + ', samen ongeveer ' + eur(Math.round(totaal * 100)) + '. Ik plaats de bestelling en reken hem direct af via RTG Pay. Zeg "ja" en het staat in gang; "nee" en het gaat niet door.', false, true);
      }
      // "zet/plan/boek mijn 24 uur op 3 augustus (bij Villa ...)":
      // claimt een dag van het gedeelde object, dus eerst een voorstel
      if (assetGebruik && /\b24\s*-?\s*u/i.test(q) && /\b(zet|plan|boek|leg)\b/i.test(q)) {
        const datum = datumInZin(q);
        if (!datum) return klaar('Op welke dag? Zeg bijvoorbeeld: "zet mijn 24 uur op 3 augustus".');
        const mijnTickets = (db.data.assetTickets || []).filter(t => t.key === key && t.status === 'actief');
        if (!mijnTickets.length) return klaar('U heeft nog geen actief Shared Asset-ticket; kijk in de Assets-tab.');
        const ql = q.toLowerCase();
        const past = t => {
          const a = (db.data.sharedAssets || []).find(x => x.id === t.assetId);
          return a && a.naam.toLowerCase().split(/\s+/).some(w => w.length > 3 && ql.includes(w));
        };
        const t = mijnTickets.find(past) || mijnTickets[0];
        const naam = (((db.data.sharedAssets || []).find(x => x.id === t.assetId) || {}).naam) || 'uw object';
        p.wacht = { soort: 'blok', assetId: t.assetId, datum, naam, at: nu() };
        save();
        return klaar('Even checken: uw 24 uur bij ' + naam + ' op ' + datum + ' vastleggen? Die dag is dan van u en gaat uit de pool. Zeg "ja" en ik regel het; "nee" en het gaat niet door.', false, true);
      }
      // "stuur 15 euro naar Noordelijke Ster": geld gaat nooit zonder "ja"
      if (pay && /\b(stuur|betaal|geef|tik)\b/i.test(q)) {
        const m = q.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:euro|eur|€)?\s+(?:naar|aan)\s+(.+?)[.?!]?\s*$/i);
        if (m) {
          const centen = Math.round(parseFloat(m[1].replace(',', '.')) * 100);
          if (!(centen > 0)) return klaar('Welk bedrag? Zeg bijvoorbeeld: "stuur 15 euro naar Noordelijke Ster".');
          const aan = m[2].trim();
          p.wacht = { soort: 'tik', centen, aan, at: nu() };
          save();
          return klaar('Even checken: ' + eur(centen) + ' aan ' + aan + ' sturen via een Tik? Zeg "ja" en ik maak het over; "nee" en het gaat niet door.', false, true);
        }
      }
      // "reserveer bij Sal de Mar morgen om 20:00 met 2 personen":
      // onder de drempel (gratis en altijd annuleerbaar), dus direct
      if (reserveerTafel && /\breserveer\b/i.test(q)) {
        if (sess.tier === 'guest') return klaar('Reserveren kan alleen met een lidmaatschap.');
        const naam = (q.match(/\bbij\s+(.+?)(?=\s+(?:op|om|voor|met|morgen|overmorgen|vandaag)\b|\s*[.?!]?\s*$)/i) || [])[1];
        const s = naam && (db.data.suppliers || []).find(x => (x.name || '').toLowerCase().includes(naam.toLowerCase().trim()));
        if (!s) return klaar('Bij welke zaak? Zeg bijvoorbeeld: "reserveer bij Sal de Mar morgen om 20:00 met 2 personen".');
        const tijd = q.match(/(\d{1,2})[:.](\d{2})/);
        const datum = datumInZin(q);
        if (!datum || !tijd) return klaar('Wanneer? Noem een dag en een tijd, bijvoorbeeld "morgen om 20:00".');
        const personen = parseInt((q.match(/(\d{1,2})\s*(personen|gasten|man)\b/i) || [])[1], 10) || 2;
        const r = reserveerTafel({ key, tier: sess.tier }, codenaam, { supplierCode: s.code, datum, tijd: tijd[1].padStart(2, '0') + ':' + tijd[2], personen });
        if (r.error) return klaar('Dat lukt niet: ' + r.error);
        // het zorgprofiel reist mee, precies zoals bij een gewone reservering
        const z = zorgVoor && zorgVoor(key);
        if (z) { r.reservering.zorg = z; save(); }
        return klaar('Aangevraagd: ' + s.name + ', ' + datum + ' om ' + r.reservering.tijd + ' voor ' + personen + '. De zaak bevestigt zo; u ziet het in de bel.', true);
      }
      // "zoek lamsrack" / "waar kan ik sushi eten": door het hele aanbod
      // van alle partners (zaken, menukaarten, diensten en producten)
      if (/^(zoek|vind)\b/i.test(q) || /\bwaar (kan|vind|koop|eet|drink|huur) ik\b/i.test(q)) {
        const term = q.replace(/^(zoek|vind)\b(\s+(een|naar))?/i, '').replace(/\bwaar (kan|vind|koop|eet|drink|huur) ik\b/i, '').replace(/[?.!]/g, ' ').trim().toLowerCase();
        if (term.length < 2) return klaar('Waar zal ik naar zoeken? Zeg bijvoorbeeld: "zoek lamsrack" of "waar kan ik sushi eten".');
        const hits = [];
        for (const s of (db.data.suppliers || [])) {
          if (((s.name || '') + ' ' + (s.type || '') + ' ' + (s.city || '')).toLowerCase().includes(term))
            hits.push((s.icon || '🏛') + ' ' + s.name + (s.type ? ' (' + s.type + ')' : '') + (s.city ? ' in ' + s.city : ''));
          for (const it of [].concat(s.menu || [], s.services || [], s.products || [])) {
            const naam = it.name || it.naam || '';
            if (!naam.toLowerCase().includes(term)) continue;
            const prijs = Number(it.price != null ? it.price : it.prijs);
            hits.push('· ' + naam + (Number.isFinite(prijs) ? ' voor ' + eur(Math.round(prijs * 100)) : '') + ' bij ' + s.name);
          }
          if (hits.length >= 8) break;
        }
        if (!hits.length) return klaar('Ik vond niets over "' + term + '" in het aanbod. Probeer een ander woord, of vraag het de zaak via de gastchat.');
        return klaar('Dit vond ik voor u: ' + hits.slice(0, 6).join(' | ') + '. Zal ik iets reserveren of regelen? Zeg het maar.');
      }
      // "vraag 20 euro aan Noordelijke Ster": een Klompje (betaalverzoek);
      // er verlaat geen geld uw rekening, dus dit mag direct
      if (pay && /\b(vraag|verzoek)\b/i.test(q)) {
        const m = q.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:euro|eur|€)?\s+(?:aan|van)\s+(.+?)[.?!]?\s*$/i);
        if (m) {
          const centen = Math.round(parseFloat(m[1].replace(',', '.')) * 100);
          const r = await pay.verzoekMaak({ van: codenaam, aan: [m[2].trim()], perCenten: centen, oms: 'Via de Butler' });
          if (r.error) return klaar('Dat lukt niet: ' + r.error);
          return klaar('Verzocht: ' + eur(centen) + ' aan ' + m[2].trim() + '. Het Klompje staat klaar; zodra er betaald is, ziet u het in de bel.', true);
        }
      }
      // "wat moet ik nog betalen": openstaande betaalverzoeken aan mij,
      // en met een "ja" betaal ik ze in een keer (geld, dus met drempel)
      if (pay && /(wat (moet|heb) ik.*(betalen|open)|openstaande (verzoeken|betalingen)|staat er (nog )?(iets )?open)/i.test(q)) {
        const aanMij = pay.verzoekenVoor(codenaam).aanMij;
        if (!aanMij.length) return klaar('Er staan geen betaalverzoeken voor u open. Zo hoort het.');
        const totaal = aanMij.reduce((a, v) => a + v.centen, 0);
        p.wacht = { soort: 'klompjes', ids: aanMij.map(v => v.id), totaal, at: nu() };
        save();
        return klaar('Er staan ' + aanMij.length + ' verzoek(en) open, samen ' + eur(totaal) + ': ' + aanMij.map(v => eur(v.centen) + ' voor ' + v.van + (v.oms ? ' (' + v.oms + ')' : '')).join(', ') + '. Zeg "ja" en ik betaal ze alle ' + aanMij.length + '; "nee" en ze blijven staan.', false, true);
      }
    }

    const stand = standVan(key);
    const seintjes = fluisterSeintjes(key);
    if (anthropic) {
      try {
        const ctx = 'Lid: ' + codenaam + '. ' +
          (p.weetjes.length ? 'Weetjes die het lid zelf deelde: ' + p.weetjes.map(w => w.tekst).join('; ') + '. ' : '') +
          (topFocus(p, 3).length ? 'Gebruikt het meest: ' + topFocus(p, 3).join(', ') + '. ' : '') +
          (stand.length ? 'Actuele stand: ' + stand.join('; ') + '. ' : '') +
          (seintjes.length ? 'Actuele seintjes: ' + seintjes.map(x => x.tekst).join('; ') + '.' : '');
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 300,
          system: 'Je bent ' + (wieBen(key) === 'uw Butler' ? 'De Butler' : 'de persoonlijke assistent') + ' in de RTG-app. Antwoord kort, warm en concreet, in de taal van de vraag. Gebruik het persoonlijke beeld alleen als het helpt. Context: ' + ctx,
          messages: [...p.gesprek.flatMap(g => [{ role: 'user', content: g.u }, { role: 'assistant', content: g.a }]), { role: 'user', content: q }]
        });
        return klaar(response.content[0].text);
      } catch (e) { /* val terug op de eigen regels */ }
    }
    // de eigen regels: persoonlijk waar het kan, eerlijk waar het moet
    const groet = p.weetjes.length ? 'Ik denk aan uw ' + p.weetjes.length + ' weetje(s). ' : '';
    const fluistert = seintjes.length ? ' Mijn seintjes: ' + seintjes.map(x => x.icoon + ' ' + x.tekst).join(' | ') + '.' : '';
    if (stand.length || seintjes.length) return klaar(groet + (stand.length ? 'Dit speelt er nu voor u: ' + stand.join('; ') + '.' : 'Er staat niets open.') + fluistert + ' Vraag gerust door, of leer me iets met "onthoud dat...".');
    // niets persoonlijks te melden: pakte=false, zodat de app dit gesprek
    // aan de gewone gesprekslaag kan geven (het brein deed hier niets mee)
    const r = klaar(groet + 'Ik ben ' + wieBen(key) + '. Leer me kennen met "onthoud dat..." en vraag "wat weet je over mij" wanneer u wilt; wissen kan altijd. Ik kan ook zoeken en regelen: reserveren, uw 24 uur plannen, een Tik of een betaalverzoek.');
    r.pakte = false;
    return r;
  }

  return { fluisterZeg, fluisterOnthoud, fluisterVergeet, fluisterFocus, fluisterProfiel, fluisterSeintjes, fluisterPush, fluisterPushAlle };
};
