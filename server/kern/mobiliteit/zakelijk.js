/* Mobility OS (deelmodule): de werkgeverskant. De ritten die op akkoord
   wachten, het besluit daarover, en het maandoverzicht per kostenplaats.

   EEN RIT DIE OP AKKOORD WACHT GAAT NIET NAAR DE DISPATCH. Dat is de hele
   betekenis van een drempel: zou de wagen alvast rijden, dan is de goedkeuring
   een formaliteit achteraf en kan een leidinggevende alleen nog "nee" zeggen
   tegen iets dat al gebeurd is. De opdracht bestaat wel -- de medewerker moet
   kunnen zien dat zijn aanvraag loopt -- maar hij staat op geen enkel
   planbord tot iemand ja zegt.

   HET BESLUIT IS VAN EEN MENS EN DRAAGT ZIJN NAAM. Geen automatische
   goedkeuring bij stilte, geen tijdslot waarna het vanzelf doorgaat: wie niets
   doet, keurt niets goed. Een aanvraag die blijft liggen is een probleem tussen
   collega's; hem stilzwijgend laten doorgaan zou er een probleem met de
   boekhouding van maken.

   HET MAANDOVERZICHT TELT WAT ER ECHT STAAT. Geen aparte administratie naast
   de rittenmotor: de opdrachten met deze organisatie als betaler, gegroepeerd
   per kostenplaats, met de uitstoot erbij als SCHATTING (zie ./reisfactoren --
   die zegt er zelf bij hoe hij eraan komt). */

