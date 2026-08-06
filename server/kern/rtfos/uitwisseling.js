/* Foundation OS, deel "uitwisseling": vrijwilligers tussen steden.

   EEN VRIJWILLIGER IS GEEN MIDDEL DAT JE VERPLAATST. Dat is de hele reden dat
   deze module bestaat en niet gewoon een veld "stad" is dat je overtypt. Iemand
   die drie avonden per week in IJmuiden meeloopt, wordt niet "uitgeleend" aan
   Haarlem omdat daar een tekort is. Hij kan gevraagd worden, hij kan ja zeggen,
   en dan geldt dat ja voor een afgesproken periode.

   VIER DINGEN DIE HIER IN CODE STAAN:

   1. ZONDER VASTGELEGDE TOESTEMMING GEEN UITLEEN. Niet als vinkje maar als
      tekst: waarvoor, naar welke stad, voor welke periode. Wie dat niet kan
      opschrijven, heeft het niet gevraagd.

   2. DE PERIODE IS EEN DATUM EN LOOPT AF. Een uitleen zonder einddatum is een
      overplaatsing met een ander woord. Verlopen wordt hier GEREKEND en niet
      door een taak omgezet: een uitleen die is afgelopen, is afgelopen, ook als
      niemand op een knop drukte.

   3. DE ONTVANGENDE STAD ZIET MINDER DAN DE EIGEN STAD. Naam, contact,
      vaardigheden, talen, beschikbaarheid en of de VOG geldig is -- dat is wat
      je nodig hebt om iemand in te plannen. GEEN evaluaties en GEEN
      urenhistorie: dat is het personeelsdossier van de andere stad, en dat
      reist niet mee omdat het toevallig in hetzelfde systeem staat.

   4. DE VOG-EIS GELDT IN DE ONTVANGENDE STAD NET ZO. Hij hangt aan het soort
      werk (vrijwilligers-inzet.js) en niet aan de stad, dus een uitgeleende
      vrijwilliger komt daar door precies dezelfde grendel. Deze module hoeft
      hem niet over te doen -- en doet dat met opzet ook niet.

   Opslag: db.data.rtfos.uitleen. */

