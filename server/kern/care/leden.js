/* Care (deelmodule): de ledenkant: de veilige intake-deling (vervalt
   vanzelf), het aanbod, boeken, betalen, annuleren en mijn behandelingen.
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/care.js. */
module.exports = (ctx) => {
  const { save, crypto, schoon, notify, zorgVoor, zorgMee,
    nu, vandaag, eur, INTAKE_DAGEN, lijsten, aanbiederVan, behandelingVan, intakeActief } = ctx;
  const C = ctx.opslag || require('./opslag')(ctx); // ./opslag.js, gebouwd in ../care.js
  const kluisje = ctx.intakesleutel || require('./intakesleutel')(); // art. 9: per veld, gebonden aan de rij
  const { careIntakeDeel, careIntakeStop } = require('./intakedeling')({
    intakes: () => C.bak('careIntake'), save, crypto, schoon, notify, nu,
    INTAKE_DAGEN, lijsten, aanbiederVan, intakeActief, kluisje
  });

  /* ---- het overzicht voor het lid: aanbieders, behandelingen en de eigen
     lopende intakes ---- */
  function careOverzicht(key) {
    lijsten();
    return {
      ok: true,
      aanbieders: C.bak('careAanbieders').map(a => ({
        id: a.id, naam: a.naam, soort: a.soort, icon: a.icon, waar: a.waar, beschrijving: a.beschrijving,
        behandelaars: (a.behandelaars || []).map(b => ({ id: b.id, naam: b.naam, functie: b.functie })),
        behandelingen: (a.behandelingen || []).map(b => ({
          id: b.id, naam: b.naam, soort: b.soort, duurMin: b.duurMin, prijs: b.prijs,
          tijden: b.tijden || [], behandelaarId: b.behandelaarId
        })),
        intakeActief: !!intakeActief(key, a.id)
      })),
      intakes: C.bak('careIntake').filter(i => i.key === key && i.status === 'actief' && i.vervaltOp >= vandaag())
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
    const bezet = C.bak('careBoekingen').find(x => x.aanbiederId === a.id && x.behandelaarId === b.behandelaarId &&
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
      zorg: zorgMee(sess.key, { zaak: 'care:' + a.id, reden: 'zorgprofiel meegegeven bij een zorgboeking' }),
      intake: null,   // hieronder, versleuteld en aan deze boeking gebonden
      status: 'wacht-op-betaling', paid: false, at: nu()
    };
    const ik = intakeActief(sess.key, a.id);
    const tekst = ik ? kluisje.open(ik.medisch, 'intake|' + ik.id + '|' + sess.key) : null;
    if (tekst) { try { boeking.intake = kluisje.sluit(tekst, 'boeking|' + boeking.id); } catch (e) { /* dicht: dan reist hij niet mee */ } }
    C.bak('careBoekingen').unshift(boeking);
    C.zetBak('careBoekingen', C.bak('careBoekingen').slice(0, 200000));
    save();
    // het lid ziet zijn eigen intake terug; in de opslag staat hij alleen versleuteld
    return { ok: true, boeking: Object.assign({}, boeking, { intake: tekst || null }) };
  }

  /* Betaald is: er bewoog geld. Het lid betaalt de zorgaanbieder via RTG Pay
     (pay.betaalZaak); de sleutel hangt aan de boeking (test/carebetaal.test.js). */
  async function careBetaal(sess, refIn, verdien) {
    lijsten();
    const bk = C.bak('careBoekingen').find(x => x.ref === String(refIn || '') && x.key === sess.key);
    if (!bk) return { status: 404, error: 'Boeking niet gevonden.' };
    if (bk.paid) return { status: 409, error: 'Al betaald.' };
    if (Date.now() - Date.parse(bk.at) > 30 * 60000) return { status: 410, error: 'Deze boeking is verlopen. Boek opnieuw.' };
    const a = aanbiederVan(bk.aanbiederId);
    if (!a || !a.supplierCode) return { status: 409, error: 'Deze aanbieder kan nog geen betaling ontvangen. Er is niets afgeschreven.' };
    if (typeof ctx.betaalZaak !== 'function') return { status: 503, error: 'RTG Pay is niet aangesloten; er is niets afgeschreven.' };
    const r = await ctx.betaalZaak({ codenaam: bk.codenaam, supplierCode: a.supplierCode,
      centen: Math.round(Number(bk.prijs) * 100), soort: 'zorg',
      oms: 'Zorg bij ' + bk.aanbiederNaam + ': ' + bk.behandelingNaam, ref: bk.ref, idem: 'care:' + bk.ref });
    if (r.error) return r;
    if (bk.paid) return { ok: true, herhaald: true, boeking: bk }; // een gelijktijdige tik was eerst
    bk.paid = true;
    bk.paidAt = nu();
    bk.status = 'geboekt';
    bk.betaling = { boeking: r.boeking || null, centen: r.betaaldCenten };
    save();
    if (typeof verdien === 'function') { try { verdien(sess.key, bk.prijs, bk.aanbiederNaam); } catch (e) {} }
    notify(sess.key, { icon: 'agenda', title: bk.aanbiederNaam + ': ' + bk.behandelingNaam, body: bk.datum + ' om ' + bk.tijd + ' bij ' + (bk.behandelaarNaam || 'de behandelaar') + '. Tot dan.', scope: 'care' });
    return { ok: true, boeking: bk };
  }

  function careAnnuleer(key, refIn) {
    lijsten();
    const bk = C.bak('careBoekingen').find(x => x.ref === String(refIn || '') && x.key === key);
    if (!bk) return { status: 404, error: 'Boeking niet gevonden.' };
    if (bk.status === 'geannuleerd') return { status: 409, error: 'Al geannuleerd.' };
    bk.status = 'geannuleerd';
    bk.geannuleerdOp = nu();
    save();
    /* Er komt een slot vrij. De wachtlijst hangt LATER in de opbouw dan deze
       laag, dus hij wordt op aanroepmoment uit de context gepakt; ontbreekt hij,
       dan annuleert het gewoon door -- een wachtlijst die niet kan seinen mag
       geen annulering tegenhouden. */
    let gewekt = 0;
    if (typeof ctx.slotVrij === 'function') {
      gewekt = ctx.slotVrij(bk.aanbiederId, bk.datum, bk.tijd, bk.behandelingNaam) || 0;
    }
    return { ok: true, ref: bk.ref, wachtlijstGewekt: gewekt };
  }

  function careMijn(key) {
    lijsten();
    return {
      ok: true,
      boekingen: C.bak('careBoekingen').filter(x => x.key === key && x.status !== 'geannuleerd').slice(0, 30)
        .map(x => ({ ref: x.ref, aanbiederNaam: x.aanbiederNaam, behandelingNaam: x.behandelingNaam,
          behandelaarNaam: x.behandelaarNaam, datum: x.datum, tijd: x.tijd, prijs: x.prijs, paid: x.paid, status: x.status }))
    };
  }

  /* ---- de aanbieder-kant: de agenda van de behandelaar ----
     Gekoppeld via supplierCode: wie komt, welke behandeling, en de zorgcontext
     die met toestemming meereist, zodat een allergie vóór de behandeling op het
     scherm staat. Afronden zet de afspraak op 'afgerond'. */
  const aanbiedersVanSupplier = code => C.kijk('careAanbieders')
    .filter(a => String(a.supplierCode || '').toUpperCase() === String(code || '').toUpperCase());

  return { careIntakeDeel, careIntakeStop, careOverzicht, careBoek, careBetaal, careAnnuleer, careMijn, aanbiedersVanSupplier };
};
