/* De verblijf-laag (toren hotel): van kamercatalogus naar echte verblijven.

   Een verblijf heeft een aankomst- en vertrekdatum, een kamer en een prijs
   (nachten maal kamerprijs) en loopt de keten aangevraagd -> bevestigd ->
   ingecheckt -> uitgecheckt (of geweigerd, geannuleerd, no-show). De regels:

   - OVERLAP: een kamer kan maar een gast tegelijk hebben; een aanvraag die
     overlapt met een bevestigd of ingecheckt verblijf op dezelfde kamer
     ketst af met de eerstvolgende vrije datum erbij.
   - CHECK-IN: de kamer gaat op "bezet" voor housekeeping en de logies gaan
     automatisch als kamerlast op de rekening (posSale, method 'kamer').
     Daarmee int de bestaande kassa-check-out ALLES in een keer: logies,
     minibar en roomservice, via RTG Pay of contant.
   - CHECK-OUT (verblijf): sluit het verblijf en zet de kamer op "vuil";
     het geld loopt via de kassa (pos/checkout), niet hier.
   - RECEPTIE: het bord van vandaag: aanvragen, aankomsten, vertrekken,
     wie er in huis is en de bezetting. */

module.exports = ({ db, save, crypto, schoon, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer }) => {
  const id = () => crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const isDatum = x => /^\d{4}-\d{2}-\d{2}$/.test(String(x || ''));
  const lijst = () => (db.data.verblijven = Array.isArray(db.data.verblijven) ? db.data.verblijven : []);
  const nachtenTussen = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

  const ACTIEF = ['aangevraagd', 'bevestigd', 'ingecheckt'];
  function overlapt(supplierCode, roomId, aankomst, vertrek, negeerId) {
    return lijst().find(v =>
      v.supplierCode === supplierCode && v.roomId === roomId && v.id !== negeerId &&
      ['bevestigd', 'ingecheckt'].includes(v.status) &&
      v.aankomst < vertrek && aankomst < v.vertrek);
  }

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

  function beslis(supplier, vid, actie) {
    const v = lijst().find(x => x.id === vid && x.supplierCode === supplier.code);
    if (!v) return { status: 404, error: 'Verblijf niet gevonden.' };
    if (v.status !== 'aangevraagd') return { status: 409, error: 'Dit verblijf is al ' + v.status + '.' };
    if (actie === 'bevestig') {
      const bezet = overlapt(supplier.code, v.roomId, v.aankomst, v.vertrek, v.id);
      if (bezet) return { status: 409, error: v.roomName + ' is inmiddels bezet in die periode.' };
      v.status = 'bevestigd';
    } else v.status = 'geweigerd';
    save();
    const tekst = v.status === 'bevestigd'
      ? 'Uw verblijf bij ' + supplier.name + ' is bevestigd: ' + v.roomName + ', ' + v.aankomst + ' tot ' + v.vertrek + '.'
      : supplier.name + ' kan uw verblijf van ' + v.aankomst + ' helaas niet plaatsen.';
    notify(v.customerKey, { icon: '🛎️', title: supplier.name, body: tekst, scope: 'orders' });
    sseToCustomer(v.customerKey, 'sync', { scope: 'verblijf' });
    sseToSupplier(supplier.code, 'sync', { scope: 'receptie' });
    return { ok: true, verblijf: v };
  }

  function checkIn(supplier, vid, actorName) {
    const v = lijst().find(x => x.id === vid && x.supplierCode === supplier.code);
    if (!v) return { status: 404, error: 'Verblijf niet gevonden.' };
    if (v.status !== 'bevestigd') return { status: 409, error: 'Alleen een bevestigd verblijf kan inchecken (dit is ' + v.status + ').' };
    v.status = 'ingecheckt';
    v.ingechecktAt = nu();
    const rm = (supplier.rooms || []).find(r => r.id === v.roomId);
    if (rm) rm.hk = { status: 'bezet', by: actorName || 'Receptie', at: nu() };
    // keyless: hoort er een slimme deur bij deze kamer, dan is de app de sleutel
    const deur = (supplier.doors || []).find(d => v.roomName.toLowerCase().includes(d.name.toLowerCase()));
    if (deur) v.deurId = deur.id;
    // de logies gaan als kamerlast op de rekening: de kassa-check-out int
    // straks alles in een keer (logies plus minibar plus roomservice)
    const sale = {
      id: crypto.randomBytes(4).toString('hex'),
      bon: 'V' + crypto.randomBytes(2).toString('hex').toUpperCase(),
      actor: actorName || 'Receptie',
      desc: 'Logies ' + v.roomName + ', ' + v.nachten + ' nacht(en) (' + v.ref + ')',
      room: v.roomName, items: null, total: v.totaal, method: 'kamer', betaler: null,
      at: nu()
    };
    const kas = db.data.posSales[supplier.code] = (db.data.posSales[supplier.code] || []);
    kas.unshift(sale);
    db.data.posSales[supplier.code] = kas.slice(0, 300);
    save();
    notify(v.customerKey, { icon: '🗝️', title: supplier.name, body: 'Welkom. Uw kamer is ' + v.roomName + (v.deurId ? '; uw telefoon is de sleutel' : '') + '. Alles wat u bestelt kan op de kamer.', scope: 'orders' });
    sseToCustomer(v.customerKey, 'sync', { scope: 'verblijf' });
    sseToSupplier(supplier.code, 'sync', { scope: 'receptie' });
    return { ok: true, verblijf: v };
  }

  function checkOut(supplier, vid) {
    const v = lijst().find(x => x.id === vid && x.supplierCode === supplier.code);
    if (!v) return { status: 404, error: 'Verblijf niet gevonden.' };
    if (v.status !== 'ingecheckt') return { status: 409, error: 'Deze gast is niet ingecheckt (' + v.status + ').' };
    // de rekening eerst: open kamerlasten horen bij de kassa-check-out
    const open = (db.data.posSales[supplier.code] || []).filter(s2 => s2.method === 'kamer' && !s2.settled && s2.room === v.roomName);
    if (open.length) {
      const totaal = Math.round(open.reduce((n, s2) => n + (s2.total || 0), 0) * 100) / 100;
      return { status: 409, error: 'Er staat nog ' + totaal.toFixed(2) + ' euro open op ' + v.roomName + '; reken de kamer eerst af op de kassa.', openLast: totaal };
    }
    v.status = 'uitgecheckt';
    v.uitgechecktAt = nu();
    const rm = (supplier.rooms || []).find(r => r.id === v.roomId);
    if (rm) rm.hk = { status: 'vuil', by: 'Systeem (check-out)', at: nu() };
    save();
    notify(v.customerKey, { icon: '🛎️', title: supplier.name, body: 'Tot ziens; uw check-out is rond. Graag tot een volgende keer.', scope: 'orders' });
    sseToCustomer(v.customerKey, 'sync', { scope: 'verblijf' });
    sseToSupplier(supplier.code, 'sync', { scope: 'receptie' });
    return { ok: true, verblijf: v };
  }

  function noShow(supplier, vid) {
    const v = lijst().find(x => x.id === vid && x.supplierCode === supplier.code);
    if (!v) return { status: 404, error: 'Verblijf niet gevonden.' };
    if (v.status !== 'bevestigd') return { status: 409, error: 'Alleen een bevestigd verblijf kan een no-show zijn.' };
    if (v.aankomst > vandaag()) return { status: 409, error: 'De aankomstdag is nog niet geweest.' };
    v.status = 'no-show';
    save();
    sseToSupplier(supplier.code, 'sync', { scope: 'receptie' });
    return { ok: true, verblijf: v };
  }

  /* De digitale sleutel: een ingecheckte gast opent met de app zijn eigen
     kamerdeur, of de entree (de eerste deur van het huis). De route eromheen
     bewaakt de zaak-optie (deurenGast) en doet het echte ontgrendelen. */
  function gastDeur(key, supplierCode, welke) {
    const s = findSupplier(supplierCode);
    if (!s || !(s.doors || []).length) return { status: 404, error: 'Dit adres heeft geen digitale deuren.' };
    const v = lijst().find(x => x.customerKey === key && x.supplierCode === s.code && x.status === 'ingecheckt');
    if (!v) return { status: 409, error: 'De digitale sleutel werkt tijdens een ingecheckt verblijf.' };
    const doel = welke === 'kamer' && v.deurId ? s.doors.find(d => d.id === v.deurId) : s.doors[0];
    if (!doel) return { status: 404, error: 'Deur niet gevonden.' };
    return { ok: true, supplier: s, door: doel, verblijf: v };
  }

  /* De kamerkalender: wie zit waar, welke nachten, ook vooruit. */
  function kamerplanning(supplier, dagenIn) {
    const n = Math.max(7, Math.min(30, parseInt(dagenIn, 10) || 14));
    const dagen = [...Array(n)].map((_, i) => new Date(Date.now() + i * 86400000).toISOString().slice(0, 10));
    const van = lijst().filter(v => v.supplierCode === supplier.code && ['bevestigd', 'ingecheckt'].includes(v.status));
    const kamers = (supplier.rooms || []).map(r => ({
      id: r.id, name: r.name,
      dagen: dagen.map(d => {
        const v = van.find(x => x.roomId === r.id && x.aankomst <= d && d < x.vertrek);
        return v ? { datum: d, status: v.status, codenaam: v.codenaam } : { datum: d, status: 'vrij' };
      })
    }));
    return { ok: true, dagen, kamers };
  }

  /* Het receptiebord: vandaag in een oogopslag. */
  function receptie(supplier, datumIn) {
    const datum = isDatum(datumIn) ? datumIn : vandaag();
    const van = lijst().filter(v => v.supplierCode === supplier.code);
    const kas = db.data.posSales[supplier.code] || [];
    const openVan = naam => {
      const open = kas.filter(s2 => s2.method === 'kamer' && !s2.settled && s2.room === naam);
      return open.length ? Math.round(open.reduce((n, s2) => n + (s2.total || 0), 0) * 100) / 100 : 0;
    };
    const kaal = v => ({ id: v.id, ref: v.ref, codenaam: v.codenaam, roomName: v.roomName, aankomst: v.aankomst, vertrek: v.vertrek, nachten: v.nachten, personen: v.personen, totaal: v.totaal, notitie: v.notitie, status: v.status, openLast: openVan(v.roomName) });
    const kamers = supplier.rooms || [];
    return {
      ok: true, datum,
      aanvragen: van.filter(v => v.status === 'aangevraagd').slice(0, 20).map(kaal),
      aankomsten: van.filter(v => v.status === 'bevestigd' && v.aankomst <= datum).sort((a, b) => a.aankomst.localeCompare(b.aankomst)).slice(0, 20).map(kaal),
      vertrekken: van.filter(v => v.status === 'ingecheckt' && v.vertrek <= datum).slice(0, 20).map(kaal),
      inHuis: van.filter(v => v.status === 'ingecheckt').slice(0, 30).map(kaal),
      komend: van.filter(v => v.status === 'bevestigd' && v.aankomst > datum).sort((a, b) => a.aankomst.localeCompare(b.aankomst)).slice(0, 10).map(kaal),
      bezetting: {
        totaal: kamers.length,
        bezet: kamers.filter(r => r.hk && r.hk.status === 'bezet').length,
        vuil: kamers.filter(r => r.hk && r.hk.status === 'vuil').length
      },
      // housekeeping-prioriteit: vuile kamers waar vandaag alweer iemand aankomt
      hkEerst: kamers
        .filter(r => r.hk && ['vuil', 'bezig'].includes(r.hk.status) &&
          van.some(v => v.status === 'bevestigd' && v.roomId === r.id && v.aankomst <= datum))
        .map(r => r.name)
    };
  }

  return { verblijfBoek: boek, mijnVerblijven, verblijfAnnuleer: annuleer, verblijfBeslis: beslis, verblijfCheckin: checkIn, verblijfCheckout: checkOut, verblijfNoShow: noShow, receptie, kamerplanning, gastDeur };
};
