/* Paspoort (deelmodule): de inzageketen: mijn status, een partner vraagt
   inzage, het lid beslist of trekt in, en de partner bekijkt tijdelijk.
   publiekVerzoek komt via de context binnen nadat kern/paspoort.js de
   toezichtlaag heeft gemount. */
module.exports = (ctx) => {
  const { db, save, crypto, accounts, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice,
    leesUploadDataUrl, leeftijdVan, gidsHaal, NIVEAUS, VIEW_TTL_MS, KIND_GRENS,
    lijsten, accountVanKey, memberState, leeftijdVanAccount, log, bevestigingVan, inhoudVoor, codenaamUitGids, id, schoon, nu } = ctx;
  const { publiekVerzoek, publiekIncident } = ctx;
  function mijnStatus(key) {
    const u = accountVanKey(key);
    if (!u) return { account: false };
    const md = memberState(u);
    return {
      account: true,
      geverifieerd: u.verified,                 // unverified | pending | verified | rejected
      selfieAanwezig: !!md.selfie,
      gezichtGecontroleerd: !!md.faceMatch,
      nationaliteit: md.nationaliteit || null,
      leeftijd: leeftijdVanAccount(u)
    };
  }

  /* ---- de partner vraagt een identiteit op ---- */
  function vraag(supplier, key, niveau, actor, opts) {
    lijsten();
    const nv = NIVEAUS.includes(niveau) ? niveau : 'bevestiging';
    const u = accountVanKey(key);
    if (!u) return { status: 404, error: 'Dit lid heeft geen RTG-geverifieerd paspoort.' };
    const minLeeftijd = opts && opts.minLeeftijd != null ? Math.max(0, Math.min(99, parseInt(opts.minLeeftijd, 10) || 0)) : null;
    const codenaam = codenaamUitGids(key) || (typeof opts === 'object' && opts.codenaam) || null;
    // bescherming minderjarigen: identiteit van een kind (t/m 15) delen we nooit
    const lft = leeftijdVanAccount(u);
    if (nv !== 'bevestiging' && lft != null && lft <= KIND_GRENS) {
      return { status: 403, error: 'Bescherming minderjarigen: de identiteit van dit lid wordt niet gedeeld.' };
    }
    const bevestiging = bevestigingVan(u, minLeeftijd);
    // niveau 'bevestiging': meteen terug, wel een melding aan het lid (transparant)
    if (nv === 'bevestiging') {
      log({ soort: 'bevestiging', supplierCode: supplier.code, key, codenaam, door: (actor && actor.name) || 'Team' });
      notify(key, { icon: '🪪', title: supplier.name, body: 'controleerde uw verificatiestatus (ja/nee, geen gegevens gedeeld).', scope: 'privacy' });
      sseToCustomer(key, 'sync', { scope: 'paspoort' });
      return { ok: true, niveau: 'bevestiging', bevestiging };
    }
    // idkaart/paspoort kan alleen als het lid geverifieerd is
    if (u.verified !== 'verified') {
      return { status: 409, error: 'Dit lid is (nog) niet RTG-geverifieerd; alleen de ja/nee-bevestiging is beschikbaar.' };
    }
    const verzoek = {
      id: id(), supplierCode: supplier.code, supplierName: supplier.name,
      key, codenaam, niveau: nv, status: 'aangevraagd',
      reden: schoon(opts && opts.reden, 200), door: (actor && actor.name) || 'Team',
      incident: false, at: nu(), beslistAt: null, vervalt: null
    };
    db.data.paspoortVerzoeken.unshift(verzoek);
    db.data.paspoortVerzoeken = db.data.paspoortVerzoeken.slice(0, 50000);
    log({ soort: 'aanvraag', verzoekId: verzoek.id, niveau: nv, supplierCode: supplier.code, key, codenaam, door: verzoek.door });
    save();
    notify(key, {
      icon: '🪪', title: supplier.name + ' vraagt uw ' + (nv === 'paspoort' ? 'paspoort' : 'ID-kaart'),
      body: (verzoek.reden ? verzoek.reden + ' · ' : '') + 'U kunt dit goedkeuren of weigeren in de app.', scope: 'privacy'
    });
    sseToCustomer(key, 'sync', { scope: 'paspoort' });
    sseToSupplier(supplier.code, 'sync', { scope: 'paspoort' });
    return { ok: true, niveau: nv, bevestiging, verzoek: publiekVerzoek(verzoek) };
  }

  /* ---- het lid keurt goed of weigert ---- */
  function beslis(key, verzoekId, akkoord) {
    lijsten();
    const v = db.data.paspoortVerzoeken.find(x => x.id === verzoekId && x.key === key);
    if (!v) return { status: 404, error: 'Verzoek niet gevonden.' };
    if (v.status !== 'aangevraagd') return { status: 409, error: 'Dit verzoek is al afgehandeld.' };
    v.beslistAt = nu();
    if (akkoord) {
      v.status = 'goedgekeurd';
      v.vervalt = new Date(Date.now() + VIEW_TTL_MS).toISOString();
      notifySupplier(v.supplierCode, { icon: '✅', title: 'Identiteit gedeeld', body: (v.codenaam || 'Een lid') + ' keurde uw ' + (v.niveau === 'paspoort' ? 'paspoort' : 'ID-kaart') + '-verzoek goed.' });
    } else {
      v.status = 'geweigerd';
      notifySupplier(v.supplierCode, { icon: '⛔', title: 'Verzoek geweigerd', body: (v.codenaam || 'Een lid') + ' weigerde uw identiteitsverzoek.' });
    }
    log({ soort: akkoord ? 'goedgekeurd' : 'geweigerd', verzoekId: v.id, niveau: v.niveau, supplierCode: v.supplierCode, key });
    save();
    sseToSupplier(v.supplierCode, 'sync', { scope: 'paspoort' });
    sseToCustomer(key, 'sync', { scope: 'paspoort' });
    return { ok: true, status: v.status };
  }

  // het lid trekt een eerder gegeven goedkeuring weer in
  function trekIn(key, verzoekId) {
    lijsten();
    const v = db.data.paspoortVerzoeken.find(x => x.id === verzoekId && x.key === key);
    if (!v) return { status: 404, error: 'Verzoek niet gevonden.' };
    if (v.status !== 'goedgekeurd') return { status: 409, error: 'Alleen een lopende goedkeuring kan worden ingetrokken.' };
    v.status = 'ingetrokken'; v.vervalt = null;
    log({ soort: 'ingetrokken', verzoekId: v.id, supplierCode: v.supplierCode, key });
    save();
    sseToSupplier(v.supplierCode, 'sync', { scope: 'paspoort' });
    return { ok: true };
  }

  /* ---- de partner bekijkt een goedgekeurde (of vrijgegeven) inzage ---- */
  function bekijk(supplier, verzoekId, actor) {
    lijsten();
    const v = db.data.paspoortVerzoeken.find(x => x.id === verzoekId && x.supplierCode === supplier.code);
    if (!v) return { status: 404, error: 'Verzoek niet gevonden.' };
    if (v.status !== 'goedgekeurd') return { status: 403, error: 'Dit verzoek is niet (meer) goedgekeurd.' };
    if (v.vervalt && new Date(v.vervalt).getTime() < Date.now()) {
      v.status = 'verlopen'; save();
      return { status: 410, error: 'De inzage is verlopen. Vraag het lid opnieuw.' };
    }
    const u = accountVanKey(v.key);
    if (!u) return { status: 404, error: 'Account niet gevonden.' };
    log({ soort: 'inzage', verzoekId: v.id, niveau: v.niveau, supplierCode: supplier.code, key: v.key, door: (actor && actor.name) || 'Team' });
    save();
    return { ok: true, verzoek: publiekVerzoek(v), inhoud: inhoudVoor(u, v.niveau) };
  }

  /* ---- incident: de partner eist het op; RTG-kantoor beoordeelt ---- */
  return { mijnStatus, vraag, beslis, trekIn, bekijk };
};
