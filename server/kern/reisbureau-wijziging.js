/* DE WIJZIGING OP EEN BEVESTIGDE REIS -- het lid vraagt, het kantoor beslist.

   Hoort bij ./reisbureau-nazorg.js en is daar afgesplitst op de 10 kB-grens.
   De naad is echt: dit is een GESPREK van twee kanten dat eindigt in dezelfde
   reis, terwijl afzeggen (daar) een EINDE is dat beide kanten alleen kunnen
   aankondigen. Wat ze delen komt hier binnen als bouwstenen -- de standcontrole
   `pak`, het spoor, de herberekening en het bericht aan het lid -- zodat er maar
   EEN plek blijft waar een reis van stand verandert.

   DE REGEL DIE DE VORM BEPAALT: een bevestiging is een toezegging aan een lid,
   dus het lid mag hem niet zelf omschrijven naar een andere datum. Het verzoek
   zet de reis op `wijziging-gevraagd` met de wens ERNAAST; pas een mens van het
   kantoor past hem toe of wijst hem af. Zie de kop van ./reisbureau-nazorg.js
   voor de rest van de redenering. */
'use strict';

module.exports = ({ pak, spoor, herbereken, meld, reisNaam, schoon, nu, save }) => {

  /* ---- 1. HET LID VRAAGT EEN WIJZIGING ---- */

  function vraagWijziging(key, ref, wens) {
    const g = pak(ref, ['bevestigd'], 'een wijziging vraagt u op een bevestigde reis.');
    if (g.error) return g;
    const a = g.aanvraag;
    if (a.customerKey !== key) return { status: 404, error: 'Reisaanvraag niet gevonden.' };

    const w = wens || {};
    const gevraagd = {};
    if (w.vertrek != null && String(w.vertrek).trim() !== '') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(w.vertrek)))
        return { status: 400, error: 'Een vertrekdatum ziet eruit als 2027-02-10.' };
      if (String(w.vertrek) !== a.vertrek) gevraagd.vertrek = String(w.vertrek);
    }
    if (w.personen != null && String(w.personen).trim() !== '') {
      const p = Math.round(Number(w.personen));
      if (!Number.isFinite(p) || p < 1 || p > 20)
        return { status: 400, error: 'Voor hoeveel personen? Eén tot twintig.' };
      if (p !== a.personen) gevraagd.personen = p;
    }
    const toelichting = schoon(w.toelichting, 300);
    /* NIETS GEVRAAGD IS GEEN VERZOEK. Zonder dit kwam er een lege wijziging op
       de balie te liggen waar een medewerker over moet beslissen, en dat is werk
       dat niemand vroeg. Een toelichting alleen mag wel: "kan het een kamer met
       uitzicht worden" is een echte vraag zonder een veld te veranderen. */
    if (!Object.keys(gevraagd).length && !toelichting)
      return { status: 400, error: 'Wat wilt u anders? Vul een datum, een aantal personen of een toelichting in.' };

    a.status = 'wijziging-gevraagd';
    a.wijziging = { gevraagd, toelichting: toelichting || null, at: nu(), stand: 'gevraagd' };
    spoor(a, 'wijziging gevraagd', 'lid', { gevraagd, toelichting: toelichting || null });
    save();
    return { ok: true, aanvraag: a };
  }

  /* ---- 2. HET KANTOOR BESLIST OVER DIE WIJZIGING ---- */

  function besluitWijziging(ref, besluit, door, bericht) {
    if (besluit !== 'toegepast' && besluit !== 'afgewezen')
      return { status: 400, error: 'Een wijziging wordt toegepast of afgewezen; een andere uitkomst kent het reisbureau niet.' };
    const wie = schoon(door, 60);
    if (!wie) return { status: 400, error: 'Een besluit zonder naam eronder is geen besluit.' };
    const tekst = schoon(bericht, 300);
    if (besluit === 'afgewezen' && !tekst)
      return { status: 400, error: 'Een wijziging afwijzen kan alleen met een reden voor het lid.' };

    const g = pak(ref, ['wijziging-gevraagd'], 'er ligt geen wijzigingsverzoek op de balie.');
    if (g.error) return g;
    const a = g.aanvraag;
    const gevraagd = (a.wijziging && a.wijziging.gevraagd) || {};

    if (besluit === 'toegepast') {
      /* WAT ER STOND BLIJFT STAAN. De oude waarden gaan mee in het spoor voordat
         ze worden overschreven: zonder dat is achteraf niet te zeggen wat er is
         veranderd, alleen dat er iets veranderde. */
      const was = { vertrek: a.vertrek, personen: a.personen };
      if (gevraagd.vertrek) a.vertrek = gevraagd.vertrek;
      if (gevraagd.personen) a.personen = gevraagd.personen;
      herbereken(a);
      spoor(a, 'wijziging toegepast', wie, { was, werd: { vertrek: a.vertrek, personen: a.personen }, bericht: tekst || null });
    } else {
      spoor(a, 'wijziging afgewezen', wie, { gevraagd, reden: tekst });
    }

    a.wijziging = { ...(a.wijziging || {}), stand: besluit, besluitAt: nu(), bericht: tekst || null };
    a.status = 'bevestigd';
    save();

    meld(a, besluit === 'toegepast'
      ? { title: 'Uw reis is aangepast', body: reisNaam(a) + ': ' + (tekst || 'de wijziging is doorgevoerd.') }
      : { title: 'Wijziging niet doorgevoerd', body: reisNaam(a) + ': ' + tekst });
    return { ok: true, aanvraag: a };
  }

  return { vraagWijziging, besluitWijziging };
};
