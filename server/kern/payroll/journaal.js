/* Payroll OS: HET LOONJOURNAAL EN HET BETAALBESTAND.

   Dit is de vierde vraag die elke euro moet kunnen beantwoorden: waar is het
   bedrag daarna geboekt, aangegeven en betaald. De eerste drie (waarom
   berekend, welke regelversie, wie keurde goed) staan in ./motor.js en
   ./run.js; hier gaat het geld het huis uit.

   TWEE UITGANGEN, EN ZE MOETEN OP ELKAAR KLOPPEN. Uit dezelfde definitieve run
   komt een BOEKING (naar het grootboek) en een BETAALBESTAND (naar de bank).
   Lopen die twee uiteen, dan klopt de boekhouding niet met de bankafschriften
   en merkt niemand dat tot de accountant komt. Daarom rekent elke uitgang terug
   naar het totaal van de run, en weigert hij als dat niet uitkomt.

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

const valuta = require('./valuta');

/* Waar de tegenrekeningen staan. Bewust met namen: een grootboekschema per
   land of per bedrijf hoort configureerbaar te zijn, maar de ROLLEN liggen
   vast, anders weet de boeking niet wat waar tegenover staat. */
const TEGENREKENINGEN = {
  nettoloon: '1600',        // schuld aan de werknemer
  loonheffing: '1610',      // schuld aan de Belastingdienst
  inhoudingen: '1620',      // pensioen, loonbeslag: schuld aan derden
  werkgeverslasten: '1630'  // premies en Zvw: schuld aan de Belastingdienst
};

const IBAN_VORM = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;

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

  /* ---------- het betaalbestand ---------- */
  /* Een SEPA-overboeking per medewerker. Geen XML hier: dat is een vorm, en de
     vorm hoort bij de bankkoppeling. Wat hier gemaakt wordt is de INHOUD, met
     de controle die ertoe doet -- het totaal moet exact het nettoloon van de
     run zijn. Dat is de controle die de gebruiker zelf noemde: "betaalbestand
     wijkt af van definitieve loonrun". */
  function betaalbestand(run, rekeningen) {
    if (!run) return { status: 404, error: 'Deze loonrun kennen we niet.' };
    if (run.stand !== 'definitief')
      return { status: 409, error: 'Een betaalbestand komt alleen uit een definitieve loonrun.' };

    /* SEPA IS EURO, EN DAT IS GEEN DETAIL. Dit bestand draagt IBANs en bedragen
       zonder muntaanduiding, want in SEPA is de munt de euro. Er yen in zetten
       levert geen foutmelding op bij de bank maar een BETALING: de getallen
       worden als euro's gelezen, en 300.000 yen wordt dan 300.000 euro.

       Daarom stopt het hier. Een betaalbestand voor een andere munt is een
       ander formaat (SWIFT, een lokale koppeling) en dat bouwen we als het er
       is -- niet door dit bestand te laten alsof het klopt. */
    const munt = ((run.stroken[0] || {}).strook || {}).valuta;
    if (munt && !valuta.isSepa(munt.code))
      return { status: 422, error: 'Deze loonrun staat in ' + munt.code +
        ' en een SEPA-betaalbestand kent alleen euro\'s. Er is nog geen betaalweg voor ' + munt.code +
        '; maak de betaling buiten RTG om en leg het bewijs vast.', valuta: munt.code };

    const posten = [];
    const zonderRekening = [];
    for (const s of run.stroken) {
      const iban = String((rekeningen || {})[s.staffId] || '').replace(/\s+/g, '').toUpperCase();
      if (!IBAN_VORM.test(iban)) { zonderRekening.push({ staffId: s.staffId, naam: s.naam }); continue; }
      if (s.strook.nettoCenten <= 0) continue; // niets te betalen (of een correctie die inhoudt)
      posten.push({ staffId: s.staffId, naam: s.naam, iban,
        centen: s.strook.nettoCenten,
        omschrijving: 'Salaris ' + run.periode + ' ' + run.zaak });
    }
    if (zonderRekening.length)
      return { status: 422, error: 'Van deze medewerkers ontbreekt een geldig rekeningnummer.', medewerkers: zonderRekening };

    const totaal = posten.reduce((s, p) => s + p.centen, 0);
    const verwacht = run.stroken.reduce((s, x) => s + Math.max(0, x.strook.nettoCenten), 0);
    if (totaal !== verwacht)
      return { status: 422, error: 'Het betaalbestand (' + totaal + ' cent) wijkt af van de loonrun (' + verwacht + ' cent).',
        totaal, verwacht };

    const best = { id: 'bet_' + crypto.randomBytes(4).toString('hex'), runId: run.id,
      periode: run.periode, zaak: run.zaak, posten, totaalCenten: totaal, aantal: posten.length,
      gemaaktOp: tijd(), verzonden: false };
    const rij = (db.data.payrollBetaalbestanden = db.data.payrollBetaalbestanden || []);
    rij.unshift(best);
    if (rij.length > 500) rij.length = 500;
    save();
    return { ok: true, bestand: best };
  }

  /* Boeken en betalen zijn twee uitgangen uit dezelfde run; deze controle
     bewaakt dat ze elkaar niet tegenspreken. Hij hoort bij de automatische
     controles uit de opzet ("aangifte wijkt af van loonjournaal"). */
  function sluitAan(run, rekeningen) {
    const b = boeking(run);
    if (b.error) return b;
    const bet = betaalbestand(run, rekeningen);
    if (bet.error) return bet;
    const nettoInBoeking = b.regels.filter(r => r.rekening === TEGENREKENINGEN.nettoloon)
      .reduce((s, r) => s + r.creditCenten, 0);
    if (nettoInBoeking !== bet.bestand.totaalCenten)
      return { status: 422, error: 'Het loonjournaal (' + nettoInBoeking + ' cent netto) en het betaalbestand (' +
        bet.bestand.totaalCenten + ' cent) spreken elkaar tegen.' };
    return { ok: true, boeking: b, bestand: bet.bestand };
  }

  return { boeking, betaalbestand, sluitAan, TEGENREKENINGEN };
}

module.exports = { maakJournaal, TEGENREKENINGEN, IBAN_VORM };
