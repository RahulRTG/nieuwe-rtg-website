/* RTF Living Lab, deel "plan": de hypothese en het onderzoeksplan.

   Dit is waar het systeem daadwerkelijk HELPT in plaats van een formulier te
   zijn. Zodra een team methoden kiest, rekent `advies()` uit wat die keuze
   betekent voor de steekproef, het aantal meetmomenten en de rapportage -- uit
   de tabel in ./kader.js, niet uit een tekst die iemand ooit typte.

   TWEE DINGEN DIE HIER GEWEIGERD WORDEN, en waarom:

   1. Een hypothese zonder tegendeel. "Een buurttuin vermindert eenzaamheid" is
      geen hypothese maar een wens, zolang er niet bij staat wat het tegendeel
      zou aantonen. Dat veld is verplicht en het is het scherpste veld van het
      hele systeem: wie het invult, kan zijn eigen onderzoek nog verliezen.
   2. Een plan met een steekproef onder de ondergrens van de gekozen methoden.
      Acht mensen enquêteren mag, maar dan heet het geen enquête -- dan zijn het
      acht gesprekken, en die dragen een lagere bewijsgraad (./bewijs.js). De
      poort weigert dus niet het ONDERZOEK maar de verkeerde naam eroverheen. */
'use strict';

const kader = require('./kader');

