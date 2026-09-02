/* ============================================================================
   DE KETEN VAN EEN UITLEEN -- meegeven, terugnemen, herijken.

   Afgesplitst van ./uitleen.js toen die over de 10 KB-keuringsgrens ging, en
   langs een echte naad: daar staat de AANVRAAG en het besluit (papier), hier
   staat wat er met het apparaat zelf gebeurt (de fysieke keten). Dat tweede is
   het deel met de poorten.

   TWEE POORTEN, ALLEBEI FAIL-CLOSED, en allebei met de reden:
   een open storing en een verlopen ijking houden een apparaat binnen. En bij het
   meegeven wordt de ijkstand BEVROREN in de keten -- blijkt later dat een
   kalibratie ondeugde, dan is precies te zien welke uitleen eronder viel.

   Herijken na gebruik buiten het lab is geen formaliteit: het apparaat is
   vervoerd en door anderen bediend. De uitleen blijft daarom open tot dat is
   gebeurd; hij gaat niet vanzelf naar afgerond.
   ========================================================================== */
'use strict';

module.exports = (ctx, hulp) => {
  const { nu, schoon, audit, save, apparatuur } = ctx;
  const { vind, kalibratieStand } = apparatuur;
  const { vindU, stap, publiek } = hulp;

  /* ---------- meegeven en terugnemen: de keten ---------- */
  function meegeven(id, b, wie) {
    const u = vindU(id); if (!u) return { status: 404, error: 'Deze aanvraag bestaat niet.' };
    if (u.stand !== 'toegekend') return { status: 409, error: 'Dit apparaat gaat pas mee als de aanvraag is toegekend; hij staat op ' + u.stand + '.' };
    const a = vind(u.apparaatId); if (!a) return { status: 404, error: 'Dit apparaat staat niet meer in het register.' };
    /* DE TWEE POORTEN. Allebei fail-closed, en allebei met de reden. */
    if ((a.onderhoud || []).some(o => o.soort === 'storing' && o.open)) {
      return { status: 409, error: 'Dit apparaat heeft een openstaande storing. Een apparaat waarvan bekend is dat het iets mankeert, gaat niet de deur uit -- de metingen die ermee gedaan worden, zijn dan niets waard.' };
    }
    const k = kalibratieStand(a, nu().slice(0, 10));
    if (!k.nvt && !k.geldig) {
      return { status: 409, error: 'De ijking van dit apparaat is verlopen (' + (k.reden || 'geen geldige kalibratie') + '). Kalibreer het eerst; een verlopen ijking ziet er precies zo uit als een geldige.' };
    }
    const door = schoon((b || {}).door, 80);
    if (!door) return { status: 400, error: 'Wie geeft het mee? Zet uw naam erbij.' };
    u.stand = 'meegegeven';
    /* DE IJKSTAND VAN NU, BEVROREN. Blijkt later dat een kalibratie ondeugde, dan
       is precies te zien welke uitleen eronder viel -- en dat kan alleen als de
       stand van TOEN in de keten staat en niet achteraf wordt opgezocht. */
    u.meegegeven = { door, at: nu(), kalibratie: k };
    stap(u, 'meegegeven', door, k.nvt ? 'ijking niet van toepassing' : 'ijking geldig tot ' + k.tot);
    audit(u.labId, 'uitleen.mee', wie, u.apparaatId, u.organisatie);
    save();
    return { ok: true, uitleen: publiek(u) };
  }

  function terug(id, b, wie) {
    const u = vindU(id); if (!u) return { status: 404, error: 'Deze aanvraag bestaat niet.' };
    if (u.stand !== 'meegegeven') return { status: 409, error: 'Dit apparaat is niet uitgeleend; het staat op ' + u.stand + '.' };
    b = b || {};
    const door = schoon(b.door, 80);
    const staat = schoon(b.staat, 400);
    if (!door) return { status: 400, error: 'Wie neemt het aan? Zet uw naam erbij.' };
    if (staat.length < 5) return { status: 400, error: 'In welke staat kwam het terug? Schrijf het op, ook als er niets aan de hand is -- "in orde" is ook een waarneming.' };
    const a = vind(u.apparaatId);
    const k = a ? kalibratieStand(a, nu().slice(0, 10)) : { nvt: true };
    /* HERIJKEN NA GEBRUIK BUITEN HET LAB is geen formaliteit: het apparaat is
       vervoerd en door anderen bediend. Zolang dat niet is gebeurd, blijft de
       uitleen open -- hij gaat niet vanzelf naar afgerond. */
    u.stand = k.nvt ? 'afgerond' : 'terug';
    u.terug = { door, staat, at: nu(), herijkNodig: !k.nvt };
    stap(u, 'terug', door, staat.slice(0, 80));
    if (k.nvt) stap(u, 'afgerond', door, 'ijking niet van toepassing bij dit apparaat');
    audit(u.labId, 'uitleen.terug', wie, u.apparaatId, staat.slice(0, 60));
    save();
    return { ok: true, uitleen: publiek(u),
      let: k.nvt ? 'De uitleen is afgerond.'
        : 'Het apparaat is terug. De uitleen blijft open tot het opnieuw is gekalibreerd: het is vervoerd en door anderen bediend.' };
  }

  /* Na de herijking sluit de keten. De kalibratie zelf wordt gezet in
     ./apparatuur.js -- hier wordt alleen vastgelegd dat het is gebeurd. */
  function herijkt(id, b, wie) {
    const u = vindU(id); if (!u) return { status: 404, error: 'Deze aanvraag bestaat niet.' };
    if (u.stand !== 'terug') return { status: 409, error: 'Deze uitleen wacht niet op een herijking; hij staat op ' + u.stand + '.' };
    const a = vind(u.apparaatId);
    const k = a ? kalibratieStand(a, nu().slice(0, 10)) : { nvt: true };
    if (!k.nvt && !k.geldig) {
      return { status: 409, error: 'De ijking staat nog steeds op verlopen. Leg eerst de nieuwe kalibratie vast in het apparatuurregister.' };
    }
    u.stand = 'afgerond';
    stap(u, 'herijkt', schoon((b || {}).door, 80) || 'lab', k.nvt ? null : 'geldig tot ' + k.tot);
    audit(u.labId, 'uitleen.herijkt', wie, u.apparaatId, '');
    save();
    return { ok: true, uitleen: publiek(u) };
  }


  return { meegeven, terug, herijkt };
};
