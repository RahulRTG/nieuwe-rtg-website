/* Ervaring-deel "tafels" (kern/ervaring): tafelreserveringen en de
   tafelplanning - van losse aanvragen naar een gedekte avond, met walk-ins
   en komst-meldingen. Verbatim afgesplitst uit kern/ervaring.js. */
module.exports = (ctx) => {
  const { db, save, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, zijnVrienden, ticketsVoorSlot, optieAan,
    orderMetRef, boekingMetRef, boekingenVanKlant, id, nu, vandaag, rond, MELDING_SCOPES } = ctx;

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

  /* ---- 1b. de tafelplanning: van losse aanvragen naar een gedekte avond ----
     De zaak wijst een tafel toe aan een bevestigde reservering, meldt de komst
     (aangekomen, no-show, vertrokken) en zet een walk-in met een tik aan een
     vrije tafel. De tafelstatussen lopen automatisch mee. */
  const tafelVan = (s, naam) => (s.tables || []).find(t => t.name === String(naam || ''));

  function tafelplanning(supplier, datumIn) {
    const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(datumIn || '')) ? String(datumIn) : vandaag();
    const dag = (db.data.reserveringen || [])
      .filter(r => r.supplierCode === supplier.code && r.datum === datum && r.status !== 'geannuleerd' && r.status !== 'geweigerd')
      .sort((a, b) => (a.tijd || '').localeCompare(b.tijd || ''));
    const verwacht = dag.filter(r => ['bevestigd', 'aangekomen'].includes(r.status));
    // de open rekening per tafel: alles wat de kassa "op de tafel" zette
    const lasten = (db.data.posSales[supplier.code] || []).filter(s => s.method === 'tafel' && !s.settled && s.room);
    const tafels = (supplier.tables || []).map(t => {
      const rek = lasten.filter(s => s.room === t.name);
      return {
        name: t.name, status: t.status,
        reserveringen: dag.filter(r => r.tafel === t.name && ['bevestigd', 'aangekomen'].includes(r.status)).map(r => r.tijd),
        rekening: rek.length ? { totaal: Math.round(rek.reduce((n, s) => n + (s.total || 0), 0) * 100) / 100, posten: rek.length } : null
      };
    });
    return {
      ok: true, datum,
      reserveringen: dag,
      tafels,
      verwachtePersonen: verwacht.reduce((n, r) => n + (r.personen || 0), 0),
      openAanvragen: dag.filter(r => r.status === 'aangevraagd').length,
      zonderTafel: verwacht.filter(r => !r.tafel).length
    };
  }

  function reserveringTafel(supplier, rid, tafelNaam) {
    const r = (db.data.reserveringen || []).find(x => x.id === rid && x.supplierCode === supplier.code);
    if (!r) return { status: 404, error: 'Reservering niet gevonden.' };
    if (!['bevestigd', 'aangekomen'].includes(r.status)) return { status: 409, error: 'Wijs een tafel toe aan een bevestigde reservering.' };
    const t = tafelVan(supplier, tafelNaam);
    if (!t) return { status: 404, error: 'Deze tafel bestaat niet.' };
    r.tafel = t.name;
    // vandaag toegewezen = de tafel staat gereserveerd (tenzij er al iemand zit)
    if (r.datum === vandaag() && t.status === 'vrij') t.status = 'gereserveerd';
    save();
    if (r.customerKey) {
      notify(r.customerKey, { icon: '🪑', title: supplier.name, body: 'Uw tafel op ' + r.datum + ' om ' + r.tijd + ': ' + t.name + '.', scope: 'orders' });
      sseToCustomer(r.customerKey, 'sync', { scope: 'reserveringen' });
    }
    sseToSupplier(supplier.code, 'sync', { scope: 'reserveringen' });
    return { ok: true, reservering: r };
  }

  function reserveringKomst(supplier, rid, actie) {
    const r = (db.data.reserveringen || []).find(x => x.id === rid && x.supplierCode === supplier.code);
    if (!r) return { status: 404, error: 'Reservering niet gevonden.' };
    const t = r.tafel ? tafelVan(supplier, r.tafel) : null;
    if (actie === 'aangekomen') {
      if (!['bevestigd', 'aangevraagd'].includes(r.status)) return { status: 409, error: 'Deze reservering is al ' + r.status + '.' };
      r.status = 'aangekomen';
      if (t) t.status = 'bezet';
    } else if (actie === 'no-show') {
      if (r.status !== 'bevestigd') return { status: 409, error: 'Alleen een bevestigde reservering kan een no-show zijn.' };
      r.status = 'no-show';
      if (t && t.status === 'gereserveerd') t.status = 'vrij';
    } else if (actie === 'vertrokken') {
      if (r.status !== 'aangekomen') return { status: 409, error: 'De gast is nog niet gemeld als aangekomen.' };
      r.status = 'afgerond';
      if (t) t.status = 'vrij';
    } else return { status: 400, error: 'Onbekende actie.' };
    save();
    sseToSupplier(supplier.code, 'sync', { scope: 'reserveringen' });
    return { ok: true, reservering: r };
  }

  function walkIn(supplier, tafelNaam, personenIn, actorName) {
    const t = tafelVan(supplier, tafelNaam);
    if (!t) return { status: 404, error: 'Deze tafel bestaat niet.' };
    if (t.status !== 'vrij') return { status: 409, error: 'Tafel ' + t.name + ' is niet vrij (' + t.status + ').' };
    const personen = Math.min(20, Math.max(1, parseInt(personenIn, 10) || 2));
    t.status = 'bezet';
    const r = {
      id: id(), supplierCode: supplier.code, supplierName: supplier.name,
      customerKey: null, customerCodename: 'Walk-in', tier: null,
      datum: vandaag(), tijd: new Date().toISOString().slice(11, 16), personen,
      notitie: actorName ? 'ontvangen door ' + actorName : '',
      status: 'aangekomen', tafel: t.name, walkIn: true, at: nu()
    };
    db.data.reserveringen.unshift(r);
    db.data.reserveringen = db.data.reserveringen.slice(0, 20000);
    save();
    sseToSupplier(supplier.code, 'sync', { scope: 'reserveringen' });
    return { ok: true, reservering: r };
  }


  return { reserveerTafel, mijnReserveringen, annuleerReservering, beslisReservering,
    tafelplanning, reserveringTafel, reserveringKomst, walkIn };
};
