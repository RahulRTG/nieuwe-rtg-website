/* Magnaat Economische Motor -- wat een actor kan besluiten of verrichten.

   Drie ingangen, en de motor weet bij geen van drie wie de consument is:
     beslis     een bedrijfsbesluit over EEN bedrijf; welk bedrijf, zegt de
                aanroeper
     transactie een wijziging op een kopie die pas bij succes de wereld wordt;
                een consument die iets naast de economie bijhoudt (zoals het
                Oefenkantoor zijn analyses) gebruikt deze en geen eigen kopie
     verricht   de economische grens voor werk: actor X verricht activiteit Y,
                met kwaliteit Q, voor zoveel eenheden, in context C. Welke missie,
                opdracht of spelhandeling daarachter zat, vertaalt de consument;
                de motor bepaalt welke economische gevolgen dat heeft. */
'use strict';
const { SCHOKKEN, WERKACTIVITEITEN, rond, geld } = require('./constanten');

module.exports = (m) => {
  function getal(v, veld) {
    const n = Number(v);
    if (!Number.isFinite(n)) return { error: veld + ' moet een getal zijn.' };
    return { waarde: n };
  }

  /* Werk op een kopie; alleen een geslaagde uitkomst wordt de wereld, en pas dan
     gaan de boekingen het journaal in. Een weigering laat NIETS achter -- ook
     geen gebeurtenis in het bewijs. */
  function transactie(actor, werk) {
    const e = structuredClone(m.state());
    const hulp = { audit: (actie, detail) => m.audit(e, actor, actie, detail) };
    const uitkomst = m.metOorzaak('besluit:' + String(actor || 'systeem').slice(0, 100), () => werk(e, hulp));
    if (uitkomst && (uitkomst.status || uitkomst.error)) return uitkomst;
    m.markeerMutatie(e);
    m.wereldState().economie = e;
    m.bevestig(e);
    m.save();
    return uitkomst;
  }

  function beslis(actor, bedrijfId, invoer) {
    if (!m.profiel.bedrijven[bedrijfId]) return { status: 400, error: 'Dat bedrijf bestaat in deze wereld niet.' };
    const uitkomst = transactie(actor, (e) => {
      const b = e.bedrijven[bedrijfId];
      invoer = invoer && typeof invoer === 'object' ? invoer : {};
      const velden = [
        ['prijs', 50, 350, n => b.prijs = geld(n * 100)],
        ['personeelDoel', 3, 100, n => b.personeelDoel = rond(n)],
        ['loonMaand', 1800, 12000, n => b.loonMaand = geld(n * 100)],
        ['trainingDag', 0, 50000, n => b.trainingDag = geld(n * 100)],
        ['bestelling', 0, 2000, n => b.bestelling = rond(n)],
        ['impactPct', 0, 20, n => b.impactBp = rond(n * 100)]
      ];
      let gewijzigd = 0;
      for (const [veld, min, max, toepassen] of velden) {
        if (invoer[veld] === undefined) continue;
        const n = getal(invoer[veld], veld);
        if (n.error) return { status: 400, error: n.error };
        if (n.waarde < min || n.waarde > max) return { status: 400, error: veld + ' moet tussen ' + min + ' en ' + max + ' liggen.' };
        toepassen(n.waarde);
        gewijzigd += 1;
      }
      if (invoer.lening !== undefined && Number(invoer.lening) > 0) {
        const n = getal(invoer.lening, 'lening');
        if (n.error || n.waarde > 1000000) return { status: 400, error: 'Lening moet tussen 0 en 1.000.000 euro liggen.' };
        const lening = m.leen(e, bedrijfId, geld(n.waarde * 100), 'besluit:' + e.dag + ':lening:' + e.boekVolgorde, actor);
        if (lening && lening.status) return lening;
        gewijzigd += 1;
      }
      if (!gewijzigd) return { status: 400, error: 'Geef ten minste één bedrijfsbesluit door.' };
      m.audit(e, actor, 'strategie', b.naam + ': ' + gewijzigd + ' instelling(en) gewijzigd');
      m.legUit(e, 'besluit', 'Nieuwe bedrijfsstrategie vastgelegd', 'De keuze verandert niet direct de score. De volgende dagcyclus rekent eerst alle markt-, arbeids- en kasgevolgen door.', gewijzigd + ' instelling(en)', 'spelersbesluit');
      return { ok: true };
    });
    return uitkomst.status ? uitkomst : Object.assign({ ok: true }, m.overzicht(actor));
  }

  function kiesSchok(actor, schokId) {
    const e = m.state();
    const schok = SCHOKKEN.find(s => s.id === String(schokId || ''));
    if (!schok || schok.id === 'geen') return { status: 400, error: 'Kies een bestaand economisch scenario.' };
    e.geforceerdeSchok = schok.id;
    m.audit(e, actor, 'scenario', schok.naam + ' staat klaar voor de volgende dag');
    m.markeerMutatie(e);
    m.save();
    return Object.assign({ ok: true, gepland: schok }, m.overzicht(actor));
  }

  /* De gevolgen staan hier en nergens anders: innovatie telt ook als
     productiviteit, impactwerk ook als service. Het effect komt pas bij de
     volgende economische dag in de markt (./markt.js, `werkBonus`). */
  function verricht(actor, opdracht) {
    const o = opdracht && typeof opdracht === 'object' ? opdracht : {};
    if (!WERKACTIVITEITEN.includes(o.activiteit)) {
      return { status: 400, error: 'Onbekende economische activiteit; de motor kent ' + WERKACTIVITEITEN.join(', ') + '.' };
    }
    const kwaliteit = Number(o.kwaliteit), eenheden = o.eenheden === undefined ? 1 : Number(o.eenheden);
    if (!Number.isInteger(kwaliteit) || kwaliteit < 0 || kwaliteit > 100) return { status: 400, error: 'Kwaliteit is een geheel getal van 0 tot 100.' };
    if (!Number.isInteger(eenheden) || eenheden < 1 || eenheden > 100) return { status: 400, error: 'Eenheden is een geheel getal van 1 tot 100.' };
    const e = m.state();
    e.werk.aantal += eenheden;
    e.werk[o.activiteit] += kwaliteit * eenheden;
    if (o.activiteit === 'innovatie') e.werk.productiviteit += rond(kwaliteit * .6) * eenheden;
    if (o.activiteit === 'impact') e.werk.service += rond(kwaliteit * .25) * eenheden;
    const context = o.context && typeof o.context === 'object' ? o.context : {};
    e.werk.bronnen.unshift(Object.assign({}, context, { kwaliteit }));
    if (e.werk.bronnen.length > 30) e.werk.bronnen.length = 30;
    m.audit(e, actor, 'werkresultaat', String(o.omschrijving || o.activiteit) + ' · ' + kwaliteit + '% proceskwaliteit');
    m.markeerMutatie(e);
    return { ok: true, activiteit: o.activiteit, kwaliteit, eenheden };
  }

  return { beslis, kiesSchok, transactie, verricht };
};
