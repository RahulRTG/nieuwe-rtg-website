/* Mobility OS (deelmodule): het vervoerbewijs. Een kaartje kopen voor een
   RTG-OV-lijn: enkele reis, retour, dagkaart of een zitplaats.

   DRIE POORTEN VOOR ER EEN KAARTJE UIT KOMT, en alle drie moeten open:
   1. de module public_transport_ticketing staat aan in dit gebied
      (kern/mobiliteit/register.js);
   2. er is een GELDIGE overeenkomst met de vervoerder die dit product op deze
      lijn dekt (./overeenkomst) -- want RTG verkoopt namens hem;
   3. de lijn en de haltes bestaan echt bij die vervoerder.
   Geen van de drie is een vinkje: alle drie worden ze op het moment zelf
   uitgerekend, en het antwoord draagt de reden.

   DE PRIJS KOMT UIT EEN FORMULE, NIET UIT TWEE. `ovPrijsVan` (kern/ov) rekent
   ook af bij het uitchecken. Zou de kaartverkoop zijn eigen som doen, dan
   betaalt een reiziger aan de balie iets anders dan bij het uitstappen -- en
   dat merkt niemand tot een klant het uitrekent.

   GELDIGHEID WORDT GEREKEND, NIET BEWAARD. Er staat geen veld `actief` op een
   kaartje dat kan blijven staan nadat het verlopen is; er is een venster en de
   klok. Wat wel bewaard wordt is wat er is GEBEURD: elke validatie, met tijd,
   lijn en wie hem deed. */

const { PRODUCTEN } = require('./geldigheid');

const { maakSleutel } = require('../../db/economische-identiteit');

