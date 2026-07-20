/* Bankregie, deel "autorisatie": vier-ogen op het opschalen van de knop. De
   betaalinfrastructuur van het hele huis omzetten is te groot voor één klik: de
   bank operationeel zetten of naar hybride/eigen draaien vraagt een tweede persoon.
   A vraagt aan (er komt een openstaande autorisatie klaar te staan), B -- iemand
   anders -- bevestigt binnen het tijdvenster; pas dan voert de rauwe uitvoerder de
   schakeling uit. Afschalen (terug naar partner, operationeel uit) loopt niet hier
   langs maar direct: een terugval mag je nooit blokkeren. Krijgt de gedeelde ctx
   van kern/bankregie/index.js. */
module.exports = (ctx) => {
  const { d, save, MODI, RANG, AUTORISATIE_MS, _modusZet, _operationeelZet, kenmerk } = ctx;

  const pub = a => a && { id: a.id, actie: a.actie, modus: a.modus || null, door: a.door, at: a.at, verlooptOverMs: Math.max(0, AUTORISATIE_MS - (Date.now() - a.at)) };

  /* Vraag een schakeling aan. Afschaling of geen-wijziging voert direct uit; een
     opschaling zet een openstaande autorisatie klaar die een tweede persoon
     moet bevestigen. */
  function aanvraag({ actie, modus: gewenst, door }) {
    const b = d(), wie = door || 'boardroom';
    if (actie === 'operationeel-uit') return { ok: true, direct: true, ..._operationeelZet(false, wie) };
    let doelActie = actie, doelModus = gewenst;
    if (actie === 'operationeel-aan') {
      if (b.operationeel) return { ok: true, direct: true, ongewijzigd: true, operationeel: true };
    } else if (actie === 'modus') {
      if (!MODI.includes(gewenst)) return { status: 400, error: 'Kies partner, hybride of eigen.' };
      if (RANG[gewenst] <= RANG[b.modus]) return { ok: true, direct: true, ..._modusZet(gewenst, wie) }; // afschaling of gelijk
    } else if (actie === 'draai') {
      const next = MODI[Math.min(RANG[b.modus] + 1, MODI.length - 1)];
      if (next === b.modus) return { ok: true, direct: true, ongewijzigd: true, modus: b.modus };
      doelActie = 'modus'; doelModus = next;
    } else return { status: 400, error: 'Onbekende actie.' };
    // hier: een opschaling -> vier-ogen
    b.autorisatie = { id: kenmerk(), actie: doelActie, modus: doelModus || null, door: wie, at: Date.now() };
    save();
    return { ok: true, needsAuth: true, autorisatie: pub(b.autorisatie) };
  }

  function bevestig({ id, door }) {
    const b = d(), a = b.autorisatie, wie = door || 'boardroom';
    if (!a || a.id !== id) return { status: 404, error: 'Er staat geen autorisatie met dit kenmerk open.' };
    if (Date.now() - a.at > AUTORISATIE_MS) { b.autorisatie = null; save(); return { status: 410, error: 'De autorisatie is verlopen; vraag hem opnieuw aan.' }; }
    if (a.door === wie) return { status: 403, error: 'De tweede persoon moet iemand anders zijn dan de aanvrager.' };
    let res;
    if (a.actie === 'operationeel-aan') res = _operationeelZet(true, wie);
    else if (a.actie === 'modus') { _operationeelZet(true, wie); res = _modusZet(a.modus, wie); }
    else res = { ok: true };
    b.autorisatie = null; save();
    return { ok: true, uitgevoerd: a.actie, modus: d().modus, operationeel: d().operationeel, aangevraagdDoor: a.door, bevestigdDoor: wie, ...(res && res.error ? { fout: res.error } : {}) };
  }
  function status() { return { ok: true, autorisatie: pub(d().autorisatie) }; }
  function annuleer({ wie } = {}) { d().autorisatie = null; save(); return { ok: true, wie: wie || 'boardroom' }; }

  return { aanvraag, bevestig, status, annuleer, pub };
};
