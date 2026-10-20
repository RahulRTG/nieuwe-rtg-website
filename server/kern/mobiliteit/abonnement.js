/* Mobility OS (deelmodule): het OV-abonnement. Een periodekaart waarmee je
   onbeperkt reist op de lijnen die de overeenkomst dekt.

   EEN ABONNEMENT IS HIER GEEN TWEEDE SOORT DING. Het wordt bewaard als een
   kaartje met product 'abonnement', in dezelfde voorraad en met dezelfde code
   (kaarttoegang.js).
   Dat is met opzet: de conducteur controleert dan langs precies EEN weg, de
   geldigheid wordt met dezelfde som gerekend, en er is geen tweede plek waar
   een vervoerbewijs kan bestaan. Een apart abonnementenregister zou binnen een
   maand een eigen controlepad krijgen, en dan is er een kaartje dat de ene weg
   wel en de andere niet kent.

   DE PRIJS KOMT UIT DE OVEREENKOMST, NIET UIT EEN FORMULE. Een losse rit volgt
   het kilometertarief van de lijn; wat een maandkaart kost is een commerciele
   afspraak met de vervoerder. Die staat in het contract (abonnementPrijs,
   abonnementDagen) en wordt hier alleen overgenomen.

   ONBEPERKT REIZEN IS ECHT ONBEPERKT, maar alleen op de lijnen die de
   overeenkomst noemt en alleen binnen de looptijd. Het aantal ritten wordt wel
   BIJGEHOUDEN -- niet om een grens te bewaken, maar omdat een reiziger mag zien
   waar zijn geld heen ging en een vervoerder moet weten hoe vaak zijn
   abonnementhouders rijden. Er hangt geen limiet aan; dat staat er ook bij. */

const PERIODE_MAX = 366;

const { maakSleutel } = require('../../db/economische-identiteit');

