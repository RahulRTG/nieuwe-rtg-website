/* Mobility OS (deelmodule): de geboekte reis. Een gekozen plan uit
   ./reisplan wordt hier echt: de taxi-etappes worden opdrachten in de
   rittenmotor, de OV-etappes worden vervoerbewijzen, en de reiziger houdt EEN
   overzicht met EEN totaal.

   HET PLAN WORDT OPNIEUW GEREKEND, NOOIT OVERGENOMEN. De app stuurt alleen
   welke optie het werd; vertrek, bestemming en prijs komen uit een verse
   planning op de server. Zou de prijs uit het verzoek komen, dan bepaalt de
   client wat een rit kost -- en dat is geen theoretisch lek maar het eerste wat
   iemand probeert.

   DE VOLGORDE VAN BOEKEN IS EEN BESLUIT. Eerst de ritten (daar beweegt nog geen
   geld), dan de kaartjes (daar wel). Mislukt er halverwege iets, dan worden de
   al aangemaakte ritten geannuleerd en is er niets betaald. Andersom zou een
   mislukte tweede etappe een betaald kaartje achterlaten voor een reis die niet
   doorgaat, en dan moet iemand met de hand geld terugzoeken.

   EEN REIS IS GEEN ENKELE BETALING, EN DAT STAAT ER OOK. Het kaartje wordt nu
   afgerekend, de rit bij het afronden -- want tot hij gereden is, is de ritprijs
   een schatting. Een reis die doet alsof alles vooraf vaststaat, corrigeert
   achteraf, en dat is precies de verrassing die niemand wil. */

