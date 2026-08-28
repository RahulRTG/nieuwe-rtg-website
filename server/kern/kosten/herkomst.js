/* WAAROM BETAAL IK DIT? -- de keten van een bedrag terug naar zijn oorsprong.

   Een kostenregel toont een bedrag, een aantal en een bron. Deze module zet die
   drie in de volgorde waarin je ze naleest, met per schakel wat die schakel WEL
   en NIET zegt:

     bedrag
       -> aantal x tarief   (of: aandeel in een verdeelde nota)
         -> de bron van dat tarief
           -> de leveranciersfactuur, met nummer en bedrag
             -> ingevoerd door een mens, op een dag

   DE KETEN EINDIGT BIJ EEN MENS EN NIET BIJ EEN PROVIDER, en dat staat er ook.
   Er wordt geen PDF ingelezen en niets bij de leverancier geverifieerd; wat er
   in het register staat is wat iemand heeft overgenomen. Een keten die zich
   voordoet als bewijs tot aan de bron, is erger dan een keten die zegt waar hij
   ophoudt -- want dan stopt niemand met zoeken op de juiste plek.

   WAT ER NIET IN ZIT, en dat is een besluit en geen omissie: doorklikken van
   een euro naar de 812 losse AI-taken eronder. Daarvoor zou de meter een
   journaal per gebruiker moeten bijhouden in plaats van tellers, en dat is
   precies wat hij met opzet niet doet -- een gedragslogboek per lid is voor een
   factuur niet nodig en kan wel uitlekken (KOSTEN.md par. 6). */
'use strict';

const { soort } = require('./soorten');

module.exports = (ctx) => {
  const { overzicht, tarieven, huisrekening, providerfactuur, meter } = ctx;

  const factuurSchakel = (fid) => {
    const f = fid && providerfactuur.factuurVan(fid);
    if (!f) {
      return { stap: 'leveranciersfactuur', gevonden: false,
        waarom: 'Aan deze bron hangt geen leveranciersfactuur. De herkomst eindigt bij de tekst die een mens heeft ingevoerd.' };
    }
    return { stap: 'leveranciersfactuur', gevonden: true,
      leverancier: f.leverancier, nummer: f.nummer, periode: f.periode, centen: f.centen,
      ingevoerdOp: f.ingevoerdOp, door: f.door, zegtNiet: f.zegtNiet };
  };

  /* De keten voor EEN soort bij EEN gebruiker. Geeft ook een keten terug als er
     niets te melden valt: dan staat er WAAROM er niets is, en niet een lege
     lijst die als "geen kosten" leest. */
  function herkomst(periode, drager, soortId) {
    const p = meter.periodeVan(periode);
    const s = soort(soortId);
    if (!s) return { status: 400, error: 'Onbekende kostensoort.' };
    const beeld = overzicht.voorDrager(p, drager);

    if (s.meetweg === 'toegerekend') {
      const regel = (beeld.toegerekend || []).find(r => r.soort === s.id);
      if (!regel) {
        return { status: 200, ok: true, periode: p, drager, soort: s.id, keten: [],
          waarom: 'Er is voor deze maand geen verdeelde ' + s.naam.toLowerCase() + ' bij deze gebruiker.' };
      }
      const post = huisrekening.postVan(p, s.id);
      return { status: 200, ok: true, periode: p, drager, soort: s.id, centen: regel.centen, graad: regel.graad,
        keten: [
          { stap: 'bedrag', centen: regel.centen, graad: regel.graad,
            zegtNiet: 'Dit is een VERDELING en geen meting. Zie de sleutel hieronder.' },
          { stap: 'verdeelsleutel', wereld: regel.wereld, sleutel: regel.sleutel, betaaldDoor: regel.betaaldDoor },
          { stap: 'nota', centen: post ? post.centen : null, bron: post ? post.bron : null,
            gezetOp: post ? post.gezetOp : null, gezetDoor: post ? post.gezetDoor : null },
          factuurSchakel(post && post.factuurId)
        ] };
    }

    const regel = (beeld.regels || []).find(r => r.soort === s.id);
    if (!regel) {
      return { status: 200, ok: true, periode: p, drager, soort: s.id, keten: [],
        waarom: 'Er is voor deze maand geen ' + s.naam.toLowerCase() + ' gemeten bij deze gebruiker.' };
    }
    const t = tarieven.tariefOp(s.id, p + '-31T23:59:59.999Z');
    return { status: 200, ok: true, periode: p, drager, soort: s.id,
      centen: regel.millicenten == null ? null : Math.round(regel.millicenten / 1000), graad: regel.graad,
      keten: [
        { stap: 'bedrag', millicenten: regel.millicenten, graad: regel.graad,
          zegtNiet: regel.millicenten == null ? regel.waarom : null },
        { stap: 'verbruik', aantal: regel.aantal, ruw: regel.ruw, eenheid: regel.eenheid, aard: regel.aard,
          zegtNiet: regel.aard === 'stand'
            ? 'Dit is een gemiddelde over de peilingen van deze maand, geen momentopname.'
            : 'Dit is een teller: hoeveel er is langsgekomen, niet wanneer.' },
        { stap: 'tarief', perEenheid: t ? t.perEenheid : null, bron: t ? t.bron : null, gezetOp: t ? t.gezetOp : null,
          zegtNiet: t ? null : 'Er is geen tarief; daarom staat er geen bedrag.' },
        factuurSchakel(t && t.factuurId)
      ] };
  }

  return { herkomst };
};
