/* Uitgifte, lijst, intrekking en rotatie van personeelsuitnodigingen. */
'use strict';

module.exports = ctx => {
  const { db, crypto, bearer, transactie, lijstVan, publiek, geldig, idemHash,
    doel, scope, dagen, dubbeltikMs } = ctx;
  const ALFABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const maakPrefix = () => {
    let c = '';
    for (let i = 0; i < 6; i++) c += ALFABET[crypto.randomInt(ALFABET.length)];
    return c;
  };
  const findSupplierByName = naam => {
    const n = String(naam || '').trim().toLowerCase();
    return n ? (db.data.suppliers || []).find(s => String(s.name || '').trim().toLowerCase() === n) || null : null;
  };
  /* Bearercode v2 met het oude gedrag: `dagen` geldig, een keer te claimen,
     en de code IS de uitnodiging (er ontstaat geen sessie uit). */
  const spec = (supplierCode, issuer) => ({ prefix: maakPrefix(), issuer, doel, scope,
    onderwerp: { soort: 'supplier', id: supplierCode },
    geldigheid: { duurMs: dagen * 86400000 }, gebruik: { max: 1 }, afgeleid: 'geen' });
  function nieuweCode(bron, maakEen) {
    const alle = Object.values(bron).flatMap(x => Array.isArray(x) ? x : []);
    for (let poging = 0; poging < 8; poging++) {
      const gemaakt = maakEen();
      const dubbel = alle.some(inv => bearer.zelfdeHash(inv && inv.toegang && inv.toegang.code_hash,
        gemaakt.toegang.code_hash) || (inv && inv.code_historie || []).some(oud =>
        bearer.zelfdeHash(oud && oud.code_hash, gemaakt.toegang.code_hash)));
      if (!dubbel) return gemaakt;
    }
    return null;
  }

  function maakInvite(supplier, actor, { naam, role, func, idem }) {
    const actorNaam = String(actor && actor.name || 'manager').slice(0, 100);
    const fingerprint = JSON.stringify({ naam: naam || null,
      role: role === 'manager' ? 'manager' : 'staff', func: func || null });
    const nu = Date.now();
    return transactie(bron => {
      const lijst = lijstVan(bron, supplier.code);
      const ih = idem ? idemHash(supplier.code + '|' + idem) : null;
      const bestaand = ih ? lijst.find(x => x.idem_hash === ih) : null;
      if (bestaand) {
        if (bestaand.idem_fingerprint !== fingerprint)
          return { status: 409, error: 'Deze herhaalsleutel hoort al bij een andere uitnodiging.' };
        return { status: 409,
          error: 'Deze code is al eenmalig uitgegeven en wordt niet opnieuw getoond. Roteer de uitnodiging als de ontvanger hem niet kreeg.',
          herhaald: true, invite: publiek(bestaand) };
      }
      const dubbelHash = idemHash('dubbel|' + supplier.code + '|' + fingerprint);
      const dubbel = !ih && lijst.find(x => x.dubbel_hash === dubbelHash &&
        nu - Date.parse(x.toegang && x.toegang.issued_at) >= 0 &&
        nu - Date.parse(x.toegang && x.toegang.issued_at) < dubbeltikMs);
      if (dubbel) return { status: 409,
        error: 'Deze uitnodiging is zojuist al eenmalig uitgegeven en wordt niet opnieuw getoond. Roteer haar als de ontvanger de code niet kreeg.',
        herhaald: true, invite: publiek(dubbel) };
      if (lijst.filter(x => !x.toegang.ingetrokken_at && !x.claim && !geldig(x)).length >= 500)
        return { status: 409, error: 'Trek eerst oude personeelsuitnodigingen in.' };
      const id = 'sinv-' + crypto.randomBytes(8).toString('hex');
      const gemaakt = nieuweCode(bron, () => bearer.maak(spec(supplier.code, actorNaam)));
      if (!gemaakt) return { status: 500, error: 'Kon geen unieke personeelsuitnodiging maken.' };
      const inv = { id, supplierCode: supplier.code, naam: naam || null,
        role: role === 'manager' ? 'manager' : 'staff', func: func || null,
        door: actorNaam, toegang: gemaakt.toegang, claim: null, code_historie: [],
        idem_hash: ih, idem_fingerprint: ih ? fingerprint : null, dubbel_hash: dubbelHash };
      lijst.push(inv);
      return Object.assign({ ok: true, kassacode: gemaakt.code }, publiek(inv));
    });
  }

  /* Ook een verlopen of door legacy-migratie gesloten rij blijft zichtbaar:
     alleen dan kan de manager hem bewust roteren. De kale code blijft weg. */
  const lijstInvites = supplierCode => transactie(bron => ({ ok: true,
    invites: lijstVan(bron, supplierCode).filter(inv => !inv.claim).slice(-200).map(inv =>
      Object.assign(publiek(inv), { status: geldig(inv) || 'actief' })) }));
  const trekInviteIn = (supplierCode, id, actor, reden) => transactie(bron => {
    const inv = lijstVan(bron, supplierCode).find(x => x.id === String(id || ''));
    if (!inv) return { status: 404, error: 'Deze uitnodiging bestaat niet (meer).' };
    bearer.intrekken(inv.toegang, actor, reden || 'ingetrokken door manager');
    return { ok: true, invite: publiek(inv),
      claimMemberId: inv.claim && inv.claim.memberId || null,
      claimStaffId: inv.claim && inv.claim.staffId || null };
  });
  const roteerInvite = (supplierCode, id, actor, idem) => transactie(bron => {
    const inv = lijstVan(bron, supplierCode).find(x => x.id === String(id || ''));
    if (!inv) return { status: 404, error: 'Deze uitnodiging bestaat niet (meer).' };
    if (inv.claim) return { status: 409, error: 'Een geclaimde uitnodiging kan niet worden geroteerd.' };
    const idemWaarde = String(idem || '').trim().slice(0, 200);
    const ih = idemWaarde ? idemHash('roteer|' + supplierCode + '|' + idemWaarde) : null;
    const dubbelHash = idemHash('roteer-dubbel|' + supplierCode + '|' + inv.id);
    const laatst = inv.laatste_rotatie;
    if (laatst && ((ih && laatst.idem_hash === ih) ||
        (!ih && laatst.dubbel_hash === dubbelHash &&
          Date.now() - Date.parse(laatst.at) >= 0 &&
          Date.now() - Date.parse(laatst.at) < dubbeltikMs)))
      return { status: 409, herhaald: true,
        error: 'De nieuwe personeelscode is al eenmalig getoond en wordt niet herhaald.',
        invite: publiek(inv) };
    /* VERNIEUWEN: de manager geeft een nieuwe code uit met weer `dagen` geldig
       en een verse claim, zoals altijd. Volgnummer, geschiedenis en de
       intrekking van de oude: kern/bearercode-keten.js. De uitgever blijft. */
    const oud = inv.toegang;
    const gemaakt = nieuweCode(bron, () => bearer.vernieuw(oud, spec(supplierCode, oud.issuer), actor || 'manager'));
    if (!gemaakt) return { status: 500, error: 'Kon geen unieke personeelsuitnodiging maken.' };
    inv.code_historie = Array.isArray(inv.code_historie) ? inv.code_historie : [];
    inv.code_historie.push({ code_hash: oud.code_hash, ingetrokken_at: oud.ingetrokken_at, rotatie: oud.rotatie });
    inv.toegang = gemaakt.toegang;
    inv.laatste_rotatie = { idem_hash: ih, dubbel_hash: ih ? null : dubbelHash,
      at: new Date().toISOString() };
    return Object.assign({ ok: true, kassacode: gemaakt.code }, publiek(inv));
  });

  return { maakKassacode: maakPrefix, findSupplierByName, maakInvite,
    lijstInvites, trekInviteIn, roteerInvite };
};
