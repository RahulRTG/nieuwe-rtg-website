/* Het gesprek van de Butler (kern/fluister): fluisterZeg verstaat de vraag,
   antwoordt (Claude of eigen regels) en handelt met de drempel: alles met
   geld of een poolclaim wordt eerst een voorstel dat u met "ja" bevestigt.
   Verbatim afgesplitst uit acties.js; voerUit komt via de context binnen. */
module.exports = (ctx) => {
  const { db, save, schoon, anthropic, notify, reserveerTafel, annuleerReservering,
    assetGebruik, zorgVoor, pay, acties, nu, wieBen, lijsten, van,
    fluisterOnthoud, fluisterVergeet, teSnel, fluisterSeintjes, standVan, topFocus, eur, datumInZin,
    butlerExtra, voerReisUit, voerKledingUit, voerUit } = ctx;
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
      return { ok: true, antwoord: basis + ' En ik regel het ook: zoeken door het hele aanbod ("zoek sushi"), uw dag plannen ("plan mijn dag"), een tafel reserveren of annuleren, bestellen en afrekenen ("bestel 2 sangria bij Sunset Ibiza"), tickets boeken ("boek 2 tickets voor de sunset cruise morgen"), een behandeling in de spa of kliniek boeken ("boek een massage bij Zenith morgen om 15:00"), een taxi of transfer regelen, uw 24-uursblok plannen, uw saldo opvragen, een Tik sturen, en betaalverzoeken maken, tonen en betalen. Alles met geld of een poolclaim vraagt altijd eerst uw "ja".', pakte: true };
    }
    /* De reislaag (kern/fluister/reis.js): een hele reis op een vraag,
       kleding en voorspellen voor leden, en de servicedag voor zaak en
       personeel (zonder sessie). "ja"/"nee" matcht hier bewust niet, dus
       de bevestigingsdrempel hieronder blijft de baas. */
    if (butlerExtra) {
      const extra = await butlerExtra(q, p, sess, klaar, key);
      if (extra) return extra;
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
        const personen = Math.min(10, Math.max(1, parseInt((q.match(/(\d{1,2})\s*(tickets?|kaartjes?|personen|man)\b/i) || [])[1], 10) || 1));
        const oms = personen + ' ticket(s) voor ' + act.name + ' bij ' + zaak.name;
        p.wacht = { soort: 'ticket', supplierCode: zaak.code, activiteitId: act.id, datum, tijd, personen, oms, at: nu() };
        save();
        return klaar('Even checken: ' + oms + ' op ' + datum + ' om ' + tijd + ', samen ' + eur(Math.round((act.prijs || 0) * personen * 100)) + '. Ik boek en reken direct af via RTG Pay. Zeg "ja" en de entreecode komt eraan; "nee" en het gaat niet door.', false, true);
      }
      // "boek een aromamassage bij Zenith morgen om 15:00": een behandeling
      // in de zorg & welzijn-toren; geld, dus eerst een voorstel
      if (acties && acties.careBoek && /\b(boek|regel|maak)\b/i.test(q) &&
          /\b(massage|behandeling|afspraak|consult|fysio|spa|wellness|gezicht)\w*/i.test(q)) {
        const ov = acties.careOverzicht(key);
        const ql = q.toLowerCase();
        let aanb = null, beh = null;
        for (const a of ov.aanbieders) {
          for (const b of a.behandelingen) {
            if ((b.naam || '').toLowerCase().split(/[^a-z0-9]+/).some(w => w.length > 3 && ql.includes(w))) { aanb = a; beh = b; break; }
          }
          if (beh) break;
        }
        // ook op zaaknaam matchen als de behandeling niet letterlijk genoemd is
        if (!beh) {
          aanb = ov.aanbieders.find(a => (a.naam || '').toLowerCase().split(/\s+/).some(w => w.length > 3 && ql.includes(w)));
          beh = aanb && aanb.behandelingen[0];
        }
        if (!beh) return klaar('Welke behandeling en waar? Bijvoorbeeld: ' + ov.aanbieders.flatMap(a => a.behandelingen.slice(0, 1).map(b => '"' + b.naam + '" bij ' + a.naam)).slice(0, 3).join(', ') + '.');
        const datum = datumInZin(q);
        if (!datum) return klaar('Voor welke dag? Zeg bijvoorbeeld: "boek een ' + beh.naam.toLowerCase() + ' bij ' + aanb.naam + ' morgen om ' + (beh.tijden[0] || '15:00') + '".');
        const tm = q.match(/(\d{1,2})[:.](\d{2})/);
        const tijd = (tm && beh.tijden.includes(tm[1].padStart(2, '0') + ':' + tm[2])) ? tm[1].padStart(2, '0') + ':' + tm[2] : beh.tijden[0];
        if (!tijd) return klaar('Op welk tijdstip? ' + aanb.naam + ' heeft voor ' + beh.naam + ' geen vrije tijden meer die dag.');
        const oms = beh.naam + ' bij ' + aanb.naam;
        p.wacht = { soort: 'behandeling', aanbiederId: aanb.id, behandelingId: beh.id, datum, tijd, oms, medisch: beh.soort === 'medisch', at: nu() };
        save();
        return klaar('Even checken: ' + oms + ' op ' + datum + ' om ' + tijd + ' (' + beh.duurMin + ' min), ' + eur(Math.round((beh.prijs || 0) * 100)) + '. Ik boek en reken direct af via RTG Pay; uw zorgprofiel reist mee.' +
          (beh.soort === 'medisch' ? ' Voor een medisch consult kunt u vooraf apart een intake delen in de Care-tab.' : '') +
          ' Zeg "ja" en het staat vast; "nee" en het gaat niet door.', false, true);
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
        const personen = Math.min(9, Math.max(1, parseInt((q.match(/(\d{1,2})\s*(personen|man)\b/i) || [])[1], 10) || 1));
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
          const qty = Math.min(20, Math.max(1, parseInt((ql.match(new RegExp('(\\d{1,2})\\s+(?:[a-z]+\\s+){0,2}?' + w)) || [])[1], 10) || 1));
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
          const r = await pay.verzoekMaak({ van: codenaam, aan: [m[2].trim()], perCenten: centen, oms: 'Via Rahul' });
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
          system: require('./rahul').RAHUL_LEAD + 'je bent de persoonlijke rechterhand in de RTG-app. Antwoord kort, warm en concreet, in de taal van de vraag. Gebruik het persoonlijke beeld alleen als het helpt. Context: ' + ctx,
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



  return { fluisterZeg };
};
