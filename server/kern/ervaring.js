/* De ervaring-laag: alles wat de reis van het lid rond de bestelling heen
   compleet maakt. Tien functies in een module, met hetzelfde maak...(state)-
   patroon als de rest van de kern:

   1. tafelreserveringen (lid vraagt aan, de zaak beslist)
   2. annuleren door het lid (order/rit/boeking, met nette terugbetaalregels)
   3. reviews (1-5 sterren na een afgeronde dienst; O(1)-gemiddelde via stats)
   4. favorieten (mijn adressen per lid)
   5. fooi (bij het betalen; gaat naar het team, telt mee in het Z-rapport)
   6. de reisagenda (alles met een datum samengevoegd tot een dagprogramma)
   7. rekening splitsen (betaalverzoeken naar verbonden vrienden)
   8. wachtlijst (vol event of tijdslot; automatisch bericht bij een vrije plek)
   9. RTG-punten (sparen bij elke betaling; verzilveren naar tegoed dat RTG
      bijlegt, de zaak ontvangt altijd het volle bedrag)
  10. meldingsvoorkeuren (per scope aan of uit; afgedwongen in notify) */

const MELDING_SCOPES = ['orders', 'events', 'salon', 'live', 'apply', 'wachtlijst'];

function maakErvaring({ db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, zijnVrienden, ticketsVoorSlot, optieAan }) {
  const id = () => crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const rond = n => Math.round(n * 100) / 100;

  /* ---- 1. tafelreserveringen ---- */
  function reserveerTafel(sess, codename, body) {
    const s = findSupplier(body.supplierCode);
    if (!s) return { status: 404, error: 'Partner niet gevonden.' };
    if (!(s.tables || []).length) return { status: 409, error: s.name + ' werkt niet met tafelreserveringen.' };
    if (s.settings && s.settings.reservationsOpen === false) return { status: 409, error: s.name + ' neemt op dit moment geen reserveringen aan.' };
    const datum = String(body.datum || '');
    const tijd = String(body.tijd || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < vandaag()) return { status: 400, error: 'Kies een datum vanaf vandaag.' };
    if (!/^\d{2}:\d{2}$/.test(tijd)) return { status: 400, error: 'Kies een tijd (bijv. 20:00).' };
    const personen = Math.min(20, Math.max(1, parseInt(body.personen, 10) || 2));
    // dubbele aanvraag voor hetzelfde moment tegenhouden
    if ((db.data.reserveringen || []).some(r => r.customerKey === sess.key && r.supplierCode === s.code &&
      r.datum === datum && r.tijd === tijd && ['aangevraagd', 'bevestigd'].includes(r.status)))
      return { status: 409, error: 'U heeft hier al een reservering voor dit moment.' };
    const r = {
      id: id(), supplierCode: s.code, supplierName: s.name,
      customerKey: sess.key, customerCodename: codename, tier: sess.tier,
      datum, tijd, personen, notitie: String(body.notitie || '').slice(0, 140),
      status: 'aangevraagd', at: nu()
    };
    db.data.reserveringen.unshift(r);
    db.data.reserveringen = db.data.reserveringen.slice(0, 20000);
    save();
    notifySupplier(s.code, { icon: '🪑', title: 'Nieuwe reservering', body: codename + ': ' + datum + ' ' + tijd + ', ' + personen + 'p' + (r.notitie ? ' · ' + r.notitie : '') });
    sseToSupplier(s.code, 'sync', { scope: 'reserveringen' });
    sseToOffice('sync', { scope: 'orders' });
    return { ok: true, reservering: r };
  }
  function mijnReserveringen(key) {
    return (db.data.reserveringen || []).filter(r => r.customerKey === key).slice(0, 25);
  }
  function annuleerReservering(key, rid) {
    const r = (db.data.reserveringen || []).find(x => x.id === rid && x.customerKey === key);
    if (!r) return { status: 404, error: 'Reservering niet gevonden.' };
    if (!['aangevraagd', 'bevestigd'].includes(r.status)) return { status: 409, error: 'Deze reservering is al ' + r.status + '.' };
    r.status = 'geannuleerd';
    save();
    notifySupplier(r.supplierCode, { icon: '🪑', title: 'Reservering geannuleerd', body: r.customerCodename + ': ' + r.datum + ' ' + r.tijd + ', ' + r.personen + 'p' });
    sseToSupplier(r.supplierCode, 'sync', { scope: 'reserveringen' });
    return { ok: true, reservering: r };
  }
  // de zaak beslist (elke medewerker, op eigen naam)
  function beslisReservering(supplier, rid, action) {
    const r = (db.data.reserveringen || []).find(x => x.id === rid && x.supplierCode === supplier.code);
    if (!r) return { status: 404, error: 'Reservering niet gevonden.' };
    if (r.status !== 'aangevraagd') return { status: 409, error: 'Deze reservering is al ' + r.status + '.' };
    r.status = action === 'bevestig' ? 'bevestigd' : 'geweigerd';
    save();
    const tekst = r.status === 'bevestigd'
      ? 'Uw tafel bij ' + supplier.name + ' op ' + r.datum + ' om ' + r.tijd + ' (' + r.personen + 'p) is bevestigd.'
      : supplier.name + ' kan uw reservering voor ' + r.datum + ' ' + r.tijd + ' helaas niet plaatsen.';
    notify(r.customerKey, { icon: '🪑', title: supplier.name, body: tekst, scope: 'orders' });
    sseToCustomer(r.customerKey, 'sync', { scope: 'reserveringen' });
    return { ok: true, reservering: r };
  }

  /* ---- 2. annuleren door het lid ----
     Terugbetaalregels: een betaalde annulering spiegelt de refund-flow van de
     zaak (paid=false, refunded=true). Orders kunnen tot de bereiding begint;
     ritten tot er een chauffeur op zit; tickets tot 24 uur voor het tijdslot;
     overige boekingen zolang ze niet afgerond zijn. */
  function annuleerItem(sess, soort, ref) {
    const key = sess.key;
    if (soort === 'order') {
      const o = db.data.orders.find(x => x.ref === ref && (x.customerKey || x.customerTier) === key);
      if (!o) return { status: 404, error: 'Bestelling niet gevonden.' };
      if (!['wacht-op-betaling', 'nieuw'].includes(o.status)) return { status: 409, error: 'Deze bestelling is al in behandeling (' + o.status + ') en kan niet meer geannuleerd worden.' };
      const wasBetaald = o.paid;
      if (o.paid) { o.paid = false; o.refunded = true; o.refundedAt = nu(); }
      o.status = wasBetaald ? 'terugbetaald' : 'geweigerd';
      o.geannuleerdDoor = 'lid';
      save();
      if (wasBetaald || o.status !== 'wacht-op-betaling') {
        notifySupplier(o.supplierCode, { icon: '↩️', title: 'Bestelling geannuleerd', body: o.customerCodename + ' annuleerde ' + o.ref + (wasBetaald ? ' (€ ' + o.total + ' retour)' : '') });
        sseToSupplier(o.supplierCode, 'sync', { scope: 'orders' });
      }
      sseToOffice('sync', { scope: 'orders' });
      return { ok: true, terugbetaald: wasBetaald ? o.total : 0 };
    }
    if (soort === 'ride') {
      const r = db.data.rides.find(x => x.ref === ref && (x.customerKey || x.customerTier) === key);
      if (!r) return { status: 404, error: 'Rit niet gevonden.' };
      if (!['wacht-op-betaling', 'aangevraagd'].includes(r.status) || r.driver)
        return { status: 409, error: 'Deze rit is al toegewezen en kan niet meer geannuleerd worden. Bel de vervoerder.' };
      const wasBetaald = r.paid && r.quote > 0;
      if (wasBetaald) { r.paid = false; r.refunded = true; r.refundedAt = nu(); }
      r.status = 'geweigerd';
      r.geannuleerdDoor = 'lid';
      save();
      notifySupplier(r.supplierCode, { icon: '↩️', title: 'Rit geannuleerd', body: r.customerCodename + ' annuleerde ' + r.ref + (wasBetaald ? ' (€ ' + r.quote + ' retour)' : '') });
      sseToSupplier(r.supplierCode, 'sync', { scope: 'orders' });
      sseToOffice('sync', { scope: 'orders' });
      return { ok: true, terugbetaald: wasBetaald ? r.quote : 0 };
    }
    if (soort === 'boeking') {
      const b = db.data.boekingen.find(x => x.ref === ref && (x.customerKey || x.customerTier) === key);
      if (!b) return { status: 404, error: 'Boeking niet gevonden.' };
      if (['afgerond', 'geweigerd'].includes(b.status)) return { status: 409, error: 'Deze boeking is al ' + b.status + '.' };
      if (b.kind === 'ticket') {
        const slotIso = b.datum + 'T' + (b.tijd || '23:59') + ':00';
        if (new Date(slotIso) - Date.now() < 24 * 3600000)
          return { status: 409, error: 'Tickets annuleert u tot 24 uur voor het tijdslot.' };
      }
      const wasBetaald = b.paid && (b.price || 0) > 0;
      if (wasBetaald) { b.paid = false; b.refunded = true; b.refundedAt = nu(); }
      b.status = 'geweigerd';
      b.geannuleerdDoor = 'lid';
      save();
      notifySupplier(b.supplierCode, { icon: '↩️', title: (b.kind === 'ticket' ? 'Ticket' : 'Boeking') + ' geannuleerd', body: b.customerCodename + ' annuleerde ' + b.ref + (wasBetaald ? ' (€ ' + b.price + ' retour)' : '') });
      sseToSupplier(b.supplierCode, 'sync', { scope: 'orders' });
      sseToOffice('sync', { scope: 'orders' });
      // vrijgekomen plek: de eerste op de wachtlijst hoort het meteen
      if (b.kind === 'ticket') meldWachtlijst('slot:' + b.supplierCode + ':' + b.activiteitId + ':' + b.datum + ':' + b.tijd);
      return { ok: true, terugbetaald: wasBetaald ? b.price : 0 };
    }
    return { status: 400, error: 'Onbekend soort (order, ride of boeking).' };
  }

  /* ---- 3. reviews ----
     Een review kan pas na een geslaagde afronding, een per dienst. Het
     gemiddelde staat als lopende som in reviewStats: O(1) per opzoeking,
     ook met miljoenen reviews. */
  const REVIEW_OK = {
    order: ['geserveerd', 'bezorgd', 'opgehaald'],
    ride: ['afgerond', 'gearriveerd'],
    boeking: ['afgerond']
  };
  function plaatsReview(sess, codename, body) {
    const soort = String(body.soort || '');
    const ref = String(body.ref || '');
    const score = parseInt(body.score, 10);
    if (!REVIEW_OK[soort]) return { status: 400, error: 'Onbekend soort.' };
    if (!(score >= 1 && score <= 5)) return { status: 400, error: 'Geef 1 tot 5 sterren.' };
    const lijst = soort === 'order' ? db.data.orders : soort === 'ride' ? db.data.rides : db.data.boekingen;
    const item = lijst.find(x => x.ref === ref && (x.customerKey || x.customerTier) === sess.key);
    if (!item) return { status: 404, error: 'Niet gevonden.' };
    if (!REVIEW_OK[soort].includes(item.status)) return { status: 409, error: 'Een review kan pas na afronding.' };
    if ((db.data.reviews || []).some(r => r.ref === ref && r.key === sess.key)) return { status: 409, error: 'U heeft deze dienst al beoordeeld.' };
    const rev = {
      id: id(), supplierCode: item.supplierCode, supplierName: item.supplierName,
      soort, ref, key: sess.key, codename, score,
      tekst: String(body.tekst || '').trim().slice(0, 300), at: nu()
    };
    db.data.reviews.unshift(rev);
    db.data.reviews = db.data.reviews.slice(0, 20000);
    const st = db.data.reviewStats[item.supplierCode] = db.data.reviewStats[item.supplierCode] || { som: 0, aantal: 0 };
    st.som += score; st.aantal += 1;
    save();
    notifySupplier(item.supplierCode, { icon: '⭐', title: 'Nieuwe review: ' + score + '/5', body: codename + (rev.tekst ? ': ' + rev.tekst.slice(0, 80) : '') });
    sseToSupplier(item.supplierCode, 'sync', { scope: 'reviews' });
    return { ok: true, review: { score: rev.score, tekst: rev.tekst } };
  }
  function reviewsVoor(code) {
    const c = String(code || '').trim().toUpperCase();
    const recent = (db.data.reviews || []).filter(r => r.supplierCode === c).slice(0, 20)
      .map(r => ({ codename: r.codename, score: r.score, tekst: r.tekst, at: r.at, reactie: r.reactie || null }));
    return { rating: ratingVan(c), reviews: recent };
  }

  /* de zaak reageert op een review: een keer, zichtbaar voor iedereen die de
     reviews bekijkt, en de gast krijgt er een nette melding van */
  function reviewReageer(s, reviewId, tekst) {
    const r = (db.data.reviews || []).find(x => x.id === reviewId && x.supplierCode === s.code);
    if (!r) return { status: 404, error: 'Review niet gevonden.' };
    tekst = String(tekst || '').replace(/[<>]/g, '').trim().slice(0, 400);
    if (!tekst) return { status: 400, error: 'Schrijf eerst een reactie.' };
    r.reactie = { tekst, at: nu() };
    save();
    notify(r.key, { icon: '💬', title: r.supplierName + ' reageerde op uw review', body: tekst.slice(0, 120), scope: 'orders' });
    sseToSupplier(s.code, 'sync', { scope: 'reviews' });
    return { ok: true, review: { id: r.id, reactie: r.reactie } };
  }
  function ratingVan(code) {
    const st = (db.data.reviewStats || {})[code];
    return st && st.aantal ? { score: Math.round((st.som / st.aantal) * 10) / 10, aantal: st.aantal } : null;
  }

  /* ---- 4. favorieten ---- */
  function toggleFavoriet(key, code) {
    const s = findSupplier(code);
    if (!s) return { status: 404, error: 'Partner niet gevonden.' };
    const lijst = db.data.favorieten[key] = db.data.favorieten[key] || [];
    const i = lijst.indexOf(s.code);
    if (i >= 0) lijst.splice(i, 1);
    else { lijst.push(s.code); if (lijst.length > 200) lijst.shift(); }
    save();
    return { ok: true, favoriet: i < 0 };
  }
  function favorietenVan(key) {
    return (db.data.favorieten[key] || []).map(c => { const s = findSupplier(c); return s ? { code: s.code, name: s.name, type: s.type, city: s.city } : null; }).filter(Boolean);
  }
  function isFavoriet(key, code) { return (db.data.favorieten[key] || []).includes(code); }

  /* ---- 5. fooi (helper voor de betaal-endpoints) ---- */
  function fooiUit(body, totaal) {
    const f = Number(body && body.fooi);
    if (!Number.isFinite(f) || f <= 0) return 0;
    return rond(Math.min(f, Math.min(500, totaal))); // nooit meer dan de rekening of 500
  }

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
    for (const b of db.data.boekingen || []) {
      if ((b.customerKey || b.customerTier) !== key || ['geweigerd'].includes(b.status) || !b.datum || b.datum < van) continue;
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
    const o = db.data.orders.find(x => x.ref === ref && (x.customerKey || x.customerTier) === key);
    if (!o) return { status: 404, error: 'Bestelling niet gevonden.' };
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

  /* ---- 8. wachtlijst ----
     Bij een vol event of tijdslot. Komt er een plek vrij (annulering), dan
     hoort de eerste op de lijst het meteen. */
  function zetOpWachtlijst(sess, codename, body) {
    const s = findSupplier(body.supplierCode);
    if (!s) return { status: 404, error: 'Partner niet gevonden.' };
    let doel = null, omschrijving = null;
    if (body.eventId != null) {
      const e = (s.events || []).find(x => x.id === body.eventId && x.published);
      if (!e) return { status: 404, error: 'Event niet gevonden.' };
      const bezet = (e.guests || []).reduce((n, g) => n + g.qty, 0);
      if (bezet < e.capacity) return { status: 409, error: 'Er is nog plek: meld u gewoon aan.' };
      doel = 'event:' + s.code + ':' + e.id;
      omschrijving = e.name + ' bij ' + s.name + ' (' + e.date + ')';
    } else if (body.activiteitId != null) {
      const act = (s.activiteiten || []).find(a => a.id === body.activiteitId);
      const datum = String(body.datum || ''), tijd = String(body.tijd || '');
      if (!act || !/^\d{4}-\d{2}-\d{2}$/.test(datum) || !(act.tijden || []).includes(tijd)) return { status: 404, error: 'Tijdslot niet gevonden.' };
      const bezet = ticketsVoorSlot(s.code, act.id, datum, tijd).reduce((n, t) => n + (t.personen || 1), 0);
      if (bezet < act.capaciteit) return { status: 409, error: 'Er is nog plek in dit tijdslot: boek gewoon een ticket.' };
      doel = 'slot:' + s.code + ':' + act.id + ':' + datum + ':' + tijd;
      omschrijving = act.naam + ' bij ' + s.name + ' (' + datum + ' ' + tijd + ')';
    } else return { status: 400, error: 'Geef een event of tijdslot op.' };
    const lijst = db.data.wachtlijsten;
    if (lijst.some(w => w.doel === doel && w.key === sess.key)) return { status: 409, error: 'U staat al op deze wachtlijst.' };
    lijst.push({ id: id(), doel, supplierCode: s.code, omschrijving, key: sess.key, codename, at: nu() });
    db.data.wachtlijsten = lijst.slice(-20000);
    save();
    const positie = lijst.filter(w => w.doel === doel).length;
    return { ok: true, positie, omschrijving };
  }
  function mijnWachtlijst(key) {
    return (db.data.wachtlijsten || []).filter(w => w.key === key)
      .map(w => ({ id: w.id, omschrijving: w.omschrijving, at: w.at, positie: db.data.wachtlijsten.filter(x => x.doel === w.doel && x.at <= w.at).length }));
  }
  // een plek is vrijgekomen: de eerste op de lijst krijgt bericht en valt eraf
  function meldWachtlijst(doel) {
    const i = (db.data.wachtlijsten || []).findIndex(w => w.doel === doel);
    if (i < 0) return null;
    const [w] = db.data.wachtlijsten.splice(i, 1);
    save();
    notify(w.key, { icon: '🎉', title: 'Er is een plek vrij!', body: 'Er kwam een plek vrij voor ' + w.omschrijving + '. Wees er snel bij: de plek is niet gereserveerd.', scope: 'wachtlijst' });
    sseToCustomer(w.key, 'sync', { scope: 'wachtlijst' });
    return w;
  }
  // aanmelding voor een event intrekken (maakt de plek vrij voor de wachtlijst)
  function rsvpAnnuleer(key, supplierCode, eventId) {
    const s = findSupplier(supplierCode);
    const e = s && (s.events || []).find(x => x.id === eventId);
    if (!e) return { status: 404, error: 'Event niet gevonden.' };
    const i = (e.guests || []).findIndex(g => g.key === key);
    if (i < 0) return { status: 404, error: 'U staat niet op deze gastenlijst.' };
    const [g] = e.guests.splice(i, 1);
    save();
    notifySupplier(s.code, { icon: '🎟', title: 'Afmelding voor ' + e.name, body: g.codename + ', ' + g.qty + ' pers.' });
    sseToSupplier(s.code, 'sync', { scope: 'events' });
    meldWachtlijst('event:' + s.code + ':' + e.id);
    return { ok: true };
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

  return {
    reserveerTafel, mijnReserveringen, annuleerReservering, beslisReservering,
    annuleerItem,
    plaatsReview, reviewsVoor, ratingVan, reviewReageer,
    toggleFavoriet, favorietenVan, isFavoriet,
    fooiUit,
    agendaVoor,
    maakSplits, mijnSplitsen, betaalSplits,
    zetOpWachtlijst, mijnWachtlijst, meldWachtlijst, rsvpAnnuleer,
    puntenVan, verdienPunten, verzilverPunten, pasTegoedToe,
    voorkeurVan, zetVoorkeur
  };
}

module.exports = { MELDING_SCOPES, maakErvaring };
