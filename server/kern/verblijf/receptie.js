/* Verblijf (deelmodule): de receptiekant: het hotel beslist over een
   aanvraag, check-in en check-out (met keyless deur voor de gast),
   no-show, de kamerkalender en het receptiebord. Krijgt de gedeelde
   context een keer bij het opstarten vanuit kern/verblijf.js. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer,
    id, nu, vandaag, isDatum, lijst, nachtenTussen, ACTIEF, overlapt } = ctx;
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
    const kaal = v => ({ id: v.id, ref: v.ref, codenaam: v.codenaam, roomName: v.roomName, aankomst: v.aankomst, vertrek: v.vertrek, nachten: v.nachten, personen: v.personen, totaal: v.totaal, notitie: v.notitie, status: v.status, openLast: openVan(v.roomName), zorg: v.zorg || null });
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

  return { beslis, checkIn, checkOut, noShow, gastDeur, kamerplanning, receptie };
};
