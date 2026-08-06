/* Mobility OS (deelmodule): de dienstregeling van een bedrijfspendel. De
   dienst zelf (opzetten, wijzigen, weghalen) staat in ./pendel; hier staat wat
   eruit volgt: de vertrekken van een dag, de zitplaatsen, en de stap waarmee
   een vertrek een echte rit wordt.

   DE DIENSTREGELING WORDT GEREKEND, NIET BEWAARD. Er staat geen tabel met
   duizenden vertrektijden in de database; er staat een regel (dagen, vensters,
   interval) en de vertrekken volgen daaruit. Bewaarde vertrektijden zouden na
   elke wijziging van de regel uit de pas lopen met de regel zelf -- twee
   waarheden over dezelfde dienst (LAT.md regel 4). Wat wel bewaard wordt is een
   RESERVERING, want die gaat over een mens die erop rekent.

   GEEN NO-SHOW-STRAF. Er wordt geteld wie niet kwam opdagen, want anders kan
   een planner de capaciteit niet bijstellen. Er hangt geen boete, geen score en
   geen blokkade aan: dat is het gesprek van de werkgever, niet ons
   strafsysteem. */

const VERTREKKEN_MAX = 120;         // per dag; een bus die vaker rijdt is een metro

module.exports = (ctx) => {
  const { save, id, schoon, nu, plekBepaal, opdrachtMaak, opdrachtMet, codenaamVan,
    pendelMet, pendelsVan, pendelBeeld, DAGNAMEN, minutenVan } = ctx;

  /* De vertrekken van een dag. Een feestdag of vakantiedag staat in
     `uitzonderingen` en levert een LEGE lijst met de reden erbij -- niet
     stilzwijgend niets, want dan denkt een medewerker dat het scherm kapot is. */
  function pendelRooster(pid, datum) {
    const p = pendelMet(schoon(pid, 40));
    if (!p) return { status: 404, error: 'Pendeldienst niet gevonden.' };
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(datum || '')) ? String(datum) : new Date().toISOString().slice(0, 10);
    const dag = new Date(d + 'T12:00:00Z').getUTCDay();
    if ((p.uitzonderingen || []).includes(d))
      return { ok: true, datum: d, vertrekken: [], reden: 'Deze dag staat als uitzondering in de dienstregeling (feest- of vakantiedag).' };
    if (!p.dagen.includes(dag))
      return { ok: true, datum: d, vertrekken: [], reden: 'Deze dienst rijdt niet op ' + DAGNAMEN[dag] + '.' };

    const vertrekken = [];
    for (const v of p.vensters) {
      for (let t = minutenVan(v.van); t <= minutenVan(v.tot) && vertrekken.length < VERTREKKEN_MAX; t += v.elkeMin) {
        const uu = String(Math.floor(t / 60)).padStart(2, '0'), mm = String(t % 60).padStart(2, '0');
        const wanneer = d + 'T' + uu + ':' + mm;
        const res = (p.reserveringen || []).filter(r => r.vertrek === wanneer);
        vertrekken.push({ vertrek: wanneer, tijd: uu + ':' + mm,
          bezet: res.filter(r => !r.wachtlijst).length, capaciteit: p.capaciteit,
          wachtlijst: res.filter(r => r.wachtlijst).length,
          opdracht: (p.opdrachten || {})[wanneer] || null });
      }
    }
    return { ok: true, datum: d, dag: DAGNAMEN[dag], pendel: pendelBeeld(p), vertrekken };
  }

  /* Een zitplaats reserveren. Vol betekent wachtlijst, niet "nee" -- dat is
     precies de informatie waarmee een planner een tweede bus inzet. */
  function pendelReserveer(session, body = {}) {
    const p = pendelMet(schoon(body.id, 40));
    if (!p) return { status: 404, error: 'Pendeldienst niet gevonden.' };
    const vertrek = schoon(body.vertrek, 16);
    const rooster = pendelRooster(p.id, vertrek.slice(0, 10));
    if (rooster.error) return rooster;
    const slot = (rooster.vertrekken || []).find(v => v.vertrek === vertrek);
    if (!slot) return { status: 404, error: 'Op dat tijdstip vertrekt er geen pendel.' };

    p.reserveringen = p.reserveringen || [];
    const al = p.reserveringen.find(r => r.vertrek === vertrek && r.key === session.key);
    if (body.weg) {
      if (!al) return { status: 404, error: 'U had geen zitplaats op dit vertrek.' };
      p.reserveringen = p.reserveringen.filter(r => r !== al);
      // de eerste van de wachtlijst schuift door; anders blijft een stoel leeg
      const wacht = p.reserveringen.filter(r => r.vertrek === vertrek && r.wachtlijst)
        .sort((a, b) => a.at.localeCompare(b.at))[0];
      if (wacht) wacht.wachtlijst = false;
      save();
      return { ok: true, weg: true, doorgeschoven: wacht ? wacht.codenaam : null };
    }
    if (al) return { status: 409, error: 'U heeft al een plaats op dit vertrek.' };
    const wachtlijst = slot.bezet >= p.capaciteit;
    const r = { id: id('rs'), key: session.key, codenaam: codenaamVan(session.key), vertrek, wachtlijst, at: nu() };
    p.reserveringen.push(r);
    save();
    return { ok: true, reservering: r, wachtlijst,
      uitleg: wachtlijst ? 'De bus is vol; u staat op de wachtlijst en schuift door zodra iemand afzegt.' : 'Uw zitplaats staat vast.' };
  }

  /* Van dienstregeling naar echte rit. Dit is de stap waar de pendel de gewone
     rittenmotor in loopt: vanaf hier is het een opdracht als elke andere, met
     dezelfde keten, dezelfde meldingen en dezelfde afrekening. Een vertrek
     zonder reserveringen wordt NIET gereden -- een lege bus laten rijden omdat
     het in de regel staat, is precies wat een dienstregeling zonder vraag
     oplevert. */
  function pendelPlan(werkgever, body = {}) {
    const p = pendelMet(schoon(body.id, 40));
    if (!p || p.werkgever !== werkgever) return { status: 404, error: 'Pendeldienst niet gevonden.' };
    const rooster = pendelRooster(p.id, body.datum);
    if (rooster.error) return rooster;
    p.opdrachten = p.opdrachten || {};
    const gemaakt = [], overgeslagen = [];
    for (const v of rooster.vertrekken || []) {
      if (p.opdrachten[v.vertrek] && opdrachtMet(p.opdrachten[v.vertrek])) continue;
      if (!v.bezet) { overgeslagen.push({ vertrek: v.vertrek, reden: 'geen reserveringen' }); continue; }
      const r = opdrachtMaak({ soort: 'pendelplanner', key: null, session: null, org: werkgever, stad: p.stad },
        { ritsoort: 'pendel', categorie: p.categorie,
          van: { lat: p.van.lat, lng: p.van.lng, label: p.van.label },
          naar: { lat: p.naar.lat, lng: p.naar.lng, label: p.naar.label },
          reizigers: v.bezet, vertrek: v.vertrek, vervoerder: p.vervoerder,
          betaler: 'organisatie', naamOpDeRit: p.naam, stad: p.stad });
      if (r.error) { overgeslagen.push({ vertrek: v.vertrek, reden: r.error }); continue; }
      p.opdrachten[v.vertrek] = r.opdracht.ref;
      gemaakt.push({ vertrek: v.vertrek, ref: r.opdracht.ref, reizigers: v.bezet });
    }
    save();
    return { ok: true, datum: rooster.datum, gemaakt, overgeslagen };
  }

  /* Wat een medewerker ziet: alle diensten van zijn werkgever waar hij op kan
     stappen. Bewust zonder de reserveringen van anderen erbij -- wie er nog
     meer in de bus zit, is geen informatie die een collega nodig heeft. */
  function pendelVoorMedewerker(werkgever, session, datum) {
    return { ok: true, pendels: pendelsVan(werkgever).map(p => {
      const r = pendelRooster(p.id, datum);
      return { pendel: pendelBeeld(p), datum: r.datum, reden: r.reden || null,
        vertrekken: (r.vertrekken || []).map(v => ({ vertrek: v.vertrek, tijd: v.tijd,
          vrij: Math.max(0, v.capaciteit - v.bezet), wachtlijst: v.wachtlijst,
          mijn: (p.reserveringen || []).some(x => x.vertrek === v.vertrek && x.key === session.key) })) };
    }) };
  }

  // niet-verschenen bijhouden: een teller voor de planner, geen strafblad
  function pendelNoShow(werkgever, body = {}) {
    const p = pendelMet(schoon(body.id, 40));
    if (!p || p.werkgever !== werkgever) return { status: 404, error: 'Pendeldienst niet gevonden.' };
    const r = (p.reserveringen || []).find(x => x.id === schoon(body.reservering, 40));
    if (!r) return { status: 404, error: 'Reservering niet gevonden.' };
    r.nietVerschenen = !!body.nietVerschenen;
    save();
    const vertrek = r.vertrek;
    const totaal = (p.reserveringen || []).filter(x => x.vertrek === vertrek && x.nietVerschenen).length;
    return { ok: true, vertrek, nietVerschenen: totaal,
      uitleg: 'Geteld voor de capaciteitsplanning. Hier hangt geen boete of blokkade aan.' };
  }

  return { pendelRooster, pendelReserveer, pendelPlan, pendelVoorMedewerker, pendelNoShow };
};