const STATUS = ['gevraagd', 'lopend', 'beeindigd', 'geweigerd'];

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, wie, poort, stadVan, save, vogGeldig } = ctx;

  const U = () => S().uitleen;
  const vind = id => U().find(u => u.id === String(id || '')) || null;
  const verlopen = u => !!u.tot && Date.parse(u.tot) < Date.now();
  // Loopt deze uitleen NU? Gerekend, niet opgeslagen: zie punt 2 hierboven.
  const actief = u => u.status === 'lopend' && !verlopen(u);

  const beeld = u => {
    const v = S().vrijwilligers.find(x => x.id === u.vrijwilligerId);
    return { id: u.id, vrijwilligerId: u.vrijwilligerId, naam: v ? v.naam : '(uit het register)',
      vanStad: (stadVan(u.vanStad) || {}).naam || null, vanStadId: u.vanStad,
      naarStad: (stadVan(u.naarStad) || {}).naam || null, naarStadId: u.naarStad,
      van: u.van, tot: u.tot, reden: u.reden, status: u.status,
      loopt: actief(u), verlopen: verlopen(u),
      toestemming: u.toestemming ? { tekst: u.toestemming.tekst, at: u.toestemming.at } : null,
      at: u.at };
  };

  /* Het beeld dat de ONTVANGENDE stad krijgt. Bewust een eigen functie en niet
     het gewone vrijwilligersbeeld met een filter erover: een filter dat je
     vergeet, lekt alles. Wat hier niet in staat, kan er ook niet uit lekken. */
  const gastBeeld = v => ({ id: v.id, naam: v.naam, contact: v.contact,
    talen: v.talen || [], vaardigheden: v.vaardigheden || [], beschikbaar: v.beschikbaar || [],
    rijbewijs: !!v.rijbewijs, voertuig: !!v.voertuig, gedragscode: !!v.gedragscode,
    vogGeldig: vogGeldig(v), gast: true, eigenStad: (stadVan(v.stad) || {}).naam || null });

  function lijst(req, stadId) {
    const w = wie(req);
    const g = poort(w, stadId, 'stad.lezen');
    if (!g.ok) return g;
    const rijen = U().filter(u => u.vanStad === g.stad.id || u.naarStad === g.stad.id);
    return { ok: true, statussen: STATUS,
      uitgeleend: rijen.filter(u => u.vanStad === g.stad.id).map(beeld),
      geleend: rijen.filter(u => u.naarStad === g.stad.id).map(beeld),
      // wie er nu werkelijk in deze stad meedraait vanuit elders
      gasten: U().filter(u => u.naarStad === g.stad.id && actief(u))
        .map(u => S().vrijwilligers.find(v => v.id === u.vrijwilligerId))
        .filter(Boolean).map(gastBeeld) };
  }

  /* Vragen. De EIGEN stad vraagt, want die kent de vrijwilliger; een stad die
     zelf mensen bij de buren weghaalt, is geen federatie maar een markt. */
  function vraag(req, b) {
    b = b || {};
    const v = S().vrijwilligers.find(x => x.id === String(b.vrijwilligerId || ''));
    if (!v) return { status: 404, error: 'Deze vrijwilliger staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, v.stad, 'vrijwilliger.beheren', 'volunteer_management');
    if (!g.ok) return g;
    const naar = stadVan(b.naarStad);
    if (!naar) return { status: 404, error: 'Die stadsafdeling bestaat niet.' };
    if (naar.id === v.stad) return { status: 400, error: 'Deze vrijwilliger hoort al bij die stad.' };
    if (naar.status !== 'actief') return { status: 400, error: 'RTF ' + naar.naam + ' staat op "' + naar.status + '" en kan geen vrijwilligers ontvangen.' };
    if (!(naar.vlaggen || []).includes('volunteer_management')) {
      return { status: 403, error: 'De module "volunteer_management" staat uit voor ' + naar.naam + '.' };
    }
    if (v.status !== 'actief') return { status: 400, error: v.naam + ' staat op "' + v.status + '".' };
    const van = schoon(b.van, 10), tot = schoon(b.tot, 10);
    if (!tot || Number.isNaN(Date.parse(tot))) {
      return { status: 400, error: 'Tot wanneer loopt deze uitleen? Zonder einddatum is het een overplaatsing met een ander woord.' };
    }
    if (van && Number.isNaN(Date.parse(van))) return { status: 400, error: 'Gebruik een datum als 2026-10-01.' };
    if (Date.parse(tot) < Date.now()) return { status: 400, error: 'Die einddatum ligt in het verleden.' };
    const reden = schoon(b.reden, 300);
    if (reden.length < 5) return { status: 400, error: 'Waarvoor is deze vrijwilliger daar nodig?' };
    if (U().length >= 50000) return { status: 400, error: 'Het uitleenregister zit vol.' };
    const u = { id: rid(), vrijwilligerId: v.id, vanStad: v.stad, naarStad: naar.id,
      van: van || nu().slice(0, 10), tot, reden, status: 'gevraagd', toestemming: null,
      door: w.key, at: nu() };
    U().push(u);
    audit(w.key, 'uitleen.gevraagd', v.naam, g.stad.naam + ' -> ' + naar.naam + ' tot ' + tot);
    save();
    return { ok: true, uitleen: beeld(u),
      melding: 'Vraag het ' + v.naam + ' zelf, en leg zijn antwoord vast. Zonder die toestemming gaat de uitleen niet lopen.' };
  }

  /* De toestemming van de vrijwilliger, en pas daarna gaat hij lopen. Weigeren
     is een even geldige uitkomst en krijgt een eigen status -- een vraag waar
     alleen "ja" op kan, is geen vraag. */
  function toestemming(req, id, b) {
    b = b || {};
    const u = vind(id);
    if (!u) return { status: 404, error: 'Deze uitleen bestaat niet.' };
    const w = wie(req);
    const g = poort(w, u.vanStad, 'vrijwilliger.beheren', 'volunteer_management');
    if (!g.ok) return g;
    if (u.status !== 'gevraagd') return { status: 400, error: 'Deze uitleen staat op "' + u.status + '".' };
    if (b.akkoord !== true) {
      u.status = 'geweigerd';
      u.toestemming = null;
      audit(w.key, 'uitleen.geweigerd', u.id, schoon(b.tekst, 60));
      save();
      return { ok: true, uitleen: beeld(u) };
    }
    const tekst = schoon(b.tekst, 300);
    if (tekst.length < 5) {
      return { status: 400, error: 'Leg vast waar de vrijwilliger mee akkoord gaat: welke stad, welke periode, welk werk.' };
    }
    u.toestemming = { tekst, door: w.key, at: nu() };
    u.status = 'lopend';
    audit(w.key, 'uitleen.lopend', u.id, u.vanStad + ' -> ' + u.naarStad);
    save();
    return { ok: true, uitleen: beeld(u) };
  }

  function beeindig(req, id) {
    const u = vind(id);
    if (!u) return { status: 404, error: 'Deze uitleen bestaat niet.' };
    const w = wie(req);
    // beide steden mogen stoppen: de eigen stad haalt zijn mensen terug, de
    // ontvangende stad geeft ze terug. Geen van beide hoeft de ander te vragen.
    const eigen = poort(w, u.vanStad, 'vrijwilliger.beheren', 'volunteer_management');
    const gast = poort(w, u.naarStad, 'vrijwilliger.beheren', 'volunteer_management');
    if (!eigen.ok && !gast.ok) return eigen.ok === false ? eigen : gast;
    if (u.status === 'beeindigd') return { status: 400, error: 'Deze uitleen is al beeindigd.' };
    u.status = 'beeindigd';
    u.beeindigdAt = nu();
    audit(w.key, 'uitleen.beeindigd', u.id, '');
    save();
    return { ok: true, uitleen: beeld(u) };
  }

  /* De vraag die vrijwilligers-inzet.js stelt: mag deze vrijwilliger in DEZE
     stad worden ingezet? Eigen stad altijd; een andere stad alleen zolang er
     een lopende, niet-verlopen uitleen is. */
  function magInStad(vrijwilligerId, stadId) {
    return U().some(u => u.vrijwilligerId === String(vrijwilligerId) &&
      u.naarStad === String(stadId) && actief(u));
  }

  return { lijst, vraag, toestemming, beeindig, magInStad, vind, beeld, gastBeeld, STATUS };
};
module.exports.STATUS = STATUS;
