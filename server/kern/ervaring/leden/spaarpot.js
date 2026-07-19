/* Leden-deel "spaarpot" (kern/ervaring/leden): de reisagenda, rekening splitsen,
   RTG-punten en de meldingsvoorkeuren. Verbatim afgesplitst uit leden.js. */
module.exports = (ctx) => {
  const { db, save, notify, sseToCustomer, zijnVrienden, orderMetRef, boekingenVanKlant,
    id, nu, vandaag, rond, MELDING_SCOPES } = ctx;

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
      notify(k, { icon: '💶', title: 'Betaalverzoek van ' + codename, body: 'Jouw deel van ' + o.supplierName + ': € ' + perPersoon, scope: 'orders' });
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
    notify(s.van, { icon: '✅', title: 'Deel ontvangen', body: 'Uw vriend betaalde € ' + deel.bedrag + ' voor ' + s.supplierName + '.', scope: 'orders' });
    sseToCustomer(s.van, 'sync', { scope: 'splitsen' });
    return { ok: true, bedrag: deel.bedrag, rond: s.delen.every(d => d.paid) };
  }

  /* ---- 9. RTG-punten ----
     Sparen: 1 punt per betaalde 10 euro. Verzilveren: 100 punten = 10 euro
     tegoed. Het tegoed wordt bij de volgende betaling automatisch verrekend;
     RTG legt het verschil bij, de zaak ontvangt altijd het volle bedrag. */
  function puntenRek(key) { return db.data.punten[key] = db.data.punten[key] || { saldo: 0, tegoed: 0, historie: [] }; }
  function puntenVan(key) {
    const p = puntenRek(key);
    return { saldo: p.saldo, tegoed: p.tegoed, historie: p.historie.slice(0, 20) };
  }
  function verdienPunten(key, euro, reden) {
    const n = Math.floor((Number(euro) || 0) / 10);
    if (n <= 0) return 0;
    const p = puntenRek(key);
    p.saldo += n;
    p.historie.unshift({ punten: n, reden: String(reden || 'betaling').slice(0, 60), at: nu() });
    p.historie = p.historie.slice(0, 60);
    return n; // save() gebeurt in de betaal-handler
  }
  function verzilverPunten(key, aantal) {
    const n = parseInt(aantal, 10);
    if (!(n >= 100) || n % 100 !== 0) return { status: 400, error: 'Verzilveren kan per 100 punten (= € 10 tegoed).' };
    const p = puntenRek(key);
    if (p.saldo < n) return { status: 409, error: 'U heeft ' + p.saldo + ' punten; dat is niet genoeg.' };
    const euro = (n / 100) * 10;
    p.saldo -= n;
    p.tegoed = rond(p.tegoed + euro);
    p.historie.unshift({ punten: -n, reden: 'verzilverd naar € ' + euro + ' tegoed', at: nu() });
    save();
    return { ok: true, saldo: p.saldo, tegoed: p.tegoed };
  }
  // bij het betalen: verreken tegoed (RTG legt bij; de zaak ziet het volle bedrag)
  function pasTegoedToe(key, totaal) {
    const p = db.data.punten[key];
    if (!p || !(p.tegoed > 0)) return 0;
    const korting = rond(Math.min(p.tegoed, totaal));
    p.tegoed = rond(p.tegoed - korting);
    p.historie.unshift({ punten: 0, reden: '€ ' + korting + ' tegoed verrekend', at: nu() });
    return korting; // save() gebeurt in de betaal-handler
  }

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

  return { agendaVoor, maakSplits, mijnSplitsen, betaalSplits,
    puntenVan, verdienPunten, verzilverPunten, pasTegoedToe, voorkeurVan, zetVoorkeur };
};
