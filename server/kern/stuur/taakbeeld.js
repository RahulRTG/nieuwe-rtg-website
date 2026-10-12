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
/* De trede komt uit de schaal van het beleid en wordt niet overgetypt. */
const { NIVEAUS } = require('./beleid');

const MAX_TEKST = 200;

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
    const boven = !s.bezwaar && s.niveau !== NIVEAUS.verboden && plafond && typeof plafond.mag === 'function' && !plafond.mag(s.capability);
    if (boven) s = Object.assign({}, s, { bezwaar: 'deze vraag mag alleen ' + (plafond.trede || 'tonen') + '; dit klaarzetten vraagt een ruimer plafond' });
    const geblokkeerd = s.niveau === NIVEAUS.verboden || !!s.bezwaar;
    const na = per.get(s.capability) || null;
    return {
      id: tekst(s.id), capability: tekst(s.capability),
      uitkomst: { tekst: tekst(s.uitkomst), herkomst: 'model' },
      staat: na ? na.uitkomst : geblokkeerd ? 'GEBLOKKEERD' : 'BESCHIKBAAR',
      waarom: geblokkeerd ? tekst(s.bezwaar || s.waarom || 'deze capability bestaat niet voor deze rol') : null,
      bevestiging: !geblokkeerd && s.bevestigingNodig ? 'mens' : null
    };
  });
  return {
    doel: { tekst: tekst(plan.doel), herkomst: 'model' },
    uitvoerbaar: !!plan.uitvoerbaar,
    samenvatting: tekst(plan.samenvatting),
    bezwaren: (plan.bezwaren || []).map((b) => tekst(b.reden)).filter(Boolean),
    stappen
  };
}

/* `acties` is wat de stuurlus teruggaf; het laatste gewogen plan erin wordt
   getoond. `vraag` en `scherm` zijn wat Rahul begreep: de vraag van de mens en
   de schermregel die de server afleidde (of null). */
function taakBeeld({ vraag, scherm, acties, plafond }) {
  const per = uitkomsten(acties);
  const plannen = (acties || []).filter((a) => a && a.pad === 'plan' && a.plan);
  const plan = planBeeld(plannen.length ? plannen[plannen.length - 1].plan : null, per, plafond);
  const lijst = [...per.values()];
  const uitgevoerd = lijst.filter((u) => u.uitkomst === 'UITGEVOERD');
  return {
    begrepen: { vraag: tekst(vraag), scherm: scherm ? tekst(scherm) : null },
    plan,
    uitgevoerd,
    wachtOpBevestiging: lijst.filter((u) => u.uitkomst === 'WACHT').map((u) => u.pad),
    geweigerd: lijst.filter((u) => u.uitkomst === 'GEWEIGERD').map((u) => u.pad),
    grens: uitgevoerd.length
      ? 'Alleen wat onder "uitgevoerd" staat is gebeurd; de rest is een voorstel.'
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

module.exports = { taakBeeld, uitkomsten, eindtekst };
