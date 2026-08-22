/* Payroll OS: DE LOONAANGIFTE.

   De derde uitgang uit dezelfde definitieve run. De boeking gaat naar het
   grootboek, het betaalbestand naar de bank, de aangifte naar de
   Belastingdienst -- en alle drie moeten hetzelfde zeggen. Zeggen ze dat niet,
   dan betaalt de werkgever iets anders dan hij aangeeft, en dat komt pas boven
   bij een controle, jaren later, met boete.

   Vandaar dat er hier maar EEN bron is: de run. Er wordt niets opnieuw
   uitgerekend en niets ingetypt. Een aangifte die zelf rekent, is een tweede
   loonmotor, en twee loonmotoren lopen uiteen.

   DE VORM: EEN COLLECTIEF EN EEN NOMINATIEF DEEL. Zo is de Nederlandse
   loonaangifte opgebouwd, en die opbouw is geen formaliteit: het collectieve
   deel is wat er betaald moet worden, het nominatieve deel is per werknemer wie
   wat verdiende. De optelling van het nominatieve deel MOET het collectieve
   deel zijn -- die controle staat hieronder en weigert, hij waarschuwt niet.

   EEN INGEDIENDE AANGIFTE VERANDERT NIET MEER. Net als een definitieve run.
   Ontdek je erna een fout, dan komt er een CORRECTIE bovenop, met een verwijzing
   naar wat hij rechtzet. Dat is hoe de Belastingdienst het ook wil, en het is
   de enige manier waarop het spoor heel blijft.

   WAT HIER NIET GEBEURT: verzenden. Deze module maakt de aangifte op. Het echte
   indienen loopt via de koppeling met de Belastingdienst en is een aparte
   handeling met zijn eigen goedkeuring -- zie ./journaal.js voor dezelfde
   scheiding. `dienIn` legt hier alleen vast DAT er is ingediend, door wie, en
   met welk kenmerk; de verzending zelf is werk voor een koppeling die er nog
   niet is. Dat staat er met zoveel woorden bij, zodat niemand denkt dat de
   aangifte de deur uit is omdat hij hier op 'ingediend' staat. */
'use strict';

/* De rubrieken. Bewust met namen en niet als losse getallen: een aangifte die
   uit een rij anonieme bedragen bestaat, is niet te controleren tegen de
   loonstrook waar hij uit komt. */
const RUBRIEKEN = ['loonLoonheffing', 'loonPremies', 'loonZvw',
  'ingehoudenLoonheffing', 'premiesWerkgever', 'zvwWerkgever'];

/* Het nominatieve deel: een regel per werknemer, rechtstreeks uit zijn strook.
   De grondslagen komen van de strook en niet uit een nieuwe optelling over de
   componenten -- anders staat er op twee plekken hoe een grondslag wordt
   bepaald.

   OP MODULESCOPE EN GEEXPORTEERD, want de bewijsketen (./herkomst.js) herbouwt
   een aangifte hiermee. Dat MOET dezelfde routine zijn: een herbouw die net
   anders optelt dan de aangifte die hij nareken, vindt altijd een verschil, en
   dan zegt een verschil niets meer. Puur -- alleen de run gaat erin. */
function nominatief(run) {
  return run.stroken.map(s => {
    const st = s.strook;
    const g = (st.stappen.find(x => x.stap === 'grondslagen') || {});
    return {
      staffId: s.staffId, naam: s.naam,
      loonLoonheffing: g.loonheffing != null ? g.loonheffing : st.brutoCenten,
      loonPremies: g.premies != null ? g.premies : 0,
      loonZvw: g.zvw != null ? g.zvw : 0,
      ingehoudenLoonheffing: st.loonheffingCenten,
      premiesWerkgever: (st.stappen.find(x => x.stap === 'premies') || {}).centen || 0,
      zvwWerkgever: (st.stappen.find(x => x.stap === 'zvw') || {}).centen || 0
    };
  });
}

const telOp = (rijen) => {
  const uit = {};
  for (const r of RUBRIEKEN) uit[r] = rijen.reduce((s, x) => s + (x[r] || 0), 0);
  return uit;
};

