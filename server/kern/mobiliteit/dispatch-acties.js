/* Mobility OS (deelmodule): de HANDELINGEN van de dispatcher. Toewijzen,
   overboeken naar een partner, een boeking voor iemand zonder app, en het
   auditspoor. Het live beeld en het voorstel van de matcher staan in
   ./dispatch, die deze module met dezelfde context meekrijgt.

   Afgesplitst omdat het geheel over de 10 kB-grens liep. De naad valt waar hij
   hoort: hierboven wordt er GEKEKEN, hier wordt er iets veranderd. */
module.exports = (ctx) => {
  const { db, save, nu, schoon, assetMet, matchRangschik, poolVan,
    opdrachtMet, opdrachtBeeld, opdrachtMaak, opdrachtNaar, logActivity, sseToOffice } = ctx;

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

  return { dispatchWijsToe, dispatchOverboek, dispatchTelefoonboeking, dispatchSpoor };
};
