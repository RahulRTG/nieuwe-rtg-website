/* Ervaring-deel "tafeluitzondering": wat een zaak kan zeggen tussen ja en nee.

   Een tafelaanvraag kende twee antwoorden: bevestigd of geweigerd. Het antwoord
   waar een concierge van leeft -- "niet om 20:00, wel om 21:15, en die houden
   wij twaalf minuten voor u vast" -- bestond niet, en een medewerker die "vol"
   zag kon niemand erbij halen die wel mocht beslissen. Dit bestand voegt die
   twee toe (CONCIERGE.md par. 2.7-2.9), op de bestaande reservering en zonder
   tweede wachtrij.

   VIER DINGEN DIE HIER VASTLIGGEN:

   1. EEN TEGENVOORSTEL HOUDT EEN PLEK VAST, EN LAAT HEM BEREKEND LOS. Zolang het
      geldt telt het mee in de capaciteit op de aangeboden tijd; daarna niet meer
      (reservering/capaciteit.js). Er is geen opruimtaak die dat moet onthouden
      (CON-09).
   2. EEN VERLOPEN TEGENVOORSTEL WORDT NIET AANGENOMEN, ook niet als de gast op
      ja drukt: de tafel kan intussen van een ander zijn.
   3. DOORZETTEN BRENGT DE BESLISSER, NIET DE DRUK. De medewerker zet een
      aanvraag door met een reden; vanaf dan beslist alleen een manager. Er komt
      geen urgentielabel en geen VIP-teken bij, en een nee blijft een nee
      (CON-04).
   4. DE GAST HOEFT NIETS TE WETEN VAN WIE HET BESLOOT. Hij ziet een nieuwe tijd
      en een termijn, niet dat er een manager bij kwam. */
'use strict';

const capaciteit = require('../reservering/capaciteit');

module.exports = (ctx) => {
  const { db, save, notify, notifySupplier, sseToCustomer, sseToSupplier, nu } = ctx;
  const vind = (code, rid) => (db.data.reserveringen || []).find(x => x.id === rid && x.supplierCode === code);
  const verlopen = r => r.status === 'tegenvoorstel' && !(Date.parse(r.tegenvoorstel && r.tegenvoorstel.geldigTot) > Date.now());

  function tegenvoorstel(supplier, actor, rid, b) {
    const r = vind(supplier.code, rid);
    if (!r) return { status: 404, error: 'Reservering niet gevonden.' };
    if (r.status !== 'aangevraagd') return { status: 409, error: 'Deze reservering is al ' + r.status + '.' };
    if (r.doorgezet && !(actor && actor.manager)) return { status: 403, error: 'Deze aanvraag is doorgezet; een manager beslist.' };
    const tijd = String(b.tijd || '');
    if (!/^\d{2}:\d{2}$/.test(tijd) || tijd === r.tijd) return { status: 400, error: 'Welke andere tijd kunt u bieden?' };
    const min = Math.max(5, Math.min(24 * 60, Math.round(Number(b.geldigMin) || 15)));
    const oud = r.tijd;
    r.tijd = tijd; // tijdelijk, voor de capaciteitsvraag
    const past = capaciteit.past(supplier, (db.data.reserveringen || []).filter(x => x !== r), r.datum, tijd, r.personen);
    r.tijd = oud;
    if (!past) return { status: 409, error: 'Ook om ' + tijd + ' is het vol.' };
    r.gevraagdeTijd = oud;
    r.tijd = tijd;
    r.status = 'tegenvoorstel';
    r.tegenvoorstel = { tijd, geldigTot: new Date(Date.now() + min * 60000).toISOString(), op: nu(),
      door: actor && actor.manager ? 'manager' : 'medewerker' };
    save();
    notify(r.customerKey, { icon: 'table', title: supplier.name,
      body: 'Om ' + oud + ' lukt het niet. Wij kunnen u om ' + tijd + ' ontvangen en houden die tafel ' + min + ' minuten vast.', scope: 'orders' });
    sseToCustomer(r.customerKey, 'sync', { scope: 'reserveringen' });
    return { ok: true, reservering: r };
  }

  function tegenvoorstelAntwoord(key, rid, akkoord) {
    const r = (db.data.reserveringen || []).find(x => x.id === rid && x.customerKey === key);
    if (!r) return { status: 404, error: 'Reservering niet gevonden.' };
    if (r.status !== 'tegenvoorstel') return { status: 409, error: 'Er ligt geen tegenvoorstel voor deze reservering.' };
    if (!akkoord) {
      r.status = 'geannuleerd';
      r.tegenvoorstel.antwoord = 'nee';
    } else if (verlopen(r)) {
      return { status: 409, error: 'Dit tegenvoorstel is verlopen; de tafel wordt niet meer vastgehouden.' };
    } else {
      r.status = 'bevestigd';
      r.tegenvoorstel.antwoord = 'ja';
    }
    save();
    notifySupplier(r.supplierCode, { icon: 'table', title: 'Antwoord op uw tegenvoorstel',
      body: r.customerCodename + ': ' + (akkoord ? 'ja, ' + r.datum + ' ' + r.tijd : 'nee, dank u') + ', ' + r.personen + 'p' });
    sseToSupplier(r.supplierCode, 'sync', { scope: 'reserveringen' });
    return { ok: true, reservering: r };
  }

  function doorzetten(supplier, actor, rid, b) {
    const r = vind(supplier.code, rid);
    if (!r) return { status: 404, error: 'Reservering niet gevonden.' };
    if (r.status !== 'aangevraagd') return { status: 409, error: 'Deze reservering is al ' + r.status + '.' };
    if (r.doorgezet) return { ok: true, reservering: r }; // al doorgezet: niet nog eens
    const reden = String(b.reden || '').replace(/[<>]/g, '').trim().slice(0, 200);
    if (!reden) return { status: 400, error: 'Waarom vraagt dit een beslissing?' };
    r.doorgezet = { op: nu(), reden, door: (actor && actor.name) || 'medewerker' };
    save();
    notifySupplier(supplier.code, { icon: 'table', title: 'Beslissing gevraagd',
      body: r.datum + ' ' + r.tijd + ', ' + r.personen + 'p: ' + reden + '. Mogelijk: nee, wachtlijst, andere tijd of een alternatief.' });
    sseToSupplier(supplier.code, 'sync', { scope: 'reserveringen' });
    return { ok: true, reservering: r };
  }

  /* Mag deze medewerker over deze aanvraag beslissen? Na doorzetten alleen een
     manager; ervoor iedereen, zoals het al was. */
  function magBeslissen(supplier, actor, rid) {
    const r = vind(supplier.code, rid);
    if (r && r.doorgezet && !(actor && actor.manager)) return { ok: false, reden: 'Deze aanvraag is doorgezet; een manager beslist.' };
    return { ok: true };
  }

  return { tegenvoorstel, tegenvoorstelAntwoord, doorzetten, magBeslissen, tegenvoorstelVerlopen: verlopen };
};
