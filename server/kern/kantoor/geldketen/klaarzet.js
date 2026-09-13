/* KLAARZETTEN -- de hele baan tot en met het besluit, en met opzet niet verder.

   AFGESPLITST VAN ../geldketen.js op de naad die GELD.md trekt: geld wordt
   KLAARGEZET en een mens voert uit. Dit bestand is de eerste helft; tekenen en
   uitvoeren staan in de module ernaast, want dat zijn menselijke daden en dit is
   voorbereiding.

   ELKE AS LEGT ZIJN UITSLAG VAST, OOK ALS DIE "NEE" IS. Een as zonder reden wordt
   binnen een jaar een vinkje, en een as die wordt overgeslagen omdat het antwoord
   voorspelbaar is, is precies hoe een grens verdwijnt.
*/
'use strict';

const envelopLaag = require('../../envelop');
const mandaatLaag = require('../../stuur/mandaat');
const gevolgLaag = require('../../stuur/gevolg');
const { KLASSEN } = require('./klassen');

function maakKlaarzet({ voornemens, frictie, mandaatBron, tijd, leg, noteer, bewaar, publiek }) {
  const weeg = require('./weging').maakWeging({ voornemens, tijd, leg, noteer, bewaar, publiek });

  function klaarzet(opgave) {
    const o = opgave || {};
    const klasse = KLASSEN[o.klasse] ? o.klasse : null;
    if (!klasse) return { status: 400, error: 'Een geldhandeling hoort bij een handelingsklasse; "' + o.klasse + '" is er geen.' };
    if (!voornemens) return { status: 503, error: 'De voornemenslaag is niet gemount; er wordt niets klaargezet.' };

    /* 1. MENSBEWIJS. De deur heeft het al gedaan (kluisAuth), hier wordt het
          VASTGELEGD -- en zonder naam gaat er niets verder. Een spoor dat eindigt
          bij een gedeelde code is een alibi. */
    const mens = o.mens && o.mens.naam ? { naam: String(o.mens.naam).slice(0, 60), sleutel: o.mens.sleutel || null } : null;
    if (!mens) return { status: 403, error: 'Deze handeling vraagt een mens op naam; met de gedeelde kantoorcode is er niemand die dit klaarzet.' };

    /* 2. ASSURANCE. De route levert de uitslag van kern/zwaarbewijs.js aan. Hij
          MOET er zijn: een baan die zelf mag beslissen dat een passkey niet nodig
          was, is geen baan. `bewezen: false` (een account zonder passkey) gaat
          door en staat als zodanig in het dossier -- dat is de bestaande
          terugval, hier zichtbaar in plaats van onzichtbaar. */
    if (!o.assurance || o.assurance.ok !== true)
      return { status: 401, error: 'De zekerheid over wie dit doet is niet vastgesteld; bevestig deze handeling eerst.' };

    const env = envelopLaag.alsStart(envelopLaag.maak({
      kanaal: 'office', actor: mens.sleutel || null, classificatie: 'intern' }));

    const dossier = {
      voornemen: null, keten: null, klasse, handeling: String(o.handeling || ''),
      doel: o.doel == null ? null : String(o.doel).slice(0, 120),
      pad: o.pad || null, envelop: env.id, correlatie: env.correlatie,
      door: mens.naam, at: tijd(), assen: []
    };

    leg(dossier, 'mensbewijs', { graad: 'gemeten', uitslag: 'mens op naam', wie: mens.naam,
      reden: 'de deur eiste een bewezen mens (kern/kantoor/kluispoort.js) en niet de gedeelde kantoorcode' });
    leg(dossier, 'assurance', { graad: o.assurance.bewezen ? 'bewezen' : 'vermoed',
      uitslag: o.assurance.bewezen ? 'met passkey bevestigd' : 'doorgelaten op de terugval',
      reden: o.assurance.bewezen
        ? 'kern/zwaarbewijs.js heeft de ceremonie geverifieerd'
        : 'dit account heeft geen passkey; kern/zwaarbewijs.js laat door en meldt het aan de beveiliging' });

    /* 3. HET MANDAAT. Niet om toestemming, maar om de grens -- en het antwoord is
          hier altijd nee. Zie de kop: een as die "nee" antwoordt doet mee. */
    /* HET MANDAAT MET EEN HYPOTHETISCH MAXIMAAL MANDAAT, en dat is het verschil
       tussen de grens raken en een gratis nee. Zou deze baan met `null` vragen,
       dan antwoordt kern/stuur/mandaat.js "er is geen mandaat, leeg is dicht" --
       waar en nietszeggend: die uitslag komt ook voor een handeling die wel
       autonoom mag. Door te vragen met een mandaat dat DEZE handeling volledig
       dekt, komt het antwoord uit de grens zelf: geld staat in NOOIT_AUTONOOM, en
       een pad dat niet in de AI-lijst staat heeft geen vermogen om te versmallen. */
    const magZelf = mandaatBron
      ? mandaatBron({ pad: o.pad, handeling: o.handeling })
      : mandaatLaag.magZelfstandig(o.pad || '', 'staff', { capabilities: [String(o.pad || '')], budget: {} });
    leg(dossier, 'mandaat', { graad: 'gemeten', uitslag: magZelf && magZelf.mag ? 'zelfstandig toegestaan' : 'niet zelfstandig',
      reden: (magZelf && magZelf.reden) || 'geen mandaat geeft autonomie op een geldhandeling; een mens voert uit' });
    if (magZelf && magZelf.mag)
      return { status: 500, error: 'Het mandaat zegt dat deze geldhandeling zelfstandig mag. Dat hoort niet te kunnen; ' +
        'kern/stuur/mandaat.js noemt geld in NOOIT_AUTONOOM. Er gaat niets verder tot dit is uitgezocht.' };

    /* 4. DE STREEFSTAND. Wat moet er na deze handeling waar zijn? Dit is geen
          `doel` in de zin van kern/doelen.js (een levensdoel) of
          kern/identiteit/doelen.js (doelbinding) -- vandaar de eigen naam. */
    if (!o.streefstand) return { status: 400, error: 'Een geldhandeling hoort te zeggen wat er daarna waar moet zijn.' };
    leg(dossier, 'streefstand', { graad: 'gemeten', uitslag: String(o.streefstand).slice(0, 200),
      reden: 'de aanvrager heeft uitgeschreven wat deze handeling waar moet maken' });

    /* 5. HET TEGENFEIT. Door het domein aangeleverd: alleen het domein weet wat
          "wat zou dit doen" betekent. Het draagt zijn eigen grens mee. */
    if (!o.tegenfeit) return { status: 400, error: 'Een geldhandeling hoort te zeggen wat zij zou doen voordat zij het doet.' };
    /* DE GRAAD VAN DE AS EN DE GRAAD VAN HET GETAL ZIJN TWEE DINGEN, en dat
       verschil is hier duur betaald. Eerst stond de graad van het TEGENFEIT op de
       as, en daarmee kon deze as nooit gehaald worden: een vooruitblik op een
       incassoronde is per definitie een bovengrens (`vermoed`), dus de keten was
       onhaalbaar gemaakt door een eigenschap van het getal. De as gaat over de
       vraag of er VOORAF is uitgerekend wat de handeling zou doen -- dat is
       gebeurd of niet. Hoe hard het getal is, staat ernaast in `uitslagGraad`. */
    leg(dossier, 'tegenfeit', { graad: 'gemeten', uitslag: o.tegenfeit.uitslag,
      uitslagGraad: o.tegenfeit.graad || 'vermoed',
      reden: o.tegenfeit.reden || 'het domein heeft vooraf uitgerekend wat deze handeling zou doen' });

    /* 6. FRICTIE. Hoeveel mens heeft dit NU nodig? De opbouw gaat mee: een cijfer
          zonder opbouw is een orakel. */
    /* De frictiemotor mag LUI worden meegegeven: hij wordt in een latere laag
       gebouwd dan deze baan (kern/command bouwt hem met het beleidsregister
       erachter), en een baan die bij het bedraden een motor eist die er dan nog
       niet is, zou zichzelf uit de lucht halen. Resolveert hij bij het verzoek
       alsnog niet, dan staat dat als `onbekend` in het dossier -- en dan is de
       keten niet rond. */
    const fmotor = typeof frictie === 'function' ? frictie() : frictie;
    if (fmotor && typeof fmotor.beoordeel === 'function') {
      const f = fmotor.beoordeel(o.handeling, { pad: o.pad, centen: o.totaalCenten || 0, actor: 'staff' });
      leg(dossier, 'frictie', { graad: 'gemeten', uitslag: f.niveau, vierOgen: !!f.vierOgen,
        opbouw: f.opbouw || null, reden: 'kern/frictie heeft deze handeling gewogen' });
    } else {
      leg(dossier, 'frictie', { graad: 'onbekend', uitslag: null,
        reden: 'de frictiemotor is niet gemount; er is niet gewogen hoeveel mens dit nodig heeft' });
    }

    /* 7. HET GEVOLG. Wat raakt deze route werkelijk aan -- gemeten, niet aangenomen.
          `onbekend` is hier geen nul: het betekent dat niemand heeft gekeken. */
    const g = gevolgLaag.gevolgVan(o.pad || '');
    leg(dossier, 'gevolg', { graad: g.graad, uitslag: g.collecties, reden: g.reden });

    /* En dan het plan wegen: zie ./weging.js. */
    return weeg(o, dossier, env, klasse, mens);
  }

  return klaarzet;
}

module.exports = { maakKlaarzet };
