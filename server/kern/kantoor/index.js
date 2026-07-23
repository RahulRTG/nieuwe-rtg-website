/* De backoffice-laag (RTG-kantoor): toegang (officeAuth), het complete
   live-overzicht met dagcijfers, weektrend, partnerprestaties en het
   actiecentrum (officeState), en de wachtrij van identiteitsverificaties
   (pendingVerifications). Alle functies dragen state en komen uit
   maakKantoor(state), zodat server.js dun blijft.

   Schaalvast: partnerprestaties tellen orders/ritten EEN keer op per code
   (O(orders + ritten)) i.p.v. per zaak over alles te filteren, en elke lijst
   in de uitkomst is begrensd; de echte totalen staan apart in totals. Dit is
   de orkestrator: de toegang, het live-beeld en de totalen wonen hier; de
   zware berekeningen (weektrend/prestaties/actiecentrum) in ./metrics. */

const { txLedgerAantal } = require('../../db'); // gecachete grootboek-teller (O(1), ~10 s vers)

function maakKantoor({ db, sessionFor, eigenaar, accounts, findSupplier, connectedSupplierCodes, publicSupplier, conciergeInbox, beveilig, archief, grootAantal, ledenAantal }) {
  const metrics = require('./metrics')({ db, accounts, conciergeInbox, beveilig });

  function officeAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const sess = token && sessionFor(token);
    if (sess && sess.role === 'office') return next();
    // de eigenaar komt ook met zijn eigen accountlogin binnen (geen aparte code nodig)
    try { if (token && eigenaar.isEigenaar(accounts, accounts.verifyToken(token))) { req.eigenaar = true; return next(); } } catch (e) {}
    return res.status(401).json({ error: 'Geen backoffice-sessie.' });
  }

  /* ---- de boardroom-poort: de kamer van de eigenaar ----
     De boardroom is van de eigenaar (Rahul Imran Ismail) alleen; hij kan
     anderen toegang geven en die ook weer intrekken. Toegang vraagt dus een
     IDENTITEIT: het eigen RTG-account (direct, of als kantoor-rol via het
     ene account). Een anonieme backoffice-code heeft geen identiteit en
     komt er daarom nooit in; de rest van het kantoor blijft gewoon open. */
  function boardroomLijst() {
    if (!Array.isArray(db.data.boardroomToegang)) db.data.boardroomToegang = [];
    return db.data.boardroomToegang;
  }
  function boardroomWie(req) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return null;
    const sess = sessionFor(token);
    if (sess && sess.role === 'office') return sess.lidKey || null;
    try { const u = accounts.verifyToken(token); if (u) return 'user-' + u.id; } catch (e) {}
    return null;
  }
  function boardroomBaas(key) {
    if (!key || !String(key).startsWith('user-')) return false;
    const u = accounts.getUserById(Number(String(key).slice(5)));
    return eigenaar.isEigenaar(accounts, u);
  }
  function magBoardroom(key) {
    return boardroomBaas(key) || (!!key && boardroomLijst().some(t => t.key === key));
  }
  function boardroomAuth(req, res, next) {
    officeAuth(req, res, () => {
      const key = boardroomWie(req);
      if (!magBoardroom(key)) {
        return res.status(403).json({ error: 'De boardroom is gesloten: alleen de eigenaar komt binnen, of wie van hem toegang heeft gekregen. Log in met het eigen RTG-account.' });
      }
      req.boardroomKey = key;
      req.boardroomBaas = boardroomBaas(key);
      next();
    });
  }

  function officeState() {
    // live overzicht: welke leden zijn nu onderweg, waarheen en met welke partners
    const live = Object.keys(db.data.live || {}).map(key => {
      const L = db.data.live[key];
      if (!L || !L.active) return null;
      const dest = L.destCode ? findSupplier(L.destCode) : null;
      return {
        codename: L.codename, tier: L.tier, mode: L.mode, arrived: !!L.arrived,
        dest: dest ? { code: dest.code, name: dest.name } : null,
        partners: connectedSupplierCodes(key).map(c => { const s = findSupplier(c); return s ? s.name : c; }),
        updatedAt: L.updatedAt
      };
    }).filter(Boolean);
    const applications = [];
    for (const [code, list] of Object.entries(db.data.applications || {})) {
      const sup = findSupplier(code);
      for (const a of list) applications.push({ company: sup ? sup.name : code, name: a.name, func: a.func, status: a.status, viaRTG: !!a.viaRTG, at: a.at });
    }
    applications.sort((x, y) => (y.at || '').localeCompare(x.at || ''));
    // slimme laag: dagcijfers, weektrend, partnerprestaties en een actiecentrum
    const nu = Date.now();
    const betaaldeOrders = db.data.orders.filter(o => o.paid && o.status !== 'geweigerd' && o.status !== 'terugbetaald');
    const betaaldeRitten = db.data.rides.filter(r => r.paid && r.status !== 'geweigerd');
    const { week, stats } = metrics.weekEnStats(betaaldeOrders, betaaldeRitten, live, nu);
    const performance = metrics.prestaties(betaaldeOrders, betaaldeRitten);
    const { alerts, wachtScholen } = metrics.actiecentrum(applications, nu);
    return {
      prices: db.data.supplierPrices.slice(0, 60),
      orders: db.data.orders.filter(o => o.status !== 'wacht-op-betaling').slice(0, 60),
      rides: db.data.rides.filter(r => r.status !== 'wacht-op-betaling').slice(0, 60),
      live: live.slice(0, 40),
      applications: applications.slice(0, 40),
      // de zaken-lijst is begrensd (het echte aantal staat in totals.partners);
      // een rauwe dump van miljoenen zaken zou het antwoord onbruikbaar maken
      suppliers: db.data.suppliers.slice(0, 1000).map(publicSupplier),
      partnerApplications: (db.data.partnerApplications || []).slice(0, 40),
      pendingSchools: wachtScholen.map(s => ({ code: s.code, naam: s.naam, plaats: s.plaats, at: s.at,
        personeel: Object.keys(s.personeel || {}).length })).slice(0, 40),
      stats, week, performance: performance.slice(0, 12), alerts: alerts.slice(0, 20),
      // totalen over de volledige data, zodat de schermen eerlijk blijven
      // vertellen hoeveel er echt is, hoe groot de lijsten ook worden
      totals: {
        // Levend plus archief: het totaal blijft eerlijk, hoe oud tickets ook
        // worden. Met een actief transactie-grootboek (Postgres) kan het RAM
        // een VENSTER zijn; dan is de grootboek-teller de ondergrens die ook
        // de uit het venster gerolde tickets meetelt.
        orders: Math.max(txLedgerAantal('orders'),
          db.data.orders.filter(o => o.status !== 'wacht-op-betaling').length + archief.stat().aantal),
        rides: db.data.rides.filter(r => r.status !== 'wacht-op-betaling').length,
        leden: ledenAantal(),
        // actieve zaken in het geheugen plus de bulk-zaken in het grootboek (Postgres)
        partners: db.data.suppliers.length + (grootAantal ? grootAantal() : 0),
        live: live.length
      }
    };
  }

  /* Backoffice: identiteitsverificaties beoordelen. */
  function pendingVerifications() {
    // De backoffice mag voor de KYC-controle de echte naam/e-mail uit de kluis zien.
    return accounts.listByVerification('pending').map(u => ({
      id: u.id, name: accounts.realNameOf(u), email: accounts.emailOf(u), codename: u.codename,
      tier: u.tier, doc: u.id_doc, at: u.created_at
    }));
  }

  return { officeAuth, boardroomAuth, boardroomLijst, boardroomBaas, boardroomWie, magBoardroom, officeState, pendingVerifications };
}

module.exports = { maakKantoor };
