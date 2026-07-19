/* Het RTG-reisbureau: een echt reisbureau in de leden-app. Leden bladeren door
   de samengestelde reizen (dezelfde die het partnerkanaal aan niet-leden toont,
   maar tegen de nettoprijs zonder opslag), en vragen een reis aan. De aanvraag
   landt bij een RTG-reisadviseur, die de datum bevestigt en de losse onderdelen
   (verblijf, transfers, tafels) regelt. Nooit de belofte dat iets al geboekt is:
   een aanvraag heet "aangevraagd" tot een mens hem bevestigt.

   Geen echte lucht-/hotelmerken als bevestigde partners. Prijzen in euro.
   Volgt het vaste kern-patroon maakReisbureau(state). */

function maakReisbureau({ db, save, crypto }) {
  const nu = () => new Date().toISOString();

  // de reizen zoals het lid ze ziet: nettoprijs per persoon, geen opslag
  function reizen() {
    return (db.data.partnerTrips || []).map(t => ({
      id: t.id, titel: t.title, bestemming: t.dest, dates: t.dates || null,
      prijs: Math.max(0, Number(t.netto) || 0),
      omschrijving: t.desc || null,
      inbegrepen: Array.isArray(t.includes) ? t.includes : [],
      visual: t.visual || null
    }));
  }

  function overzicht() {
    const lijst = reizen();
    return {
      ok: true, reizen: lijst, aantal: lijst.length, valuta: 'EUR',
      opmerking: 'Het RTG-reisbureau. Leden reizen tegen de nettoprijs, zonder opslag. Je vraagt een reis aan; een RTG-reisadviseur bevestigt de datum en stelt de reis samen. Prijzen per persoon, in euro.'
    };
  }

  // een lid vraagt een reis aan; de aanvraag komt bij het reisbureau te liggen
  function boek(sess, codename, data) {
    data = data || {};
    const trip = (db.data.partnerTrips || []).find(t => t.id === String(data.tripId || ''));
    if (!trip) return { status: 404, error: 'Reis niet gevonden.' };
    const personen = Math.min(20, Math.max(1, Math.round(Number(data.personen) || 1)));
    const vertrek = /^\d{4}-\d{2}-\d{2}$/.test(String(data.vertrek || '')) ? data.vertrek : null;
    const notitie = String(data.notitie || '').replace(/[<>]/g, '').trim().slice(0, 300);
    const pp = Math.max(0, Number(trip.netto) || 0);
    if (!Array.isArray(db.data.reisAanvragen)) db.data.reisAanvragen = [];
    // dubbele aanvraag remmen: dezelfde reis, nog open, van hetzelfde lid
    if (db.data.reisAanvragen.some(a => a.status === 'aangevraagd' && a.customerKey === sess.key && a.tripId === trip.id))
      return { status: 409, error: 'Je aanvraag voor deze reis staat al open. Een reisadviseur neemt contact met je op.' };
    const entry = {
      ref: 'RTG-R-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      tripId: trip.id, titel: trip.title, bestemming: trip.dest,
      customerKey: sess.key, codename, personen, vertrek, notitie,
      prijs: { pp, totaal: Math.round(pp * personen * 100) / 100, valuta: 'EUR' },
      status: 'aangevraagd', at: nu()
    };
    db.data.reisAanvragen.unshift(entry);
    db.data.reisAanvragen = db.data.reisAanvragen.slice(0, 5000);
    save();
    return { ok: true, aanvraag: entry };
  }

  function mijn(key) {
    return (db.data.reisAanvragen || []).filter(a => a.customerKey === key).slice(0, 50);
  }

  // het reisbureau-kantoor: de openstaande aanvragen (codenamen, nooit echte namen)
  function aanvragen() {
    return { ok: true, aanvragen: (db.data.reisAanvragen || []).slice(0, 200) };
  }

  return { reisbureau: { overzicht, boek, mijn, reizen, aanvragen } };
}

module.exports = { maakReisbureau };
