/* De zes routes van de publieke laag (STAGE.md par. 5a): de volgrelatie op een
   publieke aanwezigheid, en de redactiehandeling van De Salon.

   Alle zes zijn gelezen en beproefd in test/aanwezigheid.test.js; wat daar per
   route bewezen is, staat hieronder in `bewijs`.

   EN NOT_APPLICABLE VRAAGT ER TWEE, GEEN VAN BEIDE IN PLAATS VAN DE ANDERE. De eerste versie van deze twee
   leesroutes droeg alleen `nagekeken` en geen `bewijs`; de reparatie daarna
   verving het ene door het andere en ruilde zo de ene fout voor de andere.

   Ze zeggen namelijk iets ANDERS, en allebei is het nodig. `bewijs.gemeten` +
   `bewijs.op` is wat de MACHINE zag. `nagekeken` is wie het gat sloot dat de
   opslagmeter structureel niet kan zien: die kijkt alleen naar collecties in de
   database, en een bestand, een externe dienst of een teller daarbuiten ontgaat
   hem. Een leesroute die "schrijft niets" beweert, leunt precies op dat blinde
   stuk -- dus moet er een mens bij staan die de handler heeft gelezen. De twee die geen contract
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
    bewijs: BEWIJS('leest db.data.mediaVolgt en schrijft niets; de handler roept alleen aanwezigMijn() aan'),
    nagekeken: 'Claude, 2026-09-13: de handler las ik regel voor regel -- hij roept alleen aanwezigMijn() aan, die uitsluitend leest. Geen bestand, geen externe dienst, geen teller buiten de database.',
    afgetekend: AFGETEKEND
  },
  'POST /api/mediaos/aanwezig': {
    mutatieId: 'mediaos.aanwezig.een', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'NOT_APPLICABLE',
    bewijs: BEWIJS('leest een aanwezigheid plus of dit lid hem volgt, en schrijft niets'),
    nagekeken: 'Claude, 2026-09-13: de handler las ik regel voor regel -- aanwezigMet() en aanwezigVolgtHij(), allebei lezend. Geen bestand, geen externe dienst, geen teller buiten de database.',
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
