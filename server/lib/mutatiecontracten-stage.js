/* De zes routes van de publieke laag (STAGE.md par. 5a): de volgrelatie op een
   publieke aanwezigheid, en de redactiehandeling van De Salon.

   Alle zes zijn gelezen en beproefd in test/aanwezigheid.test.js; wat daar per
   route bewezen is, staat hieronder in `bewijs`. De twee die geen contract
   vanzelf spreken zijn de laatste twee, en hun stand is met opzet `PROTECTED`
   en niet `idempotent`: een tweede uitlichting wordt GEWEIGERD (409), en dat is
   een toestandscontrole en geen idempotentie -- MUTATIECONTRACT.md zegt met
   zoveel woorden dat die twee niet hetzelfde zijn. `hooguitEens` is daarvoor het
   juiste woord uit kern/mutatie.js. */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), handler per route geschreven en beproefd; niet door een mens nagelezen',
  op: '2026-09-13'
};
const BEWIJS = (wat) => ({ gemeten: 'test/aanwezigheid.test.js: ' + wat, op: '2026-09-13' });

module.exports = { CONTRACTEN: {
  /* Volgen zet een vlag. Tweede oproep met dezelfde waarde verandert niets -- de
     lijst bevat de id al, en er komt geen tweede regel bij. */
  'POST /api/mediaos/aanwezig/volg': {
    mutatieId: 'mediaos.aanwezig.volg', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
    bewijs: BEWIJS('toets 3 volgt twee keer en meet een volger; ontvolgen laat er nul over'),
    afgetekend: AFGETEKEND
  },
  /* Twee leesroutes. Ze staan hier omdat elke POST als schrijfroute telt, en
     niet omdat ze iets veranderen. */
  'POST /api/mediaos/aanwezig/mijn': {
    mutatieId: 'mediaos.aanwezig.mijn', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'node scripts/idemproef-route.js --pad=/api/mediaos/aanwezig: opslag a/b/c alle drie leeg, ' +
      'dus geen enkele gemeten collectie beweegt -- niet bij de eerste oproep en niet bij de herhaling', op: '2026-09-13' },
    nagekeken: 'Claude, 2026-09-13: leest db.data.mediaVolgt en schrijft niets; de handler roept alleen aanwezigMijn(). '
      + 'De opslagmeter dekt geen bestand of externe aanroep; die twee zijn hier gelezen en er zijn er geen.',
    afgetekend: AFGETEKEND
  },
  /* DEZE STAAT BEWUST NIET OP NOT_APPLICABLE, en het verschil is een meting.
     Bij lezen is hij dat net zo goed als zijn buurman hierboven -- met(), beeld()
     en volgtHij() in kern/mediaos/aanwezigheid.js raken niets aan. Maar de
     keuring eist bij die stand een METING en niet een mens die de handler las, en
     die meting is er niet: de idempotentieproef komt hier op 404 uit omdat zijn
     wereld geen aanwezigheid kent om op te vragen. "Ongemeten" is dan geen
     NOT_APPLICABLE met een net gezicht -- dat is precies wat deze stand
     tegenhoudt. */
  'POST /api/mediaos/aanwezig': {
    mutatieId: 'mediaos.aanwezig.een', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'BLOCKED_BY_TEST_FIXTURE',
    watErMoetKomen: 'De idempotentieproef heeft een BESTAANDE aanwezigheid nodig; zonder geldige `id` geeft de route '
      + '404 en meet de proef niets. Nodig is een aanwezigheid in de zaaiset van scripts/lib/idemwereld.js (een lid '
      + 'met een uitgelichte post levert er een op, zie test/aanwezigheid-routes.e2e.js). Daarna kan deze stand naar '
      + 'NOT_APPLICABLE, met de opslaguitslag als bewijs.',
    nagekeken: 'Claude, 2026-09-13: handler gelezen -- met(), aanwezigBeeld() en aanwezigVolgtHij() lezen alleen. '
      + 'Dat is een lezing en geen meting, en daarom staat de stand hier lager.',
    afgetekend: AFGETEKEND
  },
  /* Het redactiebord leest, maar het projecteert ook: een uitlichting waarvan de
     looptijd om is, valt hier van `featured`. Dat CONVERGEERT -- tweemaal
     projecteren geeft dezelfde uitkomst -- dus idempotent en geen tweede
     handeling. */
  'POST /api/office/salon/uitlicht/bord': {
    mutatieId: 'salon.uitlicht.bord', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
    bewijs: BEWIJS('toets 9: projecteren van een verlopen uitlichting haalt featured weg en laat de handeling staan'),
    afgetekend: AFGETEKEND
  },
  /* De twee handelingen zelf. Hooguit een keer, afgedwongen door een
     toestandscontrole: een tweede uitlichting van dezelfde post geeft 409 en er
     komt geen tweede regel in het register. */
  'POST /api/office/salon/uitlicht': {
    mutatieId: 'salon.uitlicht', herkomst: 'mens',
    semantiek: { klasse: 'hooguitEens' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
    bewijs: BEWIJS('toets 8: de tweede uitlichting van dezelfde post geeft 409 en het register houdt een regel'),
    afgetekend: AFGETEKEND
  },
  'POST /api/office/salon/uitlicht/intrek': {
    mutatieId: 'salon.uitlicht.intrek', herkomst: 'mens',
    semantiek: { klasse: 'hooguitEens' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
    bewijs: BEWIJS('toets 10: intrekken vraagt naam en reden; daarna loopt er geen uitlichting meer, dus een tweede oproep vindt niets'),
    afgetekend: AFGETEKEND
  }
} };
