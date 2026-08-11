/* RTG Werk OS (deellaag): de gezondheid van een organisatie, en de dagbriefing.

   "Gezondheid 92%. Waarom geen 100? Drie SLA's rood, projecten achter,
   governance uitstekend." Dat is begrijpelijker dan twintig KPI's -- en het is
   ook de makkelijkste plek in dit hele huis om een getal te verzinnen dat als
   feit gaat rondlopen. Vier regels houden hem eerlijk:

   1. HIJ MEET NIETS ZELF. Elk signaal leest het directiebeeld (bedrijf/beeld.js)
      dat er al was. Een gezondheidscijfer met een eigen meting zegt op een dag
      iets anders dan het scherm waar het over gaat, en dan gelooft niemand meer
      welk van de twee klopt -- exact de reden die kern/command/alarm.js opgeeft
      om ook niets zelf te meten.
   2. ELK SIGNAAL WEEGT EVEN ZWAAR, en dat staat erbij. Gewichten zijn een
      mening, en een mening die als getal is vermomd, is niet meer te bespreken.
      Wie een signaal belangrijker vindt, voert dat gesprek -- niet de code.
   3. WAT NIET GEMETEN KAN WORDEN, TELT NIET ALS GEZOND. Een werkruimte zonder
      contracten heeft geen groen contractsignaal maar GEEN contractsignaal, en
      de noemer wordt kleiner. Anders scoort een lege organisatie 100%: het
      cijfer zou het hoogst zijn op de dag dat er nog niets is.
   4. HET CIJFER KOMT NOOIT ALLEEN. Wat eraf gaat, staat er met naam, met het
      gemeten getal en met waar je het repareert.

   TWEE SIGNALEN ZIJN ER BIJ HET SCHRIJVEN UITGEGOOID, en dat hoort hier te
   staan omdat het dezelfde fout is die LAT-regel 9 over toetsen maakt. "Aantal
   teruggedraaide productiereleases" telt de HISTORIE: eenmaal rood, nooit meer
   groen -- een signaal dat niet meer kan herstellen, meet geen gezondheid maar
   een litteken. En "opzegdag voorbij" bestond niet als meting in het
   directiebeeld; hij zou dus altijd op nul staan, en een signaal dat nooit kan
   uitslaan koopt vertrouwen dat er niet is.

   EN DE DAGBRIEFING IS HETZELFDE, IN ZINNEN. "Goedemorgen. Vandaag adviseer ik:
   een contract, twee projecten, een storing. De rest loopt." Die zinnen worden
   NIET door een taalmodel bedacht: ze komen uit dezelfde signalen, met dezelfde
   getallen. Een briefing die iets anders zegt dan het bord waar hij op leunt,
   is precies wat een directie leert om hem niet te lezen. */
'use strict';

/* De signalen. `blok` zegt welk deel van het directiebeeld hij leest -- staat
   dat blok bij `nietGemeten`, dan is dit signaal NIET MEETBAAR en telt hij in
   geen enkele noemer mee. `rood` krijgt het blok en geeft het gemeten getal
   terug: nul of niets betekent groen, alles daarboven is de omvang. */
const SIGNALEN = [
  { id: 'taken over de deadline', blok: 'projecten', rood: (b) => b.teLaat,
    waar: 'projecten', doe: 'verzet de datum of de taak, maar laat hem niet staan' },
  { id: 'open storingen', blok: 'service', rood: (b) => b.storingenOpen,
    waar: 'servicedesk', doe: 'een storing zonder eigenaar wordt vanzelf een dag ouder' },
  { id: 'feature flags over hun opruimdatum', blok: 'bouw', rood: (b) => b.vlaggenOverDatum,
    waar: 'bouw', doe: 'ruim hem op of verzet de datum met een reden' },
  { id: 'contracten die op goedkeuring wachten', blok: 'recht', rood: (b) => b.wachtOpGoedkeuring,
    waar: 'contracten', doe: 'de goedkeuring staat bij /api/bedrijf/keur' },
  { id: 'contracten zonder einddatum', blok: 'recht', rood: (b) => b.zonderEinddatum,
    waar: 'contracten', doe: 'een contract dat nooit eindigt, kent ook geen laatste opzegdag' },
  { id: 'besluiten met een verstreken evaluatiedatum zonder uitkomst', blok: 'governance',
    rood: (b) => b.evaluatiedatumVoorbijZonderUitkomst,
    waar: 'besluiten', doe: 'schrijf op wat het terugkijken opleverde; een datum zonder uitkomst is een agendapunt' },
  { id: 'onversleutelde apparaten', blok: 'it', rood: (b) => b.onversleuteld,
    waar: 'IT', doe: 'dat is geen fout van het systeem maar een feit dat iemand moet oplossen' },
  { id: 'licenties met meer gebruikers dan plekken', blok: 'it', rood: (b) => b.licentieOverschrijding,
    waar: 'IT', doe: 'koop bij of neem in; dit is de post die stil doorloopt' }
];

