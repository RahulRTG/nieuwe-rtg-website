/* Uitgifte van een Meet-kamer en haar eenmalige deelcode. Afgesplitst zodat de
   kamermutaties en credentialuitgifte ieder onder de 10 kB-grens blijven. */
'use strict';

module.exports = ({ db, crypto, schoon, codenaamVan, transactie, toegang, toon,
  magErin, afdruk, nu, maxKamers, dubbeltikMs }) => {
  function agendaToegang(key, agendaId, titel, codenamen) {
    if (!agendaId) {
      const wieMag = (Array.isArray(codenamen) ? codenamen : [])
        .map(c => String(c || '').trim()).filter(Boolean).slice(0, 50);
      if (wieMag.length) {
        const mijn = codenaamVan(key);
        if (mijn && !wieMag.includes(mijn)) wieMag.push(mijn);
      }
      return { titel, wieMag: [...new Set(wieMag)] };
    }
    let gevonden = null, eigenaarKey = null;
    for (const ok of Object.keys(db.data.agendas || {})) {
      const item = (db.data.agendas[ok] || []).find(x => x.id === agendaId && !x.vanKey);
      if (item) { gevonden = item; eigenaarKey = ok.replace(/^lid:/, ''); break; }
    }
    if (!gevonden) return { status: 404, error: 'Die afspraak staat niet (meer) in de agenda.' };
    const namen = [codenaamVan(eigenaarKey)];
    for (const d of gevonden.deelnemers || [])
      namen.push(codenaamVan(String(d.key).replace(/^lid:/, '')));
    const wieMag = [...new Set(namen.filter(Boolean))];
    const mijn = codenaamVan(key);
    if (!mijn || !wieMag.includes(mijn)) return { status: 403, error: 'U staat niet op deze afspraak.' };
    return { titel: titel || gevonden.titel, wieMag };
  }

  function meetMaak(key, data, idem) {
    const d = data || {};
    const agendaId = String(d.agendaId || '') || null;
    const toelating = agendaToegang(key, agendaId, d.titel, d.codenamen);
    if (toelating.error) return toelating;
    const titel = schoon(String(toelating.titel || 'Vergadering'), 80);
    const idemWaarde = String(idem || d.idem || '').trim().slice(0, 200);
    return transactie(kamers => {
      if (agendaId) {
        const bestaand = kamers.find(k => !k.gesloten_at && k.agendaId === agendaId);
        if (bestaand) return magErin(bestaand, key)
          ? { id: bestaand.id, bestond: true, kamer: toon(bestaand, key) }
          : { status: 403, error: 'Deze vergaderruimte hoort bij een afspraak waar u niet op staat.' };
      }
      if (kamers.filter(k => !k.gesloten_at && k.host === key).length >= maxKamers)
        return { status: 409, error: 'U heeft al ' + maxKamers + ' kamers; ruim er eerst een op.' };
      const vinger = afdruk(JSON.stringify({ key, agendaId, titel, wieMag: toelating.wieMag }));
      const idemHash = idemWaarde ? afdruk('meet-maak-idem|' + key + '|' + idemWaarde) : null;
      const tikHash = afdruk('meet-maak-dubbeltik|' + key + '|' + vinger);
      const al = kamers.find(k => k.uitgifte && ((idemHash && k.uitgifte.idem_hash === idemHash) ||
        (!idemHash && k.uitgifte.dubbeltik_hash === tikHash &&
          Date.now() - Date.parse(k.uitgifte.at) >= 0 &&
          Date.now() - Date.parse(k.uitgifte.at) < dubbeltikMs)));
      if (al) {
        if (al.uitgifte.fingerprint_hash !== vinger)
          return { status: 409, error: 'Deze herhaalsleutel hoort al bij een andere Meet-kamer.' };
        return { status: 409,
          error: 'De Meet-code is al eenmalig uitgegeven en wordt niet opnieuw getoond. Maak vanuit de kamerlijst een nieuwe code.',
          herhaald: true, kamer: toon(al, key) };
      }
      const k = { id: 'mk' + crypto.randomBytes(8).toString('hex'), titel, host: key,
        wieMag: toelating.wieMag, agendaId, aanwezig: [], op: nu(), laatst: nu(),
        gesloten_at: null, toegang_historie: [], uitgifte: {
          idem_hash: idemHash, dubbeltik_hash: idemHash ? null : tikHash,
          fingerprint_hash: vinger, at: nu()
        } };
      const gemaakt = toegang.nieuw(kamers, k, codenaamVan(key) || key);
      if (!gemaakt) return { status: 500, error: 'Kon geen unieke Meet-code maken.' };
      k.toegang = gemaakt.toegang; kamers.push(k);
      return { id: k.id, code: gemaakt.code, eenmalig: true, kamer: toon(k, key) };
    });
  }

  return { meetMaak };
};
