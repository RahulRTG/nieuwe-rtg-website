/* Care (deelmodule): de ledenkant: de veilige intake-deling (vervalt
   vanzelf), het aanbod, boeken, betalen, annuleren en mijn behandelingen.
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/care.js. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, notify, zorgVoor,
    nu, vandaag, eur, INTAKE_DAGEN, lijsten, aanbiederVan, behandelingVan, intakeActief } = ctx;
  function careIntakeDeel(key, aanbiederIdIn, medischIn) {
    lijsten();
    const a = aanbiederVan(aanbiederIdIn);
    if (!a) return { status: 404, error: 'Zorgaanbieder niet gevonden.' };
    const medisch = schoon(medischIn, 600);
    if (!medisch) return { status: 400, error: 'Vul in wat de behandelaar moet weten.' };
    // een lopende intake bijwerken in plaats van stapelen
    let i = intakeActief(key, a.id);
    if (!i) {
      i = { id: crypto.randomBytes(4).toString('hex'), key, aanbiederId: a.id, aanbiederNaam: a.naam, status: 'actief', at: nu() };
      db.data.careIntake.push(i);
    }
    i.medisch = medisch;
    i.vervaltOp = new Date(Date.now() + INTAKE_DAGEN * 86400000).toISOString().slice(0, 10);
    save();
    notify(key, { icon: '🩺', title: 'Intake gedeeld met ' + a.naam, body: 'Uw medische context is beschikbaar voor ' + a.naam + ' tot ' + i.vervaltOp + '. U kunt dit altijd stoppen.', scope: 'care' });
    return { ok: true, intake: { id: i.id, aanbiederNaam: a.naam, vervaltOp: i.vervaltOp } };
  }
  function careIntakeStop(key, idIn) {
    lijsten();
    const i = db.data.careIntake.find(x => x.id === String(idIn || '') && x.key === key && x.status === 'actief');
    if (!i) return { status: 404, error: 'Deze deling is er niet (meer).' };
    i.status = 'gestopt';
    i.gestoptOp = nu();
    save();
    return { ok: true, gestopt: i.aanbiederNaam };
  }

  /* ---- het overzicht voor het lid: aanbieders, behandelingen en de eigen
     lopende intakes ---- */
  function careOverzicht(key) {
    lijsten();
    return {
      ok: true,
      aanbieders: db.data.careAanbieders.map(a => ({
        id: a.id, naam: a.naam, soort: a.soort, icon: a.icon, waar: a.waar, beschrijving: a.beschrijving,
        behandelaars: (a.behandelaars || []).map(b => ({ id: b.id, naam: b.naam, functie: b.functie })),
        behandelingen: (a.behandelingen || []).map(b => ({
          id: b.id, naam: b.naam, soort: b.soort, duurMin: b.duurMin, prijs: b.prijs,
          tijden: b.tijden || [], behandelaarId: b.behandelaarId
        })),
        intakeActief: !!intakeActief(key, a.id)
      })),
      intakes: db.data.careIntake.filter(i => i.key === key && i.status === 'actief' && i.vervaltOp >= vandaag())
        .map(i => ({ id: i.id, aanbiederNaam: i.aanbiederNaam, vervaltOp: i.vervaltOp }))
    };
  }

  /* ---- een behandeling boeken. De behandelaar-agenda is de schaarste: een
     behandeling per behandelaar per tijdslot. Betalen volgt via careBetaal. */
  function careBoek(sess, codenaam, body) {
    lijsten();
    if (sess.tier === 'guest') return { status: 403, error: 'Boeken kan alleen met een lidmaatschap.' };
    const a = aanbiederVan(body.aanbiederId);
    if (!a) return { status: 404, error: 'Zorgaanbieder niet gevonden.' };
    const b = behandelingVan(a, body.behandelingId);
    if (!b) return { status: 404, error: 'Deze behandeling bestaat niet.' };
    const datum = String(body.datum || '');
    const tijd = String(body.tijd || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < vandaag()) return { status: 400, error: 'Kies een dag vanaf vandaag.' };
    if (!(b.tijden || []).includes(tijd)) return { status: 400, error: 'Kies een tijdslot van deze behandeling.' };
    // de behandelaar kan maar een gezelschap per slot hebben
    const bezet = db.data.careBoekingen.find(x => x.aanbiederId === a.id && x.behandelaarId === b.behandelaarId &&
      x.datum === datum && x.tijd === tijd && !['geannuleerd'].includes(x.status));
    if (bezet) return { status: 409, error: 'Dat tijdslot is al bezet. Kies een ander moment.' };
    const boeking = {
      id: crypto.randomBytes(4).toString('hex'),
      ref: 'RTG-C-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      aanbiederId: a.id, aanbiederNaam: a.naam,
      behandelingId: b.id, behandelingNaam: b.naam, soort: b.soort,
      behandelaarId: b.behandelaarId,
      behandelaarNaam: (a.behandelaars || []).find(x => x.id === b.behandelaarId) ? (a.behandelaars.find(x => x.id === b.behandelaarId).naam) : '',
      key: sess.key, codenaam: schoon(codenaam, 40), tier: sess.tier,
      datum, tijd, duurMin: b.duurMin, prijs: b.prijs,
      // het algemene zorgprofiel reist mee (met toestemming); een aparte,
      // uitdrukkelijk gedeelde intake voor deze aanbieder gaat er bovenop
      zorg: zorgVoor(sess.key),
      intake: (intakeActief(sess.key, a.id) || {}).medisch || null,
      status: 'wacht-op-betaling', paid: false, at: nu()
    };
    db.data.careBoekingen.unshift(boeking);
    db.data.careBoekingen = db.data.careBoekingen.slice(0, 200000);
    save();
    return { ok: true, boeking };
  }

  function careBetaal(sess, refIn, verdien) {
    lijsten();
    const bk = db.data.careBoekingen.find(x => x.ref === String(refIn || '') && x.key === sess.key);
    if (!bk) return { status: 404, error: 'Boeking niet gevonden.' };
    if (bk.paid) return { status: 409, error: 'Al betaald.' };
    if (Date.now() - Date.parse(bk.at) > 30 * 60000) return { status: 410, error: 'Deze boeking is verlopen. Boek opnieuw.' };
    bk.paid = true;
    bk.paidAt = nu();
    bk.status = 'geboekt';
    save();
    if (typeof verdien === 'function') { try { verdien(sess.key, bk.prijs, bk.aanbiederNaam); } catch (e) {} }
    notify(sess.key, { icon: '🕛', title: bk.aanbiederNaam + ': ' + bk.behandelingNaam, body: bk.datum + ' om ' + bk.tijd + ' bij ' + (bk.behandelaarNaam || 'de behandelaar') + '. Tot dan.', scope: 'care' });
    return { ok: true, boeking: bk };
  }

  function careAnnuleer(key, refIn) {
    lijsten();
    const bk = db.data.careBoekingen.find(x => x.ref === String(refIn || '') && x.key === key);
    if (!bk) return { status: 404, error: 'Boeking niet gevonden.' };
    if (bk.status === 'geannuleerd') return { status: 409, error: 'Al geannuleerd.' };
    bk.status = 'geannuleerd';
    bk.geannuleerdOp = nu();
    save();
    return { ok: true, ref: bk.ref };
  }

  function careMijn(key) {
    lijsten();
    return {
      ok: true,
      boekingen: db.data.careBoekingen.filter(x => x.key === key && x.status !== 'geannuleerd').slice(0, 30)
        .map(x => ({ ref: x.ref, aanbiederNaam: x.aanbiederNaam, behandelingNaam: x.behandelingNaam,
          behandelaarNaam: x.behandelaarNaam, datum: x.datum, tijd: x.tijd, prijs: x.prijs, paid: x.paid, status: x.status }))
    };
  }

  /* ---- de aanbieder-kant: de agenda van de behandelaar ----
     Een zorgaanbieder (spa/kliniek) is gekoppeld aan een leveranciersaccount
     via supplierCode. De behandelaar ziet zijn dag: wie komt, wanneer, welke
     behandeling, en de zorgcontext die met toestemming meereist (allergenen
     en, alleen voor een kliniek met een gedeelde intake, de medische notitie).
     Zo staat een notenallergie of bloedverdunner vóór de behandeling op het
     scherm. Afronden zet de afspraak op 'afgerond'. */
  const aanbiedersVanSupplier = code => (db.data.careAanbieders || [])
    .filter(a => String(a.supplierCode || '').toUpperCase() === String(code || '').toUpperCase());

  return { careIntakeDeel, careIntakeStop, careOverzicht, careBoek, careBetaal, careAnnuleer, careMijn, aanbiedersVanSupplier };
};