module.exports = (ctx) => {
  const { nu, rid, schoon, getal, lijst, audit, vindStudie, save } = ctx;

  function hypotheseZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const tekst = schoon(b.tekst, 500), tegendeel = schoon(b.tegendeel, 500);
    if (tekst.length < 10) return { status: 400, error: 'Wat verwacht u? Formuleer het zo dat u het fout kunt hebben.' };
    if (tegendeel.length < 10)
      return { status: 400, error: 'Wat zou het tegendeel bewijzen? Zonder dat antwoord is dit een wens en geen hypothese.' };
    const eerste = !s.dossier.hypothese.at;
    s.dossier.hypothese = { tekst, tegendeel, at: nu() };
    s.dossier.logboek.unshift({ id: rid(), tekst: 'Hypothese vastgelegd, met het tegendeel erbij.', wie: schoon(wie, 80) || 'lab', at: nu() });
    // eenmalig belonen: wie zijn hypothese herschrijft, verdient er niet nog eens punten mee
    if (eerste) ctx.spel.beloon(s, 'hypothese', wie);
    audit(s.labId, 'plan.hypothese', wie, s.id, '');
    save();
    return { ok: true, hypothese: s.dossier.hypothese };
  }

  /* Wat de gekozen methoden eisen. Puur rekenwerk op de tabel: de zwaarste eis
     wint, want een plan met een enquête EN interviews moet aan allebei voldoen.
     Deze functie is ook wat het scherm toont terwijl je vinkjes zet, zodat het
     advies er staat vóór het plan, en niet als afkeuring erna. */
  function advies(methoden) {
    const gekozen = (Array.isArray(methoden) ? methoden : []).map(kader.methode).filter(Boolean);
    if (!gekozen.length) return { ok: false, error: 'Kies minstens één methode.' };
    const minN = Math.max(...gekozen.map(m => m.minN));
    const meetmomenten = Math.max(...gekozen.map(m => m.meetmomenten));
    const maxBewijs = gekozen.reduce((hoog, m) => {
      const g = kader.graad(m.maxBewijs);
      return !hoog || g.rang > hoog.rang ? g : hoog;
    }, null);
    const aarden = [...new Set(gekozen.map(m => m.aard))];
    const mensen = gekozen.some(m => m.mensen);
    return { ok: true, methoden: gekozen.map(m => ({ methode: m.methode, naam: m.naam, aard: m.aard, minN: m.minN,
        meetmomenten: m.meetmomenten, maxBewijs: m.maxBewijs })),
      minSteekproef: minN, minMeetmomenten: meetmomenten, aard: aarden.length > 1 ? 'gemengd' : aarden[0],
      raaktMensen: mensen, hoogstBewijs: maxBewijs.graad, hoogstBewijsNaam: maxBewijs.naam,
      rapportage: rapportAdvies(gekozen, aarden) };
  }

  function rapportAdvies(gekozen, aarden) {
    const uit = ['Wat de vraag was en wat het tegendeel zou zijn geweest.'];
    if (aarden.includes('kwantitatief')) uit.push('De ruwe aantallen per meetmoment, niet alleen het gemiddelde.');
    if (aarden.includes('kwalitatief')) uit.push('Citaten met de rol van de spreker erbij, nooit met de naam.');
    if (gekozen.some(m => m.methode === 'abtest' || m.methode === 'veldexperiment'))
      uit.push('De vergelijkingsgroep: wie zat erin en wat kreeg die wél.');
    uit.push('Wat er misging, wat uitviel en wie er halverwege stopte.');
    uit.push('De bewijsgraad per conclusie, met de bron eronder.');
    return uit;
  }

  function planZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    if (!s.dossier.hypothese.at)
      return { status: 409, error: 'Eerst de hypothese: een plan zonder verwachting kan niets weerleggen.' };
    b = b || {};
    const methoden = lijst(b.methoden, 30, 8).filter(m => kader.methode(m));
    const a = advies(methoden);
    if (!a.ok) return { status: 400, error: a.error };
    const steekproef = getal(b.steekproef, 0, 1000000);
    const meetmomenten = getal(b.meetmomenten, 0, 500);
    if (steekproef < a.minSteekproef)
      return { status: 400, error: 'Met deze methoden is ' + a.minSteekproef + ' de kleinste steekproef die iets zegt; er staat ' + steekproef + '. Kies een lichtere methode of werf meer deelnemers.' };
    if (meetmomenten < a.minMeetmomenten)
      return { status: 400, error: 'Deze methoden vragen minstens ' + a.minMeetmomenten + ' meetmomenten; er staat ' + meetmomenten + '.' };
    const doel = schoon(b.doel, 500);
    if (doel.length < 10) return { status: 400, error: 'Wat is het onderzoeksdoel? Waaraan ziet u straks dat u het weet?' };
    s.dossier.plan = { methoden, steekproef, meetmomenten, doel,
      rapportage: schoon(b.rapportage, 1000) || a.rapportage.join(' '),
      hoogstBewijs: a.hoogstBewijs, raaktMensen: a.raaktMensen, at: nu() };
    s.dossier.logboek.unshift({ id: rid(), tekst: 'Onderzoeksplan vastgelegd: ' + methoden.length + ' methoden, steekproef ' + steekproef + ', ' + meetmomenten + ' meetmomenten.', wie: schoon(wie, 80) || 'lab', at: nu() });
    audit(s.labId, 'plan.zet', wie, s.id, methoden.join(','));
    save();
    return { ok: true, plan: s.dossier.plan, advies: a };
  }

  /* De bronnenlijst hoort bij het plan (literatuuronderzoek) én bij het bewijs
     (./bewijs.js koppelt conclusies eraan). Hij staat hier omdat een bron
     meestal vóór het experiment binnenkomt. `nagetrokken` is geen sierveld: een
     bron die niemand heeft opgezocht mag geen conclusie dragen. */
  function bronZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    if (b.weg) {
      const bron = s.dossier.bronnen.find(x => x.id === String(b.bronId || ''));
      if (!bron) return { status: 404, error: 'Deze bron bestaat niet.' };
      if (s.dossier.conclusies.some(c => (c.bewijs || []).some(w => w.soort === 'bron' && w.ref === bron.id)))
        return { status: 409, error: 'Deze bron draagt een conclusie; haal hem daar eerst onderuit.' };
      s.dossier.bronnen = s.dossier.bronnen.filter(x => x.id !== bron.id);
      save();
      return { ok: true, bronnen: s.dossier.bronnen };
    }
    const titel = schoon(b.titel, 200);
    if (titel.length < 3) return { status: 400, error: 'Hoe heet deze bron?' };
    if (s.dossier.bronnen.length >= 300) return { status: 400, error: 'De bronnenlijst zit vol.' };
    const bron = { id: rid(), titel, herkomst: schoon(b.herkomst, 200), jaar: getal(b.jaar, 0, 2200) || null,
      nagetrokken: !!b.nagetrokken, door: schoon(b.door, 80), at: nu() };
    s.dossier.bronnen.unshift(bron);
    audit(s.labId, 'plan.bron', wie, s.id, titel);
    save();
    return { ok: true, bron, bronnen: s.dossier.bronnen };
  }

  function bronNatrek(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const bron = s.dossier.bronnen.find(x => x.id === String(b.bronId || ''));
    if (!bron) return { status: 404, error: 'Deze bron bestaat niet.' };
    const door = schoon(b.door, 80);
    if (door.length < 2) return { status: 400, error: 'Wie heeft deze bron nagetrokken?' };
    const alEens = !!bron.natrekAt;
    bron.nagetrokken = b.nagetrokken !== false;
    bron.door = door; bron.natrekAt = nu();
    bron.notitie = schoon(b.notitie, 300);
    /* Belonen ook als de bron NIET blijkt te kloppen. Dat is juist de uitkomst
       die je wilt zien: iemand die "deze bron houdt geen stand" vastlegt, heeft
       het werk gedaan dat de rest van het dossier draagt. */
    if (!alEens) ctx.spel.beloon(s, 'bron', door);
    audit(s.labId, 'plan.bronNatrek', door, s.id, bron.id + ' ' + (bron.nagetrokken ? 'klopt' : 'klopt niet'));
    save();
    return { ok: true, bron };
  }

  return { hypotheseZet, advies, planZet, bronZet, bronNatrek };
};
