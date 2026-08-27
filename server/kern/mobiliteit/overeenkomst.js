/* Mobility OS (deelmodule): de vervoerdersovereenkomst.

   DIT IS DE POORT ONDER DE KAARTVERKOOP, en hij bestaat om een reden die geen
   techniek is: je kunt niet zelf besluiten dat jouw app een geldig
   vervoerbewijs uitgeeft. Een kaartje is een afspraak tussen de reiziger en de
   VERVOERDER -- die rijdt, die controleert, die draagt het vervoerrisico. RTG
   verkoopt hooguit namens hem, en alleen als hij dat heeft afgesproken.

   Daarom is dit geen instelling maar een dossier: wie, welke lijnen, welke
   producten, van wanneer tot wanneer, en wie het namens beide kanten heeft
   vastgelegd. En daarom staat er in de module-catalogus dat
   public_transport_ticketing `partner_contracts` vereist: zonder dat er
   uberhaupt contracten bestaan, gaat de kaartverkoop niet aan.

   FAIL-CLOSED, OP DRIE MANIEREN.
   1. Geen overeenkomst voor die vervoerder = geen kaartje.
   2. Een overeenkomst die vandaag niet geldt (nog niet begonnen, verlopen,
      ingetrokken) = geen kaartje. De geldigheid wordt elke keer opnieuw
      gerekend; er is geen veld `actief` dat kan blijven staan.
   3. Een lijn of product dat er niet in staat = geen kaartje. Een lege
      lijnenlijst betekent GEEN "alle lijnen" maar geen enkele -- dat is de
      kant waar een vergissing goedkoop is.

   Wat hier NIET staat is geld. De verdeling tussen RTG en de vervoerder is een
   afspraak in het dossier; het verplaatsen ervan loopt via kern/pay, zoals elke
   andere RTG-betaling. */

// wat een overeenkomst kan toestaan; een product dat hier niet staat bestaat niet
const PRODUCTEN = ['enkel', 'retour', 'dagkaart', 'zitplaats', 'abonnement'];

