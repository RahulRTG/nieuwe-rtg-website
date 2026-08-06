/* Foundation OS, deel "activiteiten-deur": inschrijven, afmelden en inchecken.

   DIT IS DE OCHTEND ZELF. De vorige module gaat over de voorbereiding; hier
   staat er een rij bij de deur en moet het in een seconde kloppen.

   VOL IS EEN WACHTLIJST, GEEN NEE. Wie zich meldt als het vol is, komt op de
   wachtlijst en krijgt dat te horen -- met zijn plaats erbij. Een systeem dat
   "vol" zegt en verder niets, laat de organisator met de hand een lijstje
   bijhouden, en dat lijstje is er niet meer als er iemand afzegt.

   AFMELDEN SCHUIFT DE WACHTLIJST OP, EN ZEGT WIE. De opgeschoven codenamen
   komen terug in het antwoord. Een vrijgekomen plek waarvan niemand hoort, is
   geen vrijgekomen plek.

   EEN KIND ZONDER TOESTEMMING VAN DE OUDERS KOMT ER NIET IN. Dat is hier een
   grendel bij het INCHECKEN en niet alleen bij het inschrijven, want de
   toestemming kan tussen die twee momenten alsnog ontbreken (een inschrijving
   door een broer, een formulier dat niet is teruggekomen). De zin zegt precies
   wat er nodig is, want aan de deur wordt niet nagedacht maar gehandeld.

   FOTOTOESTEMMING IS EEN APART VELD EN BLIJFT DAT. Hij wordt nergens uit de
   deelnametoestemming afgeleid en heeft geen invloed op binnenkomen -- wie geen
   foto wil, doet gewoon mee. Hij staat in het antwoord zodat de fotograaf het
   kan weten.

   DE INCHECKCODE IS EEN GEHEIM, GEEN VOLGNUMMER. Hij komt uit de CSPRNG
   (basis.js: code()), staat per inschrijving vast en is de QR aan de deur. */

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, code, S, audit, wie, poort, save } = ctx;
  const { vind, beeld, ingeschreven, wachtlijst, schuifOp } = eigen;

  function open(req, id) {
    const a = vind(id);
    if (!a) return { status: 404, error: 'Deze activiteit bestaat niet.' };
    const w = wie(req);
    const g = poort(w, a.stad, 'project.beheren', 'events');
    if (!g.ok) return g;
    return { ok: true, a, w };
  }

  /* Inschrijven op codenaam. Een naam vragen zou hier makkelijker zijn en is
     precies wat we niet doen: de deelnemer is bekend in de casusmodule of als
     vrijwilliger, en anders hoort hij hier als codenaam te staan. */
  function inschrijven(req, id, b) {
    b = b || {};
    const o = open(req, id);
    if (!o.ok) return o;
    const a = o.a;
    if (!['open', 'vol'].includes(a.status)) {
      return { status: 400, error: 'Deze activiteit staat op "' + a.status + '" en neemt geen inschrijvingen aan.' };
    }
    const codenaam = schoon(b.codenaam, 30);
    if (codenaam.length < 2) return { status: 400, error: 'Onder welke codenaam schrijft deze deelnemer in?' };
    if (!Array.isArray(a.inschrijvingen)) a.inschrijvingen = [];
    if (a.inschrijvingen.some(i => i.codenaam === codenaam && i.status !== 'afgemeld')) {
      return { status: 400, error: codenaam + ' staat al ingeschreven voor deze activiteit.' };
    }
    if (a.inschrijvingen.length >= 20000) return { status: 400, error: 'Deze activiteit zit vol met inschrijvingen.' };
    const minderjarig = b.minderjarig === true;
    const rij = { id: rid(), codenaam, minderjarig,
      // Twee toestemmingen, twee velden. De ene gaat over meedoen, de andere
      // over beeld; ze worden nooit uit elkaar afgeleid.
      oudertoestemming: minderjarig ? b.oudertoestemming === true : true,
      fototoestemming: b.fototoestemming === true,
      checkinCode: code('IN'), status: 'ingeschreven', door: o.w.key, at: nu() };
    const vol = ingeschreven(a).length >= a.capaciteit;
    if (vol) {
      rij.status = 'wachtlijst';
      a.status = 'vol';
    }
    a.inschrijvingen.push(rij);
    save();
    const plaats = rij.status === 'wachtlijst' ? wachtlijst(a).findIndex(i => i.id === rij.id) + 1 : null;
    return { ok: true, activiteit: beeld(a),
      inschrijving: { id: rij.id, codenaam, status: rij.status, checkinCode: rij.checkinCode,
        wachtlijstplaats: plaats },
      bericht: rij.status === 'wachtlijst'
        ? codenaam + ' staat op de wachtlijst, plaats ' + plaats + '. Bij een afmelding schuift hij vanzelf op.'
        : codenaam + ' is ingeschreven.' };
  }

  function afmelden(req, id, inschrijvingId) {
    const o = open(req, id);
    if (!o.ok) return o;
    const a = o.a;
    const i = (a.inschrijvingen || []).find(x => x.id === String(inschrijvingId || ''));
    if (!i) return { status: 404, error: 'Deze inschrijving bestaat niet.' };
    if (i.status === 'afgemeld') return { status: 400, error: i.codenaam + ' is al afgemeld.' };
    i.status = 'afgemeld';
    const opgeschoven = schuifOp(a);
    audit(o.w.key, 'activiteit.afmelding', a.naam, i.codenaam +
      (opgeschoven.length ? '; opgeschoven: ' + opgeschoven.join(', ') : ''));
    save();
    return { ok: true, activiteit: beeld(a), opgeschoven,
      bericht: opgeschoven.length
        ? 'Er is een plek vrij en ' + opgeschoven.join(' en ') + ' schuift op. Laat het weten.'
        : i.codenaam + ' is afgemeld.' };
  }

  /* Inchecken op de code. Vier antwoorden en vier verschillende zinnen: de code
     kennen we niet, deze persoon is afgemeld, deze staat op de wachtlijst, of
     er ontbreekt toestemming van de ouders. Aan de deur is "er ging iets mis"
     onbruikbaar. */
  function inchecken(req, id, checkinCode) {
    const o = open(req, id);
    if (!o.ok) return o;
    const a = o.a;
    const c = String(checkinCode || '').trim().toUpperCase();
    const i = (a.inschrijvingen || []).find(x => x.checkinCode === c);
    if (!i) return { status: 404, error: 'Deze incheckcode hoort niet bij deze activiteit.' };
    if (i.status === 'afgemeld') return { status: 400, error: i.codenaam + ' heeft zich afgemeld voor deze activiteit.' };
    if (i.status === 'wachtlijst') {
      return { status: 403, error: i.codenaam + ' staat op de wachtlijst en heeft nog geen plek. Meld iemand af of verhoog de capaciteit.' };
    }
    if (i.minderjarig && !i.oudertoestemming) {
      return { status: 403, error: 'Voor ' + i.codenaam + ' staat geen toestemming van de ouders vastgelegd. Zonder die toestemming doet een minderjarige niet mee.' };
    }
    if (i.status === 'aanwezig') return { ok: true, alBinnen: true, activiteit: beeld(a), bericht: i.codenaam + ' was al ingecheckt.' };
    i.status = 'aanwezig';
    i.binnenAt = nu();
    if (a.status === 'open' || a.status === 'vol') a.status = 'bezig';
    save();
    return { ok: true, activiteit: beeld(a),
      fototoestemming: !!i.fototoestemming,
      bericht: i.codenaam + ' is binnen.' +
        (i.fototoestemming ? '' : ' Let op: geen toestemming voor foto\'s.') };
  }

  return { inschrijven, afmelden, inchecken };
};
