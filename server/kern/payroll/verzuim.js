/* Payroll OS: VERLOF EN ZIEKTE.

   DE SCHEIDING IS HET ONTWERP, NIET EEN INSTELLING. Een leidinggevende mag
   weten DAT iemand er niet is en WAT hij nog kan; hij mag niet weten WAT
   iemand heeft. Dat is geen beleefdheid maar de lijn die de Autoriteit
   Persoonsgegevens trekt rond gezondheidsgegevens van werknemers, en de
   makkelijkste manier om hem te overtreden is een vrij tekstveld "reden" op
   een ziekmelding.

   Daarom kent een ziekmelding hier GEEN reden-veld. Wat er wel is:

     afwezig       ja/nee, met datums -- dat is wat het rooster nodig heeft
     inzetbaarheid wat iemand nog wel kan (niets / aangepast / deels / volledig)
                   -- dat is wat de planning nodig heeft
     percentage    voor de loondoorbetaling -- dat is wat de payroll nodig heeft

   Medische gegevens horen bij de arbodienst en komen hier niet binnen. Er is
   geen veld om ze in te zetten, want een veld dat er is wordt gevuld.

   TWEE LAGEN, EEN WAARHEID. `voorPlanning()` en `voorPayroll()` lezen dezelfde
   melding maar leveren verschillende dingen. Dat is met opzet geen twee
   opslagen: twee plekken die hetzelfde bewaren lopen uit elkaar, en dan klopt
   de loondoorbetaling niet met het rooster.

   VERLOFSOORTEN. De wet kent er meer dan "vakantie of ziek", en ze betalen
   niet hetzelfde uit. Ze staan hier met naam, niet als vrije tekst, want een
   soort die de payroll niet kent kan hij ook niet doorbetalen. */
'use strict';

const SOORTEN = {
  vakantie:        { betaald: 1.0, opbouwend: false, naam: 'Vakantie' },
  ziek:            { betaald: 0.7, opbouwend: true,  naam: 'Ziek', medisch: true },
  ouderschap:      { betaald: 0.7, opbouwend: true,  naam: 'Ouderschapsverlof' },
  zwangerschap:    { betaald: 1.0, opbouwend: true,  naam: 'Zwangerschaps- en bevallingsverlof', uwv: true },
  geboorte:        { betaald: 1.0, opbouwend: true,  naam: 'Geboorteverlof' },
  zorg:            { betaald: 0.7, opbouwend: true,  naam: 'Zorgverlof' },
  onbetaald:       { betaald: 0.0, opbouwend: false, naam: 'Onbetaald verlof' },
  bijzonder:       { betaald: 1.0, opbouwend: true,  naam: 'Bijzonder verlof' }
};
const INZETBAARHEID = ['niets', 'aangepast', 'deels', 'volledig'];
const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

function keur(m) {
  const bez = [];
  if (!m || typeof m !== 'object') return ['Geen melding ontvangen.'];
  if (!SOORTEN[m.soort]) bez.push('soort moet een van ' + Object.keys(SOORTEN).join(', ') + ' zijn.');
  if (!isDatum(m.van)) bez.push('van ontbreekt of is geen datum (JJJJ-MM-DD).');
  if (m.tot && !isDatum(m.tot)) bez.push('tot is geen datum (JJJJ-MM-DD).');
  if (m.tot && m.van && m.tot < m.van) bez.push('tot ligt voor van.');
  if (m.inzetbaarheid && !INZETBAARHEID.includes(m.inzetbaarheid))
    bez.push('inzetbaarheid moet een van ' + INZETBAARHEID.join(', ') + ' zijn.');
  /* HIER ZIT DE HELE REGEL. Een ziekmelding met een omschrijving is een
     medisch gegeven in een personeelssysteem. Weigeren, niet opschonen: wie
     het veld stilzwijgend leegmaakt, laat de invoerder denken dat het is
     aangekomen en de volgende keer probeert hij het opnieuw. */
  const vrij = m.toelichting || m.reden || m.diagnose || m.klachten;
  if (SOORTEN[m.soort] && SOORTEN[m.soort].medisch && vrij)
    bez.push('Een ziekmelding draagt geen omschrijving. Wat iemand heeft, hoort bij de arbodienst; hier staat alleen of hij er is en wat hij nog kan.');
  return bez;
}

