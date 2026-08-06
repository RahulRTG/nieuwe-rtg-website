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

  /* Toewijzen. Met de hand of automatisch -- het is dezelfde functie, want
     het resultaat hoort identiek te zijn. Automatisch kiest alleen de bovenste
     kandidaat; er is geen tweede codepad dat het net even anders doet. */
  function dispatchWijsToe(vervoerder, actor, body = {}) {
    const o = opdrachtMet(schoon(body.ref, 30));
    if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    if (o.vervoerder && o.vervoerder !== vervoerder) return { status: 403, error: 'Deze opdracht hoort bij een andere vervoerder.' };
    if (o.boeking !== 'direct' && !body.bevestigd)
      return { status: 409, error: 'Dit vervoer gaat op aanvraag: bevestig eerst met de exploitant.', bevestigingNodig: true };

    let assetId = schoon(body.assetId, 40);
    let uitleg = null;
    if (!assetId) {
      const v = matchRangschik(Object.assign({}, o, { vervoerder }), poolVan(vervoerder), { vervoerder });
      if (!v.kandidaten.length)
        return { status: 409, error: 'Geen inzetbaar voertuig voor deze opdracht.', afgewezen: v.afgewezen };
      assetId = v.kandidaten[0].assetId;
      uitleg = v.kandidaten[0];
    }
    const a = assetMet(vervoerder, assetId);
    if (!a) return { status: 404, error: 'Voertuig niet gevonden bij deze vervoerder.' };

    /* Het pad naar 'geaccepteerd', per beginstatus uitgeschreven. De keten wordt
       GELOPEN en niet overgeslagen -- anders mist de reiziger de meldingen dat
       zijn prijs vaststaat en dat er een wagen wordt gezocht.

       Waarom een tabel en geen paar if-jes: hier stond eerst een reeks
       vergelijkingen op `o.status` die er tussendoor van uitging dat het
       opdrachtobject onderweg door opdrachtNaar werd bijgewerkt. Dat werkte
       toevallig voor een verse aanvraag en NERGENS anders: een rit die al op
       'geprijsd' stond was niet meer toe te wijzen, en na een pech-melding
       ('vervangend-voertuig') was er geen enkele weg terug naar een wagen -- de
       ene status waarin je een vervanger het hardst nodig hebt. */
    const PAD = {
      aangevraagd: ['geprijsd', 'aangeboden', 'geaccepteerd'],
      geprijsd: ['aangeboden', 'geaccepteerd'],
      aangeboden: ['geaccepteerd'],
      'vervangend-voertuig': ['geaccepteerd']
    };
    const pad = PAD[o.status];
    if (!pad) return { status: 409, error: 'Een opdracht met status "' + o.status + '" is niet toe te wijzen.' };

    o.vervoerder = vervoerder;
    for (const stap of pad) {
      const r = opdrachtNaar(o.ref, stap, actor, { voertuig: a.id, chauffeur: a.bestuurder || null });
      if (r.error) return r;
    }
    logActivity(vervoerder, actor, 'wees ' + o.ref + ' toe aan ' + (a.naam || a.id));
    sseToOffice('sync', { scope: 'mobiliteit' });
    return { ok: true, opdracht: opdrachtBeeld(opdrachtMet(o.ref), true), gekozen: uitleg, automatisch: !body.assetId };
  }

  /* Overboeken naar een partnervervoerder. De opdracht blijft dezelfde
     opdracht -- zelfde ref, zelfde reiziger, zelfde prijsafspraak. Een kopie
     maken zou twee ritten opleveren waarvan er een stil blijft hangen. */
  function dispatchOverboek(vervoerder, actor, body = {}) {
    const o = opdrachtMet(schoon(body.ref, 30));
    if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    if (o.vervoerder !== vervoerder) return { status: 403, error: 'Deze opdracht hoort bij een andere vervoerder.' };
    const naar = schoon(body.naar, 20);
    const partner = (db.data.suppliers || []).find(s => s.code === naar);
    if (!partner) return { status: 404, error: 'Onbekende partnervervoerder.' };
    if (['voltooid', 'afgerekend', 'geannuleerd'].includes(o.status))
      return { status: 409, error: 'Een afgeronde rit boek je niet meer over.' };
    o.overgeboekt = (o.overgeboekt || []).concat([{ van: vervoerder, naar, at: nu(), door: actor }]);
    o.vervoerder = naar; o.voertuig = null; o.chauffeur = null;
    o.gebeurtenissen = (o.gebeurtenissen || []).concat([{ soort: 'ride.transferred', at: nu(), door: actor, naar }]);
    if (['geaccepteerd', 'onderweg', 'aangekomen'].includes(o.status)) o.status = 'aangeboden';
    save();
    logActivity(vervoerder, actor, 'boekte ' + o.ref + ' over naar ' + partner.name);
    sseToOffice('sync', { scope: 'mobiliteit' });
    return { ok: true, opdracht: opdrachtBeeld(o, true) };
  }

  /* Een boeking voor iemand zonder app. De dispatcher is de actor, de beller
     is de reiziger. Er is geen sessie, dus 'hier' en een favoriete plek
     werken niet -- de dispatcher tikt een zaak, een halte of een punt in. */
  function dispatchTelefoonboeking(vervoerder, actor, body = {}) {
    const naam = schoon(body.naamOpDeRit, 40);
    if (!naam) return { status: 400, error: 'Noteer de naam waaronder de rit staat.' };
    const r = opdrachtMaak({ soort: 'dispatcher', key: null, session: null, stad: body.stad, org: null },
      Object.assign({}, body, { vervoerder, naamOpDeRit: naam }));
    if (r.error) return r;
    const o = opdrachtMet(r.opdracht.ref);
    o.vervoerder = vervoerder;
    o.telefoon = schoon(body.telefoon, 30) || null;
    save();
    logActivity(vervoerder, actor, 'nam telefonische boeking ' + o.ref + ' aan');
    return { ok: true, opdracht: opdrachtBeeld(o, true) };
  }

  // het auditspoor van een opdracht: de gebeurtenissen zoals ze zijn geschreven
  function dispatchSpoor(vervoerder, ref) {
    const o = opdrachtMet(schoon(ref, 30));
    if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    if (o.vervoerder !== vervoerder && !(o.overgeboekt || []).some(x => x.van === vervoerder))
      return { status: 403, error: 'Deze opdracht hoort bij een andere vervoerder.' };
    return { ok: true, ref: o.ref, status: o.status, gebeurtenissen: o.gebeurtenissen || [], overgeboekt: o.overgeboekt || [] };
  }

  return { poolVan, dispatchBeeld, dispatchVoorstel, dispatchWijsToe, dispatchOverboek,
    dispatchTelefoonboeking, dispatchSpoor };
};
