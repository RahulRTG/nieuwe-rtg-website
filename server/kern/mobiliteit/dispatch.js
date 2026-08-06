/* Mobility OS (deelmodule): het dispatchcentrum. Het live beeld van een
   vervoerder, de openstaande opdrachten, toewijzen (met de hand of door de
   motor), overboeken naar een partner en boekingen voor mensen zonder app.

   DIT IS BELANGRIJKER DAN EEN MOOIE CONSUMENTENAPP. Een reiziger gebruikt de
   app een paar keer per maand; een planner zit hier de hele dag. Alles wat
   hier ontbreekt, wordt met de telefoon en een schrift opgelost, en dan staat
   de helft van de ritten niet in het systeem.

   TWEE DINGEN DIE HIER BEWUST ANDERS ZIJN.

   1. AUTOMATISCH TOEWIJZEN IS EEN VOORSTEL MET EEN UITLEG, geen mededeling.
      De motor rangschikt (./matching) en de dispatcher ziet waarom. Hij mag
      altijd iemand anders kiezen; dat is geen omweg om het systeem heen maar
      de bedoeling.

   2. EEN TELEFOONBOEKING IS EEN VOLWAARDIGE OPDRACHT. Niet een notitie, niet
      een tweede soort rit. Wie belt omdat hij geen app heeft, hoort dezelfde
      keten, dezelfde meldingen en dezelfde afrekening te krijgen. Alleen de
      reiziger heeft geen sessie, en dus geen codenaam maar de naam die de
      beller opgeeft. */

module.exports = (ctx) => {
  const { db, save, nu, schoon, assetsVan, assetBeeld, assetMet, matchRangschik,
    opdrachtMet, opdrachtBeeld, opdrachtMaak, opdrachtNaar, opdrachtenVanVervoerder, opdrachtenOpen,
    logActivity, sseToOffice } = ctx;

  /* De pool die de matcher krijgt. Hier -- en niet in matching.js -- wordt
     bepaald wie er uberhaupt meedoet: alleen voertuigen van deze vervoerder
     die niet al op een lopende rit zitten. */
  function poolVan(vervoerder) {
    const bezet = new Set();
    for (const o of opdrachtenVanVervoerder(vervoerder)) {
      if (['geaccepteerd', 'onderweg', 'aangekomen', 'ingestapt', 'rijdt'].includes(o.status)) {
        if (o.voertuig) bezet.add(o.voertuig);
      }
    }
    const gepland = new Map();
    for (const o of opdrachtenVanVervoerder(vervoerder)) {
      if (o.status === 'geaccepteerd' && o.voertuig) gepland.set(o.voertuig, (gepland.get(o.voertuig) || 0) + 1);
    }
    return assetsVan(vervoerder)
      .filter(a => !bezet.has(a.id))
      .map(a => ({ asset: a, chauffeur: a.bestuurder || null, beoordeling: a.beoordeling,
        gepland: gepland.get(a.id) || 0, wilNaar: a.wilNaar || null }));
  }

  /* Het live beeld: de vloot, de openstaande opdrachten en de lopende ritten.
     Bewust in een antwoord, want de dispatcher wil ze naast elkaar zien en
     niet in drie schermen die uit de pas lopen. */
  /* Wat een vervoerder aan OPENSTAAND werk ziet. Dat is meer dan zijn eigen
     lijst, en dat is geen extraatje maar het verschil tussen werkend en niet:
     een reiziger vraagt een rit aan zonder een bedrijf te kiezen -- hij wil een
     taxi, niet Ibiza Executive Cars. Zo'n opdracht heeft dus nog GEEN vervoerder,
     en in de eerste versie zag daardoor niemand hem. De rit stond in de database
     en nergens op een scherm.

     Een opdracht zonder vervoerder ligt op de markt: elke vervoerder in dezelfde
     stad ziet hem en kan hem oppakken. Wie hem toewijst, krijgt hem (de eerste
     stap van dispatchWijsToe zet o.vervoerder). Opdrachten uit een andere stad
     blijven buiten beeld -- anders staat een planner in Haarlem naar ritten in
     Ibiza te kijken. */
  function dispatchBeeld(vervoerder, waar = {}) {
    const eigen = opdrachtenVanVervoerder(vervoerder);
    const zaak = (db.data.suppliers || []).find(s => s.code === vervoerder);
    const stad = (waar && waar.stad) || (zaak && zaak.city) || null;
    const markt = opdrachtenOpen().filter(o => !o.vervoerder &&
      ['aangevraagd', 'geprijsd', 'aangeboden'].includes(o.status) &&
      (!o.stad || !stad || o.stad === stad));
    const opdrachten = eigen;
    const open = eigen.filter(o => ['aangevraagd', 'geprijsd', 'aangeboden'].includes(o.status)).concat(markt);
    const lopend = opdrachten.filter(o => ['geaccepteerd', 'onderweg', 'aangekomen', 'ingestapt', 'rijdt', 'incident', 'vervangend-voertuig'].includes(o.status));
    const klaar = opdrachten.filter(o => ['voltooid', 'afgerekend'].includes(o.status)).slice(0, 25);
    const vloot = assetsVan(vervoerder).map(a => assetBeeld(a, waar));
    return { ok: true, vervoerder,
      vloot,
      inzetbaar: vloot.filter(a => a.inzetbaar).length,
      papierenLet: vloot.filter(a => !a.inzetbaar || (a.bijnaOp || []).length)
        .map(a => ({ id: a.id, naam: a.naam, redenen: a.redenen, bijnaOp: a.bijnaOp })),
      open: open.map(o => opdrachtBeeld(o)),
      lopend: lopend.map(o => Object.assign(opdrachtBeeld(o), { positie: o.positie || null })),
      klaar: klaar.map(o => opdrachtBeeld(o)) };
  }

  // het voorstel van de motor, met de rekensom per kandidaat
  function dispatchVoorstel(vervoerder, ref, waar = {}) {
    const o = opdrachtMet(schoon(ref, 30));
    if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    if (o.vervoerder && o.vervoerder !== vervoerder) return { status: 403, error: 'Deze opdracht hoort bij een andere vervoerder.' };
    return matchRangschik(Object.assign({}, o, { vervoerder }), poolVan(vervoerder), waar);
  }
  return { poolVan, dispatchBeeld, dispatchVoorstel };
};
