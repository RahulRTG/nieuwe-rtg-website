/* Dorpstools, deel "clubborden" (kern/hoteldorp/tools): het vakspecifieke bord
   van het clubdorp (van de deur tot het kantoor), het restaurantdorp en het
   strand. clubBord duwt zijn blokken in de meegegeven tools-array; matcht de
   afdeling niet, dan doet het niets (dan pakte hotelBord het al). Verbatim
   afgesplitst uit tools.js; de gedeelde helpers komen als gereedschap mee. */
module.exports = (ctx) => {
  const { AFDELINGEN, posten } = ctx;

  function clubBord(tools, g) {
    const { s, key, alle, open, eind, opDag, minuten } = g;

    // de borden van het clubdorp: van de deur tot het kantoor
    if (key === 'entree') {
      tools.push({ type: 'cijfers', titel: 'Deurstaat', items: [
        { label: 'op de lijst', waarde: alle.filter(p => p.status === 'op de lijst').length },
        { label: 'aan de deur', waarde: alle.filter(p => p.status === 'aan de deur').length },
        { label: 'binnen vanavond', waarde: alle.filter(p => p.status === eind && opDag(p.updatedAt)).length }
      ] });
      tools.push({ type: 'lijst', titel: 'Gastenlijst', leeg: 'Nog niemand op de lijst.',
        rijen: alle.filter(p => p.status === 'op de lijst').slice(0, 12).map(p => ({ icoon: String.fromCodePoint(0x1F4CB), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst })) });
    }
    if (key === 'garderobe') {
      const hangt = alle.filter(p => p.status === 'in bewaring');
      tools.push({ type: 'lijst', titel: 'In bewaring (' + hangt.length + ')', leeg: 'De rekken zijn leeg.',
        rijen: hangt.slice(0, 12).map(p => ({ icoon: String.fromCodePoint(0x1F9E5), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) >= 60 ? Math.round(minuten(p.at) / 60) + ' uur' : minuten(p.at) + ' min' })) });
    }
    if (key === 'bar') {
      tools.push({ type: 'lijst', titel: 'Aanvullen en 86', leeg: 'De bar staat er strak bij.',
        rijen: open.map(p => ({ icoon: String.fromCodePoint(0x1F378), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min', rood: minuten(p.at) > 30 })) });
    }
    if (key === 'vip') {
      tools.push({ type: 'lijst', titel: 'Tafels vanavond', leeg: 'Nog geen tafels geboekt.',
        rijen: open.slice().sort((a, b) => (a.waar || '').localeCompare(b.waar || '')).map(p => ({ icoon: String.fromCodePoint(0x1F37E), tekst: (p.waar || '?') + ' - ' + p.tekst, rechts: p.status })) });
    }
    if (key === 'dj') {
      tools.push({ type: 'lijst', titel: 'Verzoekjes in de wachtrij', leeg: 'Geen verzoekjes; de dj bepaalt.',
        rijen: alle.filter(p => p.status === 'in de wachtrij').map(p => ({ icoon: String.fromCodePoint(0x1F3B5), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min' })) });
    }
    if (key === 'techniek') {
      tools.push({ type: 'lijst', titel: 'Storingen open', leeg: 'Licht en geluid draaien.',
        rijen: open.map(p => ({ icoon: String.fromCodePoint(0x1F39B), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min', rood: minuten(p.at) >= 30 })) });
    }
    if (key === 'vloer') {
      tools.push({ type: 'lijst', titel: 'Meldingen op de vloer', leeg: 'De vloer ligt er netjes bij.',
        rijen: open.map(p => ({ icoon: String.fromCodePoint(0x1F9F9), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min', rood: minuten(p.at) > 20 })) });
      // de bijvullijst van de runners: alles wat de bar open heeft staan
      const barEind = AFDELINGEN.bar.keten[AFDELINGEN.bar.keten.length - 1];
      const bijvul = posten(s).filter(p => p.afdeling === 'bar' && p.status !== barEind);
      tools.push({ type: 'lijst', titel: 'Bijvullen voor de bar', leeg: 'De bar vraagt niets; loop je ronde.',
        rijen: bijvul.map(p => ({ icoon: String.fromCodePoint(0x1F4E6), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min', rood: minuten(p.at) > 30 })) });
    }
    if (key === 'promo') {
      tools.push({ type: 'cijfers', titel: 'Campagnebord', items: g.afd.keten.map(fase => ({ label: fase, waarde: alle.filter(p => p.status === fase).length })) });
    }
    if (key === 'inkoop') {
      tools.push({ type: 'lijst', titel: 'Onderweg naar de zaak', leeg: 'Niets onderweg.',
        rijen: alle.filter(p => p.status === 'onderweg').map(p => ({ icoon: String.fromCodePoint(0x1F69A), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst })) });
    }
    if (key === 'kantoor') {
      tools.push({ type: 'lijst', titel: 'Ligt op het bureau', leeg: 'Het bureau is leeg.',
        rijen: open.slice().sort((a, b) => a.at.localeCompare(b.at)).map(p => ({ icoon: String.fromCodePoint(0x1F5C2), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) >= 1440 ? Math.round(minuten(p.at) / 1440) + ' dagen' : minuten(p.at) >= 60 ? Math.round(minuten(p.at) / 60) + ' uur' : minuten(p.at) + ' min', rood: minuten(p.at) >= 1440 })) });
    }
    // de borden van het restaurantdorp en het strand
    if (key === 'host') {
      tools.push({ type: 'lijst', titel: 'Het boek van vandaag', leeg: 'Nog geen reserveringen op het bord.',
        rijen: open.slice().sort((a, b) => (a.waar || '').localeCompare(b.waar || '')).map(p => ({ icoon: String.fromCodePoint(0x1F4D6), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: p.status })) });
    }
    if (key === 'bediening') {
      tools.push({ type: 'lijst', titel: 'Tafels die iets vragen', leeg: 'Alle tafels zijn geholpen.',
        rijen: open.map(p => ({ icoon: String.fromCodePoint(0x1F937), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min', rood: minuten(p.at) > 10 })) });
    }
    if (key === 'keuken') {
      tools.push({ type: 'lijst', titel: 'Doorgiftes en 86', leeg: 'De pas is stil.',
        rijen: open.map(p => ({ icoon: String.fromCodePoint(0x1F52A), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.at) + ' min', rood: /86|allergie/i.test(p.tekst) })) });
    }
    if (key === 'ligbedden') {
      tools.push({ type: 'cijfers', titel: 'Strandstaat', items: [
        { label: 'gereserveerd', waarde: alle.filter(p => p.status === 'gereserveerd').length },
        { label: 'bezet', waarde: alle.filter(p => p.status === 'bezet').length },
        { label: 'vrijgegeven vandaag', waarde: alle.filter(p => p.status === eind && opDag(p.updatedAt)).length }
      ] });
      tools.push({ type: 'lijst', titel: 'Nu op het strand', leeg: 'De bedden zijn vrij.',
        rijen: alle.filter(p => p.status === 'bezet').slice(0, 12).map(p => ({ icoon: String.fromCodePoint(0x1F3D6), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: minuten(p.updatedAt) >= 60 ? Math.round(minuten(p.updatedAt) / 60) + ' uur' : minuten(p.updatedAt) + ' min' })) });
    }
  }

  return { clubBord };
};