function maakAangifte({ db, save, nu, crypto, run: runLaag }) {
  const tijd = nu || (() => new Date().toISOString());

  function bak() {
    if (!Array.isArray(db.data.payrollAangiftes)) db.data.payrollAangiftes = [];
    return db.data.payrollAangiftes;
  }
  const vind = (id) => bak().find(a => a.id === id) || null;

  /* ---------- opmaken ---------- */
  /* Uit EEN definitieve run. Meerdere runs over dezelfde periode (een zaak met
     een tweede loonrun, of een correctierun) krijgen elk hun eigen aangifte:
     de een is de aangifte, de ander de correctie. Ze in een aangifte proppen
     zou het spoor naar de run kwijtmaken. */
  function maak(run, door) {
    if (!run) return { status: 404, error: 'Deze loonrun kennen we niet.' };
    if (run.stand !== 'definitief')
      return { status: 409, error: 'Een loonaangifte komt alleen uit een definitieve loonrun.' };
    if (!door) return { status: 400, error: 'Noteer wie deze aangifte opmaakt.' };

    const bestaand = bak().find(a => a.runId === run.id && a.stand !== 'vervallen');
    if (bestaand) return { ok: true, ongewijzigd: true, aangifte: bestaand };

    const rijen = nominatief(run);
    const totalen = telOp(rijen);

    /* DE CONTROLE DIE ERTOE DOET. Wat er aan loonheffing wordt aangegeven moet
       exact zijn wat er op de stroken is ingehouden. Ze komen hier uit dezelfde
       bron, dus dit hoort altijd te kloppen -- en juist daarom is het een
       goede controle: gaat hij ooit af, dan is er iets veranderd waar niemand
       aan dacht. */
    const opStroken = run.stroken.reduce((s, x) => s + x.strook.loonheffingCenten, 0);
    if (totalen.ingehoudenLoonheffing !== opStroken)
      return { status: 422, error: 'De aangifte (' + totalen.ingehoudenLoonheffing +
        ' cent loonheffing) wijkt af van de loonstroken (' + opStroken + ' cent).' };

    /* Een correctierun levert een CORRECTIEAANGIFTE, en die verwijst naar de
       aangifte van de run die hij rechtzet. Zonder die verwijzing is een
       correctie een tweede aangifte over dezelfde periode, en dan telt de
       Belastingdienst hem er gewoon bovenop. */
    const oorspronkelijk = run.correctieVan
      ? (bak().find(a => a.runId === run.correctieVan) || null) : null;

    const a = {
      id: 'aan_' + crypto.randomBytes(5).toString('hex'),
      runId: run.id, code: run.code, zaak: run.zaak, periode: run.periode,
      land: run.land, regelversie: run.regelversie,
      soort: run.correctieVan ? 'correctie' : 'aangifte',
      corrigeert: oorspronkelijk ? oorspronkelijk.id : null,
      corrigeertRun: run.correctieVan || null,
      nominatief: rijen, totalen,
      teBetalenCenten: totalen.ingehoudenLoonheffing + totalen.premiesWerkgever + totalen.zvwWerkgever,
      stand: 'concept', opgemaaktDoor: door, opgemaaktOp: tijd(),
      ingediendDoor: null, ingediendOp: null, kenmerk: null
    };
    if (run.correctieVan && !oorspronkelijk) a.let =
      'Deze correctie hoort bij een run waarvan geen aangifte is opgemaakt. Maak die eerst op, anders verwijst de correctie nergens naar.';
    bak().unshift(a);
    if (bak().length > 2000) bak().length = 2000;
    save();
    return { ok: true, aangifte: a };
  }

  /* ---------- indienen ---------- */
  /* Vastleggen DAT er is ingediend. Het kenmerk is wat de Belastingdienst
     teruggeeft; zonder kenmerk is "ingediend" een bewering zonder bewijs, en
     dat is precies wat je bij een controle nodig hebt. */
  function dienIn(id, door, kenmerk) {
    const a = vind(id);
    if (!a) return { status: 404, error: 'Deze aangifte kennen we niet.' };
    if (a.stand === 'ingediend') return { status: 409, error: 'Deze aangifte is al ingediend op ' + a.ingediendOp + '.' };
    if (!door) return { status: 400, error: 'Noteer wie deze aangifte indient.' };
    const k = String(kenmerk || '').trim();
    if (k.length < 4) return { status: 400,
      error: 'Noteer het kenmerk dat de Belastingdienst teruggaf. Zonder kenmerk is "ingediend" een bewering zonder bewijs.' };
    a.stand = 'ingediend'; a.ingediendDoor = door; a.ingediendOp = tijd(); a.kenmerk = k;
    save();
    return { ok: true, aangifte: a,
      let: 'Vastgelegd dat deze aangifte is ingediend. Het verzenden zelf loopt buiten RTG om; dit is de administratie ervan.' };
  }

  /* ---------- teruglezen ---------- */
  const vanZaak = (code, periode) => bak()
    .filter(a => a.code === String(code || '').toUpperCase() && (!periode || a.periode === periode))
    .map(a => ({ id: a.id, runId: a.runId, periode: a.periode, soort: a.soort, stand: a.stand,
      corrigeert: a.corrigeert, teBetalenCenten: a.teBetalenCenten, totalen: a.totalen,
      opgemaaktDoor: a.opgemaaktDoor, opgemaaktOp: a.opgemaaktOp,
      ingediendDoor: a.ingediendDoor, ingediendOp: a.ingediendOp, kenmerk: a.kenmerk }));

  /* ---------- de aansluiting ----------
     "Aangifte wijkt af van loonjournaal" stond in de opzet als een van de
     controles die automatisch hoort te lopen. Hier is hij: de loonheffing in de
     aangifte tegenover de creditpost in het journaal. Twee wegen naar hetzelfde
     getal; lopen ze uiteen, dan is er onderweg iets veranderd. */
  function sluitAanOpJournaal(aangifte, boeking, tegenrekeningLoonheffing) {
    if (!aangifte || !boeking) return { status: 400, error: 'Geef een aangifte en een boeking.' };
    const inJournaal = (boeking.regels || [])
      .filter(r => r.rekening === tegenrekeningLoonheffing)
      .reduce((s, r) => s + r.creditCenten, 0);
    if (inJournaal !== aangifte.totalen.ingehoudenLoonheffing)
      return { status: 422, error: 'De aangifte (' + aangifte.totalen.ingehoudenLoonheffing +
        ' cent) en het loonjournaal (' + inJournaal + ' cent) spreken elkaar tegen over de loonheffing.',
        aangifte: aangifte.totalen.ingehoudenLoonheffing, journaal: inJournaal };
    return { ok: true, loonheffingCenten: inJournaal };
  }

  /* `haalAangifte` en niet `haal`: de kruisscan (scripts/kruisscan.js) leest de
     bestanden in deze map als slices van een module, en `haal` bestaat al als
     top-level naam elders. Twee dezelfde namen naast elkaar zijn precies hoe je
     later de verkeerde te pakken hebt. */
  const haalAangifte = (id) => vind(id);

  return { maak, dienIn, vanZaak, haal: haalAangifte, sluitAanOpJournaal, RUBRIEKEN };
}

module.exports = { maakAangifte, nominatief, telOp, RUBRIEKEN };
