/* ============================================================================
   CIJFERS OVER EEN APP -- voor de uitgever, en voor niemand anders.

   Besloten op 27 augustus 2026: privacyarme tellingen per dag. Dit bestand volgt
   daarin `kern/webmaker-meting.js`, dat dezelfde afweging al een keer heeft
   gemaakt voor websites. Wie die kop leest, leest hier hetzelfde terug -- en dat
   is de bedoeling: twee meters in een huis die anders denken over wat er gemeten
   mag worden, is een huis waarin het antwoord van de plek afhangt.

   WAT ER WEL IN STAAT: hoe vaak een app de brug aanriep, per dag, en hoe vaak
   die aanroep werd geweigerd -- uitgesplitst naar foutcode, want dat is wat een
   uitgever kan repareren.

   WAT ER MET OPZET NIET IN STAAT:
   - GEEN LEDEN. Geen codenaam, geen sleutel, geen "hoeveel unieke gebruikers".
     De brug weet wél welk lid er aanroept -- hij moet immers weten wat dat lid
     heeft verleend -- maar die wetenschap komt hier niet binnen. Zou dat wel zo
     zijn, dan is dit geen teller maar een lijst van wie welke app gebruikt, en
     die hoort in dit huis nergens te bestaan (APPSTORE.md grens 3).
   - GEEN TIJDSTIPPEN. Per dag een getal. Bij een app met drie gebruikers is
     "om 14:32" een aanwijzing naar een mens.
   - GEEN DUUR EN GEEN VOLGORDE. Dat is een trace, en een trace over een derde
     zegt iets over de mens die hem bedient. Dat vraagt een eigen besluit; zie
     CREATE.md par. 9.3.

   DE SCHRIJFSTORM, EN HOE HIJ WORDT VERMEDEN. `save()` schrijft in dit huis de
   HELE database weg. De brug staat 120 aanroepen per minuut per lid per app toe;
   bij elke aanroep opslaan zou van een teller een schrijfstorm maken -- precies
   de reden die in kern/appstore/brug.js al staat waarom de REM in het geheugen
   zit.

   Daarom: optellen gebeurt altijd en meteen (dat is gratis -- het is een getal
   in db.data), maar WEGSCHRIJVEN hooguit eens per SCHRIJFRUST. Wat dat kost is
   uitgesproken en niet verstopt: bij een herstart gaan de tellingen van
   hooguit dertig seconden verloren. Voor een dagteller is dat ruis; voor een
   journaal zou het onaanvaardbaar zijn, en daarom staat het journaal ook ergens
   anders (kern/appstore/index.js, boek()).
   ========================================================================== */
'use strict';

const DAGEN_MAX = 90;          // drie maanden terugkijken, daarna valt de oudste dag eraf
const SCHRIJFRUST = 30000;     // hooguit eens per dertig seconden naar schijf

function maakMeting({ S, save, nu }) {
  let laatsteSchrijf = 0;

  const dag = () => String(nu ? nu() : new Date().toISOString()).slice(0, 10);

  function pot() {
    const s = S();
    if (!s.meting || typeof s.meting !== 'object') s.meting = {};
    return s.meting;
  }
  function rij(sleutel) {
    const p = pot();
    const k = String(sleutel || '');
    if (!p[k] || typeof p[k] !== 'object') p[k] = { dagen: {} };
    if (!p[k].dagen || typeof p[k].dagen !== 'object') p[k].dagen = {};
    return p[k];
  }
  function snoei(r) {
    const dagen = Object.keys(r.dagen).sort();
    while (dagen.length > DAGEN_MAX) delete r.dagen[dagen.shift()];
  }

  /* Eén aanroep tellen. `code` is null als het goed ging, en anders de
     platformfoutcode -- dat is precies de uitsplitsing waar een uitgever iets
     mee kan: RTG_MACHTIGING_NIET_VERLEEND repareert hij anders dan
     RTG_ARGUMENT_ONGELDIG.

     Wat er NIET wordt meegegeven is het lid, en dat is geen vergeetachtigheid:
     deze functie heeft er geen parameter voor. */
  function tel(sleutel, code) {
    if (!sleutel) return;
    const r = rij(sleutel);
    const d = dag();
    if (!r.dagen[d]) r.dagen[d] = { aanroepen: 0, weigeringen: 0, codes: {} };
    const t = r.dagen[d];
    t.aanroepen++;
    if (code) {
      t.weigeringen++;
      t.codes[code] = (t.codes[code] || 0) + 1;
    }
    snoei(r);
    const n = Date.now();
    if (n - laatsteSchrijf > SCHRIJFRUST) { laatsteSchrijf = n; try { save(); } catch (e) {} }
  }

  /* De cijfers van EEN app. `dagen` is een lijst van jong naar oud, zodat een
     scherm er niets aan hoeft te sorteren. */
  function cijfers(sleutel, hoeveelDagen) {
    const r = pot()[String(sleutel || '')];
    const n = Math.max(1, Math.min(DAGEN_MAX, Number(hoeveelDagen) || 30));
    if (!r) return { sleutel, dagen: [], totaal: { aanroepen: 0, weigeringen: 0, codes: {} }, let: LET };
    const dagen = Object.keys(r.dagen).sort().reverse().slice(0, n)
      .map(d => Object.assign({ dag: d }, r.dagen[d]));
    const totaal = { aanroepen: 0, weigeringen: 0, codes: {} };
    for (const d of dagen) {
      totaal.aanroepen += d.aanroepen || 0;
      totaal.weigeringen += d.weigeringen || 0;
      for (const [c, m] of Object.entries(d.codes || {})) totaal.codes[c] = (totaal.codes[c] || 0) + m;
    }
    return { sleutel, dagen, totaal, let: LET };
  }

  /* De cijfers van een hele uitgever. `apps` komt van de aanroeper, want deze
     module weet niet wie welke app bezit -- en hoort dat ook niet te weten. */
  function cijfersVan(apps, hoeveelDagen) {
    return (apps || []).map(s => cijfers(s, hoeveelDagen));
  }

  return { tel, cijfers, cijfersVan, DAGEN_MAX, SCHRIJFRUST, LET };
}

/* De zin reist mee met elk antwoord. Zonder die zin leest iemand "412 aanroepen"
   als "412 gebruikers", en dat is precies het misverstand dat deze meter niet
   mag voeden. */
const LET = 'Dit zijn tellingen van aanroepen, geen mensen. Er wordt niet bijgehouden welk lid je app gebruikt, hoe lang, of hoe vaak dezelfde persoon terugkomt.';

module.exports = { maakMeting, DAGEN_MAX, SCHRIJFRUST, LET };
