/* Verblijf (deelmodule): de gastkant: een verblijf boeken (met
   overlapcontrole per kamer), de eigen verblijven en annuleren. Krijgt de
   gedeelde context een keer bij het opstarten vanuit kern/verblijf.js. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer,
    id, nu, vandaag, isDatum, lijst, nachtenTussen, ACTIEF, overlapt } = ctx;
  function boek(sess, codenaam, body) {
    const s = findSupplier(body.supplierCode);
    if (!s || !Array.isArray(s.rooms)) return { status: 404, error: 'Dit adres heeft geen kamers.' };
    if (s.settings && s.settings.ordersOpen === false) return { status: 409, error: s.name + ' neemt op dit moment geen boekingen aan.' };
    const kamer = s.rooms.find(r => r.id === String(body.roomId || '') && r.available);
    if (!kamer) return { status: 404, error: 'Deze kamer is er niet (meer).' };
    const aankomst = String(body.aankomst || '');
    const vertrek = String(body.vertrek || '');
    if (!isDatum(aankomst) || aankomst < vandaag()) return { status: 400, error: 'Kies een aankomstdatum vanaf vandaag.' };
    if (!isDatum(vertrek) || vertrek <= aankomst) return { status: 400, error: 'De vertrekdatum moet na de aankomst liggen.' };
    const nachten = nachtenTussen(aankomst, vertrek);
    if (nachten > 60) return { status: 400, error: 'Boeken kan tot zestig nachten in een keer.' };
    const bezet = overlapt(s.code, kamer.id, aankomst, vertrek);
    if (bezet) return { status: 409, error: kamer.name + ' is bezet in die periode; vrij vanaf ' + bezet.vertrek + '.' };
    const personen = Math.min(10, Math.max(1, parseInt(body.personen, 10) || 2));
    const v = {
      id: id(), ref: 'RTG-V-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      supplierCode: s.code, supplierName: s.name,
      roomId: kamer.id, roomName: kamer.name,
      customerKey: sess.key, codenaam, tier: sess.tier,
      aankomst, vertrek, nachten, personen,
      prijsPerNacht: Number(kamer.price) || 0,
      totaal: Math.round((Number(kamer.price) || 0) * nachten * 100) / 100,
      notitie: schoon(body.notitie, 140) || '',
      status: 'aangevraagd', at: nu()
    };
    lijst().unshift(v);
    if (lijst().length > 50000) lijst().length = 50000;
    save();
    notifySupplier(s.code, { icon: '🛎️', title: 'Nieuwe verblijfsaanvraag', body: codenaam + ': ' + kamer.name + ', ' + aankomst + ' tot ' + vertrek + ' (' + nachten + ' nacht(en), ' + personen + 'p)' });
    sseToSupplier(s.code, 'sync', { scope: 'receptie' });
    return { ok: true, verblijf: v };
  }

  function mijnVerblijven(key) {
    return lijst().filter(v => v.customerKey === key).slice(0, 25);
  }

  function annuleer(key, vid) {
    const v = lijst().find(x => x.id === vid && x.customerKey === key);
    if (!v) return { status: 404, error: 'Verblijf niet gevonden.' };
    if (!['aangevraagd', 'bevestigd'].includes(v.status)) return { status: 409, error: 'Dit verblijf is al ' + v.status + '.' };
    if (v.aankomst <= vandaag() && v.status === 'bevestigd') return { status: 409, error: 'Op de aankomstdag zelf annuleren gaat via het hotel.' };
    v.status = 'geannuleerd';
    save();
    notifySupplier(v.supplierCode, { icon: '🛎️', title: 'Verblijf geannuleerd', body: v.codenaam + ': ' + v.roomName + ', ' + v.aankomst + ' tot ' + v.vertrek });
    sseToSupplier(v.supplierCode, 'sync', { scope: 'receptie' });
    return { ok: true, verblijf: v };
  }
  return { boek, mijnVerblijven, annuleer };
};
