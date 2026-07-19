/* Gemeente-domein "burgerzaken": pijler 2, balie-afspraken en verhuizingen. Vrije
   tijdsloten per balieproduct met een capaciteit per slot, een afspraak maken
   (dubbel voor hetzelfde product wordt geweigerd), een verhuizing doorgeven en de
   eigen afspraken volgen/annuleren. De medewerker ziet de dagplanning. Krijgt de
   gedeelde ctx van kern/gemeente/index.js. */
module.exports = (ctx) => {
  const { db, save, nu, vandaag, isDatum, id, ref, schoon, seed, deGemeente, sseToSupplier, BURGERZAKEN, BALIE_SLOTS } = ctx;

  function burgerzakenOverzicht() {
    seed();
    const g = deGemeente();
    return {
      ok: true, open: !g || !g.gemeente || g.gemeente.balie.open !== false,
      soorten: Object.entries(BURGERZAKEN).map(([k, v]) => ({ id: k, label: v.label, opAfspraak: v.balie, duurMin: v.duurMin }))
    };
  }
  function bezetOp(datum, tijd) {
    return (db.data.gemeenteAfspraken || []).filter(a => a.datum === datum && a.tijd === tijd && a.status === 'gepland').length;
  }
  function burgerzakenSlots(soort, datum) {
    seed();
    if (!BURGERZAKEN[soort] || !BURGERZAKEN[soort].balie) return { status: 400, error: 'Kies een balieproduct.' };
    if (!isDatum(datum) || datum < vandaag()) return { status: 400, error: 'Kies een datum vanaf vandaag.' };
    const g = deGemeente();
    const cap = (g && g.gemeente && g.gemeente.balie.capaciteitPerSlot) || 2;
    const nuTijd = new Date().toTimeString().slice(0, 5);
    const slots = BALIE_SLOTS
      .filter(t => datum > vandaag() || t > nuTijd)
      .map(t => ({ tijd: t, vol: bezetOp(datum, t) >= cap }));
    return { ok: true, soort, label: BURGERZAKEN[soort].label, slots };
  }
  function afspraakMaak(sess, codenaam, data) {
    seed();
    data = data || {};
    const soort = data.soort;
    if (!BURGERZAKEN[soort] || !BURGERZAKEN[soort].balie) return { status: 400, error: 'Kies een balieproduct.' };
    if (!isDatum(data.datum) || data.datum < vandaag()) return { status: 400, error: 'Kies een datum vanaf vandaag.' };
    if (!BALIE_SLOTS.includes(String(data.tijd || ''))) return { status: 400, error: 'Kies een geldig tijdslot.' };
    const g = deGemeente();
    const cap = (g && g.gemeente && g.gemeente.balie.capaciteitPerSlot) || 2;
    if (bezetOp(data.datum, data.tijd) >= cap) return { status: 409, error: 'Dit tijdslot is vol. Kies een ander tijdstip.' };
    if ((db.data.gemeenteAfspraken || []).some(a => a.key === sess.key && a.soort === soort && a.status === 'gepland'))
      return { status: 409, error: 'Je hebt al een afspraak voor ' + BURGERZAKEN[soort].label + ' openstaan.' };
    const a = {
      id: id(), ref: ref('A'), gemeente: g ? g.code : 'GEMEENTE', soort, soortLabel: BURGERZAKEN[soort].label,
      datum: data.datum, tijd: data.tijd, key: sess.key, codenaam, notitie: schoon(data.notitie, 200),
      status: 'gepland', at: nu()
    };
    db.data.gemeenteAfspraken.unshift(a);
    db.data.gemeenteAfspraken = db.data.gemeenteAfspraken.slice(0, 20000);
    save();
    if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, afspraak: { ref: a.ref, soort, soortLabel: a.soortLabel, datum: a.datum, tijd: a.tijd, status: a.status } };
  }
  function verhuizingDoorgeven(sess, codenaam, data) {
    seed();
    data = data || {};
    const nieuwAdres = schoon(data.nieuwAdres, 160);
    if (nieuwAdres.length < 4) return { status: 400, error: 'Vul je nieuwe adres in.' };
    const g = deGemeente();
    const a = {
      id: id(), ref: ref('V'), gemeente: g ? g.code : 'GEMEENTE', soort: 'verhuizing', soortLabel: BURGERZAKEN.verhuizing.label,
      datum: isDatum(data.datum) ? data.datum : null, tijd: null, key: sess.key, codenaam,
      nieuwAdres, huidigAdres: schoon(data.huidigAdres, 160) || null, aantal: Math.min(12, Math.max(1, parseInt(data.aantal, 10) || 1)),
      status: 'ontvangen', at: nu()
    };
    db.data.gemeenteAfspraken.unshift(a);
    save();
    if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, aanvraag: { ref: a.ref, soortLabel: a.soortLabel, nieuwAdres, status: a.status } };
  }
  function mijnAfspraken(key) {
    return (db.data.gemeenteAfspraken || []).filter(a => a.key === key).slice(0, 50)
      .map(a => ({ ref: a.ref, soort: a.soort, soortLabel: a.soortLabel, datum: a.datum, tijd: a.tijd, status: a.status, nieuwAdres: a.nieuwAdres || null }));
  }
  function afspraakAnnuleer(key, r) {
    const a = (db.data.gemeenteAfspraken || []).find(x => x.ref === String(r || '') && x.key === key);
    if (!a) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (!['gepland', 'ontvangen'].includes(a.status)) return { status: 409, error: 'Deze afspraak is al ' + a.status + '.' };
    a.status = 'geannuleerd';
    save();
    return { ok: true };
  }

  /* ---- gemeente-medewerkers ---- */
  function afsprakenLijst(datum) {
    seed();
    const d = isDatum(datum) ? datum : vandaag();
    return { ok: true, datum: d, afspraken: (db.data.gemeenteAfspraken || [])
      .filter(a => (a.datum === d || (a.soort === 'verhuizing' && a.status === 'ontvangen')) && a.status !== 'geannuleerd')
      .map(a => ({ ref: a.ref, soort: a.soort, soortLabel: a.soortLabel, tijd: a.tijd, codenaam: a.codenaam, status: a.status, nieuwAdres: a.nieuwAdres || null })) };
  }

  return { burgerzakenOverzicht, burgerzakenSlots, afspraakMaak, verhuizingDoorgeven, mijnAfspraken, afspraakAnnuleer, afsprakenLijst };
};
