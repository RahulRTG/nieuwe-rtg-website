/* Doe-laag, deel "boeken" (kern/fluister): de boekingen boven de drempel:
   tickets, een behandeling, een rit en het 24-uursblok van een gedeeld object.
   Elke handler zet een voorstel klaar (p.wacht) dat pas op "ja" (in ./bevestig)
   echt wordt uitgevoerd; er verlaat hier nog geen geld en er wordt nog niets
   geclaimd. Krijgt {q,p,klaar,key,codenaam,sess} en geeft klaar(...) of null. */
module.exports = (ctx) => {
  const { db, save, assetGebruik, acties, nu, eur, datumInZin } = ctx;

  // "boek 2 tickets voor de sunset cruise morgen (om 19:00)": geld,
  // dus eerst een voorstel; de entreecode komt na uw "ja"
  async function tickets({ q, p, klaar }) {
    if (!(acties && acties.koopTicket && /\b(boek|koop|regel)\b/i.test(q) && /\b(tickets?|kaartjes?)\b/i.test(q))) return null;
    let zaak = null, act = null;
    const ql = q.toLowerCase();
    for (const x of (db.data.suppliers || [])) {
      for (const a of (x.activiteiten || [])) {
        if ((a.name || '').toLowerCase().split(/[^a-z0-9]+/).some(wrd => wrd.length > 3 && ql.includes(wrd))) { zaak = x; act = a; break; }
      }
      if (act) break;
    }
    if (!act) return klaar('Voor welke activiteit? Bijvoorbeeld: ' + (db.data.suppliers || []).flatMap(x => (x.activiteiten || []).map(a => '"' + a.name + '" bij ' + x.name)).slice(0, 3).join(', ') + '.');
    const datum = datumInZin(q);
    if (!datum) return klaar('Voor welke dag? Zeg bijvoorbeeld: "boek 2 tickets voor ' + act.name + ' morgen".');
    const tm = q.match(/(\d{1,2})[:.](\d{2})/);
    const tijd = (tm && (act.tijden || []).includes(tm[1].padStart(2, '0') + ':' + tm[2])) ? tm[1].padStart(2, '0') + ':' + tm[2] : (act.tijden || [])[0];
    const personen = Math.min(10, Math.max(1, parseInt((q.match(/(\d{1,2})\s*(tickets?|kaartjes?|personen|man)\b/i) || [])[1], 10) || 1));
    const oms = personen + ' ticket(s) voor ' + act.name + ' bij ' + zaak.name;
    p.wacht = { soort: 'ticket', supplierCode: zaak.code, activiteitId: act.id, datum, tijd, personen, oms, at: nu() };
    save();
    return klaar('Even checken: ' + oms + ' op ' + datum + ' om ' + tijd + ', samen ' + eur(Math.round((act.prijs || 0) * personen * 100)) + '. Ik boek en reken direct af via RTG Pay. Zeg "ja" en de entreecode komt eraan; "nee" en het gaat niet door.', false, true);
  }

  // "boek een aromamassage bij Zenith morgen om 15:00": een behandeling
  // in de zorg & welzijn-toren; geld, dus eerst een voorstel
  async function behandeling({ q, p, klaar, key }) {
    if (!(acties && acties.careBoek && /\b(boek|regel|maak)\b/i.test(q) &&
        /\b(massage|behandeling|afspraak|consult|fysio|spa|wellness|gezicht)\w*/i.test(q))) return null;
    const ov = acties.careOverzicht(key);
    const ql = q.toLowerCase();
    let aanb = null, beh = null;
    for (const a of ov.aanbieders) {
      for (const b of a.behandelingen) {
        if ((b.naam || '').toLowerCase().split(/[^a-z0-9]+/).some(w => w.length > 3 && ql.includes(w))) { aanb = a; beh = b; break; }
      }
      if (beh) break;
    }
    // ook op zaaknaam matchen als de behandeling niet letterlijk genoemd is
    if (!beh) {
      aanb = ov.aanbieders.find(a => (a.naam || '').toLowerCase().split(/\s+/).some(w => w.length > 3 && ql.includes(w)));
      beh = aanb && aanb.behandelingen[0];
    }
    if (!beh) return klaar('Welke behandeling en waar? Bijvoorbeeld: ' + ov.aanbieders.flatMap(a => a.behandelingen.slice(0, 1).map(b => '"' + b.naam + '" bij ' + a.naam)).slice(0, 3).join(', ') + '.');
    const datum = datumInZin(q);
    if (!datum) return klaar('Voor welke dag? Zeg bijvoorbeeld: "boek een ' + beh.naam.toLowerCase() + ' bij ' + aanb.naam + ' morgen om ' + (beh.tijden[0] || '15:00') + '".');
    const tm = q.match(/(\d{1,2})[:.](\d{2})/);
    const tijd = (tm && beh.tijden.includes(tm[1].padStart(2, '0') + ':' + tm[2])) ? tm[1].padStart(2, '0') + ':' + tm[2] : beh.tijden[0];
    if (!tijd) return klaar('Op welk tijdstip? ' + aanb.naam + ' heeft voor ' + beh.naam + ' geen vrije tijden meer die dag.');
    const oms = beh.naam + ' bij ' + aanb.naam;
    p.wacht = { soort: 'behandeling', aanbiederId: aanb.id, behandelingId: beh.id, datum, tijd, oms, medisch: beh.soort === 'medisch', at: nu() };
    save();
    return klaar('Even checken: ' + oms + ' op ' + datum + ' om ' + tijd + ' (' + beh.duurMin + ' min), ' + eur(Math.round((beh.prijs || 0) * 100)) + '. Ik boek en reken direct af via RTG Pay; uw zorgprofiel reist mee.' +
      (beh.soort === 'medisch' ? ' Voor een medisch consult kunt u vooraf apart een intake delen in de Care-tab.' : '') +
      ' Zeg "ja" en het staat vast; "nee" en het gaat niet door.', false, true);
  }

  // "regel een taxi naar Sal de Mar (om 23:00, met 4 personen)": de
  // offerte volgt het tarief van de vervoerder; betalen na uw "ja"
  async function taxi({ q, p, klaar }) {
    if (!(acties && acties.vraagRit && /\b(regel|boek|bestel|vraag)\b/i.test(q) && /\b(taxi|auto|rit|chauffeur|wagen|transfer)\b/i.test(q))) return null;
    const ql = q.toLowerCase();
    const rijders = (db.data.suppliers || []).filter(x => ((db.data.supplierTypes[x.type] || {}).caps || []).includes('rides') && x.type !== 'activiteit');
    const rijder = rijders.find(x => (x.name || '').toLowerCase().split(/\s+/).some(wrd => wrd.length > 3 && ql.includes(wrd))) ||
      rijders.find(x => x.type === 'taxi') || rijders[0];
    if (!rijder) return klaar('Ik zie nu geen vervoerspartner. Kijk anders even in Reizen.');
    const best = (q.match(/\bnaar\s+(.+?)(?=\s+(?:om|op|voor|met|morgen|overmorgen|vandaag)\b|[.?!]?\s*$)/i) || [])[1];
    const doel = best && (db.data.suppliers || []).find(x => (x.name || '').toLowerCase().includes(best.toLowerCase().trim()));
    const personen = Math.min(9, Math.max(1, parseInt((q.match(/(\d{1,2})\s*(personen|man)\b/i) || [])[1], 10) || 1));
    const tm = q.match(/(\d{1,2})[:.](\d{2})/);
    const datum = datumInZin(q);
    p.wacht = { soort: 'rit', supplierCode: rijder.code, to: best ? best.trim() : '', toCode: doel ? doel.code : null, personen, datum: datum || null, tijd: tm ? tm[1].padStart(2, '0') + ':' + tm[2] : null, at: nu() };
    save();
    return klaar('Even checken: een rit met ' + rijder.name + (best ? ' naar ' + best.trim() : '') + ' voor ' + personen + (datum ? ' (' + datum + (tm ? ' ' + tm[1].padStart(2, '0') + ':' + tm[2] : '') + ')' : ', zo snel mogelijk') + '? De prijs volgt het tarief van de vervoerder en reken ik direct af. Zeg "ja" en ik regel hem; "nee" en het gaat niet door.', false, true);
  }

  // "zet/plan/boek mijn 24 uur op 3 augustus (bij Villa ...)":
  // claimt een dag van het gedeelde object, dus eerst een voorstel
  async function blok24({ q, p, klaar, key }) {
    if (!(assetGebruik && /\b24\s*-?\s*u/i.test(q) && /\b(zet|plan|boek|leg)\b/i.test(q))) return null;
    const datum = datumInZin(q);
    if (!datum) return klaar('Op welke dag? Zeg bijvoorbeeld: "zet mijn 24 uur op 3 augustus".');
    const mijnTickets = (db.data.assetTickets || []).filter(t => t.key === key && t.status === 'actief');
    if (!mijnTickets.length) return klaar('U heeft nog geen actief Shared Asset-ticket; kijk in de Assets-tab.');
    const ql = q.toLowerCase();
    const past = t => {
      const a = (db.data.sharedAssets || []).find(x => x.id === t.assetId);
      return a && a.naam.toLowerCase().split(/\s+/).some(w => w.length > 3 && ql.includes(w));
    };
    const t = mijnTickets.find(past) || mijnTickets[0];
    const naam = (((db.data.sharedAssets || []).find(x => x.id === t.assetId) || {}).naam) || 'uw object';
    p.wacht = { soort: 'blok', assetId: t.assetId, datum, naam, at: nu() };
    save();
    return klaar('Even checken: uw 24 uur bij ' + naam + ' op ' + datum + ' vastleggen? Die dag is dan van u en gaat uit de pool. Zeg "ja" en ik regel het; "nee" en het gaat niet door.', false, true);
  }

  return { tickets, behandeling, taxi, blok24 };
};
