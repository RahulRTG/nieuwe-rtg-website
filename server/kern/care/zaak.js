/* Care (deelmodule): de aanbiederkant (dagagenda, afronden met verdiensten)
   en de herstel-/verblijfpakketten met de Butler-boekactie. careBoek en
   careBetaal komen via de context binnen nadat kern/care.js de ledenlaag
   heeft gemount. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, notify, zorgVoor,
    nu, vandaag, eur, INTAKE_DAGEN, lijsten, aanbiederVan, behandelingVan, intakeActief } = ctx;
  const { careBoek, careBetaal, aanbiedersVanSupplier } = ctx;
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

  return { careAgenda, careAfronden, carePakketOverzicht, carePakketBoek, carePakketBetaal, carePakketMijn, boekBehandelingActie };
};
