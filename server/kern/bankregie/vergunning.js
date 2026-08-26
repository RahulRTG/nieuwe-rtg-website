/* Bankregie, deel "vergunning": wat er is VASTGELEGD over wat RTG zelf mag, en
   welke partnerrails meedraaien. Bewust naast de drie-standen-knop en niet
   erin: de knop is een BESLUIT (wat willen we clearen), dit is een REGISTRATIE
   (wat is er afgegeven). Wie die twee door elkaar haalt, kan zichzelf een
   vergunning geven door een schakelaar om te zetten.

   Wat hier staat wordt gelezen door kern/bevoegdheid.js, dat er de vraag "mag
   deze handeling" mee beantwoordt. Leeg betekent nee. Krijgt de gedeelde ctx
   van kern/bankregie/index.js. */
'use strict';

const BEV = require('../bevoegdheid');

module.exports = (ctx) => {
  const { d, save } = ctx;

  const vergunning = () => (d().vergunning ? { ...d().vergunning } : null);
  const partnerRails = () => ({ ...d().partnerRails });

  /* De vergunning vastleggen. Dit is een REGISTRATIE en geen besluit: hier komt
     te staan wat er in werkelijkheid is afgegeven, zodat kern/bevoegdheid.js
     ernaar kan kijken. Vandaar dat een lege soort hem juist wist -- "we hebben
     hem niet meer" moet net zo makkelijk vast te leggen zijn als "we hebben hem
     wel", anders blijft een ingetrokken vergunning staan omdat weghalen
     omslachtiger is dan laten staan. */
  function vergunningZet({ soort, nummer, entiteit, landen, tot, wie }) {
    if (!soort) { d().vergunning = null; save(); return { ok: true, vergunning: null, wie: wie || 'boardroom' }; }
    if (!BEV.RANG[soort]) return { status: 400, error: 'Kies ' + BEV.SOORTEN.join(', ') + '.' };
    const ms = tot ? Date.parse(tot) : NaN;
    if (tot && !Number.isFinite(ms)) return { status: 400, error: 'De einddatum is geen geldige datum.' };
    const lijst = Array.isArray(landen) ? landen.map(l => String(l).toUpperCase().slice(0, 2)).filter(Boolean) : [];
    d().vergunning = { soort, nummer: String(nummer || '').slice(0, 60), entiteit: String(entiteit || '').slice(0, 120),
      landen: lijst, tot: Number.isFinite(ms) ? ms : null, at: Date.now() };
    save();
    return { ok: true, vergunning: { ...d().vergunning }, wie: wie || 'boardroom' };
  }
  function partnerRailZet({ rail, aan }) {
    if (!(rail in d().partnerRails)) return { status: 400, error: 'Onbekende partnerrail.' };
    d().partnerRails[rail] = aan === true; save();
    return { ok: true, partnerRails: { ...d().partnerRails } };
  }

  /* ---- DE TERUGSTORTSTAND: krijgen leden hun saldo terug, ja of nee? ----

     Dit is de enige schakelaar in dit huis die niet regelt wat RTG DOET maar
     wat RTG JURIDISCH IS. Daarom staat hij hier, naast de vergunning, en niet
     bij de gewone functieschakelaars.

       gesloten  saldo is alleen binnen RTG te besteden en komt er niet uit. Een
                 gesloten circuit met plafonds; RTG rekent dat tot een beperkt
                 netwerk en houdt daarvoor geen vergunning aan.
       open      een lid kan zijn saldo terugvragen. Dan is dat saldo tegen de
                 nominale waarde inwisselbaar voor de houder, en dat IS
                 elektronisch geld -- ongeacht hoe je het noemt.

     De stand bepaalt dus de SOORT van het vermogen WALLET_SALDO in
     kern/bevoegdheid/lijst.js: in `gesloten` een besluit met een grond, in
     `open` een rail die over de eigen rails een e-geldvergunning vraagt. Dat is
     geen twee dingen die toevallig samenhangen -- het is één werkelijkheid,
     twee kanten. Zou de stand hier staan en de soort daar los meebewegen, dan
     ontstaat precies de fout die dit hele traject heeft blootgelegd: een
     document dat iets anders zegt dan de code doet.

     WAAROM DIT EEN SCHAKELAAR MAG ZIJN EN DE VERGUNNING NIET. Een vergunning
     kun je jezelf niet geven; die is afgegeven of niet, dus is het een
     registratie. Terugstorten is wél een eigen keuze: RTG bepaalt zelf of het
     die belofte aan leden doet. Wat er daarna juridisch geldt, bepaalt RTG
     niet -- en juist daarom moet het omzetten van deze knop meteen de
     bevoegdheidsvraag verzwaren in plaats van hem te omzeilen.

     `open` is de standaard, want dat is wat er is besloten (24 augustus 2026)
     en de lijst hoort te beschrijven wat er is en niet wat lichter uitkomt. */
  const TERUGSTORTSTANDEN = ['gesloten', 'open'];
  const terugstorting = () => (TERUGSTORTSTANDEN.includes(d().terugstorting) ? d().terugstorting : 'open');
  function terugstortingZet({ stand, wie }) {
    if (!TERUGSTORTSTANDEN.includes(stand))
      return { status: 400, error: 'Kies ' + TERUGSTORTSTANDEN.join(' of ') + '.' };
    d().terugstorting = stand; save();
    return { ok: true, terugstorting: stand, wie: wie || 'boardroom',
      uitleg: stand === 'open'
        ? 'Leden kunnen hun saldo terugvragen. Daarmee is aangehouden saldo elektronisch geld: over de eigen rails vraagt dat een vergunning als elektronischgeldinstelling, en anders loopt het over een vergunninghoudende partner.'
        : 'Saldo blijft binnen RTG en wordt niet terugbetaald aan leden. Daarmee is het een gesloten circuit met plafonds, en RTG rekent dat tot een beperkt netwerk.' };
  }

  return { vergunning, partnerRails, vergunningZet, partnerRailZet, terugstorting, terugstortingZet, TERUGSTORTSTANDEN };
};