module.exports = (sctx) => {
  const { app, werkPoort } = sctx;

  function meet(w) {
    const b = sctx.bedrijfsbeeld(w);
    const gemist = new Set((b.nietGemeten || []).map(n => n.blok));
    const rijen = SIGNALEN.map(s => {
      if (gemist.has(s.blok) || !b[s.blok]) {
        return { id: s.id, blok: s.blok, stand: 'niet gemeten',
          reden: (b.nietGemeten || []).find(n => n.blok === s.blok) ? (b.nietGemeten.find(n => n.blok === s.blok).reden) : 'geen gegevens in dit blok' };
      }
      const n = Number(s.rood(b[s.blok]) || 0);
      return { id: s.id, blok: s.blok, stand: n > 0 ? 'rood' : 'groen', aantal: n,
        waar: s.waar, doe: s.doe };
    });
    const meetbaar = rijen.filter(r => r.stand !== 'niet gemeten');
    const groen = meetbaar.filter(r => r.stand === 'groen');
    return {
      cijfer: meetbaar.length ? Math.round(groen.length / meetbaar.length * 100) : null,
      gemeten: { van: SIGNALEN.length, meetbaar: meetbaar.length, groen: groen.length },
      signalen: rijen,
      rood: rijen.filter(r => r.stand === 'rood').sort((a, b2) => b2.aantal - a.aantal),
      nietGemeten: rijen.filter(r => r.stand === 'niet gemeten'),
      gemetenOp: b.gemetenOp
    };
  }

  app.post('/api/bedrijf/gezondheid', (req, res) => {
    const g = werkPoort(req, res, 'cijfer'); if (!g) return;
    const m = meet(g.w);
    res.json(Object.assign({ ok: true }, m, {
      let: m.cijfer == null
        ? 'Er is nog geen enkel signaal meetbaar in deze werkruimte. Dat is geen 100% en ook geen 0%: er staat geen cijfer, en dat is het eerlijke antwoord.'
        : 'Het cijfer is het aandeel groene signalen van de MEETBARE signalen (' + m.gemeten.groen + ' van ' + m.gemeten.meetbaar + '); ' +
          (SIGNALEN.length - m.gemeten.meetbaar) + ' van de ' + SIGNALEN.length + ' konden niet worden gemeten en tellen in geen enkele noemer mee. Elk signaal weegt even zwaar -- gewichten zijn een mening, en een mening die als getal is vermomd valt niet meer te bespreken.' }));
  });

  /* De dagbriefing: hetzelfde, in zinnen, en niets erbij verzonnen. */
  app.post('/api/bedrijf/dagbeeld', (req, res) => {
    const g = werkPoort(req, res, 'cijfer'); if (!g) return;
    const m = meet(g.w);
    const advies = m.rood.map(r => ({
      wat: r.aantal + ' ' + r.id, waar: r.waar, doe: r.doe, aantal: r.aantal }));
    res.json({ ok: true, cijfer: m.cijfer, gemeten: m.gemeten,
      advies,
      rest: advies.length
        ? 'De overige ' + m.gemeten.groen + ' gemeten signalen staan op groen.'
        : 'Alle ' + m.gemeten.groen + ' gemeten signalen staan op groen.',
      nietGemeten: m.nietGemeten.map(r => ({ wat: r.id, reden: r.reden })),
      let: 'Deze regels komen uit dezelfde signalen als /gezondheid, met dezelfde getallen -- er wordt hier niets bijgeschreven en niets samengevat door een taalmodel. Wat niet gemeten kon worden staat eronder en niet tussen het advies, want "geen signaal" is geen goed nieuws.' });
  });

  return { GEZONDHEIDSSIGNALEN: SIGNALEN, gezondheidVan: meet };
};
