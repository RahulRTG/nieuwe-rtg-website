/* Payroll OS: HET LOONJOURNAAL EN HET BETAALBESTAND.

   Dit is de vierde vraag die elke euro moet kunnen beantwoorden: waar is het
   bedrag daarna geboekt, aangegeven en betaald. De eerste drie (waarom
   berekend, welke regelversie, wie keurde goed) staan in ./motor.js en
   ./run.js; hier gaat het geld het huis uit.

   TWEE UITGANGEN, EN ZE MOETEN OP ELKAAR KLOPPEN. Uit dezelfde definitieve run
   komt een BOEKING (hier) en een BETAALBESTAND (./journaal-betalen.js). Lopen
   die twee uiteen, dan klopt de boekhouding niet met de bankafschriften en
   merkt niemand dat tot de accountant komt. Het bestand controleert zichzelf
   daarom tegen deze boeking VOORDAT het wordt bewaard.

   DE BOEKING TELT OP TOT NUL. Dat is geen stijlkeuze maar de enige controle die
   werkt: elke cent aan loonkosten staat tegenover een schuld (aan de
   werknemer, aan de Belastingdienst, aan de pensioenuitvoerder). Klopt de som
   niet, dan is er een component zonder grootboek of een bedrag dat nergens
   heen gaat -- en dat hoort te stuiten, niet stilletjes weg te lekken.

   ALLEEN UIT EEN DEFINITIEVE RUN. Een concept is een berekening waar nog
   niemand achter staat; daar hoort geen betaalbestand uit te komen. Dat lijkt
   vanzelfsprekend tot iemand "even" een proefbestand maakt en het per ongeluk
   inleest bij de bank.

   WAT HIER NIET GEBEURT: verzenden. Deze module maakt bestanden en boekingen;
   het versturen naar de bank of de Belastingdienst is een aparte handeling met
   zijn eigen goedkeuring. Een module die zowel opmaakt als verstuurt, is een
   module waar per ongeluk geld uit komt. */
'use strict';

/* Waar de tegenrekeningen staan. Bewust met namen: een grootboekschema per
   land of per bedrijf hoort configureerbaar te zijn, maar de ROLLEN liggen
   vast, anders weet de boeking niet wat waar tegenover staat. */
const TEGENREKENINGEN = {
  nettoloon: '1600',        // schuld aan de werknemer
  loonheffing: '1610',      // schuld aan de Belastingdienst
  inhoudingen: '1620',      // pensioen, loonbeslag: schuld aan derden
  werkgeverslasten: '1630'  // premies en Zvw: schuld aan de Belastingdienst
};

function maakJournaal({ db, save, nu, crypto }) {
  const tijd = nu || (() => new Date().toISOString());

  /* ---------- de boeking ---------- */
  /* Kosten aan de debetkant (per grootboekrekening uit het componentenregister),
     schulden aan de creditkant. De som moet nul zijn. */
  function boeking(run) {
    if (!run) return { status: 404, error: 'Deze loonrun kennen we niet.' };
    if (run.stand !== 'definitief')
      return { status: 409, error: 'Een loonjournaal komt alleen uit een definitieve loonrun.' };

    const debet = {};
    let netto = 0, heffing = 0, inhoudingen = 0, lasten = 0;
    const zonderRekening = [];

    for (const s of run.stroken) {
      const st = s.strook;
      for (const r of st.regels) {
        if (r.soort === 'bruto') {
          if (!r.grootboek) { zonderRekening.push(r.component); continue; }
          debet[r.grootboek] = (debet[r.grootboek] || 0) + r.centen;
        } else if (r.soort === 'inhouding') {
          inhoudingen += r.centen;
        } else if (r.soort === 'netto') {
          /* Een nettocomponent verhoogt of verlaagt wat er wordt uitbetaald
             zonder door de belasting te gaan; hij hoort dus wel in de kosten
             thuis, op zijn eigen rekening. */
          if (!r.grootboek) { zonderRekening.push(r.component); continue; }
          debet[r.grootboek] = (debet[r.grootboek] || 0) + r.centen;
        }
      }
      netto += st.nettoCenten;
      heffing += st.loonheffingCenten;
      lasten += st.werkgeverslastenCenten;
    }
    if (zonderRekening.length)
      return { status: 422, error: 'Deze looncomponenten hebben geen grootboekrekening; dan is niet te zeggen waar het bedrag heen gaat.',
        componenten: [...new Set(zonderRekening)] };

    if (lasten) debet[TEGENREKENINGEN.werkgeverslasten + '-kosten'] = lasten;

    const regels = [];
    for (const rek of Object.keys(debet).sort()) regels.push({ rekening: rek, debetCenten: debet[rek], creditCenten: 0 });
    regels.push({ rekening: TEGENREKENINGEN.nettoloon, debetCenten: 0, creditCenten: netto, wat: 'netto te betalen' });
    regels.push({ rekening: TEGENREKENINGEN.loonheffing, debetCenten: 0, creditCenten: heffing, wat: 'loonheffing' });
    if (inhoudingen) regels.push({ rekening: TEGENREKENINGEN.inhoudingen, debetCenten: 0, creditCenten: inhoudingen, wat: 'inhoudingen' });
    if (lasten) regels.push({ rekening: TEGENREKENINGEN.werkgeverslasten, debetCenten: 0, creditCenten: lasten, wat: 'werkgeverslasten' });

    const somDebet = regels.reduce((s, r) => s + r.debetCenten, 0);
    const somCredit = regels.reduce((s, r) => s + r.creditCenten, 0);
    if (somDebet !== somCredit)
      return { status: 422, error: 'De boeking telt niet op tot nul (debet ' + somDebet + ', credit ' + somCredit + ' cent). Er is een bedrag dat nergens heen gaat.',
        somDebet, somCredit };

    return { ok: true, runId: run.id, periode: run.periode, zaak: run.zaak,
      regelversie: run.regelversie, regels, somDebet, somCredit, at: tijd() };
  }

  /* Het BETAALBESTAND staat in ./journaal-betalen.js: een eigen onderwerp (hier
     gaat geld het huis uit, daar wordt geboekt) en dit bestand ging over de
     10 KB. Het krijgt de boeking mee, want het moet ertegen kloppen voordat er
     iets wordt bewaard. */
  const { betaalbestand, sluitAan } = require('./journaal-betalen')({
    db, save, tijd, crypto, boeking, bestandenVan: (id) => bestandenVan(id),
    tegenrekeningNetto: TEGENREKENINGEN.nettoloon });

  /* Welke betaalbestanden zijn er voor deze run gemaakt? Lezen, niet maken --
     het openen van een dossier hoort geen geld in beweging te zetten. */
  const bestandenVan = (runId) => (db.data.payrollBetaalbestanden || [])
    .filter(b => b.runId === runId);

  return { boeking, betaalbestand, sluitAan, bestandenVan, TEGENREKENINGEN };
}

/* IBAN_VORM hoort bij het betaalbestand en wordt hier alleen doorgegeven, zodat
   wie journaal.js gebruikt hem niet uit een tweede bestand hoeft te halen. */
const IBAN_VORM = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;
module.exports = { maakJournaal, TEGENREKENINGEN, IBAN_VORM };
