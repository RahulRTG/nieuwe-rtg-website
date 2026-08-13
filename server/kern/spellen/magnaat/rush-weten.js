/* Magnaat: WAT EEN PLOEG WEET -- de leeskant van de werkvloer.

   Afgesplitst van ./rush-acties.js op een echte naad, en de 10 kB-grens dwong
   hem op precies het goede moment af: dat bestand gaat over wat je DOET op een
   dienst (kijken, oppakken, doorgeven) en dit over wat je WEET als je binnenkomt.
   Twee onderwerpen met een verschillend tempo -- de lijst handelingen ligt vast
   zodra de laag af is, wat een ploeg mag weten groeit met elke rol mee. Dezelfde
   scheiding als ./dienst-acties.js tegenover ./dienst-beeld.js. */
'use strict';

const R = require('./rush');
const D = require('./dienst');
const STORING = require('./storing');
const OVER = require('./overdracht');

/* WAT JIJ WEET ALS JE BINNENKOMT -- en dat is met opzet niet alles.

   DE WET STAAT IN ./overdracht.js: de wereld weet wat waar is, een ploeg weet
   alleen wat zij kan ZIEN of wat aan haar is OVERGEDRAGEN. Hier valt die wet
   uiteen in de twee stroken die een dienst opent:

     waargenomen  wat er anders staat dan toen jij wegging. Zonder naam en
                  zonder bedrag, want dat is precies wat je met eigen ogen ziet:
                  de noodkoeling draait, de capaciteit is lager.
     overgedragen wat iemand BEWUST heeft achtergelaten, met zijn naam erbij --
                  want hij koos ervoor het je te vertellen.

   HIER STOND EEN LEK, en dat is de reden dat deze functie is omgebouwd. De
   eerste versie las rechtstreeks uit de AUDIT (./storing-keten.js): de vakkracht
   kreeg de codenaam van zijn eigenaar te zien en het bedrag van de
   maandrekening. Dat is tweemaal fout -- een werknemer heeft niets te maken met
   wat zijn werkgever uitgaf, en als iedereen de audit kan lezen verdwijnt alle
   menselijke frictie en is iedereen alwetend. De audit blijft waar hij hoort: op
   het scherm van wie de zaak bestuurt.

   HET IS EEN MEDEDELING EN GEEN TAAK. Er staat geen knop bij en er verandert
   geen getal; wie hem niet leest is niets kwijt. Zou hij een lijstje worden dat
   je moet afvinken, dan is het geen overdracht maar werk. */
const OVERDRACHT_MAX = 4;

/* Sinds je vorige dienst, en bij je eerste sinds je aantreden. Anders krijgt
   iemand op zijn eerste avond de hele geschiedenis van de zaak als nieuws. */
function sindsJij(d) {
  const gehad = d.diensten || [];
  return gehad.length ? Math.max(...gehad.map(x => x.maand)) : (d.sinds || 0);
}

function watIkWeet(d, v, h, naam) {
  const vorige = sindsJij(d);
  /* OP JE EERSTE AVOND IS ALLES NIEUW. Je loopt binnen, de noodkoeling draait,
     en niemand heeft je verteld waarom -- precies de situatie waar deze laag
     over gaat. Zou hier alleen "veranderd sinds je vorige dienst" staan, dan
     ziet juist de nieuwe kracht als enige niets. */
  const eerste = !(d.diensten || []).length;
  const nu = STORING.openstaand(v);
  return {
    /* WAARGENOMEN. Uit de STAND van de wereld en nergens anders: een storing
       waarvan de stand is verzet nadat jij wegging, staat er nu anders bij dan
       je hem achterliet. Een die intussen gerepareerd is, staat er domweg niet
       meer -- en die afwezigheid IS de waarneming. Er wordt hier niets
       gereconstrueerd uit een logboek, want dan is het geen waarneming. */
    gezien: nu.filter(s => eerste || s.sindsStand > vorige).map(s => ({
      naam: (STORING.SOORTEN[s.soort] || {}).naam || s.soort, staat: s.staat,
      /* EN OF ER UITLEG BIJ IS. Dit is het hele verschil tussen "de noodkoeling
         draait, en ik weet waarom" en "de noodkoeling draait, en niemand weet
         waarom". Het tweede kost de zaak elke maand arbeidstijd. */
      uitgelegd: !OVER.onwetend(v, s) })),
    /* OVERGEDRAGEN. Wat iemand bewust heeft achtergelaten, en alleen als het bij
       de HUIDIGE stand hoort -- een uitleg over een noodkoeling die inmiddels
       gemaakt is, is ruis. */
    gekregen: OVER.voor(v, nu, vorige, h).slice(-OVERDRACHT_MAX).map(o => ({
      maand: o.maand, wie: naam(o.wie), rol: (D.ROLLEN[o.rol] || {}).naam || o.rol,
      deed: o.deed, staat: o.staat }))
  };
}

/* WAT ER VAN JOUW DIENST OVER TE DRAGEN VALT: wat JIJ vanavond hebt verzet en
   waarvan de volgende ploeg morgen niet kan zien waarom.

   HIJ LEEST `s.gedaan` EN NIET DE STORING, en dat is geen omweg. Wat je op je
   dienst besluit wordt pas op de MAAND een stand (./rush-maand.js), dus de
   koeling staat tijdens je avond nog precies zoals je hem aantrof. Zou deze
   functie daarnaar kijken, dan is er nooit iets over te dragen op de avond
   waarop het ertoe doet.

   Is de lijst leeg, dan valt er niets door te geven en hoort er geen knop te
   staan -- een knop die niets doet leert de speler dat knoppen niets doen. */
function overTeDragen(v, s) {
  return (s.gedaan || []).map(g => {
    const bron = R.SOORTEN.find(b => b.id === g.id);
    if (!bron || !bron.storing) return null;
    const optie = (bron.opties || []).find(o => o.id === g.optie);
    if (!optie || !OVER.VRAAGT_OVERDRACHT.includes(optie.staat)) return null;
    // al doorgegeven deze avond: een tweede keer voegt niets toe en kost wel
    if (OVER.lijst(v).some(o => o.soort === bron.storing && o.maand >= s.maand)) return null;
    return { soort: bron.storing, staat: optie.staat, deed: optie.deed,
      naam: (STORING.SOORTEN[bron.storing] || {}).naam || bron.storing };
  }).filter(Boolean);
}

module.exports = { OVERDRACHT_MAX, watIkWeet, overTeDragen };