module.exports = (ctx) => {
  const { db, save, id, schoon, nu, findSupplier, opslag } = ctx;

  function ensureOvereenkomsten() {
    opslag.bak('mobOvereenkomsten');
  }

  const datum = v => {
    const s = schoon(v, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };
  const vandaag = () => nu().slice(0, 10);

  /* Geldt deze overeenkomst nu? Altijd met een reden, want "geen kaartje
     beschikbaar" laat een baliemedewerker raden of het contract verlopen is,
     ingetrokken, of nooit getekend. */
  function overeenkomstGeldig(o, opDatum) {
    const d = datum(opDatum) || vandaag();
    if (!o) return { geldig: false, reden: 'er is geen overeenkomst met deze vervoerder' };
    if (o.ingetrokken) return { geldig: false, reden: 'de overeenkomst is ingetrokken op ' + o.ingetrokken.at.slice(0, 10) };
    if (!o.van || !o.tot) return { geldig: false, reden: 'de overeenkomst heeft geen looptijd' };
    if (d < o.van) return { geldig: false, reden: 'de overeenkomst begint pas op ' + o.van };
    if (d > o.tot) return { geldig: false, reden: 'de overeenkomst is verlopen op ' + o.tot };
    if (!o.getekendDoor) return { geldig: false, reden: 'de overeenkomst is niet ondertekend' };
    return { geldig: true, reden: 'geldig tot ' + o.tot };
  }

  const overeenkomstenVan = code => {
    ensureOvereenkomsten();
    return opslag.bak('mobOvereenkomsten').filter(o => o.vervoerder === code);
  };

  /* De geldige overeenkomst voor een vervoerder op een dag. Meerdere kunnen er
     zijn (een verlengde loopt naast een aflopende); de eerste die geldt wint. */
  function overeenkomstVoor(vervoerder, opDatum) {
    for (const o of overeenkomstenVan(schoon(vervoerder, 20))) {
      const g = overeenkomstGeldig(o, opDatum);
      if (g.geldig) return { overeenkomst: o, geldig: true, reden: g.reden };
    }
    const alle = overeenkomstenVan(schoon(vervoerder, 20));
    if (!alle.length) return { overeenkomst: null, geldig: false, reden: 'er is geen overeenkomst met deze vervoerder' };
    // geen enkele geldt: geef de reden van de meest recente terug, die zegt het meest
    const laatste = alle[alle.length - 1];
    return { overeenkomst: null, geldig: false, reden: overeenkomstGeldig(laatste, opDatum).reden };
  }

  /* Mag er een kaartje van dit product op deze lijn verkocht worden? Dit is de
     enige vraag die de kaartverkoop stelt, en het antwoord draagt zijn reden. */
  function magVerkopen(vervoerder, lijnId, product, opDatum) {
    const v = overeenkomstVoor(vervoerder, opDatum);
    if (!v.geldig) return { mag: false, reden: v.reden };
    const o = v.overeenkomst;
    if (!PRODUCTEN.includes(product)) return { mag: false, reden: 'onbekend product ' + product };
    if (!(o.producten || []).includes(product))
      return { mag: false, reden: 'de overeenkomst dekt geen ' + product + ' (wel: ' + (o.producten || []).join(', ') + ')' };
    if (!(o.lijnen || []).includes(lijnId))
      return { mag: false, reden: 'de overeenkomst dekt lijn ' + lijnId + ' niet' };
    return { mag: true, reden: v.reden, overeenkomst: o };
  }

  /* Vastleggen of bijwerken. Alleen het kantoor komt hierbij (de route bewaakt
     dat): een vervoerder die zijn eigen overeenkomst kan schrijven, is geen
     overeenkomst maar een vinkje. */
  function overeenkomstZet(body = {}, door) {
    ensureOvereenkomsten();
    /* Eerst het dossier opzoeken, dan pas de vervoerder. Andersom stond hier de
       vervoerderscontrole boven de id-controle, en dan kon je een overeenkomst
       niet INTREKKEN zonder er de vervoerder bij te typen die er al op staat --
       een opzegging die om een overbodig veld struikelt is een val, en juist
       opzeggen moet altijd lukken. */
    const bestaand = body.id ? (opslag.bak('mobOvereenkomsten').find(o => o.id === schoon(body.id, 40)) || null) : null;
    if (body.id && !bestaand) return { status: 404, error: 'Overeenkomst niet gevonden.' };
    if (bestaand && body.intrekken) {
      bestaand.ingetrokken = { at: nu(), door: schoon(door, 60) || 'kantoor', reden: schoon(body.reden, 200) || null };
      save();
      return { ok: true, overeenkomst: overeenkomstBeeld(bestaand) };
    }

    const code = schoon(body.vervoerder, 20) || (bestaand && bestaand.vervoerder);
    const zaak = findSupplier(code);
    if (!zaak) return { status: 404, error: 'Onbekende vervoerder.' };
    if (zaak.type !== 'ov') return { status: 409, error: 'Een vervoerbewijs hoort bij een OV-vervoerder.' };

    const van = datum(body.van), tot = datum(body.tot);
    if (!van || !tot) return { status: 400, error: 'Geef een looptijd op als jjjj-mm-dd (van en tot).' };
    if (tot < van) return { status: 400, error: 'De einddatum ligt voor de begindatum.' };

    const producten = (Array.isArray(body.producten) ? body.producten : []).filter(p => PRODUCTEN.includes(p));
    if (!producten.length) return { status: 400, error: 'Noem minstens een product: ' + PRODUCTEN.join(', ') };

    // alleen lijnen die deze vervoerder ECHT rijdt; anders dekt het contract lucht
    const eigen = new Set((zaak.lijnen || []).map(l => l.id));
    const lijnen = (Array.isArray(body.lijnen) ? body.lijnen : []).map(l => schoon(l, 40)).filter(l => eigen.has(l));
    if (!lijnen.length)
      return { status: 400, error: 'Noem minstens een lijn die ' + zaak.name + ' zelf rijdt (' + [...eigen].join(', ') + ').' };

    const tekenaar = schoon(body.getekendDoor, 80);
    if (!tekenaar) return { status: 400, error: 'Noteer wie de overeenkomst namens de vervoerder heeft getekend.' };

    /* De abonnementsprijs staat in de OVEREENKOMST en wordt nergens berekend.
       Een losse rit volgt het kilometertarief van de lijn, maar wat een
       maandkaart kost is een commerciele afspraak met de vervoerder -- dat
       verzinnen wij niet, en een abonnement zonder afgesproken prijs is dus
       geen aanbod maar een gat. */
    const abo = Math.round(Number(body.abonnementPrijs) || 0);
    if (producten.includes('abonnement') && !(abo > 0))
      return { status: 400, error: 'Noteer wat het abonnement per periode kost (abonnementPrijs, in centen).' };
    const dagen = Math.round(Number(body.abonnementDagen) || 30);
    if (producten.includes('abonnement') && (dagen < 1 || dagen > 366))
      return { status: 400, error: 'De abonnementsperiode telt 1 tot 366 dagen.' };

    const o = bestaand || { id: id('ok'), vervoerder: code, gemaakt: nu() };
    Object.assign(o, { vervoerderNaam: zaak.name, van, tot, producten, lijnen,
      getekendDoor: tekenaar, vastgelegdDoor: schoon(door, 60) || 'kantoor',
      // de afspraak over het geld; verplaatsen gebeurt in kern/pay, niet hier
      afdrachtDeel: Math.min(1, Math.max(0, Number(body.afdrachtDeel) || 1)),
      abonnementPrijs: abo || null, abonnementDagen: producten.includes('abonnement') ? dagen : null,
      ingetrokken: null, gewijzigd: nu() });
    if (!bestaand) opslag.bak('mobOvereenkomsten').push(o);
    save();
    return { ok: true, overeenkomst: overeenkomstBeeld(o) };
  }

  function overeenkomstBeeld(o) {
    const g = overeenkomstGeldig(o);
    return { id: o.id, vervoerder: o.vervoerder, vervoerderNaam: o.vervoerderNaam,
      van: o.van, tot: o.tot, producten: o.producten, lijnen: o.lijnen,
      getekendDoor: o.getekendDoor, vastgelegdDoor: o.vastgelegdDoor,
      afdrachtDeel: o.afdrachtDeel, abonnementPrijs: o.abonnementPrijs || null,
      abonnementDagen: o.abonnementDagen || null, ingetrokken: o.ingetrokken || null,
      geldigNu: g.geldig, reden: g.reden };
  }

  function overeenkomstLijst(body = {}) {
    ensureOvereenkomsten();
    const code = schoon(body.vervoerder, 20);
    const lijst = code ? overeenkomstenVan(code) : opslag.bak('mobOvereenkomsten');
    return { ok: true, overeenkomsten: lijst.map(overeenkomstBeeld), producten: PRODUCTEN };
  }

  return { PRODUCTEN, ensureOvereenkomsten, overeenkomstZet, overeenkomstLijst, overeenkomstBeeld,
    overeenkomstVoor, overeenkomstGeldig, magVerkopen };
};
