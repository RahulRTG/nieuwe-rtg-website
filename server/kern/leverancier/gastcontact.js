/* Leverancier (deelmodule): de chatlijnen per afdeling, de zorg-contactlijn en de Salon-kant van de klant.
   Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/leverancier.js. */
module.exports = (ctx) => {
  const { db, save, crypto, i18n, notify, broadcastSync, sseToSupplier, sseToCustomer, logActivity,
    findSupplier, connectedSupplierCodes, guestsFor, gidsHaal, etaMinutes, haversine, accounts, werkgeverSollicitatie,
    HK_STATUSES, POS_METHODS, DOOR_RELOCK_MS, TABLE_STATUSES, ZAAK_OPTIES,
    ordersVanZaak, boekingenVanZaak, publicTrip } = ctx;
  function deptsFor(s) {
    if (s.type === 'hotel') return ['Receptie', 'Roomservice', 'Housekeeping', 'Onderhoud', 'Security'];
    if (s.type === 'apartment' || s.type === 'villa') return ['Beheer', 'Onderhoud', 'Security'];
    return ['Team'];
  }
  function chatKeyOf(supplierCode, customerKey, dept) { return supplierCode + '|' + customerKey + '|' + dept; }
  function getChat(s, customerKey, codename, tier, dept) {
    const k = chatKeyOf(s.code, customerKey, dept);
    if (!db.data.guestChats[k]) {
      db.data.guestChats[k] = { supplierCode: s.code, customerKey, codename, tier, dept, messages: [], unreadGuest: 0, unreadPartner: 0, lastAt: null };
    }
    return db.data.guestChats[k];
  }
  function validDept(s, dept) {
    const list = deptsFor(s);
    return list.includes(dept) ? dept : list[0];
  }

  /* Zodra een klant in contact komt met een partner (boekt, bestelt, huurt,
     koopt of gewoon de etalage bekijkt) openen we automatisch een chatlijn.
     Zo zijn ze nooit vreemden: beiden kunnen elkaars Salon bekijken en direct
     appen. Idempotent: de lijn wordt maar een keer aangemaakt. */
  function zorgContact(s, customerKey, codename, tier) {
    if (!s || !customerKey || String(customerKey).startsWith('rtf:')) return null;
    const k = chatKeyOf(s.code, customerKey, 'Team');
    const bestond = !!db.data.guestChats[k];
    const chat = getChat(s, customerKey, codename || customerKey, tier || 'rtg', 'Team');
    chat.open = true;
    if (codename) chat.codename = codename;
    if (tier) chat.tier = tier;
    if (!bestond) {
      chat.messages.push({ from: 'systeem', text: 'U heeft nu een open lijn met ' + s.name + '. Bekijk gerust elkaars Salon.', at: new Date().toISOString() });
      chat.lastAt = new Date().toISOString();
      try { save(); } catch (e) {}
      try { notify(tier || 'rtg', { icon: '💬', title: 'Open lijn met ' + s.name, body: 'App direct en bekijk elkaars Salon.', scope: 'gchat' }); } catch (e) {}
      try { sseToCustomer(customerKey, 'sync', { scope: 'gchat' }); } catch (e) {}
      try { sseToSupplier(s.code, 'sync', { scope: 'gchat' }); } catch (e) {}
    }
    return chat;
  }

  /* De Salon van een klant zoals de partner die ziet: privacy-first, dus alleen
     de codenaam, de pas en de eigen Salon-posts van het lid (nooit de echte
     naam). Zo kan de partner vooraf al kennismaken. */
  function klantSalon(key) {
    let codename = key, tier = 'rtg';
    const dir = (db.data.memberDir || {})[key];
    if (dir) { codename = dir.codename || key; tier = dir.tier || tier; }
    // val terug op een lopende chat voor de codenaam als de gids hem niet kent
    if (!dir) { for (const c of Object.values(db.data.guestChats || {})) if (c.customerKey === key) { codename = c.codename || codename; tier = c.tier || tier; break; } }
    // early exit: we tonen er hooguit 12, dus nooit de hele feed doorlopen
    const posts = [];
    for (const p of (db.data.posts || [])) {
      if (p.partner || p.author !== codename) continue;
      posts.push({ text: String(p.text || '').slice(0, 200), place: p.place || '', photo: p.photo || null, at: p.at || null });
      if (posts.length >= 12) break;
    }
    return { codename, tier, posts };
  }

  // publieke weergave van een leverancier (voor de klant)
  return { deptsFor, chatKeyOf, getChat, validDept, zorgContact, klantSalon };
};
