/* RTG Festival (deelmodule): DE BOEKING. Artiest, podium, rider, afrekening.

   EEN BOEKING DIE DE ARTIEST NIET HEEFT BEVESTIGD IS EEN VOORNEMEN, en dat is
   de belangrijkste regel in dit bestand. CLAUDE.md verbiedt met zoveel woorden
   te doen alsof een boeking verwerkt is; op een podiumschema is dat verschil
   het verschil tussen een programma en een wensenlijst.

   RTG BEVESTIGT NOOIT NAMENS DE ARTIEST. Wat er wel kan: een mens van de
   organisatie legt vast DAT de artiest bevestigd heeft, met zijn eigen naam
   eronder en met de manier erbij ("getekend contract", "per mail 3 juni"). Dat
   is een verslag van een menselijke uitspraak en geen systeemfeit, en het staat
   zo in de data: `bevestigd: { door, hoe, at }`. Wie dat leest, ziet meteen op
   wiens gezag het staat.

   TWEE SETS OVERLAPPEN NIET OP HETZELFDE PODIUM, EN ER ZIT EEN CHANGEOVER
   TUSSEN. Dat tweede is geen verfijning: een podium dat om 21:00 leeg moet zijn
   en om 21:00 weer bespeeld wordt, bestaat niet. De changeover hoort bij de
   PLEK (kern/festival/terrein.js) omdat hij per podium verschilt.

   De rider en de afrekening staan in ./rider.js.

   WAAROM HET DRAAIBOEK UIT kern/events/ HIER NIET WORDT HERGEBRUIKT. Dat is een
   CATERING-runsheet bij een besloten event: posten met een station (keuken,
   bar, bediening, party), een MEP-vlag en een `daysBefore`, hangend aan een
   horeca-eventobject. Een set op een podium heeft daar niets aan, en een
   soundcheck is geen keukenpost. Wat er wel is overgenomen is de LES -- reken
   over middernacht heen -- en die staat al beter in kern/festival/model.js,
   waar hij aan een echte festivaldag hangt. */
'use strict';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const STANDEN = ['voornemen', 'bevestigd', 'afgezegd'];

