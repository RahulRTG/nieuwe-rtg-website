/* Supplier (deelmodule): de backoffice: het slimme overzicht van de zaak
   (dagcijfers, weektrend, toppers, actiecentrum en briefing). Krijgt de
   gedeelde kern een keer bij het opstarten vanuit routes/supplier.js. */
module.exports = (kern) => {
  const { app, db, supplierAuth, ordersVanZaak, boekingenVanZaak } = kern;
  // welke kassabon omzet draagt: EEN plek, zie kern/fiscaal/kasomzet.js
  const kasomzet = require('../../kern/fiscaal/kasomzet');
  /* zaakcommand OP AANROEPMOMENT uit de kern, en niet hierboven uit de
     destructurering. Deze router wordt opgehangen vóórdat opzet/aanbouw.js de
     zaak-commandolaag aan de kern hangt; wie hem hier vastpakt, pakt undefined
     en krijgt een 500 op het moment dat een echte zaak zijn backoffice opent.
     Dezelfde late binding die routes/supplier/genrepuls.js met zijn motoren
     doet, en om precies dezelfde reden. */


app.post('/api/supplier/backoffice', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const s = req.supplier;
  const en = req.body.lang === 'en';
  const nu = Date.now();
  const dag = iso => String(iso || '').slice(0, 10);
  const vandaag = new Date().toISOString().slice(0, 10);
  // Niet elke betaalde boeking heeft een genest service-object: ticket-/verblijf-
  // boekingen (en direct gezaaide rijen) dragen alleen een `kind`. Nooit blind
  // b.service.name lezen -- dat liet de hele backoffice crashen (500) op zulke rijen.
  const boekNaam = b => (b && b.service && b.service.name) || (b && b.kind) || 'Boeking';
  const orders = ordersVanZaak(s.code).filter(o => o.paid && o.status !== 'geweigerd' && o.status !== 'terugbetaald');
  const ritten = db.data.rides.filter(r => r.supplierCode === s.code && r.paid && r.status !== 'geweigerd');
  const boekingen = boekingenVanZaak(s.code).filter(b => b.paid && b.status !== 'geweigerd');
  /* kassaverkopen zonder dubbeltellingen. WELKE bon dat is staat in
     kern/fiscaal/kasomzet.js en niet hier: deze filter miste 'tafel' en het
     merk van een gebundelde bon, en telde de weekomzet daardoor te hoog --
     dezelfde drift als in de maandboekhouding (TAKEN.md 4.28). */
  const kassa = (db.data.posSales[s.code] || []).filter(kasomzet.btwOmzet);
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(nu - i * 86400000).toISOString().slice(0, 10);
    week.push({
      date: d,
      label: new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short' }),
      omzet: orders.filter(o => dag(o.paidAt || o.at) === d).reduce((x, o) => x + (o.total || 0), 0)
        + ritten.filter(r => dag(r.paidAt || r.at) === d).reduce((x, r) => x + (r.quote || 0), 0)
        + boekingen.filter(b => dag(b.paidAt || b.at) === d).reduce((x, b) => x + (b.price || 0), 0)
        + kassa.filter(v => dag(v.at) === d).reduce((x, v) => x + (v.total || 0), 0),
      aantal: orders.filter(o => dag(o.paidAt || o.at) === d).length
        + ritten.filter(r => dag(r.paidAt || r.at) === d).length
        + boekingen.filter(b => dag(b.paidAt || b.at) === d).length
        + kassa.filter(v => dag(v.at) === d).length
    });
  }
  // toppers: wat verkoopt het best, app, kassa en boekingen samen
  const teller = {};
  const telItems = lijst => { for (const it of (lijst || [])) { if (!it.name) continue; const t = teller[it.name] = teller[it.name] || { naam: it.name, aantal: 0, omzet: 0 }; t.aantal += it.qty || 1; t.omzet += (it.price || 0) * (it.qty || 1); } };
  for (const o of orders) telItems(o.items);
  for (const v of kassa) telItems(v.items);
  for (const b of boekingen) { const bn = boekNaam(b); const t2 = teller[bn] = teller[bn] || { naam: bn, aantal: 0, omzet: 0 }; t2.aantal += 1; t2.omzet += b.price || 0; }
  const toppers = Object.values(teller).sort((a, b) => b.omzet - a.omzet).slice(0, 8);
  /* HET ACTIECENTRUM KOMT UIT EEN GEDEELDE BRON, en stond hier tot vandaag met
     de hand geschreven. Dat werkte prima zolang dit het enige scherm was dat
     het toonde. Zodra de commandolaag van de zaak erbij kwam, zouden er twee
     bijna-gelijke lijsten zijn -- en die lopen uiteen, niet misschien maar
     zeker (LAT.md regel 4). Nu staat hij één keer, in kern/zaakcommand/signalen.js,
     en leest dit scherm hem net zo goed als de assistent.

     De vorm van het antwoord verandert niet: nog steeds { level, text } in de
     taal van het scherm. */
  const alerts = kern.zaakcommand.voor(s, { leiding: true }).signalen.alerts(s, en, { leiding: true });
  const kassaVandaag = kassa.filter(v => dag(v.at) === vandaag).reduce((x, v) => x + (v.total || 0), 0);
  const stats = {
    omzetVandaag: week[6].omzet,
    transactiesVandaag: week[6].aantal,
    kassaVandaag,
    omzetWeek: week.reduce((x, d2) => x + d2.omzet, 0),
    binnenNu: [...new Set((db.data.klok[s.code] || []).filter(e => e.in.slice(0, 10) === vandaag && !e.out).map(e => e.name))].length,
    openActies: alerts.length
  };
  // dagbriefing in gewone taal, altijd uit de echte cijfers
  const eurF = n => '€ ' + Number(n).toLocaleString(en ? 'en-US' : 'nl-NL');
  const zin = [];
  zin.push(en
    ? 'Today ' + s.name + ' processed ' + stats.transactiesVandaag + ' transaction(s) for ' + eurF(stats.omzetVandaag) + ' (of which ' + eurF(kassaVandaag) + ' at the register); this week stands at ' + eurF(stats.omzetWeek) + '.'
    : 'Vandaag verwerkte ' + s.name + ' ' + stats.transactiesVandaag + ' transactie(s), goed voor ' + eurF(stats.omzetVandaag) + ' (waarvan ' + eurF(kassaVandaag) + ' via de kassa); de week staat op ' + eurF(stats.omzetWeek) + '.');
  if (toppers[0]) zin.push(en
    ? 'Best seller: ' + toppers[0].naam + ' (' + toppers[0].aantal + 'x, ' + eurF(toppers[0].omzet) + ').'
    : 'Topper: ' + toppers[0].naam + ' (' + toppers[0].aantal + 'x, ' + eurF(toppers[0].omzet) + ').');
  zin.push(stats.binnenNu
    ? (en ? stats.binnenNu + ' colleague(s) are clocked in right now.' : stats.binnenNu + ' collega(s) zijn nu ingeklokt.')
    : (en ? 'Nobody is clocked in right now.' : 'Er is nu niemand ingeklokt.'));
  const rood = alerts.filter(a => a.level === 'rood').length;
  zin.push(rood
    ? (en ? rood + ' item(s) are stuck; see the action list.' : rood + ' zaak/zaken lopen vast; zie de actielijst.')
    : alerts.length
      ? (en ? 'Nothing is stuck; ' + alerts.length + ' routine item(s) remain.' : 'Niets loopt vast; nog ' + alerts.length + ' routinepunt(en).')
      : (en ? 'Everything is running smoothly.' : 'Alles loopt.'));
  zin.push(en ? 'RTG charges 0% commission: this revenue is fully yours.' : 'RTG rekent 0% commissie: deze omzet is volledig van u.');
  res.json({ stats, week, toppers, alerts: alerts.slice(0, 12), briefing: zin.join(' ') });
});


};
