/* HET TAAKBEELD -- wat de Edge laat zien van een beurt van Rahul aan het stuur:
   wat hij begreep, wat hij voorstelt, wat geblokkeerd is, wat een mens moet
   bevestigen en wat er WERKELIJK is gebeurd (EDGE.md par. 14.4, stap 2).

   EEN MODEL MAG HIER GEEN STAND VERZINNEN, en dat is de hele reden van dit
   bestand. Elke stand komt uit een van twee serverbronnen:

     het gewogen plan   ./plan.js -- per stap het oordeel van beleidVoor(), LIVE;
                        verboden is GEBLOKKEERD met de reden, voorstel vraagt een
                        mens. Wat het MODEL aanleverde (het doel, de bedoelde
                        uitkomst per stap) staat er met `herkomst: 'model'` bij
                        en draagt nooit een stand.
     de uitvoeringen    wat stuurRoep werkelijk teruggaf (./lusstap.js): een
                        2xx zonder voorstel is uitgevoerd, een 428 met een
                        goedkeuring wacht op een mens, al het andere is
                        geweigerd. Het plan zelf (`pad: 'plan'`) is NOOIT een
                        uitvoering.

   DAT LAATSTE WAS EEN ECHT GEBREK. De route zette `gedaan` op "er is een actie
   met een status onder de 400", en het gewogen plan staat in die lijst met 200.
   Een plan dat niets had aangeraakt, liet de app dus "Rahul heeft het geregeld"
   zeggen. `uitgevoerd` hieronder is de enige bron voor `gedaan`.

   DE STANDEN ZIJN DIE VAN shared/edge/actiestaat.js (GEBLOKKEERD, BESCHIKBAAR)
   plus twee uitkomsten die alleen na een aanroep bestaan (UITGEVOERD, WACHT).
   Er komt geen standmachine bij: een stap verandert hier niet van stand, het
   beeld wordt per beurt opnieuw uit de bronnen afgeleid. */
'use strict';

const MAX_TEKST = 200;

/* WAT EEN MENS LEEST, NAAST WAT HET SYSTEEM BESLOOT. `waarom` blijft de reden
   van het beleid of het plafond, woordelijk -- dat is diagnose, en hij reist in
   het antwoord mee voor wie het nakijkt. `voorMens` is dezelfde grens in de
   woorden van een lid: "staat niet op de expliciete AI-allowlist" zegt een lid
   niets, maar betekent dat Rahul dit niet voor hem doet. Er wordt geen grens
   verzacht: elke vertaling zegt wat er NIET gebeurt. */
const VOOR_MENS = Object.freeze({
  plafond: 'Dit kan ik voor u voorbereiden, maar niet zelf indienen of uitvoeren.',
  beleid: 'Dit kan Rahul niet voor u doen; u kunt het zelf in de app.',
  anders: 'Dit kan nu niet.'
});

function tekst(x) {
  return String(x == null ? '' : x).replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEKST);
}

/* Wat stuurRoep teruggaf, per pad. Een pad kan vaker voorkomen; de laatste telt,
   want die zag de mens als laatste. */
function uitkomsten(acties) {
  const per = new Map();
  for (const a of acties || []) {
    if (!a || !a.pad || a.pad === 'plan') continue;
    const st = typeof a.status === 'number' ? a.status : null;
    const uitkomst = a.goedkeuring ? 'WACHT'
      : (st !== null && st >= 200 && st < 300) ? 'UITGEVOERD'
      : 'GEWEIGERD';
    per.set(a.pad, { pad: a.pad, status: st, uitkomst });
  }
  return per;
}

/* `plafond` is de grendel van DEZE vraag (./plafond.js): wat de vraagbalk met
   `tonen` stelt, mag geen voorstel klaarzetten. Een stap die het beleid kent
   maar die de grendel tegenhoudt, is voor deze vraag geblokkeerd -- anders
   toont de Edge "beschikbaar" waar de server bij `doe` zou weigeren. */
