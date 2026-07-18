/* Leverancier (deelmodule): de volledige zaak-status voor de leverancier-app (een samengestelde kaart van alles).
   Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/leverancier.js. */
module.exports = (ctx) => {
  const { db, save, crypto, i18n, notify, broadcastSync, sseToSupplier, sseToCustomer, logActivity,
    findSupplier, connectedSupplierCodes, guestsFor, gidsHaal, etaMinutes, haversine, accounts, werkgeverSollicitatie,
    HK_STATUSES, POS_METHODS, DOOR_RELOCK_MS, TABLE_STATUSES, ZAAK_OPTIES,
    ordersVanZaak, boekingenVanZaak, publicTrip } = ctx;
  const { deptsFor, chatKeyOf, getChat, validDept, zorgContact, klantSalon, publicSupplier, magBezorgen, ticketsVoorSlot, addTicket, setRoomHk, salonNaarVolgers, posDay, unlockDoor, makeSupplierCode, managerOnly, optieAan, aiFindRoom, aiFindDoor } = ctx;
  function supplierState(s, actor) {
    const t = db.data.supplierTypes[s.type] || {};
    const vandaag = new Date().toISOString().slice(0, 10);
    const ORDER_KLAAR = { 'geserveerd': 1, 'geweigerd': 1, 'terugbetaald': 1, 'bezorgd': 1, 'opgehaald': 1 };
    const alleOrders = ordersVanZaak(s.code).filter(o => o.status !== 'wacht-op-betaling');
    const zichtOrders = alleOrders.filter(o => !ORDER_KLAAR[o.status] || String(o.at).slice(0, 10) === vandaag).slice(0, 80);
    const RIDE_KLAAR = { 'afgerond': 1, 'gearriveerd': 1, 'geweigerd': 1 };
    const alleRitten = db.data.rides.filter(r => r.supplierCode === s.code && r.status !== 'wacht-op-betaling');
    const klaarAll = alleRitten.filter(r => r.status === 'afgerond' || r.status === 'gearriveerd');
    const zichtRitten = alleRitten.filter(r => !RIDE_KLAAR[r.status] || String(r.finishedAt || r.at).slice(0, 10) === vandaag).slice(0, 80);
    const BOEK_KLAAR = { 'afgerond': 1, 'geweigerd': 1 };
    const alleBoekingen = boekingenVanZaak(s.code).filter(b => b.status !== 'wacht-op-betaling');
    const zichtBoekingen = alleBoekingen.filter(b => !BOEK_KLAAR[b.status] || String(b.finishedAt || b.at).slice(0, 10) === vandaag).slice(0, 80);
    return {
      supplier: { code: s.code, name: s.name, type: s.type, typeLabel: t.label, icon: t.icon, city: s.city, caps: t.caps || [], loc: s.loc, rate: s.rate, vak: s.vak || null },
      activiteiten: s.activiteiten || null,
      transfer: s.type === 'activiteit' ? (s.transfer || { aan: false, prijs: 0 }) : null,
      autos: (s.type === 'verhuur' || s.type === 'tweewielers') ? (s.autos || []) : null,
      boten: s.type === 'charter' ? (s.boten || []) : null,
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
      voorraad: s.voorraad || [],
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
            .map(r => ({ id: r.id, codename: r.codename, score: r.score, tekst: r.tekst, at: r.at, reactie: r.reactie || null }))
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
      lijn: s.lijn || {},
      // wat over is op de pas (vers gefilterd: na twee uur telt het niet meer mee)
      overschot: (s.overschot || []).filter(x => Date.now() - new Date(x.at) < 2 * 3600000),
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

  return { supplierState };
};
