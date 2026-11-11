/* Alleen inning van de expliciet geaccepteerde offerte. De bestaande Pay-
   waardepoort, grootboektransactie en economische sleutel blijven leidend.
   Geen automatische top-up, PSP-fictie, uitbetaling of teruggave hier. */
'use strict';
const { maakSleutel } = require('../db/economische-identiteit');
const { fout, lidbeeld, IDEM, geldigeOfferte } = require('./reisbureau-ketencontract');
const betaaltoestemming = require('./reisbureau-betaaltoestemming');
module.exports = ({ O, payVan, toegang, nu }) => {
  const zelfdeClaim = (a, b) => a && b && ['van', 'naar', 'centen', 'sleutel'].every(k => a[k] === b[k]);
  function nieuweInning(a, codenaam, pay, nieuweInningMag) {
    const k = a.keten, oud = k.betaling;
    if (!geldigeOfferte(k.offerte) || !k.akkoord || k.akkoord.offerteHash !== k.offerte.hash || a.status !== 'bevestigd')
      return fout(409, 'Betaling wacht op uw akkoord en acceptatie door iedere aanbieder.');
    const verkoper = toegang.ontvanger(k.verkoper.supplierCode);
    if (verkoper.error || verkoper.org !== k.verkoper.org) return fout(409, 'De verkoper is niet meer bevoegd voor deze inning. Herstel vraagt menselijke beoordeling.');
    for (const onderdeel of k.offerte.onderdelen) {
      const provider = toegang.leverancier(onderdeel.supplierCode);
      if (provider.error || provider.org !== onderdeel.org) return fout(409, 'Een aanbieder is gewijzigd of gesloten. Betaal niet voordat de reis opnieuw is beoordeeld.');
    }
    const toegangTotGeld = betaaltoestemming(nieuweInningMag, pay);
    if (toegangTotGeld.error) return toegangTotGeld;
    const p = { van: pay.rekLid(codenaam),
      naar: k.verkoper.supplierCode ? pay.rekPartner(k.verkoper.supplierCode) : 'rtg:reisbureau',
      centen: k.offerte.totaalCenten,
      sleutel: maakSleutel('pay-handeling', ['reisketen-inning', a.ref, k.offerte.hash]) };
    if (oud && !zelfdeClaim(oud, p)) return fout(409, 'De eerdere betaalpoging wijkt af. Handmatig herstel is nodig.');
    k.betaling = oud || { ...p, status: 'bezig', at: nu() };
    return { ok: true, titel: a.titel, betaling: { ...k.betaling } };
  }
  async function betaal(actor, codenaam, b, nieuweInningMag) {
    if (!IDEM.test(b.idem || '') || !Number.isSafeInteger(b.versie))
      return fout(400, 'Betaling vraagt een exacte versie en idempotentiesleutel.');
    const pay = payVan();
    if (!pay || typeof pay.boekAsync !== 'function' || typeof pay.rekLid !== 'function' || typeof pay.rekPartner !== 'function')
      return fout(503, 'De bestaande betaalvoorziening is niet beschikbaar.');
    const claim = await O.schrijf(lijst => {
      const a = lijst.find(x => x.keten && x.ref === b.ref && x.customerKey === actor.actorRef);
      if (!a) return fout(404, 'Reis niet gevonden.');
      const k = a.keten, oud = k.betaling;
      if (oud && oud.status === 'betaald') return { ok: true, klaar: true, reis: lidbeeld(a) };
      if (oud) return oud.status === 'bezig'
        ? { ok: true, herstel: true, titel: a.titel, betaling: { ...oud } }
        : fout(409, 'De betaalstand vraagt menselijke beoordeling.');
      if (!oud && k.versie !== b.versie) return fout(409, 'De reis is gewijzigd. Controleer de actuele gegevens vóór betaling.');
      return nieuweInning(a, codenaam, pay, nieuweInningMag);
    });
    if (claim.error || claim.klaar) return claim;
    const p = claim.betaling;
    const beweging = { van: p.van, naar: p.naar, centen: p.centen,
      soort: 'reisbetaling', oms: 'Reis ' + claim.titel, ref: b.ref, economischeSleutel: p.sleutel };
    let r = null;
    if (claim.herstel) {
      /* Eerst uitsluitend de OORSPRONKELIJKE beweging lezen. Een later
         gesloten aanbieder of nieuwe codenaam wist geen al geboekte centen.
         Alleen expliciet bewezen afwezigheid mag naar de nieuwe-werkpoorten. */
      if (typeof pay.boekBekend !== 'function') return fout(503, 'De bestaande betaaluitkomst kan niet veilig worden nagekeken.');
      try { r = await pay.boekBekend(beweging); }
      catch (_) { return fout(503, 'De bestaande betaaluitkomst kon niet worden bevestigd. Er wordt niets nieuws geïnd.'); }
      if (!r || r.ok !== true) {
        if (!r || r.status !== 404 || r.onbekend !== true || r.code !== 'PAY_BOEKING_ONBEKEND')
          return fout(503, 'De bestaande betaaluitkomst wijkt af of is onbereikbaar. Er wordt niets nieuws geïnd.');
        const opnieuw = await O.schrijf(lijst => {
          const a = lijst.find(x => x.keten && x.ref === b.ref && x.customerKey === actor.actorRef);
          if (!a || !zelfdeClaim(a.keten.betaling, p)) return fout(409, 'De oorspronkelijke betaalclaim is gewijzigd; menselijk herstel is nodig.');
          if (a.keten.betaling.status === 'betaald') return { ok: true, klaar: true, reis: lidbeeld(a) };
          if (a.keten.betaling.status !== 'bezig') return fout(409, 'De betaalstand vraagt menselijke beoordeling.');
          return nieuweInning(a, codenaam, pay, nieuweInningMag);
        });
        if (opnieuw.error || opnieuw.klaar) return opnieuw;
        r = null;
      }
    }
    if (!r) {
      try { r = await pay.boekAsync(beweging); }
      catch (_) { return fout(503, 'De betaaluitkomst is onbekend. Controleer door dezelfde betaling opnieuw te proberen.'); }
    }
    if (!r || !r.ok || !r.boeking) {
      // Ook bij een foutantwoord kan de verbinding NA commit zijn verbroken.
      // De claim blijft staan, zodat alleen dezelfde economische retry kan volgen.
      return { status: r && r.status || 503, error: r && r.error || 'De betaling is niet bevestigd; probeer dezelfde betaling opnieuw.' };
    }
    if (r.boeking.van !== p.van || r.boeking.naar !== p.naar || r.boeking.centen !== p.centen ||
        r.boeking.ref !== b.ref || r.boeking.soort !== 'reisbetaling' ||
        typeof r.boeking.id !== 'string' || !r.boeking.id.trim())
      return fout(503, 'Het betaalbewijs wijkt af. De reis blijft geblokkeerd voor financiële controle.');
    return O.schrijf(lijst => {
      const a = lijst.find(x => x.keten && x.ref === b.ref && x.customerKey === actor.actorRef);
      if (!a || !zelfdeClaim(a.keten.betaling, p)) return fout(409, 'Betaling vraagt herstel van de reisverwijzing.');
      if (a.keten.betaling.status === 'betaald') return { ok: true, herhaald: true, reis: lidbeeld(a) };
      a.keten.betaling = { ...p, status: 'betaald', boekingRef: r.boeking.id, at: r.boeking.at || nu() };
      O.gebeurtenis(a, 'betaling-bevestigd', actor.actorRef);
      return { ok: true, reis: lidbeeld(a) };
    });
  }
  return { betaal };
};
