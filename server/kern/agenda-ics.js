/* De agenda, deel 2: de randen om de kalender heen -- de ICS-export, de
   herinnerings-veegtimer en de alleen-lezen laag uit het ecosysteem.

   ICS is de reden dat deze agenda niet op een eiland ligt: het bestand
   opent in elke agenda ter wereld. Tijden gaan er bewust als LOKALE tijd
   in (zonder tijdzone-regel): wat u intypte is wat de ander ziet; een
   membership-club die tijdzones gaat herrekenen zit er vaker naast dan
   goed voor hem is.

   De veegtimer kijkt elke halve minuut of er iets nadert waarvoor een
   herinnering is gevraagd, en stuurt dan een seintje (SSE) naar het
   toestel. Bij een herhalende afspraak geldt de herinnering voor elke
   keer dat hij valt; 'herinnerdOp' onthoudt per datum dat het seintje al
   geweest is. De timer is unref'd, zodat hij een test nooit wakker houdt. */

module.exports = ({ db, store }, h) => {
  const RR = { dag: 'DAILY', week: 'WEEKLY', maand: 'MONTHLY', jaar: 'YEARLY' };
  const escI = t => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  function ics(ownerKey) {
    const r = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RTG//Agenda//NL', 'CALSCALE:GREGORIAN'];
    for (const i of h.ruw(ownerKey)) {
      if (!h.isDatum(i.datum)) continue;
      const d8 = i.datum.replace(/-/g, '');
      r.push('BEGIN:VEVENT', 'UID:' + i.id + '@rtg.agenda');
      if (i.tijd) {
        r.push('DTSTART:' + d8 + 'T' + i.tijd.replace(':', '') + '00');
        if (i.eind) r.push('DTEND:' + d8 + 'T' + i.eind.replace(':', '') + '00');
      } else r.push('DTSTART;VALUE=DATE:' + d8);
      r.push('SUMMARY:' + escI(i.titel));
      if (i.plek) r.push('LOCATION:' + escI(i.plek));
      if (i.notitie) r.push('DESCRIPTION:' + escI(i.notitie));
      if (RR[i.herhaal]) r.push('RRULE:FREQ=' + RR[i.herhaal] +
        (i.herhaalTot ? ';UNTIL=' + i.herhaalTot.replace(/-/g, '') : ''));
      if (i.herinner != null && i.tijd) r.push('BEGIN:VALARM', 'ACTION:DISPLAY',
        'DESCRIPTION:' + escI(i.titel), 'TRIGGER:-PT' + i.herinner + 'M', 'END:VALARM');
      r.push('END:VEVENT');
    }
    r.push('END:VCALENDAR');
    return r.join('\r\n');
  }

  /* Valt een (mogelijk herhalende) afspraak op deze datum? Elke keer wordt
     vanaf de basisdatum gerekend (h.keerN), zodat een geklemde maand de
     reeks niet verlegt. */
  function valtOp(i, datum) {
    if (i.datum === datum) return true;
    if (!i.herhaal || i.herhaal === 'geen') return false;
    if (datum < i.datum || (i.herhaalTot && datum > i.herhaalTot)) return false;
    for (let n = 1; n < 500; n++) {
      const d = h.keerN(i.datum, i.herhaal, n);
      if (d === datum) return true;
      if (d > datum) return false;
    }
    return false;
  }

  /* De laag uit het ecosysteem: eigen RTG-boekingen, alleen-lezen en met
     bronlabel. De agenda leest RTG; hij herschrijft RTG niet. */
  function ecosysteem(memberKey, van, tot) {
    const uit = [];
    if (!h.isDatum(van) || !h.isDatum(tot)) return uit;
    for (const b of (h.boekingenVanKlant ? h.boekingenVanKlant(memberKey) : []) || []) {
      if (!b.wanneer) continue;
      const w = String(b.wanneer), datum = w.slice(0, 10);
      if (datum < van || datum > tot) continue;
      if (['geannuleerd', 'geweigerd', 'afgewezen'].includes(String(b.status || ''))) continue;
      uit.push({ id: 'boeking:' + b.ref, bron: 'boeking', ref: b.ref, datum,
        tijd: w.length > 10 ? w.slice(11, 16) : null, status: b.status || null,
        titel: ((b.service && b.service.name) || 'Boeking') + (b.supplierName ? ' · ' + b.supplierName : '') });
    }
    return uit;
  }

  let timer = null;
  function veeg() {
    try {
      const nuMs = Date.now();
      const vandaag = new Date(nuMs).toISOString().slice(0, 10);
      for (const [owner, arr] of Object.entries(store())) {
        const lk = h.lidVan(owner);
        if (!lk || !Array.isArray(arr)) continue;
        for (const i of arr) {
          if (i.gedaan || i.herinner == null || !i.tijd) continue;
          if (i.herinnerdOp === vandaag || !valtOp(i, vandaag)) continue;
          const start = new Date(vandaag + 'T' + i.tijd + ':00').getTime();
          if (nuMs >= start - i.herinner * 60000 && nuMs < start) {
            i.herinnerdOp = vandaag;
            h.save();
            try { h.sseToCustomer(lk, 'agenda', { kind: 'herinnering', titel: i.titel, datum: vandaag,
              tijd: i.tijd, plek: i.plek || null }); } catch (e) {}
          }
        }
      }
    } catch (e) { /* de veger valt nooit de zaak om */ }
  }
  function startHerinneringen() {
    if (timer) return;
    timer = setInterval(veeg, 30000);
    if (timer.unref) timer.unref();
  }

  return { ics, ecosysteem, startHerinneringen, _veeg: veeg, _valtOp: valtOp };
};
