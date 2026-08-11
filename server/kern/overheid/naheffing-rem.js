/* Overheid-domein "naheffing" (deelmodule): DE REM EN DE STOPKNOP.

   Afgesplitst van ./naheffing-invordering.js, dat over de 10 kB-lat ging -- en
   op de naad die er inhoudelijk toch al lag: daar staat de escalatie (aanmaning,
   dwangbevel, beslag), hier staat wat hem tegenhoudt.

   DIT IS GEEN VRIENDELIJKHEID MAAR EEN VOORWAARDE. Een invordering zonder rem is
   een ratel die maar een kant op kan, en dat is precies het soort systeem dat
   mensen kapotmaakt omdat niemand meer aan de noodrem kon. Een betalingsregeling
   schort de invordering op zolang hij loopt; de stopknop kan in ELKE stand, ook
   na een beslag -- want juist dan is er iets misgegaan.

   WAT DE STOPKNOP NIET DOET: terugbetalen. Wat er al is afgeschreven komt hier
   niet vanzelf terug. Dat is een besluit op bezwaar (./naheffing-daarna.js), met
   een motivering die de zaak kan lezen -- en geen pennenstreek van de ontvanger.

   De constanten en de gedeelde `openstaand` komen uit het moederbestand mee. */
'use strict';

module.exports = (ctx, { vind, publiek, openstaand, meld, overDagen, euro, REGELING_MAX_MAANDEN }) => {
  const { save, nu, schoon } = ctx;

  /* ---- de rem: een betalingsregeling ---- */
  function naheffingRegeling(id, door, maanden) {
    const n = vind(id);
    if (!n) return { status: 404, error: 'Deze naheffing kennen we niet.' };
    if (n.betaaldOp) return { status: 409, error: 'Deze naheffing is al betaald.' };
    if (!['vastgesteld', 'bezwaar', 'gehandhaafd'].includes(n.status))
      return { status: 409, error: 'Voor een naheffing met de stand "' + n.status + '" is geen regeling nodig.' };
    if (n.regeling) return { status: 409, error: 'Er loopt al een regeling tot ' + n.regeling.totOp + '.' };
    if (n.beslagOp) return { status: 409, error: 'Er is al beslag gelegd; een regeling komt daarvoor, niet daarna.' };
    const m = Math.round(Number(maanden) || 0);
    if (m < 1 || m > REGELING_MAX_MAANDEN) return { status: 400,
      error: 'Een regeling loopt van 1 tot ' + REGELING_MAX_MAANDEN + ' maanden.' };
    const wie = schoon(door, 60);
    if (wie.length < 2) return { status: 400, error: 'Een regeling staat altijd op naam.' };

    const open = openstaand(n);
    n.regeling = { maanden: m, perCenten: Math.ceil(open / m), door: wie, op: nu(), totOp: overDagen(m * 30) };
    n.vervaltOp = n.regeling.totOp;
    save();
    meld(n, 'Betalingsregeling', 'u betaalt € ' + euro(n.regeling.perCenten) + ' per maand, ' + m +
      ' maanden lang. Zolang u de regeling nakomt staat de invordering stil.');
    return { ok: true, naheffing: publiek(n),
      let: 'Regeling van ' + m + ' maanden: € ' + euro(n.regeling.perCenten) + ' per maand. De invordering staat stil.' };
  }

  /* ---- de stopknop ----
     Zonder deze is de keten hierboven een ratel die maar een kant op kan. Hij
     mag in ELKE stand -- ook na een beslag, want dan is er iets misgegaan en
     moet iemand het kunnen tegenhouden. Wat er al is afgeschreven komt hier NIET
     vanzelf terug: dat is een terugbetaling en die hoort bij een besluit op
     bezwaar, niet bij een pennenstreek van de ontvanger. */
  function naheffingStopInvordering(id, door, reden) {
    const n = vind(id);
    if (!n) return { status: 404, error: 'Deze naheffing kennen we niet.' };
    if (n.invorderingGestopt) return { status: 409, error: 'De invordering is al stopgezet.' };
    const wie = schoon(door, 60);
    const r = schoon(reden, 300);
    if (wie.length < 2) return { status: 400, error: 'Stopzetten staat altijd op naam.' };
    if (r.length < 6) return { status: 400, error: 'Noteer waarom u de invordering stopzet.' };
    n.invorderingGestopt = { op: nu(), door: wie, reden: r };
    save();
    meld(n, 'Invordering stopgezet', 'de invordering is stopgezet. ' + r);
    return { ok: true, naheffing: publiek(n),
      let: n.beslagCenten ? 'Stopgezet. Let op: het al gelegde beslag van € ' + euro(n.beslagCenten) +
        ' komt hier niet vanzelf mee terug; dat loopt via een besluit op bezwaar.' : 'De invordering is stopgezet.' };
  }

  return { naheffingRegeling, naheffingStopInvordering, REGELING_MAX_MAANDEN };
};
