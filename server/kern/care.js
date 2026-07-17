/* Toren 4: RTG Care. Zorg & welzijn: spa's, wellness en klinieken in het
   ecosysteem. Een lid boekt een behandeling bij een behandelaar in een
   tijdslot; de agenda van die behandelaar is de schaarste (een behandeling
   per behandelaar per slot). Betalen loopt via RTG Pay.

   Twee dingen maken deze toren bijzonder, en allebei staan ze in dienst van
   de zorgvolle keten die al door het hele ecosysteem loopt:

   1. Het zorgprofiel reist mee. Allergenen, dieet en aandachtspunten die het
      lid al deelt (met toestemming), gaan automatisch mee naar de behandelaar
      (een aromamassage met een notenallergie hoort de spa te weten).

   2. Veilige, aparte dossierdeling. Voor een kliniek is het gewone
      zorgprofiel niet genoeg: daar deelt het lid apart en uitdrukkelijk een
      intake (medische context) met precies die ene aanbieder, met een
      einddatum, en het lid of de aanbieder kan het altijd stoppen. Precies
      hetzelfde toestemmingsmodel als het live meekijken met de locatie:
      niets zonder een "ja", en niet langer dan nodig.

   Alleen voor leden (geen gasten). */
module.exports = ({ db, save, crypto, schoon, notify, zorgVoor }) => {
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const eur = c => '€ ' + (c / 100).toFixed(2).replace('.', ',');
  const INTAKE_DAGEN = 90; // een gedeelde intake vervalt vanzelf na een kwartaal

  const lijsten = () => {
    if (!db.data.careBoekingen) db.data.careBoekingen = [];     // geboekte behandelingen
    if (!db.data.careIntake) db.data.careIntake = [];            // toestemmingen: dossier delen met een aanbieder
    if (!Array.isArray(db.data.careAanbieders) || !db.data.careAanbieders.length) {
      db.data.careAanbieders = [
        {
          id: 'zenith', naam: 'Zenith Spa & Wellness', soort: 'spa', icon: '🧖', waar: 'Talamanca, Ibiza',
          supplierCode: 'ZENITH', // gekoppeld leveranciersaccount voor de aanbieder-agenda
          beschrijving: 'Rustige dagspa aan zee: massages, sauna en gezichtsbehandelingen.',
          behandelaars: [
            { id: 'zb1', naam: 'Nadia Sol', functie: 'Massagetherapeut' },
            { id: 'zb2', naam: 'Bram Veer', functie: 'Huidtherapeut' }
          ],
          behandelingen: [
            { id: 'zt1', naam: 'Aromamassage', soort: 'wellness', duurMin: 60, prijs: 95, behandelaarId: 'zb1', tijden: ['10:00', '12:00', '14:00', '16:00'] },
            { id: 'zt2', naam: 'Hot stone massage', soort: 'wellness', duurMin: 90, prijs: 135, behandelaarId: 'zb1', tijden: ['11:00', '15:00'] },
            { id: 'zt3', naam: 'Gezichtsbehandeling', soort: 'wellness', duurMin: 45, prijs: 80, behandelaarId: 'zb2', tijden: ['10:30', '13:30', '15:30'] }
          ]
        },
        {
          id: 'clara', naam: 'Kliniek Clara Ibiza', soort: 'kliniek', icon: '🩺', waar: 'Vila, Ibiza',
          supplierCode: 'CLARA',
          beschrijving: 'Privékliniek voor consulten, kleine ingrepen en herstelbegeleiding.',
          behandelaars: [
            { id: 'cb1', naam: 'Dr. Elena Ruiz', functie: 'Huisarts' },
            { id: 'cb2', naam: 'Dr. Tomas Blad', functie: 'Fysiotherapeut' }
          ],
          behandelingen: [
            { id: 'ct1', naam: 'Consult huisarts', soort: 'medisch', duurMin: 20, prijs: 65, behandelaarId: 'cb1', tijden: ['09:00', '09:30', '10:00', '11:00'] },
            { id: 'ct2', naam: 'Fysiotherapie', soort: 'medisch', duurMin: 30, prijs: 55, behandelaarId: 'cb2', tijden: ['13:00', '14:00', '16:00'] }
          ]
        }
      ];
      save();
    }
  };

  const aanbiederVan = id => (db.data.careAanbieders || []).find(a => a.id === String(id || ''));
  const behandelingVan = (a, id) => a && (a.behandelingen || []).find(b => b.id === String(id || ''));

  /* ---- de intake: een lid deelt medische context met een aanbieder ----
     Apart van het algemene zorgprofiel: uitdrukkelijk, per aanbieder, met een
     einddatum en altijd te stoppen (door het lid of door de aanbieder). */
  const intakeActief = (key, aanbiederId) => {
    lijsten();
    return db.data.careIntake.find(i => i.key === key && i.aanbiederId === aanbiederId &&
      i.status === 'actief' && i.vervaltOp >= vandaag());
  };
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

  function careAgenda(supplierCode, datumIn) {
    lijsten();
    const eigen = aanbiedersVanSupplier(supplierCode);
    if (!eigen.length) return { status: 409, error: 'Dit account is geen zorgaanbieder.' };
    const ids = eigen.map(a => a.id);
    const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(datumIn || '')) ? datumIn : vandaag();
    const behandelaars = [].concat(...eigen.map(a => (a.behandelaars || []).map(b => ({ id: b.id, naam: b.naam, functie: b.functie }))));
    const afspraken = db.data.careBoekingen
      .filter(x => ids.includes(x.aanbiederId) && x.datum === datum && x.paid && x.status !== 'geannuleerd')
      .sort((p, q) => p.tijd.localeCompare(q.tijd))
      .map(x => ({
        ref: x.ref, tijd: x.tijd, duurMin: x.duurMin,
        behandelingNaam: x.behandelingNaam, soort: x.soort,
        behandelaarId: x.behandelaarId, behandelaarNaam: x.behandelaarNaam,
        codenaam: x.codenaam, status: x.status, prijs: x.prijs,
        // de zorgcontext die het lid deelt: allergenen/dieet + (voor een
        // kliniek) de uitdrukkelijk gedeelde intake
        zorg: x.zorg || null, intake: x.intake || null
      }));
    return { ok: true, datum, aanbieder: eigen[0].naam, behandelaars, afspraken };
  }

  function careAfronden(supplierCode, refIn) {
    lijsten();
    const ids = aanbiedersVanSupplier(supplierCode).map(a => a.id);
    const bk = db.data.careBoekingen.find(x => x.ref === String(refIn || '') && ids.includes(x.aanbiederId));
    if (!bk) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (!bk.paid) return { status: 409, error: 'Deze afspraak is nog niet betaald.' };
    bk.status = 'afgerond';
    bk.afgerondOp = nu();
    save();
    if (bk.key) notify(bk.key, { icon: '✅', title: bk.aanbiederNaam + ': tot ziens', body: bk.behandelingNaam + ' afgerond. Fijne dag.', scope: 'care' });
    return { ok: true, ref: bk.ref };
  }

  /* ---- herstel- & verblijfpakketten ----
     Een behandeling gekoppeld aan een hotelverblijf, als één pakket met één
     prijs (voordeliger dan los). Het pakket boekt de behandeling in de gewone
     agenda (met dezelfde schaarste en zorgcontext) en legt het verblijf erbij
     vast. Betalen loopt via RTG Pay, net als de rest. */
  const pakketten = () => {
    if (!db.data.carePakketBoekingen) db.data.carePakketBoekingen = [];
    if (!Array.isArray(db.data.carePakketten) || !db.data.carePakketten.length) {
      db.data.carePakketten = [
        { id: 'herstel', naam: 'Herstel & Ontspan', aanbiederId: 'zenith', behandelingId: 'zt2',
          hotelCode: 'HOSHI', hotelNaam: 'Aguamarina Ibiza', nachten: 2, prijs: 995,
          beschrijving: 'Twee nachten aan zee bij Aguamarina met een hot stone massage bij Zenith. Kom thuis alsof u weken weg was.' },
        { id: 'balans', naam: 'Balans-weekend', aanbiederId: 'zenith', behandelingId: 'zt3',
          hotelCode: 'HOSHI', hotelNaam: 'Aguamarina Ibiza', nachten: 1, prijs: 545,
          beschrijving: 'Een nacht rust met een gezichtsbehandeling. Een korte adempauze op het eiland.' }
      ];
      save();
    }
  };
  const pakketVan = id => (db.data.carePakketten || []).find(p => p.id === String(id || ''));

  // de richtprijs per nacht van het gekoppelde hotel: de goedkoopste kamer,
  // zodat het losse alternatief eerlijk wordt berekend (en dus het voordeel)
  const nachtprijsVan = hotelCode => {
    const h = (db.data.suppliers || []).find(s => s.code === hotelCode);
    const kamers = (h && h.rooms || []).map(r => r.price).filter(n => n > 0);
    return kamers.length ? Math.min.apply(null, kamers) : 400;
  };

  function carePakketOverzicht() {
    pakketten();
    return {
      ok: true,
      pakketten: db.data.carePakketten.map(p => {
        const a = aanbiederVan(p.aanbiederId);
        const b = behandelingVan(a, p.behandelingId);
        const los = (b ? b.prijs : 0) + p.nachten * nachtprijsVan(p.hotelCode); // losse prijs: behandeling + verblijf
        return {
          id: p.id, naam: p.naam, beschrijving: p.beschrijving, prijs: p.prijs,
          aanbiederNaam: a ? a.naam : '', behandelingNaam: b ? b.naam : '', duurMin: b ? b.duurMin : 0,
          tijden: b ? (b.tijden || []) : [], hotelNaam: p.hotelNaam, nachten: p.nachten,
          bespaar: Math.max(0, los - p.prijs)
        };
      })
    };
  }

  function carePakketBoek(sess, codenaam, body) {
    pakketten();
    if (sess.tier === 'guest') return { status: 403, error: 'Boeken kan alleen met een lidmaatschap.' };
    const p = pakketVan(body.pakketId);
    if (!p) return { status: 404, error: 'Dit pakket bestaat niet.' };
    // de behandeling boekt in de gewone agenda: zelfde schaarste en zorgcontext
    const r = careBoek(sess, codenaam, { aanbiederId: p.aanbiederId, behandelingId: p.behandelingId, datum: body.datum, tijd: body.tijd });
    if (r.error) return r;
    const pb = {
      id: crypto.randomBytes(4).toString('hex'),
      ref: 'RTG-P-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      pakketId: p.id, naam: p.naam, key: sess.key, codenaam: schoon(codenaam, 40),
      careRef: r.boeking.ref, hotelCode: p.hotelCode, hotelNaam: p.hotelNaam, nachten: p.nachten,
      datum: r.boeking.datum, tijd: r.boeking.tijd, prijs: p.prijs,
      status: 'wacht-op-betaling', paid: false, at: nu()
    };
    db.data.carePakketBoekingen.unshift(pb);
    db.data.carePakketBoekingen = db.data.carePakketBoekingen.slice(0, 100000);
    save();
    return { ok: true, pakket: pb, behandeling: r.boeking };
  }

  function carePakketBetaal(sess, refIn, verdien) {
    pakketten();
    const pb = db.data.carePakketBoekingen.find(x => x.ref === String(refIn || '') && x.key === sess.key);
    if (!pb) return { status: 404, error: 'Pakketboeking niet gevonden.' };
    if (pb.paid) return { status: 409, error: 'Al betaald.' };
    if (Date.now() - Date.parse(pb.at) > 30 * 60000) return { status: 410, error: 'Deze boeking is verlopen. Boek opnieuw.' };
    // de behandeling in de agenda meebevestigen (zonder los te betalen)
    const bk = db.data.careBoekingen.find(x => x.ref === pb.careRef && x.key === sess.key);
    if (bk && !bk.paid) { bk.paid = true; bk.paidAt = nu(); bk.status = 'geboekt'; }
    pb.paid = true; pb.paidAt = nu(); pb.status = 'geboekt';
    save();
    if (typeof verdien === 'function') { try { verdien(sess.key, pb.prijs, pb.naam); } catch (e) {} }
    notify(sess.key, { icon: '🌸', title: 'Pakket geboekt: ' + pb.naam, body: pb.nachten + ' nachten bij ' + pb.hotelNaam + ' + behandeling op ' + pb.datum + ' om ' + pb.tijd + '.', scope: 'care' });
    return { ok: true, pakket: pb };
  }

  function carePakketMijn(key) {
    pakketten();
    return {
      ok: true,
      pakketten: db.data.carePakketBoekingen.filter(x => x.key === key && x.status !== 'geannuleerd').slice(0, 20)
        .map(x => ({ ref: x.ref, naam: x.naam, hotelNaam: x.hotelNaam, nachten: x.nachten, datum: x.datum, tijd: x.tijd, prijs: x.prijs, paid: x.paid, status: x.status }))
    };
  }

  /* De Butler-actie: exact dezelfde functies achter een gewone zin.
     "boek een massage bij Zenith morgen om 15:00" -> voorstel -> ja. */
  function boekBehandelingActie(session, body, verdien) {
    const r = careBoek(session, body.codenaam || '', body);
    if (r.error) return r;
    return careBetaal(session, r.boeking.ref, verdien);
  }

  return {
    careOverzicht, careBoek, careBetaal, careAnnuleer, careMijn,
    careIntakeDeel, careIntakeStop, boekBehandelingActie,
    careAgenda, careAfronden, aanbiedersVanSupplier,
    carePakketOverzicht, carePakketBoek, carePakketBetaal, carePakketMijn,
    aanbiederVan
  };
};
