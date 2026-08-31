/* Foundation OS: de SEPA-machtiging bij een periodieke gift.

   BESLUIT VAN DE EIGENAAR (31 augustus 2026): de incasso wordt gebouwd. Wat dat
   hier eerlijk kan betekenen, staat of valt met een feit dat eerst gemeten is:
   DIT HUIS HEEFT GEEN INCASSO-RAIL. server/betaal.js kent maakUitbetaling (geld
   eruit) en maakBetaling (een kaartbetaling die de betaler zelf start). Er is
   geen functie die geld van de rekening van een ander haalt, en dat is geen
   vergeten regel code: een Europese incasso vraagt een contract met een bank en
   een incassant-ID op naam van de stichting. Software kan dat niet vervangen.

   WAT ER DUS WEL IS. De machtiging zelf -- wie tekende, voor welk maximum, met
   welk kenmerk -- en per termijn een AANKONDIGING die klaarstaat. Wat er niet
   is, is de afschrijving, en elk antwoord uit deze laag zegt dat met
   `geindNu: false` en de reden erbij. Dezelfde halve stap die school/machtiging.js
   bewust nam, en om dezelfde reden: nooit claimen dat een boeking is verwerkt.

   DE REGELS KOMEN UIT ../machtiging.js en staan hier niet opnieuw. Wat hier WEL
   staat is wat een gift anders maakt dan een schoolnota:

   1. DE MACHTIGING HANGT AAN EEN PLAN EN NIET AAN EEN MENS. Wie twee periodieke
      giften heeft lopen, tekent twee keer -- met twee kenmerken, twee maxima en
      twee momenten om te stoppen. Een machtiging die voor "alles van deze gever"
      geldt, is de blanco cheque uit regel 2 in een andere vorm.

   2. HET MAXIMUM MAG NIET ONDER HET JAARBEDRAG LIGGEN. Anders tekent iemand
      voor iets dat per definitie zou stuklopen, en dat merkt hij pas bij de
      eerste incasso die weigert.

   3. DE AANKONDIGING GAAT VOOR DE AFSCHRIJVING UIT, en het aantal dagen staat
      in ../machtiging.js. Een incasso komt nooit als verrassing.

   4. INTREKKEN STOPT DE INCASSO EN NIET DE GIFT. Dat zijn twee dingen: de
      overeenkomst loopt door (daar gaat de Belastingdienst over, niet wij), en
      wat er is toegezegd kan de gever gewoon zelf blijven overmaken. Een knop
      die stilletjes allebei doet, laat iemand denken dat hij van een
      vijfjarige afspraak af is.

   5. HET STOPPEN VAN HET PLAN TREKT DE MACHTIGING MEE. Andersom dus wel, want
      een machtiging die blijft staan bij een gestopt plan is een openstaande
      volmacht zonder grond.

   EN EEN WOORD OVER HET WOORD "BANK". Hier stond "via je eigen bank", en
   test/eu-naleving.test.js zakte daarop: het woord "eigen bank" vraagt onder
   Wft 3:7 een bankvergunning zodra een platform het over ZICHZELF gebruikt.
   Hier ging het over de bank van het LID, wat die regel uitdrukkelijk toestaat
   -- maar een regex kan dat verschil niet zien, en een juridische grendel hoort
   niet losser gezet te worden omdat mijn zin toevallig onschuldig was. Het is
   nu "via je bank": even waar, en niet te verwarren.

   WAT HIER NIET IN ZIT: geen afschrijving, geen bestandsformaat (pain.008),
   geen incassant-ID. Dat komt pas als er een bankcontract is, en dan hoort het
   volledige rekeningnummer daar te liggen en niet hier. */
'use strict';

const regels = require('../machtiging');

const HUIS = 'De RTFoundation';
const FREQ = ['jaarlijks'];

