/* RTG Festival (deelmodule): HET PODIUM. Wat er nu speelt, en wat er niet klopt.

   (Niet te verwarren met kern/podium/ -- dat is RTG Podium, het live-kanaal.
   Dit gaat over een houten vloer met licht erboven.)

   EEN STAGE MANAGER HOEFT HET SCHEMA NIET TE ZIEN. Dat kent hij. Wat hij moet
   zien is waar het van het schema afwijkt: een artiest die over veertig minuten
   opgaat terwijl de boeking nog een VOORNEMEN is, een rider met vier open
   punten een half uur voor de set, een soundcheck die zo begint. Dat is
   dezelfde regel als in ./uitzondering.js, en daarom komen deze meldingen ook
   op diezelfde hoop terecht in plaats van in een eigen lijstje.

   HET VOORNEMEN IS DE ZWAARSTE. Een set in het schema die niemand heeft
   bevestigd, is geen programmapunt maar een wens (./artiest.js). Een half uur
   voor de deuren opengaan is dat geen administratieve achterstand meer maar een
   gat in het programma, en het staat hier dus als kritiek.

   ER WORDT NIETS AFGELAST EN NIETS OMGEBOEKT. Deze laag stelt vast; ingrijpen
   doet de mens (FESTIVAL.md par. 4, en par. 5.3 voor waarom dat geen detail is).
   Er zit hier dus geen knop en geen automatische herplanning. */
'use strict';

const HORIZON = 60;

module.exports = (ctx) => {
  const { editieVind, dagVind, offset, plekVind } = ctx;

  const podia = (e) => Object.values(e.plekken || {}).filter(p => p.soort === 'podium');

  /* Het beeld per podium: wat er nu speelt, wat erna komt, en hoeveel tijd er
     tussen zit. Meer niet -- de afwijkingen staan hieronder apart, want een
     cockpit die alles toont, toont niets. */
  function podiumBeeld(fid, eid, vraag) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const v = vraag || {};
    const dag = dagVind(e, v.dag);
    if (!dag) return { status: 404, error: 'Deze dag staat niet in de editie.' };
    const nu = offset(dag, String(v.tijd || ''));
    if (nu === null) return { status: 400, error: 'Dat moment valt buiten deze dag.' };

    const alle = Object.values(e.boekingen || {})
      .filter(b => b.dag === dag.id && b.stand !== 'afgezegd');

    const uit = podia(e).map(p => {
      const mijne = alle.filter(b => b.podium === p.id)
        .sort((a, b) => offset(dag, a.van) - offset(dag, b.van));
      const lopend = mijne.find(b => offset(dag, b.van) <= nu && nu < offset(dag, b.tot)) || null;
      const volgend = mijne.find(b => offset(dag, b.van) > nu) || null;
      const beeld = (b) => b ? { id: b.id, artiest: b.artiest, van: b.van, tot: b.tot,
        stand: b.stand, riderOpen: (b.rider || []).filter(r => !r.klaar).length,
        soundcheck: b.soundcheck || null } : null;
      return { podium: p.id, naam: p.naam, changeover: p.changeover || 0,
        nu: beeld(lopend), straks: beeld(volgend),
        /* De tijd tot de volgende set: dat is het getal waar een omBOUW op
           gepland wordt. Zonder volgende set is hij null en niet nul. */
        overTot: volgend ? offset(dag, volgend.van) - nu : null };
    });
    return { ok: true, dag: dag.id, podia: uit };
  }

  /* De afwijkingen, in de vorm die ./uitzondering.js verwacht. */
  function podiumSignalen(fid, eid, vraag) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const v = vraag || {};
    const dag = dagVind(e, v.dag);
    if (!dag) return { status: 404, error: 'Deze dag staat niet in de editie.' };
    const nu = offset(dag, String(v.tijd || ''));
    if (nu === null) return { ok: true, signalen: [] };
    const horizon = Math.max(5, Math.min(240, parseInt(v.vooruit, 10) || HORIZON));

    const uit = [];
    for (const b of Object.values(e.boekingen || {})) {
      if (b.dag !== dag.id || b.stand === 'afgezegd') continue;
      const podium = plekVind(e, b.podium);
      const start = offset(dag, b.van);
      if (start === null) continue;
      const over = start - nu;

      if (over >= 0 && over <= horizon) {
        if (b.stand === 'voornemen') {
          /* Een set die niemand bevestigd heeft, vlak voor hij opgaat: dat is
             een gat in het programma en geen administratie. */
          uit.push({ bron: 'podium', naam: b.artiest, ernst: 'kritiek', over,
            zin: (podium ? podium.naam + ': ' : '') + b.artiest + ' begint over ' + over
              + ' minuten en de boeking staat nog op voornemen.',
            herkomst: { boeking: b.id, podium: b.podium, stand: b.stand } });
        }
        const open = (b.rider || []).filter(r => !r.klaar).length;
        if (open) {
          uit.push({ bron: 'podium', naam: b.artiest, ernst: over <= 30 ? 'hoog' : 'aandacht', over,
            zin: (podium ? podium.naam + ': ' : '') + b.artiest + ' begint over ' + over
              + ' minuten met ' + open + ' open riderpunt' + (open === 1 ? '' : 'en') + '.',
            herkomst: { boeking: b.id, podium: b.podium, riderOpen: open } });
        }
      }

      if (b.soundcheck) {
        const sc = offset(dag, b.soundcheck);
        if (sc !== null && sc >= nu && sc - nu <= horizon) {
          uit.push({ bron: 'podium', naam: b.artiest, ernst: 'aandacht', over: sc - nu,
            zin: (podium ? podium.naam + ': ' : '') + 'soundcheck ' + b.artiest + ' over '
              + (sc - nu) + ' minuten.',
            herkomst: { boeking: b.id, podium: b.podium, soundcheck: b.soundcheck } });
        }
      }
    }
    return { ok: true, signalen: uit };
  }

  return { podiumBeeld, podiumSignalen };
};
