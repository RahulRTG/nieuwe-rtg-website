/* Leverancier (deelmodule): de chatlijnen per afdeling, de zorg-contactlijn en de Salon-kant van de klant.
   Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/leverancier.js. */
module.exports = (ctx) => {
  const { db, save, crypto, i18n, notify, broadcastSync, sseToSupplier, sseToCustomer, logActivity,
    findSupplier, connectedSupplierCodes, guestsFor, gidsHaal, etaMinutes, haversine, accounts, werkgeverSollicitatie,
    HK_STATUSES, POS_METHODS, DOOR_RELOCK_MS, TABLE_STATUSES, ZAAK_OPTIES,
    ordersVanZaak, boekingenVanZaak, publicTrip, commGastVan } = ctx;
  function deptsFor(s) {
    if (s.type === 'hotel') return ['Receptie', 'Roomservice', 'Housekeeping', 'Onderhoud', 'Security'];
    if (s.type === 'apartment' || s.type === 'villa') return ['Beheer', 'Onderhoud', 'Security'];
    return ['Team'];
  }
  /* De sleutel van een lijn blijft dezelfde drie delen dragen (CODE|lid|
     afdeling): de schermen sturen hem mee en kern/comm/gast.js herkent hem
     terug. getChat() stond hier ook en is WEG -- die maakte een record in
     db.data.guestChats aan, en die voorraad is sinds de verhuizing een
     bevroren archief. Een lijn aanmaken doet zorgContact() nu in de kern. */
  function chatKeyOf(supplierCode, customerKey, dept) { return supplierCode + '|' + customerKey + '|' + dept; }
  function validDept(s, dept) {
    const list = deptsFor(s);
    return list.includes(dept) ? dept : list[0];
  }

  /* Zodra een klant in contact komt met een partner (boekt, bestelt, huurt,
     koopt of gewoon de etalage bekijkt) openen we automatisch een chatlijn.
     Zo zijn ze nooit vreemden: beiden kunnen elkaars Salon bekijken en direct
     appen. Idempotent: de lijn wordt maar een keer aangemaakt. */
  /* SINDS DE VERHUIZING SCHRIJFT DIT NIET MEER IN db.data.guestChats. Die
     voorraad is een bevroren archief: er wordt uit gelezen zolang er nog niet
     verhuisde lijnen in staan, en er komt niets meer bij. Een nieuwe lijn
     aanmaken in de oude vorm zou dat weer een half-levende voorraad maken --
     twee plekken waar "bestaat deze lijn" beantwoord wordt, en dat is precies
     de splitsing die deze hele ronde opheft.

     De openingsregel komt van de ZAAK met een eigen soort: de kern eist dat
     een afzender deelnemer is, en die poort zetten we niet open voor een
     uitzondering. Naar buiten heet hij nog steeds 'systeem'. */
  function zorgContact(s, customerKey, codename, tier) {
    if (!s || !customerKey || String(customerKey).startsWith('rtf:')) return null;
    const g = commGastVan && commGastVan();
    if (!g) return null;
    const bestond = !!g.bestaand(s.code, customerKey, 'Team');
    const gesprek = g.gesprek(s.code, customerKey, 'Team',
      { codename: codename || customerKey, tier: tier || 'rtg' });
    if (!bestond) {
      g.opening(s.code, customerKey, 'Team',
        'U heeft nu een open lijn met ' + s.name + '. Bekijk gerust elkaars Salon.',
        { codename: codename || customerKey, tier: tier || 'rtg' });
      try { save(); } catch (e) {}
      try { notify(tier || 'rtg', { icon: 'berichten', title: 'Open lijn met ' + s.name, body: 'App direct en bekijk elkaars Salon.', scope: 'gchat' }); } catch (e) {}
      try { sseToCustomer(customerKey, 'sync', { scope: 'gchat' }); } catch (e) {}
      try { sseToSupplier(s.code, 'sync', { scope: 'gchat' }); } catch (e) {}
    }
    return gesprek;
  }

  /* De Salon van een klant zoals de partner die ziet: privacy-first, dus alleen
     de codenaam, de pas en de eigen Salon-posts van het lid (nooit de echte
     naam). Zo kan de partner vooraf al kennismaken. */
  function klantSalon(key) {
    let codename = key, tier = 'rtg';
    const dir = (db.data.memberDir || {})[key];
    if (dir) { codename = dir.codename || key; tier = dir.tier || tier; }
    /* Val terug op een lopende lijn als de ledengids deze sleutel niet kent.
       Die stond in db.data.guestChats en staat sinds de verhuizing in de
       kern: de codenaam en de pas reizen mee in de meta van het gesprek.
       Was deze terugval op de oude voorraad blijven staan, dan had hij het
       precies voor de NIEUWE leden niet meer gedaan -- en dat is het soort
       storing dat pas opvalt als iemand zegt "bij mij staat er niets". */
    if (!dir) {
      const g = commGastVan && commGastVan();
      const lijnen = g ? g.voorLid(key) : {};
      for (const r of Object.values(lijnen)) {
        if (!r.codename) continue;
        codename = r.codename; tier = r.tier || tier; break;
      }
    }
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
  return { deptsFor, chatKeyOf, validDept, zorgContact, klantSalon };
};
