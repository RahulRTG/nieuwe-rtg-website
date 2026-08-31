/* ============================================================================
   HET OBSERVATORIUM -- één bord over alle labs heen, en het kan ZAKKEN.

   Met opzet het laatste stuk van de bouwvolgorde: een spectaculaire cockpit
   boven een lege grond vertelt niets waars. Nu die grond er ligt, mag het bord
   erop.

   DE REGEL DIE HET BORD BEPAALT, uit BESTUUR.md: *een cockpit die niet kan
   zakken, is een dashboard.* Elk sein hieronder heeft daarom drie standen --
   `in orde`, `niet vast te stellen`, `storing` -- en de derde is echt bereikbaar
   uit gewone gegevens. Een bord dat alleen maar groen kan zijn, is een sierstuk.

   VIER DINGEN DIE HIER NIET GEBEUREN.

   1. ER WORDT NIETS OPGESLAGEN. Elk sein wordt AFGELEID uit de bestaande
      dossiers, het grootboek en het fonds. Een observatorium met een eigen tabel
      is binnen een maand een tweede waarheid die niemand bijwerkt.

   2. ER WORDT NIETS BEOORDEELD DAT NIET GEMETEN IS. Geen "gezondheidsscore",
      geen samengesteld cijfer over een lab. Eén getal boven dertig eerlijke
      getallen verbergt welke ervan bewoog (BEWIJSMACHINE.md), en over onderzoek
      van mensen zou het bovendien een oordeel over hun werk zijn.

   3. GEEN DREMPELS DIE HIER ZIJN VERZONNEN. Een studie die "te lang stilstaat"
      vraagt een termijn, en die heeft niemand vastgesteld. Wat er wél staat,
      staat er omdat het lab het zelf opschreef: stilgelegd, een open klacht, een
      verlopen ijking, een gezakte conclusie.

   4. EN GEEN NAMEN. Een sein noemt een studie bij nummer en titel, nooit een
      deelnemer -- ook niet als alias. Wie op dit bord een mens kan aanwijzen,
      heeft een bord gebouwd waarop mensen worden bekeken.
   ========================================================================== */
'use strict';

/* De drie standen, van licht naar zwaar. De volgorde IS de rangorde: het bord
   neemt de zwaarste van zijn seinen over, en `niet vast te stellen` is bewust
   erger dan in orde -- een meter die niet meet, is geen groen licht. */
const STANDEN = ['in orde', 'niet vast te stellen', 'storing'];
const zwaarste = (a, b) => (STANDEN.indexOf(a) >= STANDEN.indexOf(b) ? a : b);

module.exports = (ctx) => {
  const { S, vindLab } = ctx;
  const nu = () => (ctx.nu ? ctx.nu() : new Date().toISOString());
  const labfonds = () => (typeof ctx.labfonds === 'function' ? ctx.labfonds() : ctx.labfonds);
  const kort = (s) => ({ id: s.id, nummer: s.nummer || null, titel: s.titel, lab: s.labId });

  /* Een sein: wat het is, hoe het ervoor staat, waaruit dat blijkt en wat er
     moet gebeuren. `graad` is de bewijsgraad van de bewering zelf -- geteld uit
     het dossier is `gemeten`, en wat niet te peilen viel is `onbekend`. */
  const sein = (code, naam, stand, o) => Object.assign({ code, naam, stand,
    graad: stand === 'niet vast te stellen' ? 'onbekend' : 'gemeten', op: nu() }, o || {});

  /* De zes seinen staan in ./observatoriumseinen.js; hieronder alleen hoe ze tot
     één bord komen. */
  const seinen6 = require('./observatoriumseinen')({ S, nu, labfonds, sein, kort });

  /* ---------- het bord ---------- */

  /* Eén bord over alle labs, of over één lab. De stand van het bord is de
     ZWAARSTE van zijn seinen -- niet een gemiddelde, want een gemiddelde maakt
     van één stilgelegd onderzoek tussen twintig gezonde een lichte verkleuring. */
  function bord(labId) {
    const labs = labId ? [vindLab(labId)].filter(Boolean) : (S().labs || []);
    if (labId && !labs.length) return { status: 404, error: 'Dit lab bestaat niet.' };
    const ids = labs.map(l => l.id);
    const studies = (S().studies || []).filter(s => ids.includes(s.labId));

    const seinen = [
      seinen6.stilgelegd(studies),
      seinen6.klachten(studies),
      seinen6.ijking(labs, ctx.apparatuur && ctx.apparatuur.kalibratieStand),
      seinen6.wachtend(studies, ctx.cyclus && ctx.cyclus.watNu),
      seinen6.gezakt(studies),
      seinen6.geld(studies, ctx.ledger && ctx.ledger.studieLedger)
    ];
    return { ok: true, op: nu(),
      labs: labs.map(l => ({ id: l.id, naam: l.naam, stad: l.stad })),
      onderzoeken: { totaal: studies.length, lopend: studies.filter(s => !s.besluit).length },
      stand: seinen.reduce((a, s) => zwaarste(a, s.stand), 'in orde'),
      seinen,
      /* Wat dit bord NIET zegt, staat erbij. Zonder deze regel wordt een groen
         bord gelezen als "het onderzoek deugt", en dat is een heel andere
         bewering dan "er staat niets open". */
      zegtNiet: [
        'Dit bord toont wat er OPEN staat, niet of het onderzoek goed is. Die vraag beantwoordt de bewijsmotor, per conclusie.',
        'Er staat geen oordeel over mensen op: geen ranglijst van labs, geen score per onderzoeker.',
        'Wat hier niet gemeten kon worden, staat als "niet vast te stellen" en niet als nul.'
      ] };
  }

  return { bord, STANDEN, zwaarste };
};
