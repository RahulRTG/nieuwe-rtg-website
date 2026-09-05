'use strict';
const { idVanKey } = require('../../../lib/lidsleutel');

module.exports = ctx => {
  const { accounts, crypto, logActivity, notifySupplier, transactie, vindIn,
    publiek, geldig, herstelGeldig, supplierVanCode } = ctx;
  const CODE_FOUT = 'Deze kassacode is ongeldig of niet meer bruikbaar.';
  const zoekInvite = kassacode => transactie(bron => {
    const inv = vindIn(bron, kassacode);
    if (!inv || geldig(inv) || inv.claim) return null;
    const s = supplierVanCode(inv.supplierCode);
    return s ? { s, inv: publiek(inv) } : null;
  });
  const zoekInviteVoorLid = (kassacode, lid) => transactie(bron => {
    const inv = vindIn(bron, kassacode);
    if (!inv) return null;
    let hervat = false;
    if (inv.claim) {
      hervat = (inv.claim.status === 'bezig' || inv.claim.status === 'voltooid') &&
        Number(inv.claim.memberId) === Number(lid && lid.id);
      if (!hervat || herstelGeldig(inv)) return null;
    } else if (geldig(inv)) return null;
    const s = supplierVanCode(inv.supplierCode);
    return s ? { s, inv: publiek(inv), hervat,
      claimStatus: inv.claim && inv.claim.status || null,
      claimStaffId: inv.claim && inv.claim.staffId != null
        ? Number(inv.claim.staffId) : null } : null;
  });

  const beginClaim = (kassacode, lid, verwachtSupplier) => transactie(bron => {
    const inv = vindIn(bron, kassacode);
    if (!inv || (verwachtSupplier && inv.supplierCode !== verwachtSupplier))
      return { status: 403, error: CODE_FOUT };
    if (inv.claim) {
      if (Number(inv.claim.memberId) !== Number(lid.id) ||
          !['bezig', 'voltooid'].includes(inv.claim.status) || herstelGeldig(inv))
        return { status: 403, error: CODE_FOUT };
      return { ok: true, hervat: true, invite: publiek(inv),
        claimStatus: inv.claim.status,
        claimStaffId: inv.claim.staffId != null ? Number(inv.claim.staffId) : null };
    }
    if (geldig(inv))
      return { status: 403, error: CODE_FOUT };
    ctx.bearer.gebruik(inv.toegang);
    inv.claim = { id: 'claim-' + crypto.randomBytes(8).toString('hex'),
      memberId: Number(lid.id), status: 'bezig', at: new Date().toISOString(), staffId: null };
    return { ok: true, invite: publiek(inv), claimStatus: 'bezig', claimStaffId: null };
  });

  const koppelStaff = (invId, memberId, staffId) => transactie(bron => {
    const inv = Object.values(bron).flatMap(x => Array.isArray(x) ? x : [])
      .find(x => x.id === invId);
    if (!inv || !inv.claim || Number(inv.claim.memberId) !== Number(memberId) ||
        inv.claim.status !== 'bezig' || herstelGeldig(inv))
      return { status: 409, error: 'De personeelsuitnodiging kon niet veilig worden gekoppeld.' };
    if (inv.claim.staffId != null && Number(inv.claim.staffId) !== Number(staffId))
      return { status: 409, error: 'Deze uitnodiging is al aan een andere personeelsplek gekoppeld.' };
    inv.claim.staffId = Number(staffId);
    inv.claim.gekoppeld_at = inv.claim.gekoppeld_at || new Date().toISOString();
    return { ok: true };
  });

  const zetStaff = (invId, memberId, staffId) => transactie(bron => {
    const inv = Object.values(bron).flatMap(x => Array.isArray(x) ? x : [])
      .find(x => x.id === invId);
    if (!inv || !inv.claim || Number(inv.claim.memberId) !== Number(memberId) ||
        inv.claim.status !== 'bezig' || Number(inv.claim.staffId) !== Number(staffId))
      return { status: 409, error: 'De personeelsuitnodiging kon niet veilig worden voltooid.' };
    if (herstelGeldig(inv))
      return { status: 409, error: 'De personeelsuitnodiging is intussen ingetrokken.' };
    inv.claim.status = 'voltooid';
    inv.claim.voltooid_at = new Date().toISOString();
    return { ok: true };
  });

  const bevestigActief = (invId, memberId, staffId) => transactie(bron => {
    const inv = Object.values(bron).flatMap(x => Array.isArray(x) ? x : [])
      .find(x => x.id === invId);
    if (!inv || !inv.claim || inv.claim.status !== 'voltooid' ||
        Number(inv.claim.memberId) !== Number(memberId) ||
        Number(inv.claim.staffId) !== Number(staffId) || herstelGeldig(inv))
      return { status: 409, error: 'De personeelsuitnodiging is niet meer geldig.' };
    const eerste = !inv.claim.geactiveerd_at;
    inv.claim.geactiveerd_at = inv.claim.geactiveerd_at || new Date().toISOString();
    return { ok: true, eerste };
  });

  const pastBijInvite = (staff, s, lid, inv) => !!staff &&
    String(staff.supplier_code || '').toUpperCase() === String(s.code || '').toUpperCase() &&
    Number(staff.member_id) === Number(lid.id) &&
    String(staff.role || 'staff') === String(inv.role || 'staff');

  function sluitStaff(staff) {
    if (staff && accounts.deactivateStaff) accounts.deactivateStaff(staff.id);
  }

  function neveneffecten(lid, s, naam, inv) {
    try {
      const st = accounts.getMemberState(lid.id) || {};
      if (!st.via) {
        st.via = { soort: 'zaak', code: s.code, naam: s.name, at: new Date().toISOString() };
        accounts.saveMemberState(lid.id, st);
      }
    } catch (e) {}
    logActivity(s.code, { name: naam, role: inv.role },
      naam + ' meldde zich aan als teamlid (RTG-lid)');
    try {
      notifySupplier(s.code, { kind: 'team', text: naam + ' heeft zich aangemeld bij het team.' });
    } catch (e) {}
  }

  async function verbindCode(lid, kassacode, opties, verwachtSupplier) {
    if (!lid || !kassacode)
      return { status: 400, error: 'Een account en personeelsuitnodiging zijn vereist.' };
    const vooraf = await Promise.resolve(zoekInviteVoorLid(kassacode, lid));
    const supplierCode = verwachtSupplier || (vooraf && vooraf.s && vooraf.s.code);
    if (!supplierCode || !vooraf || vooraf.s.code !== supplierCode)
      return { status: 403, error: CODE_FOUT };
    const bestaandVoor = accounts.staffByMember(supplierCode, lid.id);
    if (bestaandVoor && !vooraf.hervat)
      return { status: 409, error: 'U bent al aangemeld bij dit bedrijf.', code: supplierCode };
    const claim = await Promise.resolve(beginClaim(kassacode, lid, supplierCode));
    if (!claim || claim.error) return claim;
    const inv = claim.invite;
    const s = supplierVanCode(inv.supplierCode);
    if (!s) return { status: 404, error: 'Dit bedrijf bestaat niet meer.' };

    if (claim.claimStatus === 'voltooid') {
      const exact = accounts.getStaffByIdAny && accounts.getStaffByIdAny(claim.claimStaffId);
      if (!pastBijInvite(exact, s, lid, inv))
        return { status: 409, error: 'De eerdere aanmelding kan niet veilig worden hersteld.' };
      let bevestigd;
      try {
        const actief = Number(exact.active) === 1 ? exact : accounts.activateStaff(exact.id);
        if (!actief) throw new Error('personeelsactivatie geweigerd');
        bevestigd = await Promise.resolve(bevestigActief(inv.id, lid.id, exact.id));
        if (!bevestigd || bevestigd.error) { sluitStaff(exact); return bevestigd; }
      } catch (e) { sluitStaff(exact); throw e; }
      if (bevestigd.eerste) neveneffecten(lid, s, exact.name, inv);
      return { status: 409, hersteld: true,
        error: accounts.legacyStaffPinToegestaan && accounts.legacyStaffPinToegestaan()
          ? 'De personeelsplek is veilig hersteld. Een pincode wordt nooit opnieuw getoond; laat een manager haar zo nodig resetten.'
          : 'De personeelsplek is veilig hersteld. Log in met uw persoonlijke RTG-account.',
        staff: exact, naam: exact.name, s, invite: inv };
    }

    const legacyPin = !!(accounts.legacyStaffPinToegestaan && accounts.legacyStaffPinToegestaan());
    const pin = legacyPin ? ((opties && opties.pin) || accounts.makePin()) : null;
    const naam = inv.naam || accounts.realNameOf(lid) || 'Medewerker';
    let staff = claim.claimStaffId != null && accounts.getStaffByIdAny
      ? accounts.getStaffByIdAny(claim.claimStaffId) : null;
    try {
      if (!staff && bestaandVoor && claim.hervat) {
        sluitStaff(bestaandVoor);
        staff = accounts.getStaffByIdAny && accounts.getStaffByIdAny(bestaandVoor.id);
      }
      if (!staff) staff = legacyPin
        ? await accounts.createStaff({ supplierCode: s.code, name: naam,
          role: inv.role, func: inv.func, pin, memberId: lid.id, memberTier: lid.tier,
          active: false })
        : accounts.createAccountStaff({ supplierCode: s.code, name: naam,
          role: inv.role, func: inv.func, memberId: lid.id, memberTier: lid.tier,
          active: false });
      if (!pastBijInvite(staff, s, lid, inv)) {
        sluitStaff(staff);
        return { status: 409, error: 'De personeelsplek past niet bij deze uitnodiging.' };
      }
      const gekoppeld = await Promise.resolve(koppelStaff(inv.id, lid.id, staff.id));
      if (!gekoppeld || gekoppeld.error) { sluitStaff(staff); return gekoppeld; }
      const voltooid = await Promise.resolve(zetStaff(inv.id, lid.id, staff.id));
      if (!voltooid || voltooid.error) { sluitStaff(staff); return voltooid; }
      const actief = accounts.activateStaff(staff.id);
      if (!actief) throw new Error('personeelsactivatie geweigerd');
      staff = actief;
      const bevestigd = await Promise.resolve(bevestigActief(inv.id, lid.id, staff.id));
      if (!bevestigd || bevestigd.error) { sluitStaff(staff); return bevestigd; }
    } catch (e) { sluitStaff(staff); throw e; }
    neveneffecten(lid, s, naam, inv);
    return { ok: true, staff, naam, ...(legacyPin ? { pin } : {}), s, invite: inv };
  }

  async function wisselCodeIn(lid, kassacode) {
    if (!lid || !kassacode) return null;
    try {
      const v = await verbindCode(lid, kassacode, {}, null);
      return v && v.ok
        ? { code: v.s.code, bedrijf: v.s.name, staffId: v.staff.id,
          role: v.invite.role, ...(v.pin ? { pin: v.pin } : {}) }
        : null;
    } catch (e) { return null; }
  }

  async function neemAan(supplier, uitgegeven, sollicitatieKey) {
    const id = idVanKey(sollicitatieKey);
    if (id == null) return null;
    const lid = accounts.getUserById(id);
    if (!lid) return null;
    const v = await verbindCode(lid, uitgegeven.kassacode, {}, supplier.code);
    return v && v.ok ? { staffId: v.staff.id, naam: v.naam } : null;
  }

  return { zoekInvite, verbindCode, wisselCodeIn, neemAan };
};
