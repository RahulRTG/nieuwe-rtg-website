'use strict';
/* Alleen projecties van het authoritative journaal. Deze laag kan niet
   toevoegen, wissen of opslaan; de schrijver levert de actuele lijst. */
module.exports = (lijst, NIVEAUS) => {
  function overObject(type, id) {
    const t = String(type), i = String(id);
    return lijst().filter(r => r.objectType === t && r.objectId === i);
  }

  function recent(n, filter) {
    let rij = lijst().slice().reverse();
    if (filter && filter.actor) rij = rij.filter(r => r.actor === filter.actor);
    if (filter && filter.actie) rij = rij.filter(r => r.actie.includes(filter.actie));
    if (filter && filter.niveau) rij = rij.filter(r => r.niveau === filter.niveau);
    return rij.slice(0, n || 50);
  }

  /* Reconstrueer de tijdlijn uit vastgelegde voor/na-toestanden. Er wordt
     geen historische toestand uit de huidige state afgeleid. */
  function herbeleef(van, tot, opties) {
    const v = String(van || ''), t = String(tot || '￿');
    const alles = lijst().filter(r => r.at >= v && r.at <= t);
    const gefilterd = opties && opties.objectType
      ? alles.filter(r => r.objectType === opties.objectType && (!opties.objectId || r.objectId === String(opties.objectId)))
      : alles;
    return {
      van: v, tot: t, stappen: gefilterd.length,
      actoren: [...new Set(gefilterd.map(r => r.actor))],
      automatisch: gefilterd.filter(r => r.niveau === NIVEAUS.auto).length,
      mislukt: gefilterd.filter(r => r.uitslag !== 'gedaan').length,
      lijn: gefilterd.map(r => ({ at: r.at, actor: r.actor, actie: r.actie, niveau: r.niveau,
        object: r.objectType ? r.objectType + ' ' + r.objectId : null,
        reden: r.reden, uitslag: r.uitslag, voor: r.voor, na: r.na, zegel: r.zegel }))
    };
  }
  return { overObject, recent, herbeleef };
};