module.exports = (ctx) => {
  const { db, save, crypto, id, schoon, nu, codenaamVan, pay, findSupplier,
    modAan, overeenkomstVoor, magVerkopen, notify, ensureKaartjes, kaartenVan, opslag } = ctx;

  const { dagenMs, aboStand, aboGeldtOp } = require('./geldigheid');

  /* Een abonnement kopen. Dezelfde drie poorten als een los kaartje, plus de
     module `subscriptions` -- want een abonnement is een doorlopende afspraak
     en dat is een product op zichzelf. */
  async function aboKoop(session, body = {}) {
    ensureKaartjes();
    const zaak = findSupplier(schoon(body.vervoerder, 20));
    if (!zaak || zaak.type !== 'ov') return { status: 404, error: 'Onbekende OV-vervoerder.' };

    /* MET EEN IDEM VOLGT HET ID UIT DE SLEUTEL, en een herhaling krijgt het
       abonnement dat er al is -- ook na een crash tussen boeking en abonnement,
       wanneer het geheugen van de idem-laag leeg is (zie ./kaartje.js). */
    const herhaal = () => {
      const al = body.idem ? opslag.bak('mobKaartjes').find(k => k.id === aankoopId) : null;
      if (!al) return null;
      return al.key === session.key && al.product === 'abonnement' && al.vervoerder === zaak.code
        ? { ok: true, herhaald: true, abonnement: aboBeeld(al, true) }
        : { status: 409, error: 'Deze herhaalsleutel hoort bij een andere aankoop.' };
    };
    const aankoopId = body.idem ? 'ab' + crypto.createHash('sha256')
      .update(codenaamVan(session.key) + '\u0000' + schoon(body.idem, 60)).digest('hex').slice(0, 16) : id('ab');
    const eerder = herhaal();
    if (eerder) return eerder;

    const waar = { stad: schoon(body.stad, 40) || zaak.city || null, vervoerder: zaak.code,
      groep: session.tier, key: session.key };
    for (const m of ['public_transport_ticketing', 'subscriptions']) {
      const st = modAan(m, waar);
      if (!st.aan) return { status: 409, error: 'Abonnementen zijn hier niet beschikbaar: ' + st.reden, module: m };
    }

    const v = overeenkomstVoor(zaak.code);
    if (!v.geldig) return { status: 409, error: 'Er kan hier geen abonnement verkocht worden: ' + v.reden };
    const o = v.overeenkomst;
    if (!(o.producten || []).includes('abonnement'))
      return { status: 409, error: 'De overeenkomst met ' + zaak.name + ' dekt geen abonnementen.' };
    if (!(o.abonnementPrijs > 0))
      return { status: 409, error: 'Er staat geen abonnementsprijs in de overeenkomst.' };

    /* Al een lopend abonnement bij deze vervoerder? Dan niet nog een. Twee
       tegelijk zou dubbel betalen zijn zonder dat je er iets voor terugkrijgt --
       onbeperkt is al onbeperkt. */
    const lopend = aboVan(session.key).find(a => a.vervoerder === zaak.code && aboStand(a).stand === 'geldig');
    if (lopend) return { status: 409, error: 'U heeft al een lopend abonnement bij ' + zaak.name +
      ' tot ' + lopend.geldigTot.slice(0, 10) + '.' };

    const dagen = Math.min(PERIODE_MAX, Math.max(1, Math.round(o.abonnementDagen || 30)));
    const prijs = Math.round(o.abonnementPrijs);

    // betalen met autolaad, dezelfde weg als een los kaartje
    const codenaam = codenaamVan(session.key);
    const rek = 'lid:' + codenaam;
    const tekort = prijs - pay.saldoVan(rek);
    if (tekort > 0) {
      const l = await pay.laadOp({ codenaam, centen: Math.max(tekort, 1000),
        idem: body.idem ? 'abolaad:' + schoon(body.idem, 60) : undefined });
      if (l.error) return { status: l.status || 402, error: l.error };
    }
    /* De aankoop kreeg haar id hierboven, VOOR de boeking, en de sleutel hangt
       eraan: met een idem van de client is een herhaling dezelfde aankoop,
       zonder is elke aankoop er een (zoals altijd). */
    const b = await pay.boekAsync({ van: rek, naar: 'partner:' + zaak.code, centen: prijs, soort: 'ovabo',
      oms: 'Abonnement ' + zaak.name + ' · ' + dagen + ' dagen', ref: aankoopId,
      economischeSleutel: maakSleutel('pay-handeling', body.idem
        ? ['ovabo', codenaam, schoon(body.idem, 60)] : ['ovabo', aankoopId]) });
    if (b.error) return { status: b.status || 400, error: b.error };
    // een gelijktijdige herhaling kan tijdens het boeken al zijn afgerond
    const intussen = herhaal();
    if (intussen) return intussen;

    const start = new Date();
    const a = {
      id: aankoopId,
      key: session.key, codenaam,
      vervoerder: zaak.code, vervoerderNaam: zaak.name,
      product: 'abonnement',
      // een abonnement geldt op ALLE lijnen die de overeenkomst dekt
      lijnen: (o.lijnen || []).slice(),
      lijnId: null, lijnNaam: 'alle lijnen in de overeenkomst',
      van: null, naar: null, km: 0,
      prijs, dagen, dagPrijs: Math.round(prijs / dagen),
      geldigVan: start.toISOString(),
      geldigTot: new Date(start.getTime() + dagenMs(dagen)).toISOString(),
      overeenkomst: o.id, validaties: [], terugbetaald: null, gekocht: nu()
    };
    opslag.bak('mobKaartjes').push(a);
    save();
    notify(session.key, { icon: 'ticket', title: 'RTG OV',
      body: 'Uw abonnement bij ' + zaak.name + ' loopt tot ' + a.geldigTot.slice(0, 10) + '.', scope: 'ov' });
    return { ok: true, abonnement: aboBeeld(a, true) };
  }

  const aboVan = key => kaartenVan(key).filter(k => k.product === 'abonnement');

  function aboBeeld(a, eigen) {
    const st = aboStand(a);
    const b = { id: a.id, product: 'abonnement', productNaam: 'Abonnement',
      vervoerder: a.vervoerder, vervoerderNaam: a.vervoerderNaam,
      lijnen: a.lijnen || [], prijs: a.prijs, dagen: a.dagen, dagPrijs: a.dagPrijs,
      geldigVan: a.geldigVan, geldigTot: a.geldigTot,
      stand: st.stand, reden: st.reden, dagenOver: st.dagenOver || 0,
      ritten: (a.validaties || []).length,
      // bewust erbij: geteld, niet begrensd
      rittenUitleg: 'Onbeperkt reizen; het aantal staat er alleen zodat u het kunt zien.',
      terugbetaald: a.terugbetaald || null, gekocht: a.gekocht };
    return b;
  }

  const aboMijn = session => ({ ok: true, abonnementen: aboVan(session.key).slice(-10).reverse().map(a => aboBeeld(a, true)) });

  /* Wat er aan abonnementen te koop is bij een vervoerder, met de reden erbij
     als er niets is. */
  function aboAanbod(session, body = {}) {
    const zaak = findSupplier(schoon(body.vervoerder, 20));
    if (!zaak || zaak.type !== 'ov') return { status: 404, error: 'Onbekende OV-vervoerder.' };
    const waar = { stad: schoon(body.stad, 40) || zaak.city || null, vervoerder: zaak.code,
      groep: session.tier, key: session.key };
    for (const m of ['public_transport_ticketing', 'subscriptions']) {
      const st = modAan(m, waar);
      if (!st.aan) return { ok: true, aanbod: null, reden: st.reden };
    }
    const mag = magVerkopen(zaak.code, (zaak.lijnen && zaak.lijnen[0] && zaak.lijnen[0].id) || '', 'abonnement');
    const v = overeenkomstVoor(zaak.code);
    if (!v.geldig || !v.overeenkomst.abonnementPrijs)
      return { ok: true, aanbod: null, reden: v.geldig ? 'De overeenkomst dekt geen abonnementen.' : v.reden };
    const o = v.overeenkomst;
    return { ok: true, aanbod: { vervoerder: zaak.code, vervoerderNaam: zaak.name,
      prijs: o.abonnementPrijs, dagen: o.abonnementDagen || 30,
      lijnen: o.lijnen, magVerkopen: mag.mag }, reden: null };
  }

  return { aboKoop, aboMijn, aboAanbod, aboBeeld, aboStand, aboGeldtOp, aboVan };
};