function maakVerzuim({ db, save, nu }) {
  const tijd = nu || (() => new Date().toISOString());
  const sleutel = (code, staffId) => String(code).toUpperCase() + ':' + staffId;

  function bak() {
    if (!db.data.payrollVerzuim || typeof db.data.payrollVerzuim !== 'object') db.data.payrollVerzuim = {};
    return db.data.payrollVerzuim;
  }
  const rijVan = (code, staffId) => {
    const b = bak(); const k = sleutel(code, staffId);
    if (!Array.isArray(b[k])) b[k] = [];
    return b[k];
  };

  function meld(code, staffId, melding, door) {
    const bez = keur(melding);
    if (bez.length) return { status: 422, error: 'Deze melding is afgekeurd.', bezwaren: bez };
    if (!door) return { status: 400, error: 'Noteer wie deze melding vastlegt.' };
    const m = {
      id: 'vz_' + String(staffId) + '-' + String(melding.van).replace(/-/g, '') + '-' + melding.soort,
      soort: melding.soort, van: melding.van, tot: melding.tot || null,
      inzetbaarheid: melding.inzetbaarheid || (SOORTEN[melding.soort].medisch ? 'niets' : null),
      door, at: tijd()
    };
    const rij = rijVan(code, staffId);
    const idx = rij.findIndex(x => x.id === m.id);
    if (idx >= 0) rij[idx] = m; else rij.push(m);
    rij.sort((a, b) => (a.van < b.van ? -1 : a.van > b.van ? 1 : 0));
    save();
    return { ok: true, melding: m };
  }

  const inPeriode = (code, staffId, van, tot) => rijVan(code, staffId)
    .filter(m => m.van <= tot && (!m.tot || m.tot >= van));

  /* Wat iemand nog wel kan, bijgesteld terwijl het verzuim loopt. Ziek zijn is
     geen toestand die op dag een vaststaat: na een week kan iemand aangepast
     werk doen, en dat is precies wat een rooster moet weten.

     ALLEEN DEZE VIER STANDEN, en nog steeds geen veld voor waarom. De melding
     zelf verandert niet -- soort, van en tot blijven staan -- want dit is een
     bijstelling en geen nieuwe melding. */
  function zetInzetbaarheid(code, staffId, van, stand, door) {
    if (!INZETBAARHEID.includes(stand))
      return { status: 400, error: 'inzetbaarheid moet een van ' + INZETBAARHEID.join(', ') + ' zijn.' };
    if (!door) return { status: 400, error: 'Noteer wie dit bijstelt.' };
    const rij = rijVan(code, staffId);
    /* Zonder datum: de melding die vandaag loopt. Met een datum: die ene. Wie
       niets meegeeft bedoelt "waar ik nu in zit", en dat is bijna altijd zo. */
    const m = van ? rij.find(x => x.van === van)
      : rij.slice().reverse().find(x => !x.tot || x.tot >= (van || ''));
    if (!m) return { status: 404, error: 'Er loopt geen verzuimmelding om bij te stellen.' };
    m.inzetbaarheid = stand;
    m.inzetbaarheidDoor = door;
    m.inzetbaarheidOp = tijd();
    save();
    return { ok: true, melding: { van: m.van, tot: m.tot, inzetbaarheid: m.inzetbaarheid } };
  }

  /* Wat een leidinggevende ziet: er is afwezigheid, en dit kan iemand nog.
     Geen soort bij ziekte -- "ziek" is al een gezondheidsgegeven, dus dat wordt
     "afwezig". Bij verlof mag de soort er wel bij: dat is geen medisch gegeven
     en de planning heeft er wat aan. */
  function voorPlanning(code, staffId, van, tot) {
    return inPeriode(code, staffId, van, tot).map(m => {
      const s = SOORTEN[m.soort];
      return { van: m.van, tot: m.tot,
        wat: s.medisch ? 'afwezig' : s.naam,
        inzetbaarheid: m.inzetbaarheid || null };
    });
  }

  /* Wat de payroll nodig heeft: de soort (voor het doorbetalingspercentage) en
     of het UWV eraan te pas komt. De payroll rekent, hij toont niets aan een
     leidinggevende, dus hier mag de soort wel staan. */
  function voorPayroll(code, staffId, van, tot) {
    return inPeriode(code, staffId, van, tot).map(m => {
      const s = SOORTEN[m.soort];
      return { van: m.van, tot: m.tot, soort: m.soort, naam: s.naam,
        betaaldDeel: s.betaald, viaUwv: !!s.uwv };
    });
  }

  return { meld, zetInzetbaarheid, voorPlanning, voorPayroll, keur, SOORTEN, INZETBAARHEID };
}

module.exports = { maakVerzuim, keur, SOORTEN, INZETBAARHEID };
