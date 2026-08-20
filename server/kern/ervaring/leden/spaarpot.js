/* Leden-deel "spaarpot" (kern/ervaring/leden): de reisagenda, rekening splitsen,
   RTG-punten en de meldingsvoorkeuren. Verbatim afgesplitst uit leden.js. */
module.exports = (ctx) => {
  const { db, save, notify, sseToCustomer, zijnVrienden, orderMetRef, boekingenVanKlant,
    id, nu, vandaag, rond, MELDING_SCOPES, payVan, codenaamVan } = ctx;

  /* ---- 6. de reisagenda ----
     Alles met een datum van dit lid, samengevoegd en per dag gegroepeerd:
     tafelreserveringen, tickets en boekingen, geplande ritten en events. */
  function agendaVoor(key) {
    const items = [];
    const van = vandaag();
    for (const r of db.data.reserveringen || []) {
      if (r.customerKey !== key || !['aangevraagd', 'bevestigd'].includes(r.status) || r.datum < van) continue;
      items.push({ soort: 'reservering', datum: r.datum, tijd: r.tijd, titel: 'Tafel bij ' + r.supplierName + ' (' + r.personen + 'p)', status: r.status, ref: r.id });
    }
    for (const b of boekingenVanKlant(key)) {
      if (['geweigerd'].includes(b.status) || !b.datum || b.datum < van) continue;
      items.push({ soort: b.kind === 'ticket' ? 'ticket' : 'boeking', datum: b.datum, tijd: b.tijd || '', titel: (b.kind === 'ticket' ? 'Ticket: ' : '') + (b.activiteitNaam || (b.service && b.service.name) || b.supplierName), status: b.status, ref: b.ref });
    }
    for (const r of db.data.rides || []) {
      if ((r.customerKey || r.customerTier) !== key || !r.plannedFor || ['afgerond', 'gearriveerd', 'geweigerd'].includes(r.status)) continue;
      const d = r.plannedFor.slice(0, 10);
      if (d < van) continue;
      items.push({ soort: 'rit', datum: d, tijd: r.plannedFor.slice(11, 16), titel: r.supplierName + ' naar ' + (r.to || 'bestemming'), status: r.status, ref: r.ref });
    }
    for (const s of db.data.suppliers || []) {
      for (const e of s.events || []) {
        if (!e.date || e.date < van) continue;
        const g = (e.guests || []).find(x => x.key === key);
        if (g) items.push({ soort: 'event', datum: e.date, tijd: e.time || '', titel: e.name + ' bij ' + s.name + ' (' + g.qty + 'p)', status: 'gastenlijst', ref: e.id });
      }
    }
    /* De reizen zelf (vluchten, verblijven, reisaanvragen) zijn dezelfde
       projectie op de bron: een annulering filtert zichzelf weg. */
    const lucht = db.data.luchthaven || {};
    for (const b of lucht.boekingen || []) {
      if (b.key !== key || b.status === 'geannuleerd') continue;
      const v = (lucht.vluchten || []).find(x => x.id === b.vluchtId);
      if (!v || v.status === 'geannuleerd' || v.soort !== 'vertrek' || !v.datum || v.datum < van) continue;
      items.push({ soort: 'vlucht', datum: v.datum, tijd: v.tijd || '', titel: 'Vlucht ' + v.nummer + ' naar ' + v.bestemming, status: b.status, ref: b.code });
    }
    for (const v of db.data.verblijven || []) {
      if (v.customerKey !== key || !['aangevraagd', 'bevestigd', 'ingecheckt'].includes(v.status) || !v.aankomst || v.aankomst < van) continue;
      items.push({ soort: 'verblijf', datum: v.aankomst, tijd: '', titel: 'Verblijf: ' + v.roomName + ' bij ' + v.supplierName + ' (' + v.nachten + (v.nachten === 1 ? ' nacht)' : ' nachten)'), status: v.status, ref: v.ref });
    }
    for (const a of db.data.reisAanvragen || []) {
      if (a.customerKey !== key || !['aangevraagd', 'bevestigd'].includes(a.status) || !a.vertrek || a.vertrek < van) continue;
      items.push({ soort: 'reis', datum: a.vertrek, tijd: '', titel: 'Reis: ' + a.titel + ' (' + a.bestemming + ')', status: a.status, ref: a.ref });
    }
    items.sort((a, b) => (a.datum + (a.tijd || '99')).localeCompare(b.datum + (b.tijd || '99')));
    const dagen = [];
    for (const it of items) {
      let dag = dagen[dagen.length - 1];
      if (!dag || dag.datum !== it.datum) { dag = { datum: it.datum, items: [] }; dagen.push(dag); }
      dag.items.push(it);
    }
    return { dagen };
  }

  /* ---- 7. rekening splitsen ----
     De betaler heeft al afgerekend (betalen-eerst) en stuurt betaalverzoeken
     naar verbonden vrienden voor een gelijk deel. Demo-geld, echte flow. */
  function maakSplits(key, codename, ref, metKeys) {
    const o = orderMetRef(ref);
    if (!o || (o.customerKey || o.customerTier) !== key) return { status: 404, error: 'Bestelling niet gevonden.' };
    if (!o.paid && o.status !== 'geserveerd') return { status: 409, error: 'Splitsen kan zodra de rekening betaald is.' };
    if ((db.data.splitsen || []).some(s => s.orderRef === ref)) return { status: 409, error: 'Deze rekening is al gesplitst.' };
    const keys = [...new Set((metKeys || []).map(String))].filter(k => k && k !== key).slice(0, 8);
    if (!keys.length) return { status: 400, error: 'Kies met wie u wilt splitsen.' };
    for (const k of keys) if (!zijnVrienden(key, k)) return { status: 403, error: 'Splitsen kan alleen met verbonden vrienden.' };
    const totaal = rond((o.total || 0) + (o.fooi || 0));
    const perPersoon = rond(totaal / (keys.length + 1));
    const split = {
      id: id(), orderRef: ref, supplierName: o.supplierName, totaal,
      van: key, vanCodenaam: codename,
      delen: keys.map(k => ({ key: k, bedrag: perPersoon, paid: false })),
      at: nu()
    };
    db.data.splitsen.unshift(split);
    db.data.splitsen = db.data.splitsen.slice(0, 20000);
    save();
    for (const k of keys) {
      notify(k, { icon: 'betalen', title: 'Betaalverzoek van ' + codename, body: 'Jouw deel van ' + o.supplierName + ': € ' + perPersoon, scope: 'orders' });
      sseToCustomer(k, 'sync', { scope: 'splitsen' });
    }
    return { ok: true, splits: split };
  }
  function mijnSplitsen(key) {
    return (db.data.splitsen || []).filter(s => s.van === key || s.delen.some(d => d.key === key)).slice(0, 25);
  }
  function betaalSplits(key, sid) {
    const s = (db.data.splitsen || []).find(x => x.id === sid);
    const deel = s && s.delen.find(d => d.key === key);
    if (!deel) return { status: 404, error: 'Betaalverzoek niet gevonden.' };
    if (deel.paid) return { status: 409, error: 'Al betaald.' };
    deel.paid = true;
    deel.paidAt = nu();
    save();
    notify(s.van, { icon: 'pas', title: 'Deel ontvangen', body: 'Uw vriend betaalde € ' + deel.bedrag + ' voor ' + s.supplierName + '.', scope: 'orders' });
    sseToCustomer(s.van, 'sync', { scope: 'splitsen' });
    return { ok: true, bedrag: deel.bedrag, rond: s.delen.every(d => d.paid) };
  }

  /* ---- 9. RTG-punten ----
     Verhuisd naar ./punten.js. Niet om de maat: zodra verzilverde punten een
     bedrag in euro's zijn dat het lid van RTG tegoed heeft, is dat een
     geldstuk met eigen regels (een plafond, centen, een vermogen in de
     bevoegdhedenlijst) en geen bijzaak van de spaarpot. De kop daar legt uit
     wat er is veranderd en waarom. */
  const punten = require('./punten')({ db, save, nu, payVan, codenaamVan });

  /* ---- 10. meldingsvoorkeuren ----
     Per scope aan of uit; afwezig betekent aan. De handhaving zit in notify()
     (server.js): een uitgezette scope wordt niet opgeslagen en niet gepusht. */
  function voorkeurVan(target) {
    const v = (db.data.meldingVoorkeur || {})[target] || {};
    const uit = {};
    for (const s of MELDING_SCOPES) uit[s] = v[s] !== false;
    return uit;
  }
  function zetVoorkeur(target, zet) {
    const v = db.data.meldingVoorkeur[target] = db.data.meldingVoorkeur[target] || {};
    for (const [s, aan] of Object.entries(zet || {})) {
      if (MELDING_SCOPES.includes(s)) v[s] = aan !== false && aan !== 'false' && aan !== 0;
    }
    save();
    return voorkeurVan(target);
  }

  return Object.assign({ agendaVoor, maakSplits, mijnSplitsen, betaalSplits,
    voorkeurVan, zetVoorkeur }, punten);
};
