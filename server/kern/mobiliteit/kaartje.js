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

// hoe een product zich tot de enkele-reisprijs verhoudt, en hoe lang het geldt
const PRODUCTEN = {
  enkel: { naam: 'Enkele reis', factor: 1, urenGeldig: 2, ritten: 1 },
  // de terugweg met korting: een retour is geen twee losse kaartjes
  retour: { naam: 'Retour', factor: 1.8, urenGeldig: 24, ritten: 2 },
  dagkaart: { naam: 'Dagkaart', factor: 3, urenGeldig: 24, ritten: 99 },
  zitplaats: { naam: 'Zitplaats', factor: 1, urenGeldig: 24, ritten: 1, toeslag: 150 }
};

module.exports = (ctx) => {
  const { db, save, crypto, id, schoon, nu, codenaamVan, haversine, pay,
    findSupplier, ovPrijsVan, modAan, magVerkopen, notify } = ctx;

  function ensureKaartjes() {
    if (!Array.isArray(db.data.mobKaartjes)) db.data.mobKaartjes = [];
  }
  const kaartMet = code => { ensureKaartjes(); return db.data.mobKaartjes.find(k => k.code === code) || null; };
  const kaartenVan = key => { ensureKaartjes(); return db.data.mobKaartjes.filter(k => k.key === key); };

  const lijnVanZaak = (zaak, lijnId) => (zaak.lijnen || []).find(l => l.id === lijnId) || null;
  const halteVan = (lijn, halteId) => (lijn.haltes || []).find(h => h.id === halteId) || null;

  /* Wat is dit kaartje nu waard? Geldig, opgebruikt of verlopen -- uitgerekend
     uit het venster en de validaties, nooit uit een bewaard vlaggetje. */
  function kaartStand(k) {
    /* Alleen een VOLLEDIGE teruggave maakt het kaartje ongeldig. Bij een
       vertraging krijgt de reiziger een deel terug als vergoeding en rijdt hij
       gewoon mee -- hier stond eerst dat elke teruggave het kaartje afsloot, en
       dan pakt de compensatie voor een late bus zijn rit af. Bij uitval is het
       omgekeerd juist: die rit is niet gereden en het geld is helemaal terug. */
    if (k.terugbetaald && k.terugbetaald.volledig)
      return { stand: 'terugbetaald', reden: 'de rit is uitgevallen; het bedrag is terugbetaald op ' +
        k.terugbetaald.at.slice(0, 16).replace('T', ' ') };
    const p = PRODUCTEN[k.product] || PRODUCTEN.enkel;
    const gebruikt = (k.validaties || []).length;
    if (gebruikt >= p.ritten) return { stand: 'gebruikt', reden: 'volledig gebruikt (' + gebruikt + ' van ' + p.ritten + ')' };
    const nuMs = Date.now();
    if (nuMs < new Date(k.geldigVan).getTime())
      return { stand: 'nog-niet-geldig', reden: 'geldig vanaf ' + k.geldigVan.slice(0, 16).replace('T', ' ') };
    if (nuMs > new Date(k.geldigTot).getTime())
      return { stand: 'verlopen', reden: 'verlopen op ' + k.geldigTot.slice(0, 16).replace('T', ' ') };
    return { stand: 'geldig', reden: 'geldig tot ' + k.geldigTot.slice(0, 16).replace('T', ' '),
      rittenOver: p.ritten - gebruikt };
  }

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
    const rek = 'lid:' + codenaam;
    const tekort = prijs - pay.saldoVan(rek);
    if (tekort > 0) {
      const l = await pay.laadOp({ codenaam, centen: Math.max(tekort, 1000),
        idem: body.idem ? 'kaartlaad:' + schoon(body.idem, 60) : undefined });
      if (l.error) return { status: l.status || 402, error: l.error };
    }
    const b = await pay.boekAsync({ van: rek, naar: 'partner:' + zaak.code, centen: prijs, soort: 'ovkaart',
      oms: p.naam + ' · ' + lijn.naam + (van ? ' · ' + van.naam + ' - ' + naar.naam : '') });
    if (b.error) return { status: b.status || 400, error: b.error };

    const start = new Date();
    const k = {
      id: id('kt'),
      // de code is het vervoerbewijs zelf: uit de CSPRNG, want wie hem raadt reist gratis
      code: crypto.randomBytes(9).toString('base64url').toUpperCase(),
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
    db.data.mobKaartjes.push(k);
    save();
    notify(session.key, { icon: 'ticket', title: 'RTG OV',
      body: p.naam + ' voor ' + lijn.naam + ' staat in uw app.', scope: 'ov' });
    // via ctx: ./kaartje-beeld wordt NA deze module gemount (late binding)
    return { ok: true, kaartje: ctx.kaartBeeld(k, true) };
  }

  return { KAART_PRODUCTEN: PRODUCTEN, ensureKaartjes, kaartMet, kaartenVan, kaartStand, kaartKoop };
};
