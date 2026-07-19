/* Dorpstools, deel "hotelborden" (kern/hoteldorp/tools): het vakspecifieke bord
   van de hotelafdelingen (frontoffice t/m watersport). hotelBord duwt zijn
   blokken in de meegegeven tools-array; matcht de afdeling niet, dan doet het
   niets (dan pakt clubBord het, of geen van beide). Verbatim afgesplitst uit
   tools.js; de gedeelde helpers (alle/open/eind/opDag/minuten) komen als
   gereedschap mee. */
module.exports = (ctx) => {
  const { db, AFDELINGEN, posten } = ctx;

  function hotelBord(tools, g) {
    const { s, key, alle, open, eind, vandaag, opDag, minuten } = g;

    if (key === 'frontoffice') {
      const van = (db.data.verblijven || []).filter(v => v.supplierCode === s.code);
      tools.push({ type: 'cijfers', titel: 'Dagstaat', items: [
        { label: 'aankomsten', waarde: van.filter(v => v.status === 'bevestigd' && v.aankomst <= vandaag).length },
        { label: 'vertrekken', waarde: van.filter(v => v.status === 'ingecheckt' && v.vertrek <= vandaag).length },
        { label: 'in huis', waarde: van.filter(v => v.status === 'ingecheckt').length },
        { label: 'bezet', waarde: (s.rooms || []).filter(r => r.hk && r.hk.status === 'bezet').length + '/' + (s.rooms || []).length },
        { label: 'aanvragen', waarde: van.filter(v => v.status === 'aangevraagd').length }
      ] });
    }
    if (key === 'guest') {
      const inHuis = (db.data.verblijven || []).filter(v => v.supplierCode === s.code && v.status === 'ingecheckt');
      tools.push({ type: 'lijst', titel: 'Gastenkaart, wie slaapt er', leeg: 'Niemand in huis.',
        rijen: inHuis.slice(0, 20).map(v => ({ icoon: String.fromCodePoint(0x1F6CF), tekst: v.codenaam + ' - ' + v.roomName,
          sub: posten(s).filter(p => p.waar && v.roomName.toLowerCase().includes(p.waar.toLowerCase().split(',')[0].trim()) && p.waar.length > 2).slice(0, 4)
            .map(p => ((AFDELINGEN[p.afdeling] || {}).icon || '') + ' ' + p.tekst + ' (' + p.status + ')').join(' - '),
          rechts: 'tot ' + v.vertrek })) });
    }
    if (key === 'relations') {
      tools.push({ type: 'lijst', titel: 'Vandaag nabellen', leeg: 'Niemand om na te bellen.',
        rijen: alle.filter(p => p.status === 'opgelost').map(p => ({ icoon: String.fromCodePoint(0x1F4DE), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst })) });
    }
    if (key === 'concierge') {
      tools.push({ type: 'lijst', titel: 'Vandaag geregeld', leeg: 'Nog niets geregeld vandaag.',
        rijen: alle.filter(p => p.status === eind && opDag(p.updatedAt)).slice(0, 8).map(p => ({ icoon: String.fromCodePoint(0x2728), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst })) });
    }
    if (key === 'parking') {
      tools.push({ type: 'lijst', titel: 'Voorrijd-wachtrij', leeg: 'Niemand wacht.',
        rijen: alle.filter(p => p.status === 'voorrijden').sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
          .map(p => ({ icoon: String.fromCodePoint(0x1F697), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.updatedAt) + ' min', rood: minuten(p.updatedAt) >= 5 })) });
      tools.push({ type: 'cijfers', titel: 'Garage', items: [{ label: 'gestald', waarde: alle.filter(p => p.status === 'geparkeerd').length }] });
    }
    if (key === 'security') {
      const rondes = alle.filter(p => /ronde/i.test(p.tekst) && p.status === eind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      tools.push({ type: 'lijst', titel: 'Rondeklok', leeg: 'Nog geen ronde gelopen vandaag.',
        rijen: rondes.slice(0, 3).map(p => ({ icoon: String.fromCodePoint(0x1F6E1), tekst: p.tekst + ' (' + p.door + ')', rechts: minuten(p.updatedAt) + ' min' })) });
    }
    if (key === 'spa') {
      tools.push({ type: 'lijst', titel: 'Dagagenda', leeg: 'Geen afspraken.',
        rijen: open.slice().sort((a, b) => (a.waar || '').localeCompare(b.waar || '')).map(p => ({ icoon: String.fromCodePoint(0x1F486), tekst: (p.waar || '?') + ' - ' + p.tekst, rechts: p.status })) });
    }
    if (key === 'amenities') {
      tools.push({ type: 'lijst', titel: 'Onderweg naar de kamers', leeg: 'Niets onderweg.',
        rijen: alle.filter(p => p.status === 'onderweg').map(p => ({ icoon: String.fromCodePoint(0x1F9F4), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst })) });
    }
    if (key === 'patissier') {
      tools.push({ type: 'lijst', titel: 'In de maak', leeg: 'De oven is leeg.',
        rijen: alle.filter(p => p.status === 'in de maak').map(p => ({ icoon: String.fromCodePoint(0x1F370), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst })) });
    }
    if (key === 'klussen') {
      tools.push({ type: 'lijst', titel: 'Defecten uit housekeeping', leeg: 'Geen kamers defect gemeld.',
        rijen: (s.rooms || []).filter(r => r.hk && r.hk.status === 'defect').map(r => ({ icoon: String.fromCodePoint(0x26A0), tekst: r.kamer || r.name, sub: (r.hk && r.hk.note) || '', rood: true })) });
    }
    if (key === 'it') {
      tools.push({ type: 'lijst', titel: 'Storingen open', leeg: 'Alles draait.',
        rijen: open.map(p => ({ icoon: String.fromCodePoint(0x1F5A5), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) >= 60 ? Math.round(minuten(p.at) / 60) + ' uur' : minuten(p.at) + ' min', rood: minuten(p.at) >= 60 })) });
    }
    if (key === 'sales' || key === 'events') {
      tools.push({ type: 'cijfers', titel: 'Pijplijn', items: g.afd.keten.map(fase => ({ label: fase, waarde: alle.filter(p => p.status === fase).length })) });
      if (key === 'events') tools.push({ type: 'lijst', titel: 'Eerstvolgend', leeg: 'Niets gepland.',
        rijen: open.slice().sort((a, b) => (a.waar || '').localeCompare(b.waar || '')).slice(0, 5).map(p => ({ icoon: String.fromCodePoint(0x1F3AA), tekst: (p.waar || '?') + ' - ' + p.tekst, rechts: p.status })) });
    }
    if (key === 'florist') {
      tools.push({ type: 'lijst', titel: 'Toe aan vers', leeg: 'Alles staat er vers bij.',
        rijen: alle.filter(p => p.status === eind && minuten(p.updatedAt) > 5 * 1440).map(p => ({ icoon: String.fromCodePoint(0x1F490), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: Math.round(minuten(p.updatedAt) / 1440) + ' dagen', rood: true })) });
    }
    if (key === 'kidsclub') {
      tools.push({ type: 'lijst', titel: 'Presentielijst', leeg: 'Geen kinderen binnen.',
        rijen: alle.filter(p => p.status === 'binnen').map(p => ({ icoon: String.fromCodePoint(0x1F9F8), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: Math.round(minuten(p.updatedAt) / 6) / 10 + ' uur' })) });
    }
    if (key === 'watersport') {
      tools.push({ type: 'lijst', titel: 'Op het water', leeg: 'Iedereen is binnen.',
        rijen: alle.filter(p => p.status === 'op het water').map(p => ({ icoon: String.fromCodePoint(0x1F3C4), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.updatedAt) + ' min' + (minuten(p.updatedAt) > 120 ? ' !' : ''), rood: minuten(p.updatedAt) > 120 })) });
    }
  }

  return { hotelBord };
};
