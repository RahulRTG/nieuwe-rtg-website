/* De backoffice-laag (RTG-kantoor): toegang (officeAuth), het complete
   live-overzicht met dagcijfers, weektrend, partnerprestaties en het
   actiecentrum (officeState), en de wachtrij van identiteitsverificaties
   (pendingVerifications). Alle functies dragen state en komen uit
   maakKantoor(state), zodat server.js dun blijft.

   Schaalvast: partnerprestaties tellen orders/ritten EEN keer op per code
   (O(orders + ritten)) i.p.v. per zaak over alles te filteren, en elke lijst
   in de uitkomst is begrensd; de echte totalen staan apart in totals. */

function maakKantoor({ db, sessionFor, eigenaar, accounts, findSupplier, connectedSupplierCodes, publicSupplier, conciergeInbox, beveilig, archief, grootAantal, ledenAantal }) {
  function officeAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const sess = token && sessionFor(token);
    if (sess && sess.role === 'office') return next();
    // de eigenaar komt ook met zijn eigen accountlogin binnen (geen aparte code nodig)
    try { if (token && eigenaar.isEigenaar(accounts, accounts.verifyToken(token))) { req.eigenaar = true; return next(); } } catch (e) {}
    return res.status(401).json({ error: 'Geen backoffice-sessie.' });
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
    const dagVan = iso => String(iso || '').slice(0, 10);
    const betaaldeOrders = db.data.orders.filter(o => o.paid && o.status !== 'geweigerd' && o.status !== 'terugbetaald');
    const betaaldeRitten = db.data.rides.filter(r => r.paid && r.status !== 'geweigerd');
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(nu - i * 86400000).toISOString().slice(0, 10);
      const dagOrders = betaaldeOrders.filter(o => dagVan(o.paidAt || o.at) === d);
      const dagRitten = betaaldeRitten.filter(r => dagVan(r.paidAt || r.at) === d);
      week.push({
        date: d,
        label: new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short' }),
        omzet: dagOrders.reduce((s2, o) => s2 + (o.total || 0), 0) + dagRitten.reduce((s2, r) => s2 + (r.quote || 0), 0),
        aantal: dagOrders.length + dagRitten.length
      });
    }
    // De RTFoundation krijgt 30% van de abonnementsbijdragen (ex btw); RTG
    // verdient niets aan boekingen, dus die tellen hier niet mee.
    const fonds = db.data.invoices
      .filter(i => (i.status === 'paid' || i.status === 'betaald') && /lidmaatschap|jaarbijdrage|maandbijdrage/i.test(i.desc || ''))
      .reduce((s2, i) => s2 + Math.round((i.bijdrage || 0) / 1.21 * 0.3), 0);
    // Het echte afdracht-grootboek (kern/fonds.js boekt hier per betaling): wat is
    // al gereserveerd, en staat het klaar om uit te betalen of wacht het nog op
    // het IBAN? Bedragen in centen -> euro's.
    const afdrachten = Array.isArray(db.data.fondsAfdrachten) ? db.data.fondsAfdrachten : [];
    let afTotaal = 0, afTeStorten = 0, afIngepland = 0, afGestort = 0;
    for (const a of afdrachten) {
      const c = a.centen || 0;
      afTotaal += c;
      if (a.status === 'gestort') afGestort += c;
      else if (a.status === 'ingepland') afIngepland += c;
      else afTeStorten += c;
    }
    const fondsAfdracht = {
      aantal: afdrachten.length,
      totaal: Math.round(afTotaal) / 100,
      teStorten: Math.round(afTeStorten) / 100,
      ingepland: Math.round(afIngepland) / 100,
      gestort: Math.round(afGestort) / 100,
      iban: (process.env.RTF_IBAN || '').trim(),
      begunstigde: (process.env.RTF_BEGUNSTIGDE || 'Stichting RTFoundation').trim()
    };
    const stats = {
      omzetVandaag: week[6].omzet, aantalVandaag: week[6].aantal,
      omzetWeek: week.reduce((s2, d) => s2 + d.omzet, 0),
      foundation: fonds, fondsAfdracht, liveNu: live.length
    };
    /* Partnerprestaties: NIET per zaak over alle orders filteren (dat is
       O(zaken x orders) en loopt met miljoenen restaurants volledig vast).
       In plaats daarvan tellen we de orders/ritten EEN keer op per code, en
       bouwen we alleen prestaties voor zaken die vandaag/deze week echt iets
       deden. O(orders + ritten + actieve zaken). */
    const perCode = new Map();
    // naam/type uit het order/rit-record zelf halen (die staan erop), zodat we
    // NIET per code findSupplier hoeven te doen: bij miljoenen bulk-zaken zou dat
    // het grootboek overspoelen met losse queries.
    const aggCode = (code, naam, type) => { let a = perCode.get(code); if (!a) { a = { naam: naam || code, type: type || '', omzet: 0, aantal: 0, openNu: 0, dur: 0, durN: 0 }; perCode.set(code, a); } return a; };
    for (const o of betaaldeOrders) { const a = aggCode(o.supplierCode, o.supplierName, o.type); a.omzet += (o.total || 0); a.aantal += 1; }
    for (const r of betaaldeRitten) { const a = aggCode(r.supplierCode, r.supplierName, r.type); a.omzet += (r.quote || 0); a.aantal += 1; if (r.finishedAt) { a.dur += (new Date(r.finishedAt) - new Date(r.at)) / 60000; a.durN += 1; } }
    for (const o of db.data.orders) if (o.paid && (o.status === 'nieuw' || o.status === 'in bereiding')) aggCode(o.supplierCode, o.supplierName, o.type).openNu += 1;
    for (const r of db.data.rides) if (r.paid && !['afgerond', 'gearriveerd', 'geweigerd', 'wacht-op-betaling'].includes(r.status)) aggCode(r.supplierCode, r.supplierName, r.type).openNu += 1;
    const performance = [...perCode.entries()].map(([code, a]) => ({ code, name: a.naam, type: a.type, omzet: a.omzet, aantal: a.aantal, openNu: a.openNu,
      gemMin: a.durN ? Math.round(a.dur / a.durN) : null })).sort((a, b) => b.omzet - a.omzet);
    // actiecentrum: alles wat nu een oog van RTG nodig heeft, belangrijkste eerst
    const alerts = [];
    // open SOS van huurders: altijd rood en bovenaan, tot de zaak hem afhandelt
    for (const h of db.data.boekingen) {
      if (h.kind !== 'huur' || !Array.isArray(h.sos)) continue;
      for (const sos of h.sos) {
        if (sos.ok) continue;
        alerts.push({ level: 'rood', kind: 'sos', ref: h.ref, supplierCode: h.supplierCode,
          text: 'SOS van ' + h.customerCodename + ' (' + h.supplierName + ', ' + (h.autoNaam || 'huurauto') + '): ' +
            String(sos.bericht || 'noodsignaal').slice(0, 120) +
            (Number.isFinite(sos.lat) ? ' · locatie bekend' : '') });
      }
    }
    const minGeleden = iso => Math.round((nu - new Date(iso)) / 60000);
    for (const o of db.data.orders) {
      if (!o.paid || o.status !== 'nieuw') continue;
      const m = minGeleden(o.paidAt || o.at);
      if (m >= 10) alerts.push({ level: 'rood', kind: 'order', ref: o.ref, supplierCode: o.supplierCode, nudgedAt: o.nudgedAt || null,
        text: 'Bestelling ' + o.ref + ' bij ' + o.supplierName + ' staat al ' + m + ' min onaangeroerd (gast ' + o.customerCodename + ').' });
    }
    for (const r of db.data.rides) {
      if (!r.paid || r.status !== 'aangevraagd' || r.driver) continue;
      const straks = r.plannedFor && (new Date(r.plannedFor) - nu) > 45 * 60000;
      const m = minGeleden(r.paidAt || r.at);
      if (!straks && m >= 10) alerts.push({ level: 'rood', kind: 'ride', ref: r.ref, supplierCode: r.supplierCode, nudgedAt: r.nudgedAt || null,
        text: 'Rit ' + r.ref + ' bij ' + r.supplierName + ' wacht al ' + m + ' min op een chauffeur (gast ' + r.customerCodename + ').' });
      else if (straks && (new Date(r.plannedFor) - nu) < 24 * 3600000) alerts.push({ level: 'amber', kind: 'ride', ref: r.ref, supplierCode: r.supplierCode, nudgedAt: r.nudgedAt || null,
        text: 'Geplande rit ' + r.ref + ' (' + String(r.plannedFor).slice(0, 16).replace('T', ' ') + ') bij ' + r.supplierName + ' heeft nog geen chauffeur.' });
    }
    const verif = accounts.listByVerification('pending').length;
    if (verif) alerts.push({ level: 'amber', kind: 'verify', text: verif + ' identiteitsverificatie(s) wachten op beoordeling.' });
    const wachtend = conciergeInbox().filter(c => c.needsConcierge).length;
    if (wachtend) alerts.push({ level: 'amber', kind: 'concierge', text: wachtend + ' lid/leden wachten op een antwoord van de concierge.' });
    const trustOpen = (db.data.trustLine || []).filter(t => t.open).length;
    if (trustOpen) alerts.push({ level: 'amber', kind: 'trust', text: trustOpen + ' bericht(en) op de vertrouwenslijn wachten op de vertrouwenspersoon.' });
    const nieuwePartners = (db.data.partnerApplications || []).filter(p => p.status === 'nieuw').length;
    if (nieuwePartners) alerts.push({ level: 'info', kind: 'partner', text: nieuwePartners + ' nieuwe partner-aanvraag/aanvragen om te beoordelen.' });
    const wachtScholen = Object.values(((db.data.foundation || {}).scholen) || {}).filter(s => (s.status || 'actief') === 'wacht');
    if (wachtScholen.length) alerts.push({ level: 'info', kind: 'school', text: wachtScholen.length + ' schoolaanmelding(en) voor RTF School om te beoordelen.' });
    const openFuncties = ((db.data.techniek || {}).functieVerzoeken || []).filter(v => v.status === 'wacht').length;
    if (openFuncties) alerts.push({ level: 'amber', kind: 'functie',
      text: openFuncties + ' functieaanvraag/-aanvragen wachten op bevestiging van de eigenaar. Accepteren of weigeren kan alleen op de technische pagina.' });
    const kritiekeBeveiliging = beveilig.openKritiek();
    if (kritiekeBeveiliging) alerts.push({ level: 'rood', kind: 'beveiliging',
      text: kritiekeBeveiliging + ' kritieke beveiligingsmelding(en). Bekijk ze op de technische pagina onder Beveiliging.' });
    const nieuweSollicitaties = applications.filter(a => a.status === 'nieuw').length;
    if (nieuweSollicitaties) alerts.push({ level: 'info', kind: 'apps', text: nieuweSollicitaties + ' open sollicitatie(s) bij partners.' });
    const volgorde = { rood: 0, amber: 1, info: 2 };
    alerts.sort((a, b) => volgorde[a.level] - volgorde[b.level]);
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
        // levend plus archief: het totaal blijft eerlijk, hoe oud tickets ook worden
        orders: db.data.orders.filter(o => o.status !== 'wacht-op-betaling').length + archief.stat().aantal,
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

  return { officeAuth, officeState, pendingVerifications };
}

module.exports = { maakKantoor };