function planBeeld(plan, per, plafond) {
  if (!plan) return null;
  const stappen = (plan.stappen || []).map((s) => {
    const boven = !s.bezwaar && s.niveau !== 'verboden' && plafond && typeof plafond.mag === 'function' && !plafond.mag(s.capability);
    if (boven) s = Object.assign({}, s, { bezwaar: 'deze vraag mag alleen ' + (plafond.trede || 'tonen') + '; dit klaarzetten vraagt een ruimer plafond' });
    const geblokkeerd = s.niveau === 'verboden' || !!s.bezwaar;
    const soort = boven ? 'plafond' : s.niveau === 'verboden' ? 'beleid' : 'anders';
    const na = per.get(s.capability) || null;
    return {
      id: tekst(s.id), capability: tekst(s.capability),
      uitkomst: { tekst: tekst(s.uitkomst), herkomst: 'model' },
      staat: na ? na.uitkomst : geblokkeerd ? 'GEBLOKKEERD' : 'BESCHIKBAAR',
      waarom: geblokkeerd ? tekst(s.bezwaar || s.waarom || 'deze capability bestaat niet voor deze rol') : null,
      voorMens: geblokkeerd ? VOOR_MENS[soort] : null,
      bevestiging: !geblokkeerd && s.bevestigingNodig ? 'mens' : null
    };
  });
  return {
    doel: { tekst: tekst(plan.doel), herkomst: 'model' },
    uitvoerbaar: !!plan.uitvoerbaar,
    samenvatting: tekst(plan.samenvatting),
    bezwaren: (plan.bezwaren || []).map((b) => tekst(b.reden)).filter(Boolean),
    nietUitvoerbaarVoorMens: plan.uitvoerbaar ? null : 'Zo kan dit plan niet in zijn geheel; de geblokkeerde stappen hieronder zeggen waarom.',
    stappen
  };
}

/* `acties` is wat de stuurlus teruggaf; het laatste gewogen plan erin wordt
   getoond. `vraag` en `sch` zijn wat Rahul begreep: de vraag van de mens en wat
   kern/stuur/menscontext-opzoek.js van het scherm maakte. Voor de mens telt het
   ONDERWERP (welk object, als de vraag er over gaat); de technische schermregel
   gaat alleen mee als diagnose. `concept` is een voorbereiding die een domein
   herkende (bijvoorbeeld een reiswens) en die nergens is ingediend. */
function taakBeeld({ vraag, sch, acties, plafond, concept }) {
  const per = uitkomsten(acties);
  const plannen = (acties || []).filter((a) => a && a.pad === 'plan' && a.plan);
  const plan = planBeeld(plannen.length ? plannen[plannen.length - 1].plan : null, per, plafond);
  const lijst = [...per.values()];
  const uitgevoerd = lijst.filter((u) => u.uitkomst === 'UITGEVOERD');
  return {
    begrepen: { vraag: tekst(vraag), onderwerp: sch && sch.onderwerp ? tekst(sch.onderwerp) : null,
      relatie: (sch && sch.relatie) || null },
    diagnose: { scherm: sch && sch.scherm ? tekst(sch.scherm.regel) : null, relatieReden: (sch && sch.reden) || null },
    concept: concept || null,
    plan,
    uitgevoerd,
    wachtOpBevestiging: lijst.filter((u) => u.uitkomst === 'WACHT').map((u) => u.pad),
    geweigerd: lijst.filter((u) => u.uitkomst === 'GEWEIGERD').map((u) => u.pad),
    grens: uitgevoerd.length
      ? 'Alleen wat als uitgevoerd is gemarkeerd, is gebeurd; de rest is een voorstel.'
      : concept ? 'Er is niets ingediend, geboekt of betaald. Dit is een voorbereiding.'
      : 'Er is niets uitgevoerd. Wat hier staat is een voorstel van Rahul, gewogen door RTG.'
  };
}

/* DE EINDTEKST VAN EEN LUS ZONDER WOORDEN VAN HET MODEL. Hier stond in
   ./lus.js en ./lus-zwaar.js `tekst || 'Gedaan.'`: een leeg antwoord werd
   "Gedaan." ook als er niets was gedaan. Nu alleen als stuurRoep echt iets
   uitvoerde; anders blijft het leeg, en dan antwoordt het gesprek. */
function eindtekst(tekst, acties) {
  if (tekst) return tekst;
  return [...uitkomsten(acties).values()].some((u) => u.uitkomst === 'UITGEVOERD') ? 'Gedaan.' : '';
}

module.exports = { taakBeeld, uitkomsten, eindtekst, VOOR_MENS };
