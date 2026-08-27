/* Payroll OS: DE AUTOMATISCHE CONTROLES.

   WAAROM DIT EEN EIGEN LAAG IS EN GEEN IF'JES IN DE MOTOR. Een controle die in
   de berekening zit, verleidt tot repareren: het bedrag wordt stilletjes
   opgehoogd tot het minimumloon, de negatieve strook wordt op nul gezet, de
   dubbele declaratie verdwijnt. Dan is het probleem weg uit beeld en niet uit
   de wereld. Deze laag REPAREERT NIETS. Hij kijkt naar een doorgerekende run en
   zegt wat er aan de hand is.

   ELKE BEVINDING DRAAGT VIER DINGEN, en dat is niet cosmetisch:

     ernst      hoog / midden / laag -- wat mag er door naar definitief
     eigenaar   wie hem afhandelt (manager, administrateur, kantoor). Een
                waarschuwing zonder eigenaar blijft altijd liggen.
     uitleg     in gewone taal, met de getallen erin. "Afwijking gedetecteerd"
                helpt niemand; "netto 40% lager dan vorige maand (1.240 -> 744)"
                wel.
     status     open / verklaard / afgehandeld -- zodat een bekende, uitgelegde
                afwijking niet elke maand opnieuw als nieuw voelt.

   HOOG BLOKKEERT. Een run met een openstaande hoge bevinding hoort niet
   definitief te kunnen worden; dat is de rem die de gebruiker in zijn opzet
   beschreef als het verschil tussen een salarisberekenaar en een payroll die je
   durft te vertrouwen. Verklaren kan altijd -- met een reden, die blijft staan. */
'use strict';

const ERNST = ['hoog', 'midden', 'laag'];
const STATUS = ['open', 'verklaard', 'afgehandeld'];

/* Hoeveel het nettoloon mag afwijken van de vorige periode voor er iemand naar
   kijkt. Een kwart is ruim genoeg voor een maand met wat overuren en scherp
   genoeg om een verdubbeling of een halvering te vangen. */
const AFWIJKING = 0.25;
const OVERUREN_VEEL = 60; // per periode; daarboven is het geen uitschieter meer

const euro = (c) => (c / 100).toFixed(2);

