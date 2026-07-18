/* Modebezorg (deelmodule): de koerierkant: de slimme route, een bezorging
   nemen, live gps, overhandigen met pincode en retour. winkelBeeld en
   instel komen via de context binnen nadat kern/modebezorg.js de
   winkellaag heeft gemount. */
module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, accounts, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, haversine, etaMinutes, leesUploadDataUrl,
    KETEN, KLAAR, id, nu, pin, schoon, getal, lijst } = ctx;
  const { instel, winkelBeeld, klantBeeld } = ctx;
  function route(code, koerierPos) {
    const open = lijst().filter(b => b.supplierCode === code && !KLAAR[b.status]);
    const pos = (koerierPos && Number.isFinite(koerierPos.lat)) ? koerierPos : null;
    const metAfstand = open.map(b => ({ b, d: (pos && b.loc) ? haversine(pos, b.loc) : null }));
    metAfstand.sort((x, y) => (x.d == null ? 1e12 : x.d) - (y.d == null ? 1e12 : y.d));
    return metAfstand.map(x => Object.assign(winkelBeeld(x.b), { afstandM: x.d, etaMin: x.d != null ? etaMinutes(x.d, 'driving') : null }));
  }
  function bezorging(code, ref) { return lijst().find(b => b.ref === ref && b.supplierCode === code); }
  function neem(code, ref, actor) {
    const b = bezorging(code, ref);
    if (!b) return { status: 404, error: 'Bezorging niet gevonden.' };
    if (KLAAR[b.status]) return { status: 409, error: 'Deze bezorging is al afgerond.' };
    b.koerier = { naam: (actor && actor.name) || 'Koerier', staffId: actor && actor.staffId };
    if (b.status === 'aangevraagd') { b.status = 'klaargezet'; b.stappen.push({ status: 'klaargezet', at: nu() }); }
    if (b.status === 'klaargezet') { b.status = 'onderweg'; b.stappen.push({ status: 'onderweg', at: nu() }); }
    save();
    notify(b.key, { icon: '\u{1F6F5}', title: b.supplierName, body: 'Uw bezorging is onderweg met ' + b.koerier.naam + '. Volg live en houd uw bezorgcode klaar.', scope: 'orders' });
    sseToCustomer(b.key, 'sync', { scope: 'modebezorg' });
    sseToSupplier(code, 'sync', { scope: 'modebezorg' });
    return { status: 200, ok: true, status2: b.status };
  }
  function gps(code, ref, lat, lng) {
    const b = bezorging(code, ref);
    if (!b) return { status: 404, error: 'Bezorging niet gevonden.' };
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { status: 400, error: 'Geen positie.' };
    b.gps = { lat, lng, at: nu() };   // vluchtig genoeg; we bewaren de laatste
    const eta = b.loc ? etaMinutes(haversine({ lat, lng }, b.loc), 'driving') : null;
    sseToCustomer(b.key, 'modebezorg', { ref: b.ref, kind: 'gps', lat, lng, etaMin: eta });
    return { status: 200, ok: true, etaMin: eta };
  }
  // Overdracht: bezorgcode moet kloppen; foto als bewijs; bij dure stukken ID ok.
  function overhandig(code, ref, opts, actor) {
    const b = bezorging(code, ref);
    if (!b) return { status: 404, error: 'Bezorging niet gevonden.' };
    if (KLAAR[b.status]) return { status: 409, error: 'Deze bezorging is al afgerond.' };
    if (String((opts && opts.bezorgcode) || '') !== b.bezorgcode) return { status: 403, error: 'De bezorgcode klopt niet. Vraag de klant om de code uit de app.' };
    if (b.idVereist && !(opts && opts.idOk === true)) return { status: 403, error: 'Dit is een dure levering: bevestig eerst de identiteit aan de deur.' };
    const foto = opts && opts.foto;
    if (foto && typeof foto === 'string' && /^data:image\//.test(foto) && foto.length < 900 * 1024) b.foto = foto;
    b.idOk = !!(opts && opts.idOk);
    b.status = 'afgeleverd';
    b.afgeleverdAt = nu();
    b.stappen.push({ status: 'afgeleverd', at: b.afgeleverdAt, door: (actor && actor.name) || null });
    save();
    notify(b.key, { icon: '✅', title: b.supplierName, body: 'Veilig afgeleverd. Bedankt voor uw aankoop.', scope: 'orders' });
    sseToSupplier(code, 'sync', { scope: 'modebezorg' });
    sseToOffice('sync', { scope: 'modebezorg' });
    return { status: 200, ok: true, status2: b.status };
  }
  // Retour aan de deur (past niet / klant weigert): de koerier neemt het mee terug.
  function retour(code, ref, reden, actor) {
    const b = bezorging(code, ref);
    if (!b) return { status: 404, error: 'Bezorging niet gevonden.' };
    if (KLAAR[b.status]) return { status: 409, error: 'Deze bezorging is al afgerond.' };
    const s = findSupplier(code);
    if (s && !instel(s).retourAanDeur) return { status: 409, error: 'Retour aan de deur staat uit voor deze winkel.' };
    b.status = 'retour'; b.retourReden = schoon(reden, 160) || 'Retour aan de deur';
    b.stappen.push({ status: 'retour', at: nu(), door: (actor && actor.name) || null });
    save();
    notify(b.key, { icon: '↩️', title: b.supplierName, body: 'Uw bezorging is retour genomen. Het bedrag wordt teruggestort.', scope: 'orders' });
    sseToSupplier(code, 'sync', { scope: 'modebezorg' });
    return { status: 200, ok: true };
  }

  /* ---- beelden ---- */
  return { route, bezorging, neem, gps, overhandig, retour };
};