module.exports = (ctx, { planVan, standVan }) => {
  const { nu, rid, schoon, S, audit, euro, save } = ctx;

  const M = () => {
    const s = S();
    if (!Array.isArray(s.giftmachtigingen)) s.giftmachtigingen = [];
    return s.giftmachtigingen;
  };

  const NIET = regels.nietGeind(HUIS);

  const bijPlan = planId => M().find(m => m.planId === String(planId || '') && m.actief) || null;

  function beeld(m) {
    if (!m) return null;
    return Object.assign(regels.publiek(m), { planId: m.planId,
      /* WAT DE BETALER MOET WETEN, en niet in een voetnoot. */
      stornoWeken: regels.STORNO_WEKEN,
      stornoOnterechtMaanden: regels.STORNO_ONTERECHT_MAANDEN,
      aankondigingDagen: regels.AANKONDIGING_DAGEN });
  }

  function mijn(codenaam) {
    const ik = schoon(codenaam, 40);
    if (!ik) return { status: 401, error: 'Hiervoor is een eigen RTG-account nodig.' };
    return Object.assign({ ok: true,
      machtigingen: M().filter(m => m.codenaam === ik).map(beeld) }, NIET);
  }

  /* Tekenen. De gever doet dit zelf; er is geen weg waarlangs het kantoor een
     machtiging namens iemand aanmaakt -- dat zou het woord "getekend" leeg
     maken. */
  function teken(codenaam, b) {
    b = b || {};
    const ik = schoon(codenaam, 40);
    if (!ik) return { status: 401, error: 'Hiervoor is een eigen RTG-account nodig.' };
    const g = standVan();
    if (g.stand !== 'open') return { status: 409, error: 'RTG neemt op dit moment geen giften aan.' };

    const plannen = planVan(ik);
    const plan = (plannen.plannen || []).find(p => p.id === String(b.planId || ''));
    if (!plan) return { status: 404, error: 'Dit plan bestaat niet, of het is niet van jou.' };
    if (plan.stand === 'gestopt') return { status: 409, error: 'Dit plan is gestopt; daar hoort geen machtiging bij.' };

    const k = regels.keur(b, { frequenties: FREQ, frequentie: 'jaarlijks' });
    if (!k.ok) return { status: k.status, error: k.error };

    /* GRENDEL 2: een maximum onder het jaarbedrag loopt gegarandeerd stuk, en
       dat merkt de gever pas bij de eerste incasso die weigert. */
    const jaarCenten = Math.round(Number(plan.euroPerJaar || 0) * 100);
    if (k.velden.maxCenten < jaarCenten) {
      return { status: 400,
        error: 'Het maximum (' + euro(k.velden.maxCenten) + ') ligt onder het jaarbedrag van dit plan (' +
          euro(jaarCenten) + '). Dan zou elke incasso weigeren.' };
    }

    const kenmerk = 'RTF-' + String(plan.id).slice(0, 6).toUpperCase() + '-' + String(M().length + 1).padStart(4, '0');
    /* GRENDEL 1 en regel 4 van ../machtiging.js: per PLAN, en een tweede
       vervangt de eerste van datzelfde plan. */
    const vervangen = regels.vervang(M(), o => o.planId === plan.id, kenmerk, nu());

    const m = Object.assign({ id: rid(), codenaam: ik, planId: plan.id, kenmerk,
      actief: true, at: nu() }, k.velden);
    if (!m.getekendOp) m.getekendOp = nu().slice(0, 10);
    M().push(m);
    audit(ik, 'giftmachtiging.getekend', m.id, kenmerk + ', max ' + euro(m.maxCenten));
    save();
    return Object.assign({ ok: true, machtiging: beeld(m), vervangen }, NIET,
      { zegt: [
        'Getekend onder kenmerk ' + kenmerk + '. Bewaar dat kenmerk: daarmee herken je de afschrijving op je rekening.',
        'Je krijgt elke termijn ' + regels.AANKONDIGING_DAGEN + ' dagen van tevoren bericht met het bedrag en de datum.',
        'Een afschrijving kun je tot ' + regels.STORNO_WEKEN + ' weken terug laten boeken via je bank, zonder opgaaf van reden.',
        'Er wordt nu niets afgeschreven: ' + NIET.uitleg
      ] });
  }

  /* GRENDEL 4: dit stopt de INCASSO en niet de gift. */
  function trekIn(codenaam, b) {
    b = b || {};
    const ik = schoon(codenaam, 40);
    const m = M().find(x => x.id === String(b.id || ''));
    if (!m) return { status: 404, error: 'Deze machtiging bestaat niet.' };
    if (!ik || m.codenaam !== ik) return { status: 403, error: 'Deze machtiging is niet van jou.' };
    if (!m.actief) return { status: 409, error: 'Deze machtiging is al ingetrokken.' };
    m.actief = false;
    m.ingetrokkenAt = nu();
    m.ingetrokkenDoor = ik;
    audit(ik, 'giftmachtiging.ingetrokken', m.id, m.kenmerk);
    save();
    return Object.assign({ ok: true, machtiging: beeld(m) }, NIET, { zegt: [
      'De machtiging is ingetrokken. Vanaf nu wordt er niets meer van je rekening gehaald.',
      'Je periodieke gift loopt hiermee NIET af. Wat je hebt toegezegd blijft staan; je kunt elke termijn zelf overmaken. Wil je de afspraak zelf beëindigen, stop dan het plan.',
      'Een afschrijving van de afgelopen ' + regels.STORNO_WEKEN + ' weken kun je bij je bank laten terugboeken.'
    ] });
  }

  /* GRENDEL 5: het plan stopt, dus de volmacht vervalt. Wordt aangeroepen door
     ./gift-periodiek.js. */
  function bijPlanGestopt(planId, door) {
    const weg = regels.vervang(M(), o => o.planId === String(planId || ''), 'het gestopte plan', nu());
    if (weg.length) { audit(schoon(door, 40) || 'systeem', 'giftmachtiging.vervallen', String(planId), weg.join(', ')); save(); }
    return weg;
  }

  /* De aankondiging die vooruit hoort te gaan. Hij wordt KLAARGEZET en niet
     verstuurd: versturen raakt een mens, en dat bevestigt de stichting. */
  function aankondiging(planId) {
    const m = bijPlan(planId);
    if (!m) return { ok: true, machtiging: null,
      uitleg: 'Voor dit plan staat geen machtiging; elke termijn bevestigt de gever zelf.' };
    return Object.assign({ ok: true, kenmerk: m.kenmerk, maxEuro: euro(m.maxCenten),
      dagenVooraf: regels.AANKONDIGING_DAGEN,
      tekst: 'Over ' + regels.AANKONDIGING_DAGEN + ' dagen zou de termijn van dit jaar worden afgeschreven onder kenmerk ' +
        m.kenmerk + ', van de rekening die eindigt op ' + m.ibanEinde + '.' }, NIET);
  }

  return { mijn, teken, trekIn, bijPlanGestopt, aankondiging, bijPlan, beeld, FREQ };
};
