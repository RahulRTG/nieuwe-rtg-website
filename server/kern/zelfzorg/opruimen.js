/* Zelfzorg, pijler 1: OPRUIMEN. Veegt wat aantoonbaar verlopen of over zijn
   grens gegroeid is. Alles hier is veilig en verwacht: verlopen snaps en
   verhalen (24-uursregel), verlopen munt-ontvangsten, verlopen care-intakes
   (kwartaalregel), en de interne logboeken terug binnen hun grens. Er wordt
   nooit iets weggegooid dat nog geldig is of geld raakt. */

module.exports = (ctx) => {
  const { db, save, schrijf } = ctx;
  const d = () => db.data;
  const DAG = 86400000;

  function opruim(door) {
    const acties = [];
    const nu = Date.now();
    const oud = (iso, ms) => nu - new Date(iso || 0).getTime() >= ms;

    // verlopen snaps (bekeken of ouder dan 24 uur) en verhalen (24 uur)
    if (Array.isArray(d().snaps)) {
      const voor = d().snaps.length;
      d().snaps = d().snaps.filter(s => !s.bekeken && !oud(s.at, DAG));
      if (voor - d().snaps.length) acties.push({ wat: 'verlopen snaps geveegd', aantal: voor - d().snaps.length });
    }
    if (Array.isArray(d().stories)) {
      const voor = d().stories.length;
      d().stories = d().stories.filter(s => !oud(s.at, DAG));
      if (voor - d().stories.length) acties.push({ wat: 'verlopen verhalen geveegd', aantal: voor - d().stories.length });
    }

    // munt-ontvangsten die hun vervaltijd voorbij zijn: markeren, niet wissen
    // (de betaalgeschiedenis blijft heel; er verdwijnt nooit geld-administratie)
    const mo = d().muntOntvangsten;
    if (mo && typeof mo === 'object') {
      let n = 0;
      for (const k of Object.keys(mo)) {
        const o = mo[k];
        if (o && o.status === 'wacht' && o.vervalt && new Date(o.vervalt).getTime() < nu) { o.status = 'verlopen'; n++; }
      }
      if (n) acties.push({ wat: 'verlopen munt-ontvangsten gemarkeerd', aantal: n });
    }

    // gedeelde care-intakes voorbij hun kwartaal: markeren als verlopen
    if (Array.isArray(d().careIntake)) {
      const vandaag = new Date().toISOString().slice(0, 10);
      let n = 0;
      for (const i of d().careIntake) if (i && i.status === 'actief' && i.vervaltOp && i.vervaltOp < vandaag) { i.status = 'verlopen'; n++; }
      if (n) acties.push({ wat: 'verlopen care-intakes gemarkeerd', aantal: n });
    }

    // interne logboeken terug binnen hun grens (het werk gaat nooit verloren,
    // alleen de staart van heel oude regels)
    if (Array.isArray(d().kantoorAudit) && d().kantoorAudit.length > 2000) {
      acties.push({ wat: 'kantoor-auditlog ingekort', aantal: d().kantoorAudit.length - 2000 });
      d().kantoorAudit.length = 2000;
    }
    const chat = d().kantoorChat;
    if (chat && typeof chat === 'object') {
      let n = 0;
      for (const k of Object.keys(chat)) if (Array.isArray(chat[k]) && chat[k].length > 300) { n += chat[k].length - 300; chat[k].length = 300; }
      if (n) acties.push({ wat: 'kantoorchat-archief ingekort', aantal: n });
    }
    const tech = d().techniek;
    if (tech && Array.isArray(tech.moderniseringen) && tech.moderniseringen.length > 50) {
      acties.push({ wat: 'moderniseringslog ingekort', aantal: tech.moderniseringen.length - 50 });
      tech.moderniseringen = tech.moderniseringen.slice(-50);
    }

    if (acties.length) save();
    const regel = schrijf('opruimen', door, acties, []);
    return { ok: true, acties, at: regel.at, schoon: !acties.length };
  }

  return { opruim };
};
