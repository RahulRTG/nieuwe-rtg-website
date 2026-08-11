/* Spellen (deelmodule): DE WACHTRIJ -- een tegenstander die je niet kent.

   Afgesplitst van ./lobby.js, op de naad die daar al lag. Dat bestand gaat over
   een potje dat je met NAAM opzet: uitnodigen, accepteren, en zien wat je hebt
   lopen. Dit gaat over het andere pad -- je meldt je aan en de server koppelt je
   aan wie er verder wacht. Dat heeft een eigen onderwerp dat in de lobby alleen
   maar meelas: WAAROP SPLITST EEN RIJ.

   Die vraag is de hele module. Een rij die te grof splitst koppelt mensen die
   niet hetzelfde spel wilden; een rij die te fijn splitst koppelt niemand. Vier
   dingen splitsen hem vandaag, en drie ervan hebben een reden die je niet mag
   weglaten:

   - het SPEL en de GROOTTE: vanzelfsprekend, dat is het spel.
   - de TAAL, maar alleen bij een taalgevoelig spel (`perTaal` in de descriptor;
     Woordduel heeft een letterzak per taal). Bij de rest zou het de rij delen
     zonder dat er iets verschilt.
   - het TEMPO: wie een partij van 72 uur per beurt zoekt en er een van 30
     seconden krijgt, heeft geen tegenstander maar een verloren partij.
   - de VARIANT, om dezelfde reden: wie schoolvragen zoekt en algemene kennis
     krijgt, heeft geen tegenstander maar een ander spel.

   Een potje zonder tempo en zonder variant houdt de OUDE sleutel, dus rijen die
   al liepen veranderen niet.

   ER IS HIER GEEN GASTHEER, en dat is geen vergeten veld: de wachtrij koppelt
   vreemden, dus niemand is hier de uitnodiger. Dat verschil telt zodra er iets
   aan `host` hangt (een projectiekamer openen, een Game Night leiden). */
module.exports = (ctx) => {
  const { S, save, rid, nu, SPEL, TEAMS, beleid, klok, nudge, opschonen, spelStart, spelGrootte, teamModus } = ctx;
  function spelRandom(mij, soort, grootte, taal, wereld, tempo, variant) {
    opschonen();
    const nee = beleid.mag(mij, soort, { wereld });
    if (nee) return nee;
    const tf = klok ? klok.tempoFout(soort, tempo) : null;
    if (tf) return { status: 400, error: tf };
    const vv = beleid.variant(soort, variant);
    if (vv.error) return vv;
    const max = spelGrootte(soort, grootte);
    const w_taal = taal === 'en' ? 'en' : 'nl';
    /* De sleutel: waarop de rij splitst, met de vier redenen in de kop van dit
       bestand. De variant gaat er op ALFABETISCHE volgorde in, zodat dezelfde
       keuze altijd dezelfde rij oplevert -- de volgorde van de velden in een
       verzoek mag geen tweede rij maken. */
    const vSleutel = Object.entries(vv.variant || {}).filter(([, w]) => w !== null)
      .sort(([a], [b]) => a.localeCompare(b)).map(([k, w]) => k + '=' + w).join(',');
    const sleutel = soort + ':' + max + (SPEL[soort].perTaal ? ':' + w_taal : '') +
      (tempo ? ':' + tempo : '') + (vSleutel ? ':' + vSleutel : '');
    const w = S().wachtrij;
    w[sleutel] = (w[sleutel] || []).filter(x => x !== mij);
    w[sleutel].push(mij);
    if (w[sleutel].length >= max) {
      const spelers = w[sleutel].splice(0, max);
      const potje = Object.assign({ id: rid(5), soort, grootte: max, modus: teamModus(soort, max), taal: w_taal,
        teams: TEAMS, spelers, uitgenodigd: [],
        status: 'wacht', beurt: 0, winnaar: null, at: nu(), door: 'random' },
        // geen host: de wachtrij koppelt vreemden, dus niemand is hier gastheer
        beleid.roomVelden({ context: 'hall', host: null, tempo, variant: vv.variant }));
      S().potjes[potje.id] = potje;
      spelStart(potje);
      save();
      spelers.forEach(sp => nudge(sp, potje));
      return { status: 200, ok: true, id: potje.id, gestart: true };
    }
    save();
    return { status: 200, ok: true, wachten: true, plek: w[sleutel].length, nodig: max };
  }

  return { spelRandom };
};
