/* Markt-handel: de chat tussen koper en verkoper en de veilige deal
   (prijs afspreken, beide GPS bij elkaar, factuur, betalen) plus het
   postvak. Krijgt de gedeelde context een keer bij het opstarten
   vanuit kern/markt.js. */
module.exports = (ctx) => {
  const { db, save, crypto, anthropic, schoon, notify, notifySupplier, haversine, betaal,
    CATEGORIEEN, STATEN, LEVERING, RESPECTLOOS, VERBODEN, SCAM_WOORDEN, CONTACT_BUITEN,
    RICHTPRIJS, STAAT_FACTOR, SAMEN_METER, SAMEN_VERS_MS,
    store, rid, nu, clip, pk, keurTekst, scanVeiligheid, pub, zichtbaar, vind } = ctx;
  /* ---------- chat tussen koper en verkoper ---------- */
  function chatId(adId, koperKey) { return adId + '::' + koperKey; }
  function sein(partij, note) {
    try {
      if (partij.soort === 'lid') notify && notify(partij.id, note);
      else if (partij.soort === 'zaak') notifySupplier && notifySupplier(partij.id, { kind: 'markt', text: note.body || note.title });
      // rtf-gezinnen halen hun berichten op (poll); geen push nodig
    } catch (e) {}
  }
  function reageer(adId, koper, tekst) {
    const ad = vind(adId);
    if (!ad || !zichtbaar(ad, koper)) return { error: 'Advertentie niet gevonden.', status: 404 };
    if (pk(ad.verkoper) === pk(koper)) return { error: 'Dit is je eigen advertentie.', status: 400 };
    const m = store();
    // koper mag niet chatten als de verkoper hem blokkeerde
    const blokV = m.geblokkeerd[pk(ad.verkoper)] || [];
    if (blokV.includes(pk(koper))) return { error: 'Je kunt deze verkoper niet bereiken.', status: 403 };
    const t = clip(tekst, 800);
    if (!t) return { error: 'Typ een bericht.', status: 400 };
    if (RESPECTLOOS.test(t)) return { error: 'Houd het bericht netjes en respectvol.', status: 400 };
    const id = chatId(adId, pk(koper));
    let chat = m.chats[id];
    if (!chat) chat = m.chats[id] = { adId, adTitel: ad.titel, koper: { soort: koper.soort, id: koper.id, naam: clip(koper.naam, 40) || 'Koper' }, verkoper: { soort: ad.verkoper.soort, id: ad.verkoper.id, naam: ad.verkoper.naam }, berichten: [], at: nu() };
    const scam = SCAM_WOORDEN.test(t) || CONTACT_BUITEN.test(t);
    chat.berichten.push({ van: pk(koper), naam: chat.koper.naam, tekst: t, at: nu(), let: scam });
    chat.laatst = nu();
    save();
    sein(ad.verkoper, { icon: '🏷️', title: 'Bericht over "' + ad.titel.slice(0, 30) + '"', body: t.slice(0, 80) });
    return { ok: true, chat: chatPub(chat, koper), tip: scam ? 'Let op: betaal nooit vooraf en houd het gesprek hier in de app.' : null };
  }
  // De verkoper (of koper) antwoordt in een bestaande chat.
  function antwoord(cid, partij, tekst) {
    const chat = store().chats[cid];
    if (!chat) return { error: 'Gesprek niet gevonden.', status: 404 };
    if (pk(partij) !== pk(chat.koper) && pk(partij) !== pk(chat.verkoper)) return { error: 'Dit gesprek is niet van jou.', status: 403 };
    const t = clip(tekst, 800);
    if (!t) return { error: 'Typ een bericht.', status: 400 };
    if (RESPECTLOOS.test(t)) return { error: 'Houd het bericht netjes en respectvol.', status: 400 };
    const scam = SCAM_WOORDEN.test(t) || CONTACT_BUITEN.test(t);
    const ander = pk(partij) === pk(chat.koper) ? chat.verkoper : chat.koper;
    const naam = pk(partij) === pk(chat.koper) ? chat.koper.naam : chat.verkoper.naam;
    chat.berichten.push({ van: pk(partij), naam, tekst: t, at: nu(), let: scam });
    chat.laatst = nu();
    save();
    sein(ander, { icon: '🏷️', title: 'Bericht over "' + (chat.adTitel || '').slice(0, 30) + '"', body: t.slice(0, 80) });
    return { ok: true, chat: chatPub(chat, partij), tip: scam ? 'Let op: betaal nooit vooraf en houd het gesprek hier in de app.' : null };
  }
  // Een bestaand gesprek openen (zonder iets te versturen).
  function chatOpen(cid, partij) {
    const chat = store().chats[cid];
    if (!chat) return { error: 'Gesprek niet gevonden.', status: 404 };
    if (pk(partij) !== pk(chat.koper) && pk(partij) !== pk(chat.verkoper)) return { error: 'Dit gesprek is niet van jou.', status: 403 };
    return { ok: true, chat: chatPub(chat, partij) };
  }

  /* ---------- veilig samen betalen (GPS bij elkaar -> factuur -> Apple Pay) ----------
     De koper betaalt de verkoper pas nadat ze fysiek samen zijn: beide delen bij
     de overhandiging hun locatie; zijn die dichtbij en vers, dan komt er een
     factuur en kan de koper via zijn account betalen (Apple Pay). Zo is er geen
     vooruitbetaling op afstand mogelijk. */
  function chatMet(cid) { return store().chats[cid] || null; }
  function isDeelnemer(chat, partij) { return pk(partij) === pk(chat.koper) || pk(partij) === pk(chat.verkoper); }
  function rolIn(chat, partij) { return pk(partij) === pk(chat.verkoper) ? 'verkoper' : 'koper'; }

  // Prijs afspreken (of bijstellen). Elke deelnemer mag het bedrag zetten; de
  // andere ziet het en stemt in door verder te gaan naar de overhandiging.
  function dealVoorstel(cid, partij, bedrag) {
    const chat = chatMet(cid);
    if (!chat) return { error: 'Gesprek niet gevonden.', status: 404 };
    if (!isDeelnemer(chat, partij)) return { error: 'Dit gesprek is niet van jou.', status: 403 };
    const ad = vind(chat.adId);
    const b = Math.max(0, Math.round(Number(bedrag) || (ad ? ad.prijs : 0)));
    if (b <= 0) return { error: 'Vul een bedrag in om af te spreken.', status: 400 };
    const oud = chat.deal || {};
    chat.deal = { bedrag: b, status: 'afgesproken', door: rolIn(chat, partij),
      koperGps: null, verkoperGps: null, samen: false, factuur: null, betaald: false, methode: null, at: nu() };
    if (oud.betaald) chat.deal = oud; // een afgeronde betaling niet overschrijven
    chat.berichten.push({ van: pk(partij), naam: rolIn(chat, partij) === 'verkoper' ? chat.verkoper.naam : chat.koper.naam, tekst: 'Prijs afgesproken: € ' + b + '. Betalen kan zodra jullie samen zijn.', at: nu(), systeem: true });
    save();
    const ander = pk(partij) === pk(chat.koper) ? chat.verkoper : chat.koper;
    sein(ander, { icon: '🤝', title: 'Prijs afgesproken', body: '€ ' + b + ' voor "' + (chat.adTitel || '').slice(0, 30) + '"' });
    return { ok: true, chat: chatPub(chat, partij) };
  }

  // "Ik ben hier": deel je locatie bij de overhandiging. Zijn beide locaties
  // dichtbij en vers, dan zijn jullie 'samen' en komt de factuur vrij.
  function dealHier(cid, partij, lat, lng) {
    const chat = chatMet(cid);
    if (!chat) return { error: 'Gesprek niet gevonden.', status: 404 };
    if (!isDeelnemer(chat, partij)) return { error: 'Dit gesprek is niet van jou.', status: 403 };
    if (!chat.deal || !chat.deal.bedrag) return { error: 'Spreek eerst een prijs af.', status: 400 };
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return { error: 'We konden je locatie niet lezen. Zet locatie aan.', status: 400 };
    const pos = { lat: Number(lat), lng: Number(lng), at: Date.now() };
    if (pk(partij) === pk(chat.koper)) chat.deal.koperGps = pos; else chat.deal.verkoperGps = pos;
    const kg = chat.deal.koperGps, vg = chat.deal.verkoperGps;
    let afstand = null;
    const versKg = kg && (Date.now() - kg.at) < SAMEN_VERS_MS;
    const versVg = vg && (Date.now() - vg.at) < SAMEN_VERS_MS;
    if (versKg && versVg) {
      afstand = haversine ? haversine(kg, vg) : null;
      if (afstand != null && afstand <= SAMEN_METER && !chat.deal.betaald) {
        if (!chat.deal.samen) {
          chat.deal.samen = true;
          chat.deal.status = 'samen';
          chat.deal.factuur = maakFactuur(chat);
          const ander = pk(partij) === pk(chat.koper) ? chat.verkoper : chat.koper;
          sein(ander, { icon: '📍', title: 'Jullie zijn samen', body: 'De factuur staat klaar; de koper kan nu betalen.' });
        }
      }
    }
    chat.deal.afstand = afstand;
    save();
    return { ok: true, chat: chatPub(chat, partij), samen: !!chat.deal.samen, afstand };
  }

  function maakFactuur(chat) {
    const m = store();
    m.teller = (m.teller || 0) + 1;
    const jaar = new Date().getFullYear();
    return {
      nummer: 'SAL-' + jaar + '-' + String(m.teller).padStart(6, '0'),
      bedrag: chat.deal.bedrag, verkoper: chat.verkoper.naam, koper: chat.koper.naam,
      omschrijving: chat.adTitel || 'Marktplaats-aankoop', at: nu()
    };
  }

  // De koper betaalt de verkoper via zijn account (Apple Pay). Kan alleen als ze
  // samen zijn (GPS bij elkaar) en de factuur klaarstaat.
  async function dealBetaal(cid, partij, methode) {
    const chat = chatMet(cid);
    if (!chat) return { error: 'Gesprek niet gevonden.', status: 404 };
    if (!isDeelnemer(chat, partij)) return { error: 'Dit gesprek is niet van jou.', status: 403 };
    if (rolIn(chat, partij) !== 'koper') return { error: 'Alleen de koper betaalt.', status: 403 };
    if (!chat.deal || !chat.deal.samen) return { error: 'Betalen kan pas als jullie samen zijn (locaties bij elkaar).', status: 409 };
    if (chat.deal.betaald) return { error: 'Deze aankoop is al betaald.', status: 409 };
    const m = ['apple-pay', 'ideal', 'kaart'].includes(methode) ? methode : 'apple-pay';
    // De betaling loopt via de betaal-naad (met Apple Pay als methode). In demo
    // rondt die direct af; met een echte aanbieder bevestigt de app de Apple Pay
    // betaling met de clientSecret.
    let res = { status: 'betaald' };
    if (betaal && betaal.maakBetaling) {
      try {
        res = await betaal.maakBetaling({ bedrag: Math.round(chat.deal.bedrag * 100), valuta: 'eur',
          referentie: chat.deal.factuur.nummer, omschrijving: 'De Salon: ' + (chat.adTitel || 'aankoop') });
      } catch (e) { return { error: 'De betaling kon niet worden gestart. Probeer het opnieuw.', status: 502 }; }
    }
    if (res.status !== 'betaald' && res.clientSecret) {
      chat.deal.methode = m; chat.deal.clientSecret = res.clientSecret; chat.deal.status = 'in-behandeling';
      save();
      return { ok: true, inBehandeling: true, clientSecret: res.clientSecret, chat: chatPub(chat, partij) };
    }
    chat.deal.betaald = true; chat.deal.status = 'betaald'; chat.deal.methode = m; chat.deal.betaaldAt = nu();
    // de advertentie is verkocht
    const ad = vind(chat.adId); if (ad) ad.status = 'verkocht';
    chat.berichten.push({ van: pk(partij), naam: chat.koper.naam, tekst: 'Betaald via ' + (m === 'apple-pay' ? 'Apple Pay' : m) + ': € ' + chat.deal.bedrag + '. Bedankt!', at: nu(), systeem: true });
    save();
    sein(chat.verkoper, { icon: '✅', title: 'Betaald', body: chat.koper.naam + ' heeft € ' + chat.deal.bedrag + ' betaald voor "' + (chat.adTitel || '').slice(0, 30) + '".' });
    return { ok: true, betaald: true, factuur: chat.deal.factuur, chat: chatPub(chat, partij) };
  }

  function dealPub(chat, kijker) {
    const d = chat.deal;
    if (!d) return null;
    const rol = rolIn(chat, kijker);
    const ikGps = rol === 'koper' ? d.koperGps : d.verkoperGps;
    const anderGps = rol === 'koper' ? d.verkoperGps : d.koperGps;
    return {
      bedrag: d.bedrag, status: d.status, rol,
      ikGedeeld: !!ikGps, anderGedeeld: !!anderGps, samen: !!d.samen,
      afstand: d.afstand != null ? d.afstand : null,
      factuur: d.factuur || null, betaald: !!d.betaald, methode: d.methode || null,
      magBetalen: rol === 'koper' && !!d.samen && !d.betaald
    };
  }
  function chatPub(chat, kijker) {
    const kijkerKey = pk(kijker);
    return {
      id: chatId(chat.adId, pk(chat.koper)), adId: chat.adId, adTitel: chat.adTitel,
      metNaam: kijkerKey === pk(chat.koper) ? chat.verkoper.naam : chat.koper.naam,
      rol: rolIn(chat, kijker),
      berichten: chat.berichten.map(b => ({ mijn: b.van === kijkerKey, naam: b.naam, tekst: b.tekst, at: b.at, let: !!b.let, systeem: !!b.systeem })),
      deal: dealPub(chat, kijker)
    };
  }
  function postvak(partij) {
    const key = pk(partij);
    return Object.values(store().chats)
      .filter(c => pk(c.koper) === key || pk(c.verkoper) === key)
      .sort((a, b) => String(b.laatst || b.at).localeCompare(String(a.laatst || a.at)))
      .map(c => ({
        id: chatId(c.adId, pk(c.koper)), adId: c.adId, adTitel: c.adTitel,
        metNaam: key === pk(c.koper) ? c.verkoper.naam : c.koper.naam,
        laatste: (c.berichten[c.berichten.length - 1] || {}).tekst || '', laatst: c.laatst || c.at,
        rol: key === pk(c.koper) ? 'koper' : 'verkoper',
        deal: c.deal ? { status: c.deal.status, bedrag: c.deal.bedrag, samen: !!c.deal.samen, betaald: !!c.deal.betaald } : null
      }));
  }
  return { reageer, antwoord, postvak, chatOpen, chatPub, dealVoorstel, dealHier, dealBetaal };
};
