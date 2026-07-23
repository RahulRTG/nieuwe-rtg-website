/* Rahul-reislaag, deel "reisplan" (kern/fluister/reis): de hele reis in een
   vraag. bouwReisplan zet verblijf + transfer + diner + activiteit klaar als een
   voorstel met totaalprijs; voerReisUit boekt daarna alles in volgorde op het
   ene "ja", via exact dezelfde actie-functies als de app-knoppen. Verbatim
   afgesplitst uit reis.js; de gedeelde zaken-/open-/caps-/datumPlus-helpers
   komen via de context binnen. */
module.exports = (ctx) => {
  const { acties, reserveerTafel, zorgVoor, eur, datumInZin, plusDagen,
    verblijfBoek, zaken, open, caps, datumPlus } = ctx;

  function bouwReisplan(q) {
    const personen = Math.min(10, Math.max(1, parseInt((q.match(/(\d{1,2})\s*(personen|man|vrienden|pers)\b/i) || [])[1], 10) || 2));
    const start = datumInZin(q) || plusDagen(1);
    const nachten = Math.min(14, Math.max(1, parseInt((q.match(/(\d{1,2})\s*nacht/i) || [])[1], 10) || (/weekend/i.test(q) ? 2 : 2)));
    const delen = [];
    // verblijf: het eerste adres met een vrije kamer
    const hotel = zaken().find(s => Array.isArray(s.rooms) && s.rooms.some(r => r.available) && open(s));
    const kamer = hotel && hotel.rooms.find(r => r.available);
    if (hotel) delen.push({ soort: 'verblijf', supplierCode: hotel.code, roomId: kamer.id,
      aankomst: start, vertrek: datumPlus(start, nachten), personen,
      oms: nachten + ' nacht(en) in ' + kamer.name + ' bij ' + hotel.name,
      centen: Math.round((Number(kamer.price) || 0) * nachten * 100) });
    // transfer: een vervoerder brengt u naar het verblijf
    const rijders = zaken().filter(x => caps(x).includes('rides') && x.type !== 'activiteit' && open(x));
    const rijder = rijders.find(x => x.type === 'taxi') || rijders[0];
    if (rijder && hotel) delen.push({ soort: 'rit', supplierCode: rijder.code, to: hotel.name,
      toCode: hotel.code, personen, datum: start, tijd: '15:00',
      oms: 'transfer met ' + rijder.name + ' naar ' + hotel.name, centen: 0 });
    // diner op de aankomstavond
    const resto = zaken().find(s => s.type === 'restaurant' && open(s));
    if (resto) delen.push({ soort: 'tafel', supplierCode: resto.code, datum: start, tijd: '20:00',
      personen, oms: 'diner bij ' + resto.name + ' om 20:00', centen: 0 });
    // een activiteit op de eerste volle dag
    const actZaak = zaken().find(s => (s.activiteiten || []).length && open(s));
    const act = actZaak && actZaak.activiteiten[0];
    if (act) delen.push({ soort: 'ticket', supplierCode: actZaak.code, activiteitId: act.id,
      datum: datumPlus(start, 1), tijd: (act.tijden || [])[0] || '16:00', personen,
      oms: act.name + ' bij ' + actZaak.name, centen: Math.round((Number(act.prijs) || 0) * personen * 100) });
    return { delen, start, nachten, personen };
  }

  async function voerReisUit(key, codenaam, w, sess) {
    const regels = [];
    let gelukt = 0;
    for (const d of w.delen) {
      try {
        if (d.soort === 'verblijf' && verblijfBoek) {
          const r = verblijfBoek(sess, { supplierCode: d.supplierCode, roomId: d.roomId, aankomst: d.aankomst, vertrek: d.vertrek, personen: d.personen });
          regels.push(r.error ? '✕ ' + d.oms + ': ' + r.error : '✓ ' + d.oms + ' (' + r.verblijf.ref + ', ' + d.aankomst + ' tot ' + d.vertrek + ')');
          if (!r.error) gelukt++;
        } else if (d.soort === 'rit' && acties && acties.vraagRit) {
          const r = acties.vraagRit(sess, { supplierCode: d.supplierCode, to: d.to, toCode: d.toCode, personen: d.personen, datum: d.datum, tijd: d.tijd });
          if (r.error) { regels.push('✕ ' + d.oms + ': ' + r.error); continue; }
          const b = acties.betaalRit(sess, { ref: r.rit.ref });
          regels.push(b.error ? '✕ ' + d.oms + ': ' + b.error : '✓ ' + d.oms + ' om ' + d.tijd + ' (' + r.rit.ref + ')');
          if (!b.error) gelukt++;
        } else if (d.soort === 'tafel' && reserveerTafel) {
          const r = reserveerTafel({ key, tier: sess.tier }, codenaam, { supplierCode: d.supplierCode, datum: d.datum, tijd: d.tijd, personen: d.personen });
          regels.push(r.error ? '✕ ' + d.oms + ': ' + r.error : '✓ ' + d.oms + ' op ' + d.datum);
          if (!r.error) gelukt++;
        } else if (d.soort === 'ticket' && acties && acties.koopTicket) {
          const r = acties.koopTicket(sess, { supplierCode: d.supplierCode, activiteitId: d.activiteitId, datum: d.datum, tijd: d.tijd, personen: d.personen });
          if (r.error) { regels.push('✕ ' + d.oms + ': ' + r.error); continue; }
          const b = acties.betaalBoeking(sess, { ref: r.ticket.ref });
          regels.push(b.error ? '✕ ' + d.oms + ': ' + b.error : '✓ ' + d.oms + ' op ' + d.datum + ' om ' + d.tijd + ' (entreecode ' + r.ticket.code + ')');
          if (!b.error) gelukt++;
        }
      } catch (e) { regels.push('✕ ' + d.oms + ': dat lukte net niet; probeer dat onderdeel los.'); }
    }
    const zorgNu = zorgVoor && zorgVoor(key);
    return { tekst: 'Uw reis staat: ' + regels.join(' | ') + '.' +
      (gelukt < w.delen.length ? ' De onderdelen met een ✕ regel ik graag alsnog; zeg het maar.' : '') +
      (zorgNu && (zorgNu.allergenen || []).length ? ' Uw allergenen reizen overal automatisch mee.' : '') +
      ' Alles staat in uw app: het verblijf onder Reizen, de rit onder Onderweg, de tickets met oplichtende code.', gedaan: true };
  }

  return { bouwReisplan, voerReisUit };
};
