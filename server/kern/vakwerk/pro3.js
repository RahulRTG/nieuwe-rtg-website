/* Vakwerk Pro, deel 3: vaste afspraken (ritmes) en de wachtlijst.
   Een ritme is een afgesproken herhaling (elke 1, 2 of 4 weken op een vaste
   tijd): de motor plant telkens de VOLGENDE afspraak als aanvraag in zodra de
   vorige voorbij is -- de zaak bevestigt gewoon elke afspraak, en stoppen kan
   altijd, door beide kanten, zonder gedoe. De wachtlijst laat een lid weten
   wanneer er plek vrijkomt; het lid boekt dan zelf, er wordt nooit
   automatisch geboekt of betaald. Alles op codenaam. */
module.exports = (ctx) => {
  const { db, save, findSupplier, isVak, scho, crypto, notify, notifySupplier,
    sseToCustomer, sseToSupplier, boekingenVoegToe, boekingenVanZaak, vandaagStr, geldigeTijd } = ctx;
  const nu = () => new Date().toISOString();
  const eigen = require('../eigencollectie')({ db, domein: 'kern/vakwerk/pro3', bezit: { vakRitmes: 'lijst', vakWachtlijst: 'lijst' } });
  const ritmes = () => eigen.bak('vakRitmes');
  const wacht = () => eigen.bak('vakWachtlijst');
  const pubRitme = r => ({ id: r.id, supplierCode: r.supplierCode, zaak: r.supplierName, klant: r.customerCodename,
    dienst: r.dienstNaam, intervalWeken: r.intervalWeken, tijd: r.tijd, laatst: r.laatst || r.start, actief: r.actief });

  function plan(r, datum) {
    const s = findSupplier(r.supplierCode);
    const d = s && (s.services || []).find(x => x.id === r.serviceId);
    if (!d) { r.actief = false; return null; }
    const boeking = {
      ref: 'RTG-B-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      supplierCode: s.code, supplierName: s.name,
      customerTier: r.customerTier, customerKey: r.customerKey, customerCodename: r.customerCodename,
      service: { id: d.id, name: d.name, soort: d.soort || 'dienst', duurMin: d.duurMin || null },
      price: d.price, wanneer: datum + ' ' + r.tijd, note: 'Vaste afspraak ' + r.id,
      betaalMoment: 'achteraf', status: 'aangevraagd', paid: false, at: nu()
    };
    boekingenVoegToe(boeking);
    r.laatst = datum;
    return boeking;
  }

  /* de tick: per actief ritme de volgende afspraak inplannen zodra er geen
     toekomstige meer staat; draait bij elk pro-overzicht van de zaak */
  function ritmeTick(code) {
    const vd = vandaagStr();
    let acties = 0;
    for (const r of ritmes()) {
      if (r.supplierCode !== code || !r.actief) continue;
      const open = (boekingenVanZaak(code) || []).some(b => b.note === 'Vaste afspraak ' + r.id
        && b.status !== 'geweigerd' && String(b.wanneer || '').slice(0, 10) >= vd);
      if (open) continue;
      let d = new Date((r.laatst || r.start) + 'T12:00:00');
      if (r.laatst) d = new Date(d.getTime() + r.intervalWeken * 7 * 864e5);
      while (d.toISOString().slice(0, 10) < vd) d = new Date(d.getTime() + r.intervalWeken * 7 * 864e5);
      const b = plan(r, d.toISOString().slice(0, 10));
      if (b) {
        acties++;
        notify(r.customerTier, { icon: 'agenda', title: r.supplierName, body: 'Uw vaste afspraak "' + r.dienstNaam + '" is aangevraagd voor ' + b.wanneer + '. Stoppen of verzetten kan altijd.', scope: 'orders' });
        sseToCustomer(r.customerKey || r.customerTier, 'sync', { scope: 'orders' });
      }
    }
    if (acties) { save(); sseToSupplier(code, 'sync', { scope: 'orders' }); }
    return acties;
  }

  function ritmeStart(sessie, body) {
    const s = findSupplier((body || {}).supplierCode);
    if (!isVak(s)) return { status: 404, error: 'Deze zaak kent geen vaste afspraken.' };
    const d = (s.services || []).find(x => x.id === String((body || {}).serviceId || ''));
    if (!d) return { status: 404, error: 'Deze dienst bestaat niet (meer).' };
    const interval = Number((body || {}).intervalWeken);
    if (![1, 2, 4].includes(interval)) return { status: 400, error: 'Kies elke week, elke 2 of elke 4 weken.' };
    if (!geldigeTijd((body || {}).tijd)) return { status: 400, error: 'Kies een tijd.' };
    const start = String((body || {}).start || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || start < vandaagStr()) return { status: 400, error: 'Kies een startdatum vanaf vandaag.' };
    if (ritmes().filter(r => r.customerKey === sessie.key && r.actief).length >= 10)
      return { status: 429, error: 'U heeft al tien vaste afspraken lopen.' };
    const r = {
      id: 'RT-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      supplierCode: s.code, supplierName: s.name,
      customerKey: sessie.key, customerTier: sessie.tier, customerCodename: sessie.codename,
      serviceId: d.id, dienstNaam: d.name, intervalWeken: interval, tijd: body.tijd,
      start, actief: true, at: nu()
    };
    ritmes().unshift(r);
    eigen.zetBak('vakRitmes', ritmes().slice(0, 10000));
    const b = plan(r, start);
    save();
    notifySupplier(s.code, { icon: 'agenda', title: 'Vaste afspraak gestart', body: r.customerCodename + ': ' + d.name + ', elke ' + (interval === 1 ? 'week' : interval + ' weken') + ' om ' + r.tijd + '.' });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    return { status: 200, ok: true, ritme: pubRitme(r), boeking: b };
  }
  const ritmesVanLid = key => ({ status: 200, ritmes: ritmes().filter(r => r.customerKey === key && r.actief).slice(0, 15).map(pubRitme) });
  const ritmesVanZaak = code => ritmes().filter(r => r.supplierCode === code && r.actief).slice(0, 25).map(pubRitme);
  function ritmeStop(wie, id) {
    const r = ritmes().find(x => x.id === String(id || '') && (wie.key ? x.customerKey === wie.key : x.supplierCode === wie.code));
    if (!r || !r.actief) return { status: 404, error: 'Deze vaste afspraak is niet gevonden of al gestopt.' };
    r.actief = false;
    save();
    if (wie.code) { notify(r.customerTier, { icon: 'agenda', title: r.supplierName, body: 'Uw vaste afspraak "' + r.dienstNaam + '" is stopgezet.', scope: 'orders' }); sseToCustomer(r.customerKey || r.customerTier, 'sync', { scope: 'orders' }); }
    else { notifySupplier(r.supplierCode, { icon: 'agenda', title: 'Vaste afspraak gestopt', body: r.customerCodename + ' stopte "' + r.dienstNaam + '".' }); sseToSupplier(r.supplierCode, 'sync', { scope: 'orders' }); }
    return { status: 200, ok: true };
  }

  /* ---- de wachtlijst: seintje bij vrijgekomen plek, lid boekt zelf ---- */
  function wachtZet(sessie, body) {
    const s = findSupplier((body || {}).supplierCode);
    if (!isVak(s)) return { status: 404, error: 'Deze zaak kent geen wachtlijst.' };
    const datum = String((body || {}).datum || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < vandaagStr()) return { status: 400, error: 'Kies een datum vanaf vandaag.' };
    if (wacht().some(w => w.customerKey === sessie.key && w.supplierCode === s.code && w.datum === datum))
      return { status: 409, error: 'U staat al op de wachtlijst voor deze dag.' };
    if (wacht().filter(w => w.customerKey === sessie.key && !w.uitgenodigd).length >= 10)
      return { status: 429, error: 'U staat al op tien wachtlijsten.' };
    const d = (s.services || []).find(x => x.id === String((body || {}).serviceId || ''));
    const w = { id: 'WL-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      supplierCode: s.code, customerKey: sessie.key, customerTier: sessie.tier, codenaam: sessie.codename,
      dienst: (d && d.name) || null, datum, uitgenodigd: null, at: nu() };
    wacht().push(w);
    eigen.zetBak('vakWachtlijst', wacht().slice(-10000));
    save();
    notifySupplier(s.code, { icon: 'agenda', title: 'Wachtlijst', body: sessie.codename + ' wacht op een plek op ' + datum + (w.dienst ? ' (' + w.dienst + ')' : '') + '.' });
    return { status: 200, ok: true };
  }
  const wachtVanZaak = code => wacht().filter(w => w.supplierCode === code && w.datum >= vandaagStr()).slice(0, 25)
    .map(w => ({ id: w.id, klant: w.codenaam, dienst: w.dienst, datum: w.datum, uitgenodigd: !!w.uitgenodigd }));
  function nodigUit(w, naam) {
    notify(w.customerTier, { icon: 'agenda', title: naam, body: 'Er is plek vrijgekomen op ' + w.datum + (w.dienst ? ' voor "' + w.dienst + '"' : '') + '. Boeken kan in de Mall, als u dat nog wilt.', scope: 'orders' });
    sseToCustomer(w.customerKey || w.customerTier, 'sync', { scope: 'orders' });
    w.uitgenodigd = nu();
  }
  function wachtUitnodig(code, body) {
    const w = wacht().find(x => x.id === String((body || {}).id || '') && x.supplierCode === code);
    if (!w) return { status: 404, error: 'Deze wachtende is niet gevonden.' };
    if (w.uitgenodigd) return { status: 429, error: 'Al uitgenodigd; het lid beslist zelf.' };
    nodigUit(w, (findSupplier(code) || {}).name || 'RTG');
    save();
    return { status: 200, ok: true };
  }
  // auto-seintje: komt er een plek vrij (geweigerde/afgezegde boeking), dan
  // krijgt de eerste wachtende voor die dag vanzelf netjes bericht
  function wachtVrij(code, datum) {
    const w = wacht().find(x => x.supplierCode === code && x.datum === datum && !x.uitgenodigd);
    if (!w) return 0;
    nodigUit(w, (findSupplier(code) || {}).name || 'RTG');
    save();
    return 1;
  }

  return { ritmeTick, ritmeStart, ritmesVanLid, ritmesVanZaak, ritmeStop,
    wachtZet, wachtVanZaak, wachtUitnodig, wachtVrij };
};
