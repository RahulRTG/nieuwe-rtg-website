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

  /* Is dit een ECHTE persoon? De boardroom-poort levert een accountsleutel
     ('user-<id>'); de gedeelde backoffice-code levert dat per definitie niet --
     daar zit geen persoon achter, alleen een code die meerdere mensen kennen.
     Zonder deze controle is de vergelijking in bevestig() een vergelijking van
     twee tekstvelden, en dat is geen vier-ogen-principe. */
  const identiteit = wie => typeof wie === 'string' && /^user-\d+$/.test(wie);

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
    // hier: een opschaling -> vier-ogen. De AANVRAGER moet ook een echte
    // identiteit zijn, anders is de vergelijking bij bevestig() zinloos.
    if (!identiteit(wie)) return { status: 403, error: 'Opschalen kan alleen met een eigen RTG-account, niet met de gedeelde backoffice-code.' };
    b.autorisatie = { id: kenmerk(), actie: doelActie, modus: doelModus || null, door: wie, at: Date.now() };
    save();
    return { ok: true, needsAuth: true, autorisatie: pub(b.autorisatie) };
  }

  function bevestig({ id, door }) {
    const b = d(), a = b.autorisatie, wie = door || 'boardroom';
    if (!a || a.id !== id) return { status: 404, error: 'Er staat geen autorisatie met dit kenmerk open.' };
    if (Date.now() - a.at > AUTORISATIE_MS) { b.autorisatie = null; save(); return { status: 410, error: 'De autorisatie is verlopen; vraag hem opnieuw aan.' }; }
    /* GEEN ANONIEME BEVESTIGING. De vergelijking hieronder is het hele
       vier-ogen-principe, en hij is alleen iets waard als beide kanten een ECHTE
       identiteit zijn. Zolang `wie` uit een tekstveld kon komen (of terugviel op
       de vaste string 'boardroom') was dit theater: aanvragen als de een,
       bevestigen als de ander, met een sessie. De routes staan nu achter de
       boardroom-poort en leveren req.boardroomKey; wat daar niet uitkomt, is
       geen tweede persoon. */
    if (!identiteit(wie)) return { status: 403, error: 'De tweede persoon moet met een eigen RTG-account zijn ingelogd.' };
    if (a.door === wie) return { status: 403, error: 'De tweede persoon moet iemand anders zijn dan de aanvrager.' };
    let res;
    if (a.actie === 'operationeel-aan') res = _operationeelZet(true, wie);
    else if (a.actie === 'modus') { _operationeelZet(true, wie); res = _modusZet(a.modus, wie); }
    else res = { ok: true };
    b.autorisatie = null; save();
    /* EEN MISLUKTE UITVOERING IS GEEN GESLAAGDE BEVESTIGING. Hier stond
       `return { ok: true, ..., fout: res.error }`: de tweede persoon kreeg 200
       en de reden waarom er niets was gebeurd stond als los veldje ernaast, waar
       geen enkele aanroeper naar keek. De stand bleef staan, het scherm zei
       "bevestigd", en de autorisatie was op. Dat viel pas op toen de
       vergunningsgrendel in _modusZet een weigering ging teruggeven -- daarvoor
       kon _modusZet alleen falen op "nog niet operationeel", en dat zet
       _operationeelZet er een regel eerder net zelf aan.

       De autorisatie wordt WEL opgebruikt: een toestemming geldt voor die ene
       poging, en na een weigering hoort er een nieuwe aanvraag te komen in
       plaats van een tweede kans op dezelfde handtekening. */
    if (res && res.error) return { status: res.status || 409, error: res.error, uitgevoerd: null, aangevraagdDoor: a.door, bevestigdDoor: wie };
    return { ok: true, uitgevoerd: a.actie, modus: d().modus, operationeel: d().operationeel, aangevraagdDoor: a.door, bevestigdDoor: wie };
  }
  function status() { return { ok: true, autorisatie: pub(d().autorisatie) }; }
  function annuleer({ wie } = {}) { d().autorisatie = null; save(); return { ok: true, wie: wie || 'boardroom' }; }

  return { aanvraag, bevestig, status, annuleer, pub };
};
