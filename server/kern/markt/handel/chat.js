/* Markt-handel (deelmodule): de chat tussen koper en verkoper. chatPub komt
   per aanroep uit de deallaag (late binding via de context). Krijgt de
   gedeelde context een keer bij het opstarten vanuit kern/markt/handel.js. */
module.exports = (ctx) => {
  const { db, save, crypto, anthropic, schoon, notify, notifySupplier, haversine, betaal,
    CATEGORIEEN, STATEN, LEVERING, RESPECTLOOS, VERBODEN, SCAM_WOORDEN, CONTACT_BUITEN,
    RICHTPRIJS, STAAT_FACTOR, SAMEN_METER, SAMEN_VERS_MS,
    store, rid, nu, clip, pk, keurTekst, scanVeiligheid, pub, zichtbaar, vind } = ctx;
  const chatPub = (chat, kijker) => ctx.chatPub(chat, kijker);
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

  return { chatId, sein, reageer, antwoord, chatOpen };
};
