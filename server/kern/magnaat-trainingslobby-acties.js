/* Muterende teamkameracties. De kamerkern levert de autorisatie-, revisie- en
   auditbouwstenen aan, zodat alle acties dezelfde veiligheidsgrenzen delen. */
'use strict';

module.exports = H => {
  const { tekst, fout, vind, revisie, commando, legCommandoVast, muteer,
    publiek, rolVan, nu, id } = H;

  function kiesRol(key, kamerId, rolId, verwacht) {
    const v = vind(key, kamerId); if (v.fout) return v.fout;
    if (!['wacht', 'gepauzeerd'].includes(v.kamer.status))
      return fout('Een rol kan alleen voor de start of tijdens een pauze worden gewijzigd.', 409);
    const rf = revisie(v.kamer, verwacht); if (rf) return rf;
    const rol = v.kamer.rollen.find(r => r.id === tekst(rolId, 100));
    if (!rol) return fout('Kies een rol uit deze bedrijfstweeling.');
    v.d.rolId = rol.id;
    muteer(v.kamer, v.d, 'rol-gekozen', rol.naam);
    return { ok: true, kamer: publiek(v.kamer, key) };
  }

  function bouwTaken(kamer) {
    return kamer.werkproces.stappen.map((stap, i) => {
      const d = kamer.deelnemers[i % kamer.deelnemers.length];
      const rol = rolVan(kamer, d);
      const laatste = i === kamer.werkproces.stappen.length - 1;
      return {
        id: id('taak'), titel: tekst(stap, 220),
        soort: laatste && rol && rol.rechten.includes('goedkeuren')
          ? 'goedkeuring' : i === 0 ? 'intake' : laatste ? 'afronding' : 'uitvoering',
        eigenaarId: d.id, status: 'open', bewijs: null, afgerondDoor: null, afgerondAt: null
      };
    });
  }

  function start(key, kamerId, verwacht, commandId) {
    const v = vind(key, kamerId); if (v.fout) return v.fout;
    if (v.kamer.hostKey !== tekst(key, 150)) return fout('Alleen de host kan de teamtraining starten.', 403);
    const c = commando(v.kamer, commandId);
    if (c.fout) return c.fout;
    if (c.herhaald) return { ok: true, herhaald: true, kamer: publiek(v.kamer, key) };
    if (v.kamer.status !== 'wacht') return fout('Deze teamkamer kan niet opnieuw worden gestart.', 409);
    const rf = revisie(v.kamer, verwacht); if (rf) return rf;
    if (v.kamer.deelnemers.length < 2) return fout('Een teamtraining start met minimaal twee deelnemers.', 409);
    if (v.kamer.deelnemers.some(d => !d.rolId)) return fout('Iedere deelnemer kiest eerst een bedrijfsrol.', 409);
    legCommandoVast(v.kamer, c.sleutel);
    v.kamer.taken = bouwTaken(v.kamer);
    v.kamer.taakIndex = 0;
    v.kamer.status = 'bezig';
    muteer(v.kamer, v.d, 'training-gestart', v.kamer.deelnemers.length + ' deelnemers · ' + v.kamer.werkproces.naam);
    return { ok: true, kamer: publiek(v.kamer, key) };
  }

  function actie(key, kamerId, invoer = {}) {
    const v = vind(key, kamerId); if (v.fout) return v.fout;
    const c = commando(v.kamer, invoer.commandoId);
    if (c.fout) return c.fout;
    if (c.herhaald) return { ok: true, herhaald: true, kamer: publiek(v.kamer, key) };
    if (v.kamer.status !== 'bezig') return fout('De teamtraining loopt nu niet.', 409);
    const rf = revisie(v.kamer, invoer.revisie); if (rf) return rf;
    const taak = v.kamer.taken[v.kamer.taakIndex];
    if (!taak) return fout('Er staat geen taak open.', 409);
    const soort = tekst(invoer.actie, 30);
    if (soort === 'overdragen') {
      if (taak.eigenaarId !== v.d.id && v.kamer.hostKey !== tekst(key, 150))
        return fout('Alleen de taakeigenaar of host mag overdragen.', 403);
      const doel = v.kamer.deelnemers.find(d => d.id === tekst(invoer.naar, 100));
      if (!doel) return fout('Kies een deelnemer uit deze teamkamer.');
      legCommandoVast(v.kamer, c.sleutel);
      taak.eigenaarId = doel.id;
      muteer(v.kamer, v.d, 'taak-overgedragen', taak.titel + ' → ' + doel.naam);
      return { ok: true, kamer: publiek(v.kamer, key) };
    }
    if (soort !== 'voltooien') return fout('Kies voltooien of overdragen.');
    if (taak.eigenaarId !== v.d.id) return fout('Deze taak is aan een andere deelnemer toegewezen.', 403);
    const bewijs = tekst(invoer.bewijs, 600);
    if (bewijs.length < 12) return fout('Leg in minimaal twaalf tekens vast wat u aantoonbaar heeft gedaan.');
    const rol = rolVan(v.kamer, v.d);
    if (taak.soort === 'goedkeuring' && (!rol || !rol.rechten.includes('goedkeuren')))
      return fout('Deze bedrijfsrol heeft geen goedkeuringsrecht.', 403);
    legCommandoVast(v.kamer, c.sleutel);
    taak.status = 'klaar';
    taak.bewijs = bewijs;
    taak.afgerondDoor = v.d.naam;
    taak.afgerondAt = nu();
    v.kamer.taakIndex += 1;
    if (v.kamer.taakIndex >= v.kamer.taken.length) {
      v.kamer.status = 'voltooid';
      v.kamer.voltooidAt = nu();
    }
    muteer(v.kamer, v.d, v.kamer.status === 'voltooid' ? 'training-voltooid' : 'taak-voltooid', taak.titel);
    return { ok: true, kamer: publiek(v.kamer, key) };
  }

  function bedien(key, kamerId, actieIn, verwacht, commandId) {
    const v = vind(key, kamerId); if (v.fout) return v.fout;
    if (v.kamer.hostKey !== tekst(key, 150)) return fout('Alleen de host bedient de teamkamer.', 403);
    const c = commando(v.kamer, commandId);
    if (c.fout) return c.fout;
    if (c.herhaald) return { ok: true, herhaald: true, kamer: publiek(v.kamer, key) };
    const rf = revisie(v.kamer, verwacht); if (rf) return rf;
    const actie = tekst(actieIn, 30);
    if (actie === 'pauzeren' && v.kamer.status === 'bezig') v.kamer.status = 'gepauzeerd';
    else if (actie === 'hervatten' && v.kamer.status === 'gepauzeerd') v.kamer.status = 'bezig';
    else if (actie === 'herstarten' && ['gepauzeerd', 'voltooid'].includes(v.kamer.status)) {
      v.kamer.taken = bouwTaken(v.kamer);
      v.kamer.taakIndex = 0;
      v.kamer.status = 'bezig';
      v.kamer.voltooidAt = null;
    } else return fout('Deze bediening past niet bij de huidige kamerstatus.', 409);
    legCommandoVast(v.kamer, c.sleutel);
    muteer(v.kamer, v.d, actie, v.kamer.werkproces.naam);
    return { ok: true, kamer: publiek(v.kamer, key) };
  }

  return { kiesRol, start, actie, bedien };
};
