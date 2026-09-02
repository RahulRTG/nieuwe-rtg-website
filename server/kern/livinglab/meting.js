/* ============================================================================
   DE DEELNEMERSKANT VAN HET METEN -- het venster, en de meting die erin gaat.

   Afgesplitst van ./instrument.js toen die over de 10 KB-keuringsgrens ging, en
   langs de naad die er inhoudelijk al lag: daar staat wat de ONDERZOEKSLEIDER
   samenstelt en terugleest, hier staat wat de DEELNEMER ziet en instuurt. Twee
   lezers, twee deuren (kantoorinlog tegenover labpas), twee bestanden.

   De drie grenzen die hier worden afgedwongen staan voluit in de kop van
   ./instrument.js: geen toestemmingsgrond geen meting, een waarde buiten bereik
   wordt geweigerd en niet bijgesteld, en de deelnemer is een alias.
   ========================================================================== */
'use strict';

const { lees } = require('./instrumentsoorten');

const MAX_METINGEN = 200000;      // per studie

module.exports = (ctx, potje) => {
  const { nu, rid, schoon, getal, vindStudie, save } = ctx;

  /* Wat de DEELNEMER ziet: zijn meetvenster. Alleen de vragen -- geen antwoorden
     van anderen, geen aantallen, geen voortgang van de studie. */
  function venster(studieId, alias) {
    const s = vindStudie(studieId); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    const d = potje(s);
    if (!d.protocol.versie) return { status: 404, error: 'Voor dit onderzoek staat nog geen meetvenster klaar.' };
    if (d.ethiek.stilgelegd) return { status: 409, error: 'Dit onderzoek is stilgelegd; er wordt nu niets gemeten.' };
    const mijn = d.metingen.filter(m => m.alias === alias);
    return { ok: true, nummer: s.nummer || null, titel: s.titel,
      protocol: { versie: d.protocol.versie, instrumenten: d.protocol.instrumenten },
      toestemming: { regime: d.ethiek.toestemming.regime, tekst: d.ethiek.toestemming.tekst || null },
      /* Alleen zijn EIGEN aantal, en het laatste moment. Een deelnemer die ziet
         hoeveel anderen al hebben ingevuld, wordt daarmee gestuurd. */
      ik: { ingestuurd: mijn.length, laatste: mijn.length ? mijn[0].at : null },
      let: 'Wat u invult, gaat naar dit onderzoek onder uw alias. Uw naam staat er niet bij.' };
  }

  /* ---------- de meting insturen (de deelnemer, met zijn labpas) ---------- */
  function metingBij(studieId, alias, b) {
    const s = vindStudie(studieId); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    const d = potje(s);
    if (!d.protocol.versie) return { status: 409, error: 'Voor dit onderzoek staat nog geen meetvenster klaar.' };
    if (d.ethiek.stilgelegd) return { status: 409, error: 'Dit onderzoek is stilgelegd; er wordt nu niets verzameld.' };
    /* GRENS 1: geen toestemmingsgrond, geen meting. */
    const regime = String((d.ethiek.toestemming || {}).regime || 'geen');
    if (regime === 'geen') {
      return { status: 409, error: 'Voor dit onderzoek is nog geen toestemmingsregime vastgesteld. Zolang dat er niet is, wordt er niets van deelnemers verzameld.' };
    }
    if (d.metingen.length >= MAX_METINGEN) return { status: 400, error: 'Dit onderzoek heeft genoeg metingen; verwerk ze eerst tot een dataset.' };

    b = b || {};
    const gegeven = b.antwoorden && typeof b.antwoorden === 'object' ? b.antwoorden : {};
    const antwoorden = [];
    for (const inst of d.protocol.instrumenten) {
      const heeft = Object.prototype.hasOwnProperty.call(gegeven, inst.sleutel);
      if (!heeft) {
        if (inst.verplicht) return { status: 400, error: 'De vraag "' + inst.vraag + '" is nog niet beantwoord.' };
        continue;
      }
      const w = lees(inst, gegeven[inst.sleutel], schoon);
      if (w.fout) return { status: 400, error: w.fout };
      antwoorden.push({ sleutel: inst.sleutel, soort: inst.soort, waarde: w.waarde,
        eenheid: inst.eenheid || null });
    }
    if (!antwoorden.length) return { status: 400, error: 'Er is niets ingevuld.' };

    /* HET APPARAAT EN ZIJN IJKSTAND, bevroren op dit moment. Blijkt een apparaat
       later ontregeld, dan is hiermee precies te zien welke metingen eronder
       vallen -- en dat is iets anders dan achteraf de kalibratiestand opzoeken,
       want die is dan al veranderd. */
    let apparaat = null;
    if (b.apparaatId) {
      const a = ctx.apparatuur && ctx.apparatuur.vind ? ctx.apparatuur.vind(String(b.apparaatId)) : null;
      if (!a) return { status: 404, error: 'Dit apparaat staat niet in het register van dit lab.' };
      /* De GEREKENDE stand en niet de ruwe velden: "geldig tot 12 februari" is
         wat een onderzoeker later nodig heeft, en die rekensom staat al in
         ./apparatuur.js. Hem hier overdoen zou betekenen dat twee plekken op een
         dag iets anders zeggen over hetzelfde apparaat. */
      const stand = ctx.apparatuur.kalibratieStand ? ctx.apparatuur.kalibratieStand(a, nu().slice(0, 10)) : null;
      apparaat = { id: a.id, naam: a.naam || null, kalibratie: stand };
    }

    const m = { id: rid(), alias: String(alias || '').slice(0, 40) || 'onbekend',
      protocolversie: d.protocol.versie,
      meetmoment: getal(b.meetmoment, 0, 500) || null,
      toestemmingsgrond: regime,
      apparaat, antwoorden, at: nu() };
    d.metingen.unshift(m);
    save();
    return { ok: true, meting: { id: m.id, protocolversie: m.protocolversie, at: m.at },
      let: 'Uw meting is bewaard bij versie ' + m.protocolversie + ' van het meetvenster.' };
  }


  return { venster, metingBij, MAX_METINGEN };
};