module.exports = (ctx) => {
  const { db, save, crypto, id, schoon, nu, codenaamVan, haversine, pay,
    findSupplier, ovPrijsVan, modAan, magVerkopen, notify, opslag } = ctx;

  function ensureKaartjes() {
    opslag.bak('mobKaartjes');
  }
  // op ID: de code is een bearer in ./kaarttoegang en staat niet op het kaartje
  const kaartMet = id => { ensureKaartjes(); return (id && opslag.bak('mobKaartjes').find(k => k.id === id)) || null; };
  const kaartenVan = key => { ensureKaartjes(); return opslag.bak('mobKaartjes').filter(k => k.key === key); };

  const lijnVanZaak = (zaak, lijnId) => (zaak.lijnen || []).find(l => l.id === lijnId) || null;
  const halteVan = (lijn, halteId) => (lijn.haltes || []).find(h => h.id === halteId) || null;

  const { kaartStand } = require('./geldigheid')({ abonnementStand: () => ctx.aboStand });

  /* Een kaartje kopen. `session` is het lid; betalen gaat uit de wallet met
     autolaad, precies zoals het uitchecken in RTG OV. */
  async function kaartKoop(session, body = {}) {
    ensureKaartjes();
    const product = schoon(body.product, 20);
    const p = PRODUCTEN[product];
    if (!p) return { status: 400, error: 'Kies een product: ' + Object.keys(PRODUCTEN).join(', ') };

    const zaak = findSupplier(schoon(body.vervoerder, 20));
    if (!zaak || zaak.type !== 'ov') return { status: 404, error: 'Onbekende OV-vervoerder.' };
    const lijn = lijnVanZaak(zaak, schoon(body.lijnId, 40));
    if (!lijn) return { status: 404, error: 'Deze vervoerder rijdt die lijn niet.' };

    const waar = { stad: schoon(body.stad, 40) || zaak.city || null, vervoerder: zaak.code,
      groep: session.tier, key: session.key };
    const m = modAan('public_transport_ticketing', waar);
    if (!m.aan) return { status: 409, error: 'Kaartverkoop is hier niet beschikbaar: ' + m.reden, module: 'public_transport_ticketing' };

    // de overeenkomst: RTG verkoopt namens de vervoerder, of helemaal niet
    const mag = magVerkopen(zaak.code, lijn.id, product);
    if (!mag.mag) return { status: 409, error: 'Er mag hier geen ' + p.naam.toLowerCase() + ' verkocht worden: ' + mag.reden };

    /* Een dagkaart geldt op de hele lijn en heeft dus geen traject; de andere
       producten wel, en die haltes moeten op DEZE lijn liggen. */
    let van = null, naar = null, km = 0;
    if (product !== 'dagkaart') {
      van = halteVan(lijn, schoon(body.van, 40));
      naar = halteVan(lijn, schoon(body.naar, 40));
      if (!van || !naar) return { status: 400, error: 'Kies een begin- en eindhalte op ' + lijn.naam + '.' };
      if (van.id === naar.id) return { status: 400, error: 'Begin- en eindhalte zijn dezelfde.' };
      km = Math.max(0, (haversine(van, naar) || 0) / 1000);
    } else {
      // een dagkaart is de hele lijn waard: de langste afstand erop
      const h = lijn.haltes || [];
      for (let i = 0; i < h.length; i++)
        for (let j = i + 1; j < h.length; j++) km = Math.max(km, (haversine(h[i], h[j]) || 0) / 1000);
    }

    const enkel = ovPrijsVan(lijn, km);
    const prijs = Math.round(enkel * p.factor) + (p.toeslag || 0);

    // betalen met autolaad, dezelfde weg als elke andere RTG-betaling
    const codenaam = codenaamVan(session.key);
    /* MET EEN IDEM VOLGT HET ID UIT DE SLEUTEL. De idem-poort is na een crash
       leeg; met een vers id weigerde de geldlaag de herhaling ("sleutel hoort
       bij een andere boeking"), en viel de crash tussen boeking en kaartje, dan
       was er betaald zonder kaartje (scripts/lib/voltooi/ov.js). */
    const aankoopId = body.idem ? 'kt' + crypto.createHash('sha256')
      .update(codenaam + '\u0000' + schoon(body.idem, 60)).digest('hex').slice(0, 16) : id('kt');
    const al = body.idem ? kaartMet(aankoopId) : null;
    const traject = (h) => (h ? h.id : null);
    if (al) return al.key === session.key && al.lijnId === lijn.id && al.product === product &&
      traject(al.van) === traject(van) && traject(al.naar) === traject(naar)
      ? { ok: true, herhaald: true, kaartje: ctx.kaartBeeld(al, true) }
      : { status: 409, error: 'Deze herhaalsleutel hoort bij een andere aankoop.' };
    const rek = 'lid:' + codenaam;
    const tekort = prijs - pay.saldoVan(rek);
    if (tekort > 0) {
      const l = await pay.laadOp({ codenaam, centen: Math.max(tekort, 1000),
        idem: body.idem ? 'kaartlaad:' + schoon(body.idem, 60) : undefined });
      if (l.error) return { status: l.status || 402, error: l.error };
    }
    // id voor de boeking (hierboven), sleutel eraan: zie ./abonnement.js
    const b = await pay.boekAsync({ van: rek, naar: 'partner:' + zaak.code, centen: prijs, soort: 'ovkaart',
      oms: p.naam + ' · ' + lijn.naam + (van ? ' · ' + van.naam + ' - ' + naar.naam : ''), ref: aankoopId,
      economischeSleutel: maakSleutel('pay-handeling', body.idem
        ? ['ovkaart', codenaam, schoon(body.idem, 60)] : ['ovkaart', aankoopId]) });
    if (b.error) return { status: b.status || 400, error: b.error };
    // een gelijktijdige herhaling kan tijdens het boeken al zijn afgerond
    const intussen = body.idem ? kaartMet(aankoopId) : null;
    if (intussen) return { ok: true, herhaald: true, kaartje: ctx.kaartBeeld(intussen, true) };

    const start = new Date();
    const k = {
      id: aankoopId,
      key: session.key, codenaam,
      vervoerder: zaak.code, vervoerderNaam: zaak.name,
      lijnId: lijn.id, lijnNaam: lijn.naam, soort: lijn.soort,
      product, van: van ? { id: van.id, naam: van.naam } : null, naar: naar ? { id: naar.id, naam: naar.naam } : null,
      km: Math.round(km * 10) / 10, prijs, enkelPrijs: enkel,
      geldigVan: start.toISOString(),
      geldigTot: new Date(start.getTime() + p.urenGeldig * 3600 * 1000).toISOString(),
      overeenkomst: mag.overeenkomst ? mag.overeenkomst.id : null,
      validaties: [], terugbetaald: null, gekocht: nu()
    };
    opslag.bak('mobKaartjes').push(k);
    save();
    notify(session.key, { icon: 'ticket', title: 'RTG OV',
      body: p.naam + ' voor ' + lijn.naam + ' staat in uw app.', scope: 'ov' });
    // via ctx: ./kaartje-beeld wordt NA deze module gemount (late binding)
    return { ok: true, kaartje: ctx.kaartBeeld(k, true) };
  }

  return { KAART_PRODUCTEN: PRODUCTEN, ensureKaartjes, kaartMet, kaartenVan, kaartStand, kaartKoop };
};
