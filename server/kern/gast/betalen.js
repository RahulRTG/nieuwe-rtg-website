/* Hospitality Guest OS (deelmodule): DE FOOI EN HET AFREKENEN.

   OVER BETALEN, EERLIJK. Een gast kan hier afrekenen langs de rails die ECHT
   bestaan: een cadeaubon, tegoed, en de kamer van het hotel (de folio-laag).
   Kaart en online lopen nog niet vanaf de telefoon van de gast; die geven een
   nette weigering met de reden in plaats van een groen vinkje. Doen alsof er
   betaald is terwijl er geen geld is bewogen, is de ene fout die een
   horecasysteem niet mag maken -- en het is precies de fout die je maakt als je
   een knop bouwt voordat de rail eronder ligt.

   De verdeling (wie betaalt welk deel) staat in ./verdeling.js. */
'use strict';

/* De rails die vandaag echt geld verplaatsen vanaf de gastkant. `kamer` loopt
   via de bestaande folio-laag, `bon` en `tegoed` via kern/horeca.js. */
const GASTRAILS = ['bon', 'tegoed', 'kamer'];

module.exports = ({ save, schoon, horeca, beleid, orderlaag, verdeling }) => {
  const { heleCenten, openstaand, nu, id } = horeca;
  const { audit, zetReis, gastBeeld } = orderlaag;
  const { verdeel } = verdeling;
  /* ---------- de fooi ----------
     Nooit voorgevuld, nooit een voorgeselecteerde knop, en altijd zichtbaar
     voordat er betaald wordt. De fooi hangt aan de rekening (zo telt hij mee in
     wat er te betalen is) en wordt bij een bestaande verdeling opnieuw
     verdeeld, want anders klopt de som niet meer. */
  function fooi(zaakcode, rek, deelnemer, bedrag) {
    if (rek.status !== 'open') return { status: 409, error: 'Deze rekening is al ' + rek.status + '.' };
    const was = rek.fooiCenten || 0;
    rek.fooiCenten = heleCenten(bedrag);
    audit(rek, { actor: deelnemer ? deelnemer.handle : 'gast', bron: 'gast', wat: 'fooi',
      van: was, naar: rek.fooiCenten });
    if (rek.verdeling) {
      const opnieuw = verdeel(zaakcode, rek, { wijze: rek.verdeling.wijze,
        delen: rek.verdeling.delen.map(d => ({ nr: d.nr, centen: d.centen })) });
      /* Een opgegeven verdeling per persoon telt na een fooiwijziging niet meer
         op; die vervalt dan liever dan dat hij stil scheef staat. */
      if (opnieuw.error) rek.verdeling = null;
    }
    save();
    return { ok: true, fooi: rek.fooiCenten, verdeling: rek.verdeling || null,
      let: 'Fooi telt niet mee in de omzet en gaat naar het personeel.' };
  }

  /* ---------- afrekenen ---------- */
  function betaal(zaakcode, rek, deelnemer, { wijze, centen: bedrag, bonCode, kamer, idem, apparaat, folioBoek }) {
    const magHet = beleid.magAfrekenen(zaakcode);
    if (!magHet.mag) return { status: 403, error: magHet.uitleg, code: magHet.code };
    if (rek.status !== 'open') return { status: 409, error: 'Deze rekening is al ' + rek.status + '.', code: 'gesloten' };

    const w = String(wijze || '');
    if (!GASTRAILS.includes(w)) return { status: 501, code: 'rail-ontbreekt',
      error: 'Vanaf je eigen telefoon kun je hier afrekenen met een cadeaubon, tegoed of op je hotelkamer. ' +
        'Kaart en online lopen nog via de bediening: vraag om de pin.', rails: GASTRAILS };

    const { sleutel, eerder } = orderlaag.idemZoek(zaakcode, idem);
    if (eerder) return Object.assign({}, eerder, { herhaald: true });

    const open = openstaand(rek);
    if (open <= 0) return { status: 409, error: 'Er staat niets meer open op deze rekening.', code: 'niets-open' };

    /* Standaard betaalt de gast ZIJN DEEL als er een verdeling ligt, en anders
       het openstaande bedrag. Dat is het verschil tussen een gedeelde tafel en
       een rekening met een persoon erachter. */
    const mijnDeel = rek.verdeling && deelnemer
      ? (rek.verdeling.delen.find(d => d.nr === deelnemer.nr) || {}).centen : null;
    const alBetaaldDoorMij = (rek.betalingen || [])
      .filter(b => deelnemer && b.gastNr === deelnemer.nr).reduce((t, b) => t + b.centen, 0);
    let wil = bedrag != null ? heleCenten(bedrag)
      : (mijnDeel != null ? Math.max(0, mijnDeel - alBetaaldDoorMij) : open);
    if (!wil) return { status: 400, error: 'Jouw deel staat al voldaan.', code: 'deel-voldaan' };
    if (wil > open) return { status: 400, code: 'meer-dan-open',
      error: 'Dat is meer dan er openstaat (€ ' + (open / 100).toFixed(2) + ').' };

    let bonUit = null;
    if (w === 'bon' || w === 'tegoed') {
      const uit = horeca.bonBoek(zaakcode, bonCode, wil);
      if (uit.error) return { status: uit.status || 400, error: uit.error, code: 'bon' };
      bonUit = uit; wil = uit.geboekt;
    }
    const betaling = { id: id(3), wijze: w, centen: wil, at: nu(),
      door: deelnemer ? deelnemer.handle : 'gast', gastNr: deelnemer ? deelnemer.nr : null,
      bon: bonUit ? bonUit.bon : null, kamer: w === 'kamer' ? (rek.kamer || schoon(kamer, 20)) : null };

    if (w === 'kamer') {
      if (!betaling.kamer) return { status: 400, error: 'Op welke kamer moet dit geboekt worden?', code: 'kamer-leeg' };
      if (!folioBoek) return { status: 409, code: 'hotel-uit',
        error: 'De hotellaag staat bij deze zaak niet aan; op de kamer boeken kan hier niet.' };
      const opFolio = folioBoek(zaakcode, betaling.kamer, {
        soort: rek.kanaal === 'roomservice' ? 'roomservice' : 'restaurant',
        omschrijving: (rek.tafel || rek.kanaal) + ' · rekening ' + rek.id, centen: wil,
        door: betaling.door, bron: rek.id });
      if (opFolio.error) return { status: opFolio.status || 400, error: opFolio.error, code: 'folio' };
      betaling.folioRegel = opFolio.regel.id;
    }

    rek.betalingen.push(betaling);
    audit(rek, { actor: betaling.door, bron: 'gast', apparaat, wat: 'betaling',
      naar: w + ' € ' + (wil / 100).toFixed(2) });
    const rest = openstaand(rek);
    if (rest <= 0) { rek.status = 'betaald'; rek.geslotenAt = nu(); zetReis(rek, 'vertrokken'); }
    save();
    const uit = { ok: true, betaald: wil, openstaand: rest, gesloten: rek.status === 'betaald',
      bonSaldo: bonUit ? bonUit.saldo : undefined, rekening: gastBeeld(rek, deelnemer) };
    return orderlaag.idemLeg(zaakcode, sleutel, uit);
  }

  return { GASTRAILS, fooi, betaal };
};
