/* Fluister: de persoonlijke assistent van het hele ecosysteem. Een soort
   Siri, maar dan voor deze code: iedereen gebruikt hem voor zichzelf, en hij
   leert de gebruiker kennen.

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
module.exports = ({ db, save, schoon, anthropic, notify, reserveerTafel, assetGebruik, zorgVoor, pay }) => {
  const nu = () => new Date().toISOString();
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

  /* ---- proactief: Fluister fluistert zelf, nog voordat je iets vraagt ---- */
  const BEDENKTIJD_DAGEN = 14; // gelijk aan kern/assets.js
  function fluisterSeintjes(key) {
    const p = van(key);
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
    const res = (db.data.reserveringen || [])
      .filter(r => r.customerKey === key && ['aangevraagd', 'bevestigd'].includes(r.status) && r.datum >= vandaag())
      .sort((a, b) => (a.datum + a.tijd).localeCompare(b.datum + b.tijd))[0];
    if (res && dagenTot(res.datum) <= 2)
      s.push({ icoon: '🪑', tekst: wanneer(dagenTot(res.datum)) + ' ' + res.tijd + ' gereserveerd bij ' + res.supplierName + (res.status === 'aangevraagd' ? ' (wacht nog op bevestiging)' : '') });
    // 3. verblijf: de check-in nadert, of het is tijd om uit te checken
    for (const v of (db.data.verblijven || []).filter(v => (v.customerKey || v.key) === key)) {
      if (v.status === 'bevestigd' && v.aankomst >= vandaag() && dagenTot(v.aankomst) <= 7)
        s.push({ icoon: '🏨', tekst: 'Check-in ' + v.roomName + ' bij ' + v.supplierName + ' · ' + wanneer(dagenTot(v.aankomst)) });
      if (v.status === 'ingecheckt' && v.vertrek && dagenTot(v.vertrek) <= 1)
        s.push({ icoon: '🧳', tekst: 'Uitchecken bij ' + v.supplierName + ' · ' + wanneer(dagenTot(v.vertrek)) });
    }
    // 4. een geboekt 24-uursblok van een Shared Asset dat eraan komt
    for (const g of (db.data.assetGebruik || []).filter(g => g.key === key && g.datum >= vandaag() && dagenTot(g.datum) <= 7))
      s.push({ icoon: '🔑', tekst: 'Uw 24 uur bij ' + g.assetNaam + ' · ' + wanneer(dagenTot(g.datum)) + ' (' + g.datum + ')' });
    // 5. lopende asset-zaken: bedenktijd die nog loopt, terugkoop onderweg
    const bedenk = (db.data.assetTickets || []).filter(t => t.key === key && t.status === 'actief' &&
      Date.now() - Date.parse(t.at) < BEDENKTIJD_DAGEN * 86400000);
    if (bedenk.length) {
      const rest = Math.ceil(BEDENKTIJD_DAGEN - (Date.now() - Date.parse(bedenk[0].at)) / 86400000);
      s.push({ icoon: '↩️', tekst: 'Nog ' + rest + ' dag(en) bedenktijd op ' + bedenk.length + ' ticket(s); herroepen is kosteloos' });
    }
    for (const v of (db.data.assetTerugkoop || []).filter(v => v.key === key && v.status === 'aangevraagd'))
      s.push({ icoon: '⏳', tekst: 'Terugkoop ' + v.assetNaam + ': uiterlijk ' + v.uiterlijk + ' staat het bedrag in uw tegoed' });
    // 6. een vriendelijke duw: het jaar loopt en uw 24 uur staat nog nergens
    if (vandaag().slice(5, 7) >= '07') {
      const jaar = vandaag().slice(0, 4);
      const stil = (db.data.assetTickets || []).find(t => t.key === key && t.status === 'actief' &&
        Date.now() - Date.parse(t.at) >= BEDENKTIJD_DAGEN * 86400000 &&
        !(db.data.assetGebruik || []).some(g => g.key === key && g.assetId === t.assetId && g.datum.slice(0, 4) === jaar));
      if (stil) s.push({ icoon: '💡', tekst: 'Uw 24 uur van dit jaar bij ' + (((db.data.sharedAssets || []).find(a => a.id === stil.assetId) || {}).naam || 'uw object') + ' staat nog niet gepland' });
    }
    return s.slice(0, 5);
  }

  /* Een nieuw seintje wordt vanzelf een melding op het toestel (de bel plus
     web-push). Met geheugen: elk seintje piept precies een keer. */
  function fluisterPush(key) {
    if (String(key).startsWith('staff:') || !notify) return { ok: true, gepusht: 0 };
    const p = van(key);
    if (!p.geseind) p.geseind = {};
    let n = 0;
    for (const s of fluisterSeintjes(key)) {
      if (p.geseind[s.tekst]) continue;
      p.geseind[s.tekst] = nu();
      notify(key, { icon: s.icoon, title: 'Fluister fluistert', body: s.tekst, scope: 'fluister' });
      n++;
    }
    // het piep-geheugen blijft klein: de oudste vermeldingen vallen eraf
    const ks = Object.keys(p.geseind);
    if (ks.length > 60) for (const k of ks.sort((a, b) => p.geseind[a].localeCompare(p.geseind[b])).slice(0, ks.length - 60)) delete p.geseind[k];
    if (n) save();
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
  async function voerUit(key, codenaam, w) {
    if (w.soort === 'blok' && assetGebruik) {
      const r = assetGebruik({ key }, w.assetId, w.datum);
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      return { tekst: 'Geregeld: uw 24 uur bij ' + r.gebruik.assetNaam + ' staat op ' + w.datum + ' (nog ' + r.dagenTegoed + ' dag(en) tegoed dit jaar). Het team neemt vooraf contact op.', gedaan: true };
    }
    if (w.soort === 'tik' && pay) {
      const r = await pay.stuur({ van: codenaam, aanCodenaam: w.aan, centen: w.centen, oms: 'Via Fluister', soort: 'tik' });
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      return { tekst: 'Gedaan: ' + eur(w.centen) + ' aan ' + w.aan + ' gestuurd via een Tik. Uw saldo: ' + eur(r.saldo) + '.', gedaan: true };
    }
    return { tekst: 'Dat voorstel ken ik niet meer; zeg het gerust opnieuw.' };
  }

  /* Het gesprek. Eerst de eigen commando's (onthouden, opvragen, vergeten);
     daarna Claude met het volledige persoonlijke beeld, of de eigen regels. */
  async function fluisterZeg(key, codenaam, qIn, sess) {
    const q = String(qIn || '').trim().slice(0, 600);
    if (!q) return { status: 400, error: 'Zeg iets.' };
    const p = van(key);
    // het antwoord gaat ook het gespreksgeheugen in (laatste 5 beurten);
    // voorstel=true betekent: er staat iets klaar dat op "ja" wacht
    const klaar = (antwoord, gedaan, voorstel) => {
      p.gesprek.push({ u: q, a: String(antwoord).slice(0, 400), at: nu() });
      p.gesprek = p.gesprek.slice(-5);
      save();
      return { ok: true, antwoord, gedaan: !!gedaan, voorstel: !!voorstel };
    };
    if (/^onthoud\b/i.test(q)) {
      const r = fluisterOnthoud(key, q);
      if (r.error) return r;
      return { ok: true, antwoord: 'Onthouden: "' + r.weetjes[r.weetjes.length - 1].tekst + '". U kunt dit altijd terugzien of wissen met "wat weet je over mij".', geleerd: true };
    }
    if (/vergeet alles/i.test(q)) {
      fluisterVergeet(key, 'alles');
      p.gesprek = [];
      p.focus = {};
      p.wacht = null;
      save();
      return { ok: true, antwoord: 'Alles gewist: uw weetjes, ons gesprek en de gebruikstellers. We beginnen met een schone lei.', geleerd: true };
    }
    if (/wat (weet|onthoud) je (over|van) mij/i.test(q)) {
      const regels = [];
      if (p.weetjes.length) regels.push('U vertelde me: ' + p.weetjes.map(w => '"' + w.tekst + '"').join(', ') + '.');
      const top = topFocus(p, 3);
      if (top.length) regels.push('En ik zie dat u het meest werkt met: ' + top.join(', ') + '.');
      if (!regels.length) regels.push('Nog niets. Vertel me iets met "onthoud dat..." of gebruik de app; ik leer vanzelf wat u belangrijk vindt.');
      if (p.gesprek.length) regels.push('Verder onthoud ik alleen de laatste ' + p.gesprek.length + ' beurt(en) van ons gesprek.');
      regels.push('Wissen kan per weetje of in een keer ("vergeet alles").');
      return { ok: true, antwoord: regels.join(' ') };
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
        const r = await voerUit(key, codenaam, w);
        return klaar(r.tekst, r.gedaan);
      }
      // "nee": het voorstel gaat van tafel
      if (/^(nee|nope|laat maar|annuleer|stop|toch niet)[.!]?$/i.test(q)) {
        if (!wachtVers) return klaar('Er stond niets open; alles blijft zoals het was.');
        p.wacht = null;
        save();
        return klaar('Goed, het gaat niet door. Het voorstel is van tafel.');
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
          system: 'Je bent Fluister, de persoonlijke assistent in de RTG-app. Antwoord kort, warm en concreet, in de taal van de vraag. Gebruik het persoonlijke beeld alleen als het helpt. Context: ' + ctx,
          messages: [...p.gesprek.flatMap(g => [{ role: 'user', content: g.u }, { role: 'assistant', content: g.a }]), { role: 'user', content: q }]
        });
        return klaar(response.content[0].text);
      } catch (e) { /* val terug op de eigen regels */ }
    }
    // de eigen regels: persoonlijk waar het kan, eerlijk waar het moet
    const groet = p.weetjes.length ? 'Ik denk aan uw ' + p.weetjes.length + ' weetje(s). ' : '';
    const fluistert = seintjes.length ? ' Mijn seintjes: ' + seintjes.map(x => x.icoon + ' ' + x.tekst).join(' | ') + '.' : '';
    if (stand.length || seintjes.length) return klaar(groet + (stand.length ? 'Dit speelt er nu voor u: ' + stand.join('; ') + '.' : 'Er staat niets open.') + fluistert + ' Vraag gerust door, of leer me iets met "onthoud dat...".');
    return klaar(groet + 'Ik ben Fluister, uw persoonlijke assistent. Leer me kennen met "onthoud dat..." en vraag "wat weet je over mij" wanneer u wilt; wissen kan altijd.');
  }

  return { fluisterZeg, fluisterOnthoud, fluisterVergeet, fluisterFocus, fluisterProfiel, fluisterSeintjes, fluisterPush };
};
