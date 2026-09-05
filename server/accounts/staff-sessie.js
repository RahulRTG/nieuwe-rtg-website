/* De productiesessie van een leverancier is een AFGESPLITSTE sessie van een
   persoonlijk RTG-account, geen nieuw identiteitsbewijs. Daarom wordt bij elk
   verzoek opnieuw bewezen dat drie levende waarheden nog bij elkaar horen:

     sessie -> actieve personeelsplek -> actief RTG-account.

   Dit ene oordeel wordt door zowel de gewone leverancierspoort als de SSE-
   ingang gebruikt. Uit dienst, account uit of wachtwoord/herstel gewijzigd
   sluit dus ook een al geopende werkplek meteen. De oude, ongebonden demo-
   sessie mag alleen in de expliciete Magnaat Test-omgeving bestaan. */
'use strict';

function accountBinding(accounts, lidOfId, uitgegevenOp = Date.now()) {
  const id = Number(lidOfId && typeof lidOfId === 'object' ? lidOfId.id : lidOfId);
  const lid = Number.isSafeInteger(id) && id > 0 ? accounts.getUserById(id) : null;
  if (!lid || (accounts.isActief && !accounts.isActief(lid))) return null;
  return { lid: id, lidKey: 'user-' + id, lidInlogOp: Number(uitgegevenOp) };
}

function controleer(accounts, sess) {
  if (!sess || sess.role !== 'supplier')
    return { ok: false, status: 401, error: 'Niet ingelogd als leverancier.' };

  const legacy = !!(accounts.legacyStaffPinToegestaan && accounts.legacyStaffPinToegestaan());
  let staff = null;
  if (sess.staffId != null) {
    staff = accounts.getStaffById(Number(sess.staffId));
    if (!staff || String(staff.supplier_code || '').toUpperCase() !== String(sess.code || '').toUpperCase())
      return { ok: false, status: 401, error: 'Deze personeelsplek is niet meer actief.' };
  }

  /* Buiten Magnaat Test bestaat er geen leverancierssessie zonder menselijk
     account. Ook een oud token van vóór de migratie valt hiermee dicht. */
  if (!legacy && (!staff || staff.member_id == null || sess.lid == null))
    return { ok: false, status: 401, error: 'Log opnieuw in met uw persoonlijke RTG-account.' };

  if (sess.lid != null) {
    const id = Number(sess.lid);
    if (!Number.isSafeInteger(id) || id < 1 ||
        (staff && Number(staff.member_id) !== id) ||
        (sess.lidKey && sess.lidKey !== 'user-' + id))
      return { ok: false, status: 401, error: 'De personeelsplek hoort niet bij dit RTG-account.' };
    const lid = accounts.getUserById(id);
    if (!lid || (accounts.isActief && !accounts.isActief(lid)))
      return { ok: false, status: 401, error: 'Dit RTG-account is niet meer actief.' };
    const start = Number(sess.lidInlogOp);
    if ((!Number.isFinite(start) || start <= 0) && !legacy)
      return { ok: false, status: 401, error: 'Log opnieuw in met uw persoonlijke RTG-account.' };
    if (Number.isFinite(start) && start > 0 && Number(lid.sessies_vanaf || 0) > start)
      return { ok: false, status: 401, error: 'Uw RTG-sessies zijn ingetrokken. Log opnieuw in.' };
  }

  return { ok: true, staff };
}

function registreer(sessieregister, sess, lidKey, bron) {
  if (!sessieregister || !sess || !sess.sid || !lidKey) return false;
  sessieregister.open(sess.sid, lidKey, { context: {
    contextId: String(sess.code || ''), contextSoort: 'zaak', contextVersie: 1,
    herkomst: { bron: bron || 'persoonlijk-rtg-account', methode: 'gemeten',
      vastgesteldOp: new Date().toISOString(), regelversie: 'staff-account-v1' }
  } });
  return true;
}

module.exports = { accountBinding, controleer, registreer };
