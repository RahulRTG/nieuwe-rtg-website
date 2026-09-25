/* De backoffice-laag, deelbestand "metrics": de zware berekeningen achter het
   live-overzicht. De weektrend en dagcijfers (omzet, foundation-afdracht, munt-
   ontvangsten), de partnerprestaties (schaalvast: EEN keer optellen per code) en het
   actiecentrum (alle alerts die nu een oog van RTG nodig hebben, belangrijkste eerst).
   Krijgt de gedeelde ctx van kern/kantoor/index.js. */
module.exports = (ctx) => {
  const { db, accounts, conciergeInbox, beveilig } = ctx;
  const dagVan = iso => String(iso || '').slice(0, 10);

  // de weektrend en de dagcijfers: ./metrics-week.js
  const { weekEnStats } = require('./metrics-week')({ invoices: () => db.data.invoices,
    fondsAfdrachten: () => db.data.fondsAfdrachten, muntOntvangsten: () => db.data.muntOntvangsten });

  /* Partnerprestaties: NIET per zaak over alle orders filteren (dat is
     O(zaken x orders) en loopt met miljoenen restaurants volledig vast).
     In plaats daarvan tellen we de orders/ritten EEN keer op per code. */
  function prestaties(betaaldeOrders, betaaldeRitten) {
    const perCode = new Map();
    const aggCode = (code, naam, type) => { let a = perCode.get(code); if (!a) { a = { naam: naam || code, type: type || '', omzet: 0, aantal: 0, openNu: 0, dur: 0, durN: 0 }; perCode.set(code, a); } return a; };
    for (const o of betaaldeOrders) { const a = aggCode(o.supplierCode, o.supplierName, o.type); a.omzet += (o.total || 0); a.aantal += 1; }
    for (const r of betaaldeRitten) { const a = aggCode(r.supplierCode, r.supplierName, r.type); a.omzet += (r.quote || 0); a.aantal += 1; if (r.finishedAt) { a.dur += (new Date(r.finishedAt) - new Date(r.at)) / 60000; a.durN += 1; } }
    for (const o of db.data.orders) if (o.paid && (o.status === 'nieuw' || o.status === 'in bereiding')) aggCode(o.supplierCode, o.supplierName, o.type).openNu += 1;
    for (const r of db.data.rides) if (r.paid && !['afgerond', 'gearriveerd', 'geweigerd', 'wacht-op-betaling'].includes(r.status)) aggCode(r.supplierCode, r.supplierName, r.type).openNu += 1;
    return [...perCode.entries()].map(([code, a]) => ({ code, name: a.naam, type: a.type, omzet: a.omzet, aantal: a.aantal, openNu: a.openNu,
      gemMin: a.durN ? Math.round(a.dur / a.durN) : null })).sort((a, b) => b.omzet - a.omzet);
  }

  // actiecentrum: alles wat nu een oog van RTG nodig heeft, belangrijkste eerst
  function actiecentrum(applications, nu) {
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
    return { alerts, wachtScholen };
  }

  return { weekEnStats, prestaties, actiecentrum };
};
