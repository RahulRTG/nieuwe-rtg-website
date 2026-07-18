/* Fluister (deelmodule): de seintjesmotor: de rem (60 berichten per
   minuut), de seintjesindex voor de sweep, de proactieve seintjes, de
   push, het profiel en de actuele stand van het lid. Krijgt de gedeelde
   context een keer bij het opstarten vanuit kern/fluister.js. */
module.exports = (ctx) => {
  const { db, save, schoon, anthropic, notify, reserveerTafel, annuleerReservering, assetGebruik, zorgVoor, pay, acties,
    nu, wieBen, lijsten, van, topFocus, MAANDEN, vandaag, datumUit, dagenTot, plusDagen, wanneer, eur, datumInZin } = ctx;
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
    const orders = require('../../db').ordersVanKlant(key).filter(o => !['geserveerd', 'geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status));
    if (orders.length) delen.push(orders.length + ' lopende bestelling(en)');
    const res = (db.data.reserveringen || []).filter(r => r.customerKey === key && ['aangevraagd', 'bevestigd'].includes(r.status));
    if (res.length) delen.push('eerstvolgende reservering ' + res[0].datum + ' ' + res[0].tijd + ' bij ' + res[0].supplierName);
    const vb = (db.data.verblijven || []).filter(v => (v.customerKey || v.key) === key && ['bevestigd', 'ingecheckt'].includes(v.status));
    if (vb.length) delen.push('verblijf: ' + vb[0].roomName + ' (' + vb[0].status + ')');
    const tickets = (db.data.assetTickets || []).filter(t => t.key === key && t.status === 'actief');
    if (tickets.length) delen.push(tickets.length + ' Shared Asset-ticket(s)');
    return delen;
  }
  return { teSnel, maakSeintjesIndex, bronnenVoor, fluisterSeintjes, fluisterPush, fluisterPushAlle, fluisterProfiel, standVan };
};
