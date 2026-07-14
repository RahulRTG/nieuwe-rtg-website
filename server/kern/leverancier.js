/* De leverancier-laag: de request-tijd read/write-helpers van de partner-app.
   De publieke weergave (publicSupplier, publicTrip), het complete dashboard
   (supplierState), de kassa-dag (posDay), gastchat (deptsFor/getChat), kamers en
   housekeeping (setRoomHk/addTicket), slimme deuren (unlockDoor), tickets, De
   Salon (salonNaarVolgers), de AI-zoekhulpjes en de zaak-opties.

   De kleine primitieven en glue (findSupplier, de SSE-routers, notifySupplier,
   logActivity, supplierAuth, ensureSupplierDefaults) blijven in server.js: die
   worden al vroeg, door andere kern-fabrieken, gebruikt. Deze fabriek draait ná
   de werk-kern, omdat supplierState werkgeverSollicitatie meeneemt. */

const HK_STATUSES = ['schoon', 'vuil', 'bezig', 'bezet', 'defect'];
const POS_METHODS = ['pin', 'contant', 'kamer'];
const DOOR_RELOCK_MS = 10000;
const TABLE_STATUSES = ['vrij', 'bezet', 'gereserveerd', 'dicht'];
/* Elke zaak is baas over de eigen opties. Alles kan aan of uit, met een
   principiele uitzondering: betalen via de app staat altijd aan. Wel kiest de
   zaak het moment: vooraf of achteraf. */
const ZAAK_OPTIES = {
  betaalVooraf: 'vooraf betalen',
  gastchat: 'de gastchat',
  ritten: 'ritaanvragen',
  deurenGast: 'de digitale gastsleutel',
  events: 'event-aanmeldingen'
};

