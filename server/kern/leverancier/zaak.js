/* Leverancier (deelmodule): de zaak-helpers: publieke weergave, tickets, housekeeping, kassa-dag, deuren en AI-vinders.
   Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/leverancier.js. */
module.exports = (ctx) => {
  const { db, save, crypto, i18n, notify, broadcastSync, sseToSupplier, sseToCustomer, logActivity,
    findSupplier, connectedSupplierCodes, guestsFor, gidsHaal, etaMinutes, haversine, accounts, werkgeverSollicitatie,
    HK_STATUSES, POS_METHODS, DOOR_RELOCK_MS, TABLE_STATUSES, ZAAK_OPTIES,
    ordersVanZaak, boekingenVanZaak, publicTrip } = ctx;
  const { deptsFor } = ctx; // uit de gastcontactlaag, die eerder gemount is
  function publicSupplier(s, lang) {
    const t = db.data.supplierTypes[s.type] || {};
    const loc = s.loc ? { ...s.loc, label: i18n.localize(s.loc.label, lang) } : s.loc;
    // review-gemiddelde uit de lopende som (O(1), ook met miljoenen reviews)
    const rs = (db.data.reviewStats || {})[s.code];
    return { code: s.code, name: s.name, type: s.type, typeLabel: t.label, icon: t.icon,
             rating: rs && rs.aantal ? { score: Math.round((rs.som / rs.aantal) * 10) / 10, aantal: rs.aantal } : null,
             city: s.city, caps: t.caps || [], loc, hasMenu: (s.menu || []).length > 0,
             depts: deptsFor(s),
             ordersOpen: !s.settings || s.settings.ordersOpen !== false,
             reservationsOpen: !s.settings || s.settings.reservationsOpen !== false,
             tablesFree: (s.tables || []).filter(x => x.status === 'vrij').length,
             tableNames: (s.tables || []).map(t => t.name),
             photos: s.photos || [],
             events: (s.events || []).filter(e => e.published).map(e => ({
               id: e.id, name: e.name, date: e.date, time: e.time, desc: e.desc, price: e.price,
               capacity: e.capacity,
               spotsLeft: Math.max(0, e.capacity - (e.guests || []).reduce((n, g) => n + g.qty, 0))
             })),
             rooms: (s.rooms || []).filter(r => r.available).map(r => ({ id: r.id, name: r.name, desc: i18n.localize(r.desc, lang), price: r.price })),
             // zelfstandigen: het vak en de boekbare diensten/producten
             vak: s.vak || null,
             services: (t.caps || []).includes('services')
               ? (s.services || []).map(x => ({ id: x.id, name: x.name, desc: x.desc, price: x.price, duurMin: x.duurMin || null, soort: x.soort || 'dienst' }))
               : undefined };
  }

  /* Welke zaken mogen een ophaal/bezorgdienst voeren: horeca (orders-caps)
     en zelfstandigen. Hotels/vervoer hebben hun eigen kanalen al. */
  function magBezorgen(s) {
    const caps = (db.data.supplierTypes[s.type] || {}).caps || [];
    return caps.includes('orders') || s.type === 'zzp';
  }
  /* Tickets leven als boekingen met soort 'ticket'; verlopen onbetaalde (ouder
     dan 30 min) tellen niet mee voor de capaciteit. */
  function ticketsVoorSlot(code, activiteitId, datum, tijd) {
    const nu = Date.now();
    return boekingenVanZaak(code).filter(b => b.kind === 'ticket' &&
      b.activiteitId === activiteitId && b.datum === datum && b.tijd === tijd &&
      b.status !== 'geweigerd' &&
      (b.paid || (nu - new Date(b.at).getTime()) < 30 * 60000));
  }

  function addTicket(code, actor, text, room) {
    const t = {
      id: crypto.randomBytes(4).toString('hex'),
      text: String(text).slice(0, 160), room: room || null,
      status: 'open', by: actor ? actor.name : 'Systeem', at: new Date().toISOString()
    };
    const list = db.data.tickets[code] = (db.data.tickets[code] || []);
    list.unshift(t);
    db.data.tickets[code] = list.slice(0, 120);
    return t;
  }
  function setRoomHk(s, room, status, note, actor) {
    const wasDefect = room.hk && room.hk.status === 'defect';
    room.hk = { status, note: status === 'defect' ? note : '', by: actor.name, at: new Date().toISOString() };
    // elke statuswissel haalt de vroege-check-in-vrijgave weg (die hoort bij schoon)
    if (status !== 'schoon') delete room.vroegVrij;
    if (status === 'defect') {
      // direct uit de verkoop en een klus voor onderhoud
      if (room.available) { room.available = false; room.hkDisabledAvail = true; }
      addTicket(s.code, actor, 'Kamer defect: ' + (note || room.name), room.name);
      logActivity(s.code, actor, 'meldde ' + room.name + ' defect' + (note ? ': ' + note : ''));
    } else {
      if (wasDefect && room.hkDisabledAvail) { room.available = true; delete room.hkDisabledAvail; }
      logActivity(s.code, actor, 'zette ' + room.name + ' op "' + status + '"');
    }
    save();
    broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
    sseToSupplier(s.code, 'sync', { scope: 'rooms' });
  }

  function salonNaarVolgers(s, tekst) {
    // volgers krijgen een melding zodra hun zaak iets nieuws plaatst
    const volgers = (s.salon && s.salon.volgers) || [];
    const tiers = [...new Set(volgers.map(k => (gidsHaal(k) || {}).tier).filter(Boolean))];
    for (const tier of tiers) notify(tier, { icon: '✦', title: 'De Salon · ' + s.name, body: String(tekst).slice(0, 90), scope: 'salon' });
    for (const k of volgers) sseToCustomer(k, 'sync', { scope: 'salon' });
  }

  /* Kassa-dagoverzicht (Z-rapport). Kamerlasten tellen pas mee als omzet bij het
     uitchecken (anders dubbel). */
  function posDay(code) {
    const today = new Date().toISOString().slice(0, 10);
    const all = db.data.posSales[code] || [];
    const sales = all.filter(s => s.at.slice(0, 10) === today);
    const byMethod = {}, byActor = {};
    let total = 0;
    for (const s of sales) {
      byActor[s.actor] = (byActor[s.actor] || 0) + s.total;
      if (s.method === 'kamer') continue;
      total += s.total;
      byMethod[s.method] = (byMethod[s.method] || 0) + s.total;
    }
    // open kamerrekeningen (alle dagen): nog niet uitgecheckte kamerlasten
    const openRooms = {};
    for (const s of all) {
      if (s.method !== 'kamer' || s.settled || !s.room) continue;
      const r = openRooms[s.room] = openRooms[s.room] || { total: 0, count: 0 };
      r.total += s.total;
      r.count += 1;
    }
    // fooien van vandaag (uit app-betalingen: bestellingen en ritten): voor het team
    let fooien = 0;
    for (const o of ordersVanZaak(code)) if (o.fooi && String(o.paidAt || '').slice(0, 10) === today) fooien += o.fooi;
    for (const r of db.data.rides) if (r.supplierCode === code && r.fooi && String(r.paidAt || '').slice(0, 10) === today) fooien += r.fooi;
    return { total, count: sales.length, byMethod, byActor, openRooms, fooien: Math.round(fooien * 100) / 100, sales: sales.slice(0, 25) };
  }

  /* Slimme deuren (appartementen): openen is tijdelijk; na 10 seconden
     vergrendelt de deur zichzelf weer, zoals een echt smart lock. */
  function unlockDoor(s, door, who) {
    door.locked = false;
    door.lastBy = who;
    door.lastAt = new Date().toISOString();
    save();
    sseToSupplier(s.code, 'sync', { scope: 'doors' });
    setTimeout(() => {
      const cur = (s.doors || []).find(d => d.id === door.id);
      if (cur && !cur.locked) {
        cur.locked = true;
        save();
        sseToSupplier(s.code, 'sync', { scope: 'doors' });
      }
    }, DOOR_RELOCK_MS);
  }

  function makeSupplierCode(name) {
    let base = String(name).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'PARTNER';
    let code = base, n = 2;
    while (db.data.suppliers.find(s => s.code === code)) code = base + n++;
    return code;
  }

  function managerOnly(req, res) {
    if (!req.actor.manager) { res.status(403).json({ error: 'Alleen een manager kan dit aanpassen.' }); return false; }
    return true;
  }
  function optieAan(s, naam) {
    return !s.settings || !s.settings.opties || s.settings.opties[naam] !== false;
  }

  // AI-zoekhulpjes voor de leverancier-assistent: kamer of deur uit vrije tekst
  function aiFindRoom(s, ql) {
    return (s.rooms || []).find(r => ql.includes(r.name.toLowerCase())) ||
           (s.rooms || []).find(r => r.name.toLowerCase().split(/[ ,]+/).some(w => w.length > 3 && ql.includes(w)));
  }
  function aiFindDoor(s, ql) {
    return (s.doors || []).find(d => ql.includes(d.name.toLowerCase())) ||
           (s.doors || []).find(d => d.name.toLowerCase().split(/[ (]+/).some(w => w.length > 3 && ql.includes(w))) ||
           ((ql.includes('deur') || ql.includes('door')) ? (s.doors || [])[0] : null);
  }

  // dashboarddata voor de ingelogde leverancier. Schaalvast: alleen het werk van
  // nu plus een korte staart; de rest loopt via gepagineerde endpoints en totalen.
  return { publicSupplier, magBezorgen, ticketsVoorSlot, addTicket, setRoomHk, salonNaarVolgers, posDay, unlockDoor, makeSupplierCode, managerOnly, optieAan, aiFindRoom, aiFindDoor };
};
