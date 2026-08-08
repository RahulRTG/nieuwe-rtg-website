/* RTG Podium, deelbestand "toegang": DE TWEE MANIEREN OM BINNEN TE KOMEN die
   niet aan de deur van de zone hangen maar aan het KANAAL zelf.

   Een KAARTJE (zone 'evenement') is een eenmalige betaling die deze kijker voor
   een periode binnenlaat, en verder niets: geen abonnement dat doorloopt, geen
   incasso. Het loopt langs precies dezelfde RTG Pay-route als een cadeau.

   Een UITNODIGING (zone 'besloten') is een handeling van de maker, op codenaam.
   Er gaat geen geld mee, en de lijst komt niet naar buiten: wie niet is
   uitgenodigd, ziet het kanaal niet eens bestaan (kern/podium/kanaal.js
   filtert de lijst op poort.magKanaal).

   Krijgt de gedeelde ctx van kern/podium/index.js. */
module.exports = (ctx) => {
  const { save, nu, kanaalMet, metIdem, codenaamVan, pay, zones, poort } = ctx;

  /* ---- het kaartje ----
     Een kaartje is een EENMALIGE betaling die deze kijker voor een periode
     binnenlaat, en verder niets: geen abonnement dat doorloopt, geen incasso.
     Het loopt langs precies dezelfde RTG Pay-route als een cadeau, met dezelfde
     idempotentie -- een dubbeltik koopt geen tweede kaartje. */
  async function kaartje(key, kid, idem) {
    const k = kanaalMet(kid); if (!k || k.status !== 'goedgekeurd') return { status: 404, error: 'Kanaal niet gevonden.' };
    if (k.key === key) return { status: 400, error: 'Dit is uw eigen kanaal.' };
    if (!poort.geldMag(k, 'kaartje')) return { status: 409, error: 'In deze zone worden geen kaartjes verkocht.' };
    const zone = zones.ZONES[zones.zoneVan(k)];
    const basis = poort.magZone(key, zones.zoneVan(k));
    if (!basis.ok) return { status: 403, error: basis.reden };
    if ((k.geblokkeerd || []).includes(key)) return { status: 403, error: 'Dit kanaal is niet beschikbaar.' };
    const centen = Math.round(Number(k.kaartCenten) || 0);
    if (!(centen > 0)) return { status: 409, error: 'Voor dit evenement staat nog geen kaartprijs.' };
    /* De volgorde is gedrag: EERST de idempotentie, DAARNA de vraag of u al een
       kaartje heeft. Andersom krijgt een dubbeltik (dezelfde idem, want de
       verbinding haperde) een fout terug in plaats van hetzelfde antwoord --
       terwijl er niets tweede is gebeurd. Wie later met een NIEUWE idem
       nogmaals koopt terwijl zijn kaartje nog loopt, wordt hieronder wel
       geweigerd; dat is een tweede aankoop en geen herhaling. */
    return metIdem(k, idem ? 'k:' + key + ':' + idem : null, async () => {
      if (poort.kaartjeGeldig(k, key)) return { status: 409, error: 'U heeft al een kaartje.' };
      const r = await pay.stuur({ van: codenaamVan(key), aanCodenaam: codenaamVan(k.key), centen,
        oms: 'Podium · kaartje ' + k.naam, idem: idem ? 'podiumkaart:' + idem : undefined, soort: 'podium' });
      if (r.error) return { status: r.status || 400, error: r.error };
      k.verdiend = Math.round((k.verdiend || 0) + centen);
      k.kaartjes = k.kaartjes || {};
      /* Geldig tot het einde van de dag NA de uitzending: wie een kaartje koopt
         mag het ook nog terugkijken, en het loopt vanzelf af. */
      k.kaartjes[key] = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
      save();
      return { status: 200, ok: true, tot: k.kaartjes[key], zone: zone.naam, saldo: r.saldo };
    });
  }

  /* ---- de uitnodiging (zone 'besloten') ----
     Alleen de maker nodigt uit, op codenaam. Er gaat geen geld mee en er komt
     geen lijst naar buiten: wie niet is uitgenodigd, ziet het kanaal niet
     bestaan (kern/podium/kanaal.js filtert de lijst). */
  async function nodig(key, kid, codenaam, aan) {
    const k = kanaalMet(kid); if (!k || k.key !== key) return { status: 403, error: 'Alleen de maker beheert het kanaal.' };
    if (zones.zoneVan(k) !== 'besloten') return { status: 409, error: 'Uitnodigen hoort bij een besloten kanaal.' };
    /* De gids is ASYNC en geeft een RIJ terug, geen sleutel -- wie dat vergeet,
       zet een Promise in de genodigdenlijst en nodigt daarmee niemand uit,
       zonder dat er iets klaagt. Dezelfde val als in kern/mediaos/hub.js. */
    const rij = ctx.keyVanCodenaam ? await ctx.keyVanCodenaam(String(codenaam || '')) : null;
    const doel = rij && rij.key ? rij.key : null;
    if (!doel) return { status: 404, error: 'Deze codenaam kent RTG niet.' };
    if (doel === key) return { status: 400, error: 'Uzelf uitnodigen hoeft niet.' };
    k.genodigd = (k.genodigd || []).filter(x => x !== doel);
    if (aan !== false) k.genodigd.push(doel);
    save();
    return { status: 200, ok: true, genodigd: k.genodigd.length };
  }

  return { kaartje, nodig };
};