module.exports = (ctx) => {
  const { db, save, id, schoon, nu, codenaamVan, notify,
    reisPlan, opdrachtMaak, opdrachtMet, opdrachtAnnuleer, opdrachtBeeld,
    kaartKoop, kaartMet, kaartBeeld, opslag } = ctx;

  function ensureReizen() {
    opslag.bak('mobReizen');
  }
  const reisMet = rid => { ensureReizen(); return opslag.bak('mobReizen').find(r => r.id === rid) || null; };
  const reizenVan = key => { ensureReizen(); return opslag.bak('mobReizen').filter(r => r.key === key); };

  /* Een reis boeken. `body` draagt dezelfde velden als de planner plus de id
     van de gekozen optie. */
  async function reisBoek(session, body = {}) {
    ensureReizen();
    const plan = reisPlan(session, body);
    if (plan.error) return plan;
    const keuze = (plan.opties || []).find(o => o.id === schoon(body.optie, 60));
    if (!keuze)
      return { status: 404, error: 'Die reisoptie bestaat niet (meer); plan de reis opnieuw.',
        opties: (plan.opties || []).map(o => o.id) };

    /* Op rekening van de werkgever? Dan gaan de RITTEN op die rekening en
       blijven de VERVOERBEWIJZEN persoonlijk. Een rit wordt achteraf
       afgerekend en kan dus naar een zakelijke rekening; een kaartje wordt hier
       en nu uit de portemonnee van de reiziger betaald. Het staat erbij. */
    const org = schoon(body.namensOrganisatie, 20) || null;
    const r = { id: id('rs'), key: session.key, codenaam: codenaamVan(session.key),
      van: plan.van, naar: plan.naar, optie: keuze.id, optieNaam: keuze.naam,
      organisatie: org ? org.toUpperCase() : null,
      etappes: [], totaal: keuze.totaal, gemaakt: nu(), status: 'geboekt' };

    // ---- stap 1: de ritten. Hier beweegt nog geen geld ----
    const gemaakteRitten = [];
    for (const e of keuze.etappes) {
      if (e.wijze !== 'taxi') continue;
      const uit = opdrachtMaak({ soort: 'lid', key: session.key, session, groep: session.tier,
        org, stad: schoon(body.stad, 40) || null },
        { ritsoort: 'direct', categorie: 'taxi',
          betaler: org ? 'organisatie' : 'reiziger', kostenplaats: body.kostenplaats,
          van: { lat: e.van.lat, lng: e.van.lng, label: e.van.label || e.van.naam || 'Vertrek' },
          naar: { lat: e.naar.lat, lng: e.naar.lng, label: e.naar.label || e.naar.naam || 'Bestemming' },
          reizigers: Math.max(1, Math.round(Number(body.reizigers) || 1)),
          bagage: Math.max(0, Math.round(Number(body.bagage) || 0)),
          stad: schoon(body.stad, 40) || null });
      if (uit.error) { await draaiTerug(gemaakteRitten); return uit; }
      gemaakteRitten.push(uit.opdracht.ref);
      r.etappes.push({ wijze: 'taxi', ref: uit.opdracht.ref, prijs: uit.opdracht.prijs,
        van: e.van, naar: e.naar, km: e.km, minuten: e.minuten, betaald: false });
    }

    // ---- stap 2: de kaartjes. Vanaf hier beweegt er wel geld ----
    for (const e of keuze.etappes) {
      if (e.wijze !== 'ov') continue;
      if (!e.kaartTeKoop) {
        /* Geen kaartverkoop op deze lijn betekent NIET dat de reis niet kan --
           inchecken in het voertuig bestaat nog steeds. Het staat als etappe in
           het overzicht met wat de reiziger moet doen, en de reden erbij. */
        r.etappes.push({ wijze: 'ov', lijnId: e.lijnId, lijnNaam: e.lijnNaam, vervoerder: e.vervoerder,
          van: e.van, naar: e.naar, km: e.km, minuten: e.minuten, prijs: e.prijs,
          kaartje: null, instructie: 'Check in het voertuig in met uw RTG-app.', reden: e.kaartReden });
        continue;
      }
      const k = await kaartKoop(session, { vervoerder: e.vervoerder, lijnId: e.lijnId,
        van: e.van.id, naar: e.naar.id, product: 'enkel',
        idem: body.idem ? 'reis:' + schoon(body.idem, 40) + ':' + e.lijnId : undefined,
        stad: schoon(body.stad, 40) || null });
      if (k.error) { await draaiTerug(gemaakteRitten); return k; }
      r.etappes.push({ wijze: 'ov', lijnId: e.lijnId, lijnNaam: e.lijnNaam, vervoerder: e.vervoerder,
        van: e.van, naar: e.naar, km: e.km, minuten: e.minuten, prijs: k.kaartje.prijs,
        kaartje: k.kaartje.code, betaald: true });
    }

    // de looptappes staan er ook in: een reisoverzicht zonder het stuk lopen klopt niet
    for (const e of keuze.etappes)
      if (e.wijze === 'lopen')
        r.etappes.push({ wijze: 'lopen', van: e.van, naar: e.naar, meters: e.meters, minuten: e.minuten, prijs: 0 });
    r.etappes.sort((a, b) => keuze.etappes.findIndex(x => x.wijze === a.wijze && (x.lijnId || '') === (a.lijnId || '')) -
      keuze.etappes.findIndex(x => x.wijze === b.wijze && (x.lijnId || '') === (b.lijnId || '')));

    opslag.bak('mobReizen').unshift(r);
    save();
    notify(session.key, { icon: 'ov', title: 'RTG Vervoer',
      body: 'Uw reis naar ' + (plan.naar.label || 'de bestemming') + ' staat klaar.', scope: 'mobiliteit' });
    return { ok: true, reis: reisBeeld(r) };
  }

  // alles wat al was aangemaakt weer weghalen; er is dan niets betaald
  async function draaiTerug(refs) {
    for (const ref of refs) {
      const o = opdrachtMet(ref);
      if (o) opdrachtAnnuleer(ref, 'systeem', 'reis niet volledig te boeken');
    }
  }

  function reisBeeld(r) {
    const nuBetaald = r.etappes.filter(e => e.betaald).reduce((n, e) => n + (e.prijs || 0), 0);
    const later = r.etappes.filter(e => e.wijze === 'taxi').reduce((n, e) => n + (e.prijs || 0), 0);
    const wacht = r.etappes.some(e => { const o = e.ref ? opdrachtMet(e.ref) : null;
      return o && o.goedkeuring && o.goedkeuring.status === 'wacht'; });
    return { id: r.id, van: r.van, naar: r.naar, optieNaam: r.optieNaam, status: r.status,
      gemaakt: r.gemaakt, totaal: r.totaal, organisatie: r.organisatie || null,
      etappes: r.etappes.map(e => {
        const b = Object.assign({}, e);
        if (e.wijze === 'taxi' && e.ref) {
          const o = opdrachtMet(e.ref);
          b.ritStatus = o ? o.status : 'onbekend';
          b.voertuig = o ? o.voertuig : null;
          b.goedkeuring = o ? (o.goedkeuring || null) : null;
        }
        if (e.wijze === 'ov' && e.kaartje) {
          const k = kaartMet(e.kaartje);
          b.kaartStand = k ? kaartBeeld(k, true).stand : 'onbekend';
        }
        return b;
      }),
      /* De drie geldstromen apart, want ze gedragen zich echt anders. Ze op een
         hoop gooien zou suggereren dat de hele reis al is afgerekend.

         En de derde is er bijgekomen omdat de zin ernaast loog: een reis met
         alleen een OV-etappe zonder kaartverkoop meldde "Alles is betaald",
         terwijl je nog moet inchecken en bij het uitstappen betaalt. Nul betaald
         en nul open is niet hetzelfde als klaar. */
      betaald: nuBetaald, nogAfTeRekenen: later,
      inchecken: r.etappes.filter(e => e.wijze === 'ov' && !e.kaartje).length,
      uitleg: [
        nuBetaald ? 'De vervoerbewijzen zijn betaald.' : null,
        later ? 'De rit wordt afgerekend als hij gereden is; tot dan is die prijs een schatting.' : null,
        r.etappes.some(e => e.wijze === 'ov' && !e.kaartje)
          ? 'Voor het openbaar vervoer checkt u in met uw RTG-app; u betaalt bij het uitchecken.' : null,
        r.organisatie && nuBetaald
          ? 'De rit gaat op rekening van ' + r.organisatie + '; uw vervoerbewijzen blijven persoonlijk.' : null,
        wacht ? 'De rit wacht nog op akkoord van uw werkgever; tot dan wordt er geen wagen gezocht.' : null
      ].filter(Boolean).join(' ') || 'Er staat niets open.' };
  }

  const reisMijn = session => ({ ok: true, reizen: reizenVan(session.key).slice(0, 20).map(reisBeeld) });

  /* Een reis annuleren: elke etappe krijgt zijn eigen behandeling. De ritten
     kunnen weg; een gekocht kaartje blijft geldig, want dat is betaald en
     geldig -- het teruggeven daarvan is een zaak tussen de reiziger en de
     vervoerder, niet iets wat wij stilletjes intrekken. */
  function reisAnnuleer(session, body = {}) {
    const r = reisMet(schoon(body.id, 40));
    if (!r) return { status: 404, error: 'Reis niet gevonden.' };
    if (r.key !== session.key) return { status: 403, error: 'Dit is uw reis niet.' };
    if (r.status === 'geannuleerd') return { status: 409, error: 'Deze reis is al geannuleerd.' };
    const uit = [];
    for (const e of r.etappes) {
      if (e.wijze !== 'taxi' || !e.ref) continue;
      const a = opdrachtAnnuleer(e.ref, 'lid', schoon(body.reden, 200));
      uit.push({ ref: e.ref, gelukt: !a.error, reden: a.error || null, kosten: a.kosten || 0 });
    }
    r.status = 'geannuleerd';
    r.geannuleerd = { at: nu(), ritten: uit };
    save();
    const kaartjes = r.etappes.filter(e => e.kaartje).length;
    return { ok: true, reis: reisBeeld(r), ritten: uit,
      uitleg: kaartjes
        ? 'De ritten zijn geannuleerd. Uw ' + kaartjes + ' vervoerbewijs(zen) blijven geldig zolang ze niet verlopen zijn.'
        : 'De ritten zijn geannuleerd.' };
  }

  return { ensureReizen, reisBoek, reisMijn, reisAnnuleer, reisBeeld, reisMet };
};