module.exports = (ctx) => {
  const { save, crypto, schoon, editieVind, dagVind, offset, plekVind } = ctx;

  const bak = (e) => {
    if (!e.boekingen || typeof e.boekingen !== 'object') e.boekingen = {};
    return e.boekingen;
  };
  const nuIso = () => new Date().toISOString();
  const centen = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);

  /* Twee vensters op dezelfde dag, met de changeover van het podium erbij
     geteld. In minuten na opening, zodat het over middernacht heen klopt. */
  function botst(dag, a, b, gat) {
    const av = offset(dag, a.van), at = offset(dag, a.tot);
    const bv = offset(dag, b.van), bt = offset(dag, b.tot);
    if ([av, at, bv, bt].some(x => x === null)) return false;
    return av < bt + gat && bv < at + gat;
  }

  function boekingZet(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const dag = dagVind(e, d.dag);
    if (!dag) return { status: 404, error: 'Deze dag staat niet in de editie.' };
    const podium = plekVind(e, d.podium);
    if (!podium) return { status: 404, error: 'Dit podium bestaat niet.' };
    const artiest = schoon(d.artiest, 80);
    if (!artiest) return { status: 400, error: 'Wie speelt er?' };
    if (!HHMM.test(String(d.van || '')) || !HHMM.test(String(d.tot || '')))
      return { status: 400, error: 'Geef begin en eind als uu:mm.' };
    const van = String(d.van), tot = String(d.tot);
    if (offset(dag, van) === null || offset(dag, tot) === null)
      return { status: 400, error: 'Die tijden vallen buiten de openingstijden van deze dag.' };
    if (offset(dag, van) >= offset(dag, tot))
      return { status: 400, error: 'Een set eindigt niet voor of op zijn begin.' };
    if (d.soundcheck && !HHMM.test(String(d.soundcheck)))
      return { status: 400, error: 'Geef de soundcheck als uu:mm.' };
    if (d.soundcheck && offset(dag, String(d.soundcheck)) === null)
      return { status: 400, error: 'De soundcheck valt buiten de openingstijden van deze dag.' };
    /* Een soundcheck NA de set is geen soundcheck. Zonder deze regel staat er
       een tijd in het schema waar de stage manager op wacht terwijl het al
       voorbij is. */
    if (d.soundcheck && offset(dag, String(d.soundcheck)) >= offset(dag, van))
      return { status: 400, error: 'De soundcheck valt na het begin van de set.' };

    const gat = podium.changeover || 0;
    const b = bak(e);
    const nieuw = { dag: dag.id, podium: podium.id, van, tot };
    for (const x of Object.values(b)) {
      if (x.id === String(d.id || '') || x.stand === 'afgezegd') continue;
      if (x.dag !== dag.id || x.podium !== podium.id) continue;
      if (botst(dag, x, nieuw, gat)) {
        return { status: 409, error: podium.naam + ' is dan bezet door ' + x.artiest
          + ' (' + x.van + '-' + x.tot + (gat ? ', changeover ' + gat + ' min' : '') + ').' };
      }
    }

    const velden = { ...nieuw, artiest, zaak: schoon(d.zaak, 40) || null,
      soundcheck: d.soundcheck ? String(d.soundcheck) : null,
      contact: schoon(d.contact, 80) || null,
      gage: centen(d.gage), voorschot: centen(d.voorschot) };
    if (d.id) {
      const x = b[String(d.id)];
      if (!x) return { status: 404, error: 'Deze boeking bestaat niet.' };
      Object.assign(x, velden);
      save();
      return { ok: true, boeking: x };
    }
    const x = { id: 'boek' + crypto.randomBytes(4).toString('hex'), ...velden,
      stand: 'voornemen', bevestigd: null, rider: [], extras: [], at: nuIso() };
    if (Object.keys(b).length >= 2000) return { status: 400, error: 'Er staan te veel boekingen op deze editie.' };
    b[x.id] = x;
    save();
    return { ok: true, boeking: x };
  }

  /* Vastleggen DAT de artiest bevestigd heeft. Met een naam en met de manier
     erbij, want dit is een verslag van een menselijke uitspraak. */
  function boekingStand(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const x = bak(e)[String(d.id || '')];
    if (!x) return { status: 404, error: 'Deze boeking bestaat niet.' };
    const stand = STANDEN.includes(String(d.stand)) ? String(d.stand) : null;
    if (!stand) return { status: 400, error: 'Kies een stand: ' + STANDEN.join(', ') + '.' };
    const door = schoon(d.door, 60);
    if (!door) return { status: 400, error: 'Wie legt dit vast?' };
    if (stand === 'bevestigd') {
      const hoe = schoon(d.hoe, 120);
      /* ZONDER "HOE" GEEN BEVESTIGING. Anders staat er "bevestigd" zonder dat
         iemand kan nagaan waarop dat berust, en dat is precies de schijnzekerheid
         waar CLAUDE.md voor waarschuwt. */
      if (!hoe) return { status: 400, error: 'Waaruit blijkt dat? Noem het (getekend contract, mail van 3 juni).' };
      x.bevestigd = { door, hoe, at: nuIso() };
    }
    x.stand = stand;
    save();
    return { ok: true, boeking: x };
  }

  function boekingenVan(fid, eid, dagId) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const uit = Object.values(e.boekingen || {})
      .filter(x => !dagId || x.dag === String(dagId))
      .map(x => ({ ...x, podiumNaam: (plekVind(e, x.podium) || {}).naam || null,
        riderOpen: (x.rider || []).filter(r => !r.klaar).length }))
      .sort((a, b) => a.van.localeCompare(b.van));
    return { ok: true, boekingen: uit };
  }

  return { boekingZet, boekingStand, boekingenVan, BOEKING_STANDEN: STANDEN };
};