function maakLeverancier({ db, save, crypto, i18n, notify, broadcastSync, sseToSupplier, sseToCustomer, logActivity, findSupplier, connectedSupplierCodes, guestsFor, gidsHaal, etaMinutes, haversine, accounts, werkgeverSollicitatie }) {
  function publicTrip(t, staffRate, lang) {
    const out = {
      id: t.id, dest: t.dest, visual: t.visual, title: i18n.localize(t.title, lang),
      dates: i18n.localize(t.dates, lang), desc: i18n.localize(t.desc, lang), includes: i18n.localizeList(t.includes, lang),
      price: Math.round(t.netto * (1 + db.data.partnerService))
    };
    if (staffRate != null) out.staffPrice = Math.round(t.netto * (1 + staffRate));
    return out;
  }

  // afdelingen per sector: de gast kiest met wie hij spreekt
  function deptsFor(s) {
    if (s.type === 'hotel') return ['Receptie', 'Roomservice', 'Housekeeping', 'Onderhoud', 'Security'];
    if (s.type === 'apartment') return ['Beheer', 'Onderhoud', 'Security'];
    return ['Team'];
  }
  function chatKeyOf(supplierCode, customerKey, dept) { return supplierCode + '|' + customerKey + '|' + dept; }
  function getChat(s, customerKey, codename, tier, dept) {
    const k = chatKeyOf(s.code, customerKey, dept);
    if (!db.data.guestChats[k]) {
      db.data.guestChats[k] = { supplierCode: s.code, customerKey, codename, tier, dept, messages: [], unreadGuest: 0, unreadPartner: 0, lastAt: null };
    }
    return db.data.guestChats[k];
  }
  function validDept(s, dept) {
    const list = deptsFor(s);
    return list.includes(dept) ? dept : list[0];
  }

  // publieke weergave van een leverancier (voor de klant)
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
    return db.data.boekingen.filter(b => b.kind === 'ticket' && b.supplierCode === code &&
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
    for (const o of db.data.orders) if (o.supplierCode === code && o.fooi && String(o.paidAt || '').slice(0, 10) === today) fooien += o.fooi;
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
  function supplierState(s, actor) {
    const t = db.data.supplierTypes[s.type] || {};
    const vandaag = new Date().toISOString().slice(0, 10);
    const ORDER_KLAAR = { 'geserveerd': 1, 'geweigerd': 1, 'terugbetaald': 1, 'bezorgd': 1, 'opgehaald': 1 };
    const alleOrders = db.data.orders.filter(o => o.supplierCode === s.code && o.status !== 'wacht-op-betaling');
    const zichtOrders = alleOrders.filter(o => !ORDER_KLAAR[o.status] || String(o.at).slice(0, 10) === vandaag).slice(0, 80);
    const RIDE_KLAAR = { 'afgerond': 1, 'gearriveerd': 1, 'geweigerd': 1 };
    const alleRitten = db.data.rides.filter(r => r.supplierCode === s.code && r.status !== 'wacht-op-betaling');
    const klaarAll = alleRitten.filter(r => r.status === 'afgerond' || r.status === 'gearriveerd');
    const zichtRitten = alleRitten.filter(r => !RIDE_KLAAR[r.status] || String(r.finishedAt || r.at).slice(0, 10) === vandaag).slice(0, 80);
    const BOEK_KLAAR = { 'afgerond': 1, 'geweigerd': 1 };
    const alleBoekingen = db.data.boekingen.filter(b => b.supplierCode === s.code && b.status !== 'wacht-op-betaling');
    const zichtBoekingen = alleBoekingen.filter(b => !BOEK_KLAAR[b.status] || String(b.finishedAt || b.at).slice(0, 10) === vandaag).slice(0, 80);
    return {
      supplier: { code: s.code, name: s.name, type: s.type, typeLabel: t.label, icon: t.icon, city: s.city, caps: t.caps || [], loc: s.loc, rate: s.rate, vak: s.vak || null },
      activiteiten: s.activiteiten || null,
      transfer: s.type === 'activiteit' ? (s.transfer || { aan: false, prijs: 0 }) : null,
      autos: s.type === 'verhuur' ? (s.autos || []) : null,
      panden: s.type === 'vastgoed' ? (s.panden || []) : null,
      // de ophaal/bezorgdienst: alleen voor horeca en zelfstandigen
      bezorg: magBezorgen(s) ? {
        aan: !!(s.bezorg && s.bezorg.aan),
        ophalen: !s.bezorg || s.bezorg.ophalen !== false,
        bezorgen: !s.bezorg || s.bezorg.bezorgen !== false,
        producten: (s.bezorg && s.bezorg.producten) || [],
        lopend: alleOrders.filter(o => o.levering && !ORDER_KLAAR[o.status]).slice(0, 40),
        vandaagKlaar: alleOrders.filter(o => o.levering && (o.status === 'bezorgd' || o.status === 'opgehaald') && String(o.finishedAt || o.at).slice(0, 10) === vandaag).length
      } : null,
      services: s.services || null,
      boekingen: zichtBoekingen,
      rooms: s.rooms || null,
      doors: s.doors || null,
      tables: s.tables || null,
      settings: s.settings || { ordersOpen: true, reservationsOpen: true },
      fleet: s.fleet || null,
      minibar: Array.isArray(s.minibar) ? {
        catalog: s.minibar,
        countedToday: [...new Set((db.data.minibarCounts[s.code] || []).filter(e => e.at.slice(0, 10) === new Date().toISOString().slice(0, 10)).map(e => e.room))],
        recent: (db.data.minibarCounts[s.code] || []).slice(0, 12)
      } : null,
      photos: s.photos || [],
      pos: posDay(s.code),
      // tafelreserveringen: open aanvragen bovenaan, daarna komende bevestigde
      reserveringen: (db.data.reserveringen || [])
        .filter(r => r.supplierCode === s.code && ['aangevraagd', 'bevestigd'].includes(r.status) && r.datum >= vandaag)
        .sort((a, b) => (a.status === b.status ? (a.datum + a.tijd).localeCompare(b.datum + b.tijd) : a.status === 'aangevraagd' ? -1 : 1))
        .slice(0, 40),
      // reviews: het lopende gemiddelde plus de recentste beoordelingen
      reviews: (() => {
        const rs = (db.data.reviewStats || {})[s.code];
        return {
          rating: rs && rs.aantal ? { score: Math.round((rs.som / rs.aantal) * 10) / 10, aantal: rs.aantal } : null,
          recent: (db.data.reviews || []).filter(r => r.supplierCode === s.code).slice(0, 10)
            .map(r => ({ codename: r.codename, score: r.score, tekst: r.tekst, at: r.at }))
        };
      })(),
      tickets: (db.data.tickets[s.code] || []).slice(0, 40),
      lostfound: (db.data.lostfound[s.code] || []).slice(0, 40),
      guestChats: Object.entries(db.data.guestChats)
        .filter(([, c]) => c.supplierCode === s.code && c.messages.length)
        .map(([k, c]) => ({ key: k, codename: c.codename, dept: c.dept || 'Team', unread: c.unreadPartner, last: c.messages[c.messages.length - 1].text.slice(0, 60), lastFrom: c.messages[c.messages.length - 1].from, lastAt: c.lastAt }))
        .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''))
        .slice(0, 30),
      // leden die nu live onderweg zijn maar nog niet met dit bedrijf verbonden
      nearbyGuests: Object.values(db.data.live || {})
        .filter(L => L.active && !connectedSupplierCodes(L.key).includes(s.code))
        .slice(0, 12)
        .map(L => { const d = L.destCode ? findSupplier(L.destCode) : null; return { codename: L.codename, dest: d ? d.name : null }; }),
      menu: s.menu || [],
      orders: zichtOrders.map(o => {
        const L = db.data.live[o.customerKey || o.customerTier];
        const enroute = L && L.active && connectedSupplierCodes(o.customerKey || o.customerTier).includes(s.code);
        const me = enroute && Number.isFinite(L.lat) ? { lat: L.lat, lng: L.lng } : null;
        return { ...o, guestEtaMin: me && s.loc ? etaMinutes(haversine(me, s.loc), L.mode) : null, guestArrived: !!(L && L.arrived && L.destCode === s.code) };
      }),
      rides: zichtRitten.map(r => {
        const L = db.data.live[r.customerKey || r.customerTier];
        const guest = L && L.active && Number.isFinite(L.lat) ? { lat: L.lat, lng: L.lng } : null;
        const toS = r.toCode ? findSupplier(r.toCode) : null;
        return { ...r, guestLoc: guest, pickupEtaMin: guest && s.loc ? etaMinutes(haversine(s.loc, guest), 'driving') : null, dropEtaMin: guest && toS && toS.loc ? etaMinutes(haversine(guest, toS.loc), 'driving') : null };
      }),
      totals: {
        orders: alleOrders.length,
        rides: alleRitten.length,
        historie: klaarAll.length,
        ritOmzet: klaarAll.reduce((s2, r) => s2 + (r.quote || 0), 0),
        boekingen: alleBoekingen.length
      },
      // personeelszaken voor het kantoor: verlofaanvragen en wie er nu binnen is
      verlof: (db.data.verlof[s.code] || []).slice(0, 30),
      klok: (() => {
        const entries = (db.data.klok[s.code] || []).filter(e => e.in.slice(0, 10) === vandaag).slice(0, 60);
        return { vandaag: entries, binnen: [...new Set(entries.filter(e => !e.out).map(e => e.name))] };
      })(),
      guests: guestsFor(s.code).slice(0, 30),
      prices: db.data.supplierPrices.filter(p => p.supplierCode === s.code).slice(0, 20),
      notifications: db.data.supplierNotifications[s.code] || [],
      staff: accounts.listStaff(s.code).map(accounts.publicStaff),
      applications: (db.data.applications[s.code] || []).slice(0, 30).map(werkgeverSollicitatie),
      vacatures: (db.data.vacatures[s.code] || []).slice(0, 40),
      events: s.events || null,
      dailyMeps: (() => {
        if (!s.dailyMeps) return null;
        const vandaag = new Date().toISOString().slice(0, 10);
        const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const out = {};
        if (s.dailyMeps[vandaag]) out[vandaag] = s.dailyMeps[vandaag];
        if (s.dailyMeps[morgen]) out[morgen] = s.dailyMeps[morgen];
        return out;
      })(),
      activity: (db.data.supplierActivity[s.code] || []).slice(0, 40),
      team: (db.data.supplierTeam[s.code] || []).slice(-60),
      actor: actor || { name: 'Beheer', role: 'manager', manager: true }
    };
  }

  return {
    publicTrip, deptsFor, chatKeyOf, getChat, validDept, publicSupplier, magBezorgen,
    ticketsVoorSlot, addTicket, setRoomHk, salonNaarVolgers, posDay, unlockDoor,
    makeSupplierCode, managerOnly, optieAan, aiFindRoom, aiFindDoor, supplierState
  };
}

module.exports = { HK_STATUSES, POS_METHODS, DOOR_RELOCK_MS, TABLE_STATUSES, ZAAK_OPTIES, maakLeverancier };
