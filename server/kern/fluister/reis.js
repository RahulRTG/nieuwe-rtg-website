/* De Butler-reislaag (kern/fluister): Rahul regelt met EEN vraag een hele
   reis: verblijf, transfer, diner en een activiteit, als een voorstel met
   een totaalprijs dat op een enkel "ja" in zijn geheel wordt geboekt en
   afgerekend, via exact dezelfde actie-functies als de app-knoppen. Ook
   hier: koopt hij kleding (apart leggen in uw maat bij de modezaak) en
   voorspelt hij wat er nog nodig is rond wat al geboekt staat. Alles met
   geld of voorraad blijft achter de vaste drempel (eerst "ja"). */
module.exports = (ctx) => {
  const { db, save, acties, reserveerTafel, zorgVoor, eur, datumInZin, plusDagen, nu,
    verblijfBoek, retailLegApart, retailKlantProfiel } = ctx;

  const zaken = () => db.data.suppliers || [];
  const open = s => !(s.settings && s.settings.ordersOpen === false);
  const caps = s => (db.data.supplierTypes[s.type] || {}).caps || [];
  const datumPlus = (d, n) => new Date(new Date(d + 'T12:00:00').getTime() + n * 86400000).toISOString().slice(0, 10);

  /* ---- de hele reis in een vraag: "plan mijn reis/weekend (met 4 personen,
     3 nachten)" bouwt verblijf + transfer + diner + activiteit als een
     voorstel; het ene "ja" boekt daarna alles in volgorde. ---- */
  function bouwReisplan(q) {
    const personen = Math.min(10, Math.max(1, parseInt((q.match(/(\d{1,2})\s*(personen|man|vrienden|pers)\b/i) || [])[1], 10) || 2));
    const start = datumInZin(q) || plusDagen(1);
    const nachten = Math.min(14, Math.max(1, parseInt((q.match(/(\d{1,2})\s*nacht/i) || [])[1], 10) || (/weekend/i.test(q) ? 2 : 2)));
    const delen = [];
    // verblijf: het eerste adres met een vrije kamer
    const hotel = zaken().find(s => Array.isArray(s.rooms) && s.rooms.some(r => r.available) && open(s));
    const kamer = hotel && hotel.rooms.find(r => r.available);
    if (hotel) delen.push({ soort: 'verblijf', supplierCode: hotel.code, roomId: kamer.id,
      aankomst: start, vertrek: datumPlus(start, nachten), personen,
      oms: nachten + ' nacht(en) in ' + kamer.name + ' bij ' + hotel.name,
      centen: Math.round((Number(kamer.price) || 0) * nachten * 100) });
    // transfer: een vervoerder brengt u naar het verblijf
    const rijders = zaken().filter(x => caps(x).includes('rides') && x.type !== 'activiteit' && open(x));
    const rijder = rijders.find(x => x.type === 'taxi') || rijders[0];
    if (rijder && hotel) delen.push({ soort: 'rit', supplierCode: rijder.code, to: hotel.name,
      toCode: hotel.code, personen, datum: start, tijd: '15:00',
      oms: 'transfer met ' + rijder.name + ' naar ' + hotel.name, centen: 0 });
    // diner op de aankomstavond
    const resto = zaken().find(s => s.type === 'restaurant' && open(s));
    if (resto) delen.push({ soort: 'tafel', supplierCode: resto.code, datum: start, tijd: '20:00',
      personen, oms: 'diner bij ' + resto.name + ' om 20:00', centen: 0 });
    // een activiteit op de eerste volle dag
    const actZaak = zaken().find(s => (s.activiteiten || []).length && open(s));
    const act = actZaak && actZaak.activiteiten[0];
    if (act) delen.push({ soort: 'ticket', supplierCode: actZaak.code, activiteitId: act.id,
      datum: datumPlus(start, 1), tijd: (act.tijden || [])[0] || '16:00', personen,
      oms: act.name + ' bij ' + actZaak.name, centen: Math.round((Number(act.prijs) || 0) * personen * 100) });
    return { delen, start, nachten, personen };
  }

  async function voerReisUit(key, codenaam, w, sess) {
    const regels = [];
    let gelukt = 0;
    for (const d of w.delen) {
      try {
        if (d.soort === 'verblijf' && verblijfBoek) {
          const r = verblijfBoek(sess, { supplierCode: d.supplierCode, roomId: d.roomId, aankomst: d.aankomst, vertrek: d.vertrek, personen: d.personen });
          regels.push(r.error ? '✕ ' + d.oms + ': ' + r.error : '✓ ' + d.oms + ' (' + r.verblijf.ref + ', ' + d.aankomst + ' tot ' + d.vertrek + ')');
          if (!r.error) gelukt++;
        } else if (d.soort === 'rit' && acties && acties.vraagRit) {
          const r = acties.vraagRit(sess, { supplierCode: d.supplierCode, to: d.to, toCode: d.toCode, personen: d.personen, datum: d.datum, tijd: d.tijd });
          if (r.error) { regels.push('✕ ' + d.oms + ': ' + r.error); continue; }
          const b = acties.betaalRit(sess, { ref: r.rit.ref });
          regels.push(b.error ? '✕ ' + d.oms + ': ' + b.error : '✓ ' + d.oms + ' om ' + d.tijd + ' (' + r.rit.ref + ')');
          if (!b.error) gelukt++;
        } else if (d.soort === 'tafel' && reserveerTafel) {
          const r = reserveerTafel({ key, tier: sess.tier }, codenaam, { supplierCode: d.supplierCode, datum: d.datum, tijd: d.tijd, personen: d.personen });
          regels.push(r.error ? '✕ ' + d.oms + ': ' + r.error : '✓ ' + d.oms + ' op ' + d.datum);
          if (!r.error) gelukt++;
        } else if (d.soort === 'ticket' && acties && acties.koopTicket) {
          const r = acties.koopTicket(sess, { supplierCode: d.supplierCode, activiteitId: d.activiteitId, datum: d.datum, tijd: d.tijd, personen: d.personen });
          if (r.error) { regels.push('✕ ' + d.oms + ': ' + r.error); continue; }
          const b = acties.betaalBoeking(sess, { ref: r.ticket.ref });
          regels.push(b.error ? '✕ ' + d.oms + ': ' + b.error : '✓ ' + d.oms + ' op ' + d.datum + ' om ' + d.tijd + ' (entreecode ' + r.ticket.code + ')');
          if (!b.error) gelukt++;
        }
      } catch (e) { regels.push('✕ ' + d.oms + ': dat lukte net niet; probeer dat onderdeel los.'); }
    }
    const zorgNu = zorgVoor && zorgVoor(key);
    return { tekst: 'Uw reis staat: ' + regels.join(' | ') + '.' +
      (gelukt < w.delen.length ? ' De onderdelen met een ✕ regel ik graag alsnog; zeg het maar.' : '') +
      (zorgNu && (zorgNu.allergenen || []).length ? ' Uw allergenen reizen overal automatisch mee.' : '') +
      ' Alles staat in uw app: het verblijf onder Reizen, de rit onder Onderweg, de tickets met oplichtende code.', gedaan: true };
  }

  /* ---- kleding: "koop een linnen overhemd (maat M)": Rahul zoekt in de
     modecatalogus, pakt uw maat uit het klantprofiel en legt het stuk voor
     u apart (voorraadclaim, dus eerst uw "ja"). ---- */
  function bouwKleding(q, sess) {
    const modes = zaken().filter(s => Array.isArray(s.artikelen) && s.artikelen.length && open(s));
    if (!modes.length) return null;
    const ql = q.toLowerCase();
    const maatWens = (q.match(/maat\s+([a-z0-9]{1,4})\b/i) || [])[1];
    for (const s of modes) {
      for (const a of s.artikelen || []) {
        const tekst = ((a.naam || '') + ' ' + (a.categorie || '')).toLowerCase();
        if (!tekst.split(/\s+/).some(wrd => wrd.length > 3 && ql.includes(wrd))) continue;
        const prof = retailKlantProfiel && sess ? retailKlantProfiel(s, sess.key) : null;
        const maat = maatWens || (prof && prof.maten && (prof.maten.boven || prof.maten.onder)) || null;
        const v = (a.varianten || []).find(x => x.voorraad > 0 && (!maat || String(x.maat).toLowerCase() === String(maat).toLowerCase())) ||
          (a.varianten || []).find(x => x.voorraad > 0);
        if (!v) continue;
        return { supplierCode: s.code, zaakNaam: s.name, vsku: v.vsku, artikel: a.naam, kleur: v.kleur, maat: v.maat,
          centen: Math.round((Number(a.price) || 0) * 100) };
      }
    }
    return null;
  }

  function voerKledingUit(key, codenaam, w) {
    const s = zaken().find(x => x.code === w.supplierCode);
    if (!s || !retailLegApart) return { tekst: 'De modezaak is even niet bereikbaar; probeer het zo weer.' };
    const r = retailLegApart(s, key, w.vsku, 'butler');
    if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
    return { tekst: 'Geregeld: ' + w.artikel + ' (' + w.kleur + ', maat ' + w.maat + ') hangt voor u apart bij ' + w.zaakNaam +
      ' voor ' + eur(w.centen) + '. Past hij, dan rekent u af aan de kassa of in de paskamer; past hij niet, dan gaat hij gewoon terug in de verkoop.', gedaan: true };
  }

  /* ---- voorspellen: "wat heb ik nodig": Rahul kijkt naar wat er al staat
     (verblijf, boekingen, reserveringen) en stelt de ontbrekende stukken
     voor, elk met de zin waarmee hij het direct regelt. ---- */
  function voorspel(key, sess) {
    const mijnVerblijf = (db.data.verblijven || []).find(v => v.customerKey === key && v.status !== 'geannuleerd' && v.vertrek >= new Date().toISOString().slice(0, 10));
    const mijnRes = (db.data.reservations || []).filter(r => (r.customerKey || r.customerTier) === key && r.status !== 'geannuleerd');
    const mijnBoek = (db.data.boekingen || []).filter(b => (b.customerKey || b.customerTier) === key);
    const tips = [];
    if (mijnVerblijf) {
      if (!mijnBoek.some(b => b.soort === 'rit' && b.datum === mijnVerblijf.aankomst))
        tips.push('een transfer naar ' + mijnVerblijf.supplierName + ' op ' + mijnVerblijf.aankomst + ' ("regel een taxi naar ' + mijnVerblijf.supplierName + '")');
      if (!mijnRes.some(r => r.datum >= mijnVerblijf.aankomst && r.datum <= mijnVerblijf.vertrek))
        tips.push('een dinerreservering tijdens uw verblijf ("reserveer een tafel morgen om 20:00")');
    } else tips.push('uw volgende reis in een keer ("plan mijn weekend met 4 vrienden")');
    if (!mijnBoek.some(b => b.soort !== 'rit')) tips.push('iets te doen ("boek 2 tickets voor de eerste activiteit die je vindt")');
    const zorgNu = zorgVoor && zorgVoor(key);
    return 'Wat ik voor u zou klaarzetten: ' + tips.join('; ') + '.' +
      (zorgNu && (zorgNu.allergenen || []).length ? ' Met uw allergenen houd ik overal rekening.' : '') +
      ' Zeg een van de zinnen en ik regel het, met een voorstel vooraf zodra er geld mee gemoeid is.';
  }

  /* ---- de servicedag: voor een zaak of een personeelslid bouwt Rahul uit
     de echte dagstand (reserveringen, lopende orders, activiteiten) een
     werkplan met per regel de vervolgstap. Lezen, geen geld: direct. ---- */
  function servicedag(key) {
    const code = (String(key).match(/^(?:staff|zaak):([^:]+)/) || [])[1];
    const s = code && zaken().find(x => x.code === code);
    if (!s) return null;
    const vandaag = new Date().toISOString().slice(0, 10);
    const regels = [];
    const res = (db.data.reserveringen || []).filter(r => r.supplierCode === s.code && r.datum === vandaag && ['aangevraagd', 'bevestigd'].includes(r.status));
    if (res.length) {
      const open = res.filter(r => r.status === 'aangevraagd').length;
      regels.push(res.length + ' reservering(en) vandaag, de eerste om ' + res.map(r => r.tijd).sort()[0] +
        (open ? ' (' + open + ' nog te bevestigen: doe dat eerst, gasten wachten op zekerheid)' : ''));
    }
    let orders = [];
    try { orders = require('../../db').ordersVanZaak(s.code).filter(o => !['geserveerd', 'geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status)); } catch (e) {}
    if (orders.length) regels.push(orders.length + ' lopende bestelling(en) op de lijn: houd de wachttijden kort');
    for (const a of (s.activiteiten || []).slice(0, 2))
      regels.push(a.name + ' vandaag om ' + ((a.tijden || [])[0] || '?') + ': zet de entree en het team klaar');
    if (s.settings && s.settings.ordersOpen === false) regels.push('de zaak staat DICHT voor bestellingen: vergeet niet open te zetten als de dienst begint');
    if (!regels.length) regels.push('een rustige start: geen reserveringen of lopende orders op dit moment. Goed moment voor de voorraad, het bord en de briefing');
    return 'Uw servicedag bij ' + s.name + ': ' + regels.join(' | ') + '. Vraag me gerust door per onderdeel; ik geef ook seintjes zodra er iets bijkomt.';
  }

  /* ---- de haak in fluisterZeg: herkent de vragen en zet zelf het
     voorstel klaar; geeft null terug als de vraag niet van deze laag is. ---- */
  async function butlerExtra(q, p, sess, klaar, key) {
    // fototips: Rahul als fotocoach voor iedereen (lezen, geen geld: direct)
    if (/fototip|foto ?tip|mooiere foto('s)?|perfecte foto|hoe fotografeer/i.test(q)) {
      const food = /food|eten|gerecht|bord/i.test(q);
      return klaar(food
        ? 'Voor het perfecte food-shot: recht van boven of juist op tafelhoogte, alles ertussenin maakt borden klein. Schuif het bord naar daglicht, zet uw rug naar de lamp en ruim de tafel rond het bord op. In de RTG Camera-app wordt de ring groen zodra u recht boven het bord hangt.'
        : 'Voor de perfecte vakantiefoto: zet de horizon op een rasterlijn (niet in het midden), mensen op een derde van het beeld met kijkruimte, en fotografeer in het gouden uur, net na zonsopkomst of voor zonsondergang. De RTG Camera-app helpt met het raster en de waterpas.');
    }
    if (!sess) {
      // de zaak- en personeelskant: het dagplan uit de echte dagstand
      if (/plan (mijn|onze|de) (service)?dag|dagplan|servicedag/i.test(q)) {
        const plan = servicedag(key);
        if (plan) return klaar(plan);
      }
      return null;
    }
    if (/\b(plan|regel|boek)\b/i.test(q) && /\b(reis|trip|weekend|tripje|city ?trip)\b/i.test(q)) {
      const plan = bouwReisplan(q);
      if (!plan.delen.length) return klaar('Ik zie nu geen aanbod om een reis van te bouwen; kijk anders even in Reizen.');
      const totaal = plan.delen.reduce((t, d) => t + (d.centen || 0), 0);
      p.wacht = { soort: 'reisplan', delen: plan.delen, oms: 'reis vanaf ' + plan.start, at: nu() };
      save();
      return klaar('Mijn voorstel voor uw reis vanaf ' + plan.start + ' met ' + plan.personen + ' personen: ' +
        plan.delen.map(d => d.oms).join(' | ') + '. Samen ' + eur(totaal) + ' (de transfer volgt het tarief van de vervoerder). ' +
        'Zeg "ja" en ik boek alles in een keer, inclusief uw dagschema; "nee" en het gaat niet door.', false, true);
    }
    if (/\b(koop|bestel|zoek|regel)\b/i.test(q)) {
      // de catalogus zelf is het bewijs: vindt Rahul een echt kledingstuk in
      // de vraag, dan is dit een kledingwens (anders valt de vraag gewoon
      // door naar bestellen, tickets of de rest)
      const k = bouwKleding(q, sess);
      if (k) {
        p.wacht = { soort: 'kleding', ...k, at: nu() };
        save();
        return klaar('Gevonden: ' + k.artikel + ' (' + k.kleur + ', maat ' + k.maat + ') bij ' + k.zaakNaam + ' voor ' + eur(k.centen) +
          '. Zal ik hem voor u apart laten leggen? Zeg "ja" en hij hangt klaar; "nee" en ik laat hem hangen.', false, true);
      }
      if (/\b(kleding|jurk|overhemd|shirt|jas|schoenen|outfit|broek|blazer|rok)\b/i.test(q))
        return klaar('Ik vond dit stuk niet in de collecties. Vraag het iets anders ("koop een linnen overhemd") of kijk in de catalogus.');
    }
    if (/wat heb ik nodig|wat raad je (me )?aan|voorspel|wat mis ik|denk met me mee/i.test(q)) {
      return klaar(voorspel(sess.key, sess));
    }
    return null;
  }

  return { butlerExtra, voerReisUit, voerKledingUit };
};