module.exports = (ctx) => {
  const { db, save, schoon, nu, notify, findSupplier, opdrachtMet, opdrachtBeeld,
    opdrachtAnnuleer, co2Van, sseToOffice, beleidToets, werktBij, opslag } = ctx;

  const zakelijkeOpdrachten = org => (opslag.bak('mobOpdrachten') || [])
    .filter(o => o.organisatie === schoon(org, 20).toUpperCase());

  /* DE POORT WAAR ELKE ZAKELIJKE RIT DOORHEEN MOET. Hij hangt in de
     rittenmotor zelf (./opdracht) en niet bij een route, omdat er meer dan een
     weg naar een rit op rekening van een bedrijf loopt: de app, de reisplanner,
     de dispatcher. Een controle per weg is een controle die de volgende weg
     vergeet -- en zo kon hier tot vandaag elk lid dat een bedrijfscode kende op
     diens rekening rijden.

     ZONDER REIZIGER VALT ER NIETS NA TE TREKKEN. Een pendelrit wordt gemaakt
     door de planner van het bedrijf zelf, achter de inlog van dat bedrijf; daar
     is de werkgever de boeker en niet een medewerker. */
  function zakelijkePoort(actor, voorstel = {}) {
    if (!actor.org || !actor.key) return { goedkeuring: null, medewerker: null };
    const t = beleidToets(actor.org, actor.key, voorstel);
    if (!t.mag) return { status: 403, error: t.redenen.join(' '), redenen: t.redenen };
    const p = werktBij(actor.key, actor.org);
    return { medewerker: (p && p.name) || null,
      goedkeuring: t.goedkeuringNodig
        ? { status: 'wacht', drempel: (t.beleid && t.beleid.goedkeuringVanaf) || 0,
          reden: t.uitleg, sinds: nu() }
        : null };
  }

  /* Wat er op akkoord wacht. Voor de leidinggevende: wie, waarheen, hoeveel,
     en waarom het langs hem komt. Op CODENAAM, want ook een werkgever hoeft
     niet te weten welk lid welke rit vroeg -- hij ziet zijn medewerker, en dat
     is de personeelsnaam die hij al kent. */
  function zakelijkWacht(org) {
    const uit = zakelijkeOpdrachten(org)
      .filter(o => o.goedkeuring && o.goedkeuring.status === 'wacht')
      .map(o => ({ ref: o.ref, van: o.van, naar: o.naar, prijs: o.prijs, km: o.km,
        ritsoort: o.ritsoort, kostenplaats: o.kostenplaats || null,
        medewerker: o.medewerkerNaam || o.reizigerCodenaam,
        gevraagd: o.gemaakt, drempel: o.goedkeuring.drempel || null,
        reden: o.goedkeuring.reden || null }));
    return { ok: true, wachtend: uit,
      uitleg: uit.length ? null : 'Er wacht niets op uw akkoord.' };
  }

  /* Het besluit. `akkoord: true` laat de rit los richting de dispatch; `false`
     annuleert hem, want een geweigerde zakelijke rit die blijft staan is een
     rit die iemand alsnog gaat rijden. */
  function zakelijkBesluit(org, actor, body = {}) {
    const code = schoon(org, 20).toUpperCase();
    const o = opdrachtMet(schoon(body.ref, 30));
    if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    if (o.organisatie !== code) return { status: 403, error: 'Deze rit staat niet op uw organisatie.' };
    if (!o.goedkeuring || o.goedkeuring.status !== 'wacht')
      return { status: 409, error: 'Deze rit wacht niet (meer) op een besluit.' };

    const akkoord = !!body.akkoord;
    o.goedkeuring = Object.assign({}, o.goedkeuring, {
      status: akkoord ? 'akkoord' : 'geweigerd',
      door: schoon(actor, 60) || 'leidinggevende', at: nu(),
      toelichting: schoon(body.toelichting, 200) || null });
    save();

    if (!akkoord) {
      /* Weigeren annuleert de rit. Hem laten staan zou een opdracht opleveren
         die niemand goedkeurde en die toch op een planbord kan belanden zodra
         iemand de goedkeuringsfilter vergeet. */
      opdrachtAnnuleer(o.ref, 'werkgever', 'niet goedgekeurd: ' +
        (o.goedkeuring.toelichting || 'geen toelichting'));
    }
    if (o.reiziger) notify(o.reiziger, { icon: 'auto', title: 'RTG Vervoer',
      body: akkoord ? 'Uw zakelijke rit is goedgekeurd.' : 'Uw zakelijke rit is niet goedgekeurd.',
      scope: 'mobiliteit' });
    sseToOffice('sync', { scope: 'mobiliteit' });
    return { ok: true, opdracht: opdrachtBeeld(opdrachtMet(o.ref), true),
      uitleg: akkoord ? 'De rit is vrijgegeven en staat nu op het planbord.'
        : 'De rit is geweigerd en geannuleerd; de medewerker kan hem desgewenst op eigen rekening boeken.' };
  }

  /* Het maandoverzicht: wat er is gereden, per kostenplaats, met de uitstoot.
     De basis is de rittenmotor zelf -- geen tweede administratie die eigen
     getallen bijhoudt en er binnen een kwartaal naast zit. */
  function zakelijkOverzicht(org, body = {}) {
    const code = schoon(org, 20).toUpperCase();
    const zaak = findSupplier(code);
    const maand = /^\d{4}-\d{2}$/.test(String(body.maand || '')) ? String(body.maand) : nu().slice(0, 7);
    const ritten = zakelijkeOpdrachten(code).filter(o => String(o.gemaakt).slice(0, 7) === maand);

    const tel = (lijst) => ({
      aantal: lijst.length,
      centen: lijst.reduce((n, o) => n + (o.prijs || 0), 0),
      km: Math.round(lijst.reduce((n, o) => n + (o.km || 0), 0) * 10) / 10,
      co2Gram: lijst.reduce((n, o) => n + co2Van(o.categorie || 'taxi', o.km || 0).gram, 0)
    });

    const gereden = ritten.filter(o => !['geannuleerd'].includes(o.status));
    const perKostenplaats = {};
    for (const o of gereden) {
      const k = o.kostenplaats || 'zonder kostenplaats';
      (perKostenplaats[k] = perKostenplaats[k] || []).push(o);
    }
    const perMedewerker = {};
    for (const o of gereden) {
      const m = o.medewerkerNaam || o.reizigerCodenaam || 'onbekend';
      (perMedewerker[m] = perMedewerker[m] || []).push(o);
    }

    return { ok: true, organisatie: code, naam: zaak ? zaak.name : code, maand,
      totaal: tel(gereden),
      geannuleerd: tel(ritten.filter(o => o.status === 'geannuleerd')),
      wachtend: ritten.filter(o => o.goedkeuring && o.goedkeuring.status === 'wacht').length,
      geweigerd: ritten.filter(o => o.goedkeuring && o.goedkeuring.status === 'geweigerd').length,
      perKostenplaats: Object.entries(perKostenplaats)
        .map(([k, v]) => Object.assign({ kostenplaats: k }, tel(v)))
        .sort((a, b) => b.centen - a.centen),
      perMedewerker: Object.entries(perMedewerker)
        .map(([k, v]) => Object.assign({ medewerker: k }, tel(v)))
        .sort((a, b) => b.centen - a.centen),
      ritten: gereden.slice(0, 200).map(o => ({ ref: o.ref, gemaakt: o.gemaakt,
        van: o.van.label, naar: o.naar.label, km: o.km, prijs: o.prijs,
        kostenplaats: o.kostenplaats || null, status: o.status,
        medewerker: o.medewerkerNaam || o.reizigerCodenaam })),
      co2Uitleg: 'De uitstoot is een schatting op basis van indicatieve gemiddelden per reizigerskilometer, ' +
        'geen meting aan het voertuig.' };
  }

  return { zakelijkePoort, zakelijkWacht, zakelijkBesluit, zakelijkOverzicht, zakelijkeOpdrachten };
};
