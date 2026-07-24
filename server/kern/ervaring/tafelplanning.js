/* Ervaring-deel "tafelplanning" (kern/ervaring/tafels): van losse bevestigde
   aanvragen naar een gedekte avond. De zaak wijst een tafel toe, meldt de komst
   (aangekomen, no-show, vertrokken) en zet een walk-in met een tik aan een vrije
   tafel; de tafelstatussen lopen automatisch mee. Draait op dezelfde context als
   kern/ervaring/tafels.js, plus de gedeelde rijpMaak-sweep. */
module.exports = (ctx, { rijpMaak }) => {
  const { db, save, notify, sseToCustomer, sseToSupplier, id, nu, vandaag } = ctx;

  const tafelVan = (s, naam) => (s.tables || []).find(t => t.name === String(naam || ''));

  function tafelplanning(supplier, datumIn) {
    const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(datumIn || '')) ? String(datumIn) : vandaag();
    const dag = (db.data.reserveringen || [])
      .filter(r => r.supplierCode === supplier.code && r.datum === datum && r.status !== 'geannuleerd' && r.status !== 'geweigerd')
      .sort((a, b) => (a.tijd || '').localeCompare(b.tijd || ''));
    rijpMaak(dag); // rijpe bedenktijd meteen definitief tonen
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

  return { tafelplanning, reserveringTafel, reserveringKomst, walkIn };
};