function maakControles({ opslag, save, nu }) {
  const tijd = nu || (() => new Date().toISOString());
  const bak = () => opslag.bak('payrollBevindingen');

  function bevinding(soort, ernst, eigenaar, uitleg, extra) {
    return Object.assign({ soort, ernst, eigenaar, uitleg, status: 'open', at: tijd() }, extra || {});
  }

  /* Loopt een doorgerekende run na. `context` levert wat de run zelf niet weet:
     de vorige run, de contracten, de bankrekeningwijzigingen, de uren-
     bevindingen uit ./uren.js. */
  function loop(run, context) {
    const c = context || {};
    const uit = [];

    /* Wat de urenimport al vond, hoort hier gewoon bij: het is dezelfde lijst
       voor dezelfde mens, en twee lijstjes op twee schermen betekent dat er een
       wordt vergeten. */
    for (const b of (c.urenBevindingen || [])) uit.push(Object.assign({ status: 'open' }, b));

    for (const s of run.stroken) {
      const st = s.strook;
      const naam = s.naam || ('#' + s.staffId);

      if (st.nettoCenten < 0) uit.push(bevinding('negatief_netto', 'hoog', 'administrateur',
        naam + ' komt uit op een negatief nettoloon (' + euro(st.nettoCenten) + '). Dat kan kloppen bij een terugvordering, maar het wordt niet uitbetaald.',
        { staffId: s.staffId }));

      /* Betaald zonder geldig contract. De motor rekent gewoon door -- hij
         krijgt een contract aangereikt -- dus deze controle is de enige plek
         waar dit opvalt.

         ALLEEN ALS DE AANROEPER CONTRACTEN MEEGAF. Zonder die voorwaarde meldt
         deze controle iedereen als contractloos zodra iemand hem aanroept
         zonder die gegevens, en dan staat er elke maand een rij hoge
         bevindingen die nergens over gaat. Een lijst met valse alarmen wordt
         niet gelezen, en dan mist hij ook de echte. */
      const contract = c.contracten ? c.contracten[s.staffId] : undefined;
      if (c.contracten && !contract) uit.push(bevinding('geen_geldig_contract', 'hoog', 'administrateur',
        'Voor ' + naam + ' is geen contractversie gevonden die gold in ' + run.periode + '. Er wordt loon berekend zonder grondslag.',
        { staffId: s.staffId }));
      else if (contract && contract.terugwerkend) uit.push(bevinding('terugwerkende_contractwijziging', 'midden', 'administrateur',
        'Het contract van ' + naam + ' is met terugwerkende kracht gewijzigd (ingang ' + contract.vanaf + ', vastgelegd ' + String(contract.vastgelegdOp).slice(0, 10) + '). Controleer of er nog nabetaald moet worden.',
        { staffId: s.staffId }));

      /* Sterke afwijking ten opzichte van de vorige periode. */
      const vorige = ((c.vorigeRun || {}).stroken || []).find(x => x.staffId === s.staffId);
      if (vorige && vorige.strook.nettoCenten > 0) {
        const was = vorige.strook.nettoCenten, nu2 = st.nettoCenten;
        const deel = Math.abs(nu2 - was) / was;
        if (deel > AFWIJKING) uit.push(bevinding('afwijking_vorige_periode', 'midden', 'manager',
          'Het nettoloon van ' + naam + ' wijkt ' + Math.round(deel * 100) + '% af van de vorige periode (' +
          euro(was) + ' naar ' + euro(nu2) + ').', { staffId: s.staffId }));
      }

      /* Extreem veel overuren: eerder een signaal over de bezetting dan over
         het loon, maar het hoort wel gezien te worden. */
      const over = st.regels.find(r => r.component === 'overuren_125');
      if (over && over.aantal > OVERUREN_VEEL) uit.push(bevinding('veel_overuren', 'midden', 'manager',
        naam + ' schreef ' + over.aantal + ' overuren in ' + run.periode + '. Kijk of de bezetting klopt.',
        { staffId: s.staffId }));

      /* Een bankrekening die vlak voor de loonrun is gewijzigd, is het klassieke
         patroon bij loonfraude. Niet blokkeren -- mensen wisselen echt van bank
         -- maar wel altijd langs een mens. */
      const bank = (c.bankGewijzigd || {})[s.staffId];
      if (bank) {
        const dagen = Math.round((new Date(tijd()) - new Date(bank)) / 86400000);
        if (dagen <= 7) uit.push(bevinding('bankrekening_net_gewijzigd', 'hoog', 'administrateur',
          'De bankrekening van ' + naam + ' is ' + dagen + ' dag(en) geleden gewijzigd, vlak voor deze loonrun. Controleer dit met de medewerker zelf, niet per e-mail.',
          { staffId: s.staffId }));
      }

      /* Dubbele declaratie: dezelfde component twee keer met exact hetzelfde
         bedrag in een periode is zelden echt. */
      const gezien = new Map();
      for (const r of st.regels) {
        if (r.aantal != null) continue; // uren, geen declaratie
        const sleutel = r.component + ':' + r.centen;
        gezien.set(sleutel, (gezien.get(sleutel) || 0) + 1);
      }
      for (const [sleutel, n] of gezien) {
        if (n < 2) continue;
        uit.push(bevinding('dubbele_declaratie', 'midden', 'manager',
          naam + ' heeft ' + n + ' keer exact dezelfde post (' + sleutel.split(':')[0] + ', ' +
          euro(Number(sleutel.split(':')[1])) + ') in deze periode.', { staffId: s.staffId }));
      }

      /* Waarschuwingen die de motor zelf al gaf (minimumloon, ongecontroleerd
         regelpakket) horen in dezelfde lijst thuis. */
      for (const w of (s.waarschuwingen || [])) uit.push(Object.assign(
        bevinding(w.soort, w.ernst || 'hoog', 'administrateur', w.uitleg, { staffId: s.staffId }), w, { status: 'open' }));
    }

    /* Bewaren, zodat een verklaring blijft staan tussen twee keer kijken. */
    const bevindingen = bak();
    const oud = bevindingen[run.id] || [];
    const samen = uit.map(b => {
      const eerder = oud.find(x => x.soort === b.soort && x.staffId === b.staffId);
      return eerder && eerder.status !== 'open'
        ? Object.assign({}, b, { status: eerder.status, verklaring: eerder.verklaring, door: eerder.door })
        : b;
    });
    bevindingen[run.id] = samen;
    save();

    return { runId: run.id, bevindingen: samen,
      hoogOpen: samen.filter(b => b.ernst === 'hoog' && b.status === 'open').length };
  }

  /* Verklaren: de bevinding blijft staan, met de uitleg erbij. Wegklikken zonder
     reden kan niet -- dan is de lijst binnen een maand een knop die iedereen
     indrukt. */
  function verklaar(runId, soort, staffId, verklaring, door) {
    if (String(verklaring || '').trim().length < 10)
      return { status: 400, error: 'Noteer waarom deze bevinding in orde is.' };
    if (!door) return { status: 400, error: 'Noteer wie dit verklaart.' };
    const rij = bak()[runId] || [];
    const b = rij.find(x => x.soort === soort && (staffId == null || x.staffId === staffId));
    if (!b) return { status: 404, error: 'Deze bevinding kennen we niet.' };
    b.status = 'verklaard'; b.verklaring = String(verklaring).trim().slice(0, 400);
    b.door = door; b.verklaardOp = tijd();
    save();
    return { ok: true, bevinding: b };
  }

  /* Mag deze run definitief worden? Een openstaande hoge bevinding houdt hem
     tegen. Dat is de rem; verklaren kan altijd, negeren niet. */
  function magDefinitief(runId) {
    const rij = bak()[runId] || [];
    const blok = rij.filter(b => b.ernst === 'hoog' && b.status === 'open');
    if (!blok.length) return { ok: true };
    return { status: 409, error: 'Er staan ' + blok.length + ' bevinding(en) met ernst hoog open. Handel ze af of verklaar ze.',
      bevindingen: blok };
  }

  const van = (runId) => bak()[runId] || [];

  return { loop, verklaar, magDefinitief, van, ERNST, STATUS, AFWIJKING };
}

module.exports = { maakControles, ERNST, STATUS, AFWIJKING };
