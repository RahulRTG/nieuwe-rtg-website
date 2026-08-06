/* Foundation OS, deel "vrijwilligers": het register, de VOG, de planning en de
   uren.

   DE VOG IS EEN DATUM, GEEN VINKJE. Een verlopen VOG is geen VOG. De code
   rekent daarom altijd met `vogGeldigTot` en niet met een boolean die ooit door
   iemand is aangezet; een vinkje veroudert niet en dat is precies het probleem.

   EN HIJ IS EEN GRENDEL, GEEN VELD. Bij werk met kinderen en met kwetsbare
   ouderen kan een vrijwilliger zonder geldige VOG niet aan een project worden
   gekoppeld -- de koppeling wordt geweigerd, niet gemarkeerd. Een waarschuwing
   in een lijst is iets wat je wegklikt op de ochtend dat je te weinig mensen
   hebt, en dat is precies de ochtend waarop het misgaat.

   ZOEKEN OP WAT ER NODIG IS. De planner zoekt op stad, beschikbaarheid, taal,
   rijbewijs, vaardigheid en VOG. Dat is geen luxe: "wie kan er dinsdagavond
   rijden en spreekt Arabisch" is de vraag die in de praktijk gesteld wordt, en
   als het systeem hem niet kan beantwoorden gaat het per WhatsApp -- buiten
   elke afspraak over persoonsgegevens om.

   WAT HIER NIET STAAT. Geen bijzondere persoonsgegevens: geen gezondheid, geen
   geloof, geen strafblad. Van de VOG bewaren we of hij er is en tot wanneer,
   niet wat erin staat -- dat mag ook niet en het is niet nodig. */

const STATUS = ['aangemeld', 'kennismaking', 'actief', 'inactief', 'gestopt'];
const DAGDELEN = ['ma-o', 'ma-m', 'ma-a', 'di-o', 'di-m', 'di-a', 'wo-o', 'wo-m', 'wo-a',
  'do-o', 'do-m', 'do-a', 'vr-o', 'vr-m', 'vr-a', 'za', 'zo'];
// De projectsoorten waar een geldige VOG een voorwaarde is, geen wens.
const VOG_VERPLICHT = ['jongeren', 'huiswerk', 'sport', 'ouderen'];

module.exports = (ctx) => {
  const { nu, rid, schoon, code, S, audit, wie, poort, save, vogGeldig } = ctx;

  const vind = id => S().vrijwilligers.find(v => v.id === String(id || '')) || null;
  const uren = v => (v.uren || []).reduce((s, u) => s + u.uren, 0);
  const beeld = v => ({ id: v.id, stad: v.stad, naam: v.naam, contact: v.contact, status: v.status,
    beschikbaar: v.beschikbaar || [], talen: v.talen || [], vaardigheden: v.vaardigheden || [],
    rijbewijs: !!v.rijbewijs, voertuig: !!v.voertuig, gedragscode: !!v.gedragscode,
    vogGeldigTot: v.vogGeldigTot || null, vogGeldig: vogGeldig(v),
    trainingen: v.trainingen || [], urenTotaal: uren(v), projecten: v.projecten || [],
    /* De uren die de vrijwilliger ZELF heeft doorgegeven en die nog op een
       bevestiging wachten (vrijwilligerportaal.js). Ze staan hier omdat de
       coordinator ze anders nergens ziet -- en een melding die niemand ziet,
       is hetzelfde als geen melding. */
    gemeldeUren: (v.gemeldeUren || []).map(u => ({ id: u.id, datum: u.datum, uren: u.uren,
      km: u.km, projectId: u.projectId })),
    evaluaties: (v.evaluaties || []).slice(0, 10), sinds: v.at });

  function lijst(req, stadId, filter) {
    const w = wie(req);
    const g = poort(w, stadId, 'stad.lezen');
    if (!g.ok) return g;
    const f = filter || {};
    const taal = schoon(f.taal, 40).toLowerCase();
    const vaardig = schoon(f.vaardigheid, 60).toLowerCase();
    const dagdeel = schoon(f.dagdeel, 10);
    let rijen = S().vrijwilligers.filter(v => v.stad === g.stad.id);
    if (f.status) rijen = rijen.filter(v => v.status === String(f.status));
    if (taal) rijen = rijen.filter(v => (v.talen || []).some(t => t.toLowerCase().includes(taal)));
    if (vaardig) rijen = rijen.filter(v => (v.vaardigheden || []).some(t => t.toLowerCase().includes(vaardig)));
    if (dagdeel) rijen = rijen.filter(v => (v.beschikbaar || []).includes(dagdeel));
    if (f.rijbewijs === true) rijen = rijen.filter(v => v.rijbewijs);
    if (f.voertuig === true) rijen = rijen.filter(v => v.voertuig);
    if (f.vog === true) rijen = rijen.filter(vogGeldig);
    return { ok: true, statussen: STATUS, dagdelen: DAGDELEN, vogVerplicht: VOG_VERPLICHT,
      aantal: rijen.length, vrijwilligers: rijen.slice(0, 500).map(beeld) };
  }

  function maak(req, b) {
    b = b || {};
    const w = wie(req);
    const g = poort(w, b.stad, 'vrijwilliger.beheren', 'volunteer_management');
    if (!g.ok) return g;
    const naam = schoon(b.naam, 80);
    if (naam.length < 2) return { status: 400, error: 'Hoe heet deze vrijwilliger?' };
    if (S().vrijwilligers.length >= 100000) return { status: 400, error: 'Het vrijwilligersregister zit vol.' };
    const v = { id: rid(), stad: g.stad.id, naam, contact: schoon(b.contact, 120),
      // de eigen ingang van de vrijwilliger (vrijwilligerportaal.js); wordt
      // pas iets waard als de coordinator hem persoonlijk overhandigt
      code: code('RTFV'),
      status: 'aangemeld', beschikbaar: [], talen: [], vaardigheden: [], rijbewijs: false,
      voertuig: false, gedragscode: false, vogGeldigTot: null, trainingen: [], uren: [],
      projecten: [], evaluaties: [], at: nu() };
    S().vrijwilligers.push(v);
    audit(w.key, 'vrijwilliger.maak', naam, 'stad ' + g.stad.naam);
    save();
    return { ok: true, vrijwilliger: beeld(v) };
  }

  function zet(req, id, b) {
    const v = vind(id);
    if (!v) return { status: 404, error: 'Deze vrijwilliger staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, v.stad, 'vrijwilliger.beheren', 'volunteer_management');
    if (!g.ok) return g;
    b = b || {};
    if (b.naam !== undefined) v.naam = schoon(b.naam, 80) || v.naam;
    if (b.contact !== undefined) v.contact = schoon(b.contact, 120);
    if (b.status !== undefined) {
      if (!STATUS.includes(String(b.status))) return { status: 400, error: 'Kies een status (' + STATUS.join(', ') + ').' };
      v.status = String(b.status);
    }
    if (Array.isArray(b.beschikbaar)) {
      const on = b.beschikbaar.map(String).filter(x => !DAGDELEN.includes(x));
      if (on.length) return { status: 400, error: 'Onbekend dagdeel: ' + on.slice(0, 3).join(', ') + '.' };
      v.beschikbaar = [...new Set(b.beschikbaar.map(String))];
    }
    for (const veld of ['talen', 'vaardigheden', 'trainingen']) {
      if (Array.isArray(b[veld])) v[veld] = b[veld].map(x => schoon(x, 40)).filter(Boolean).slice(0, 20);
    }
    for (const vlag of ['rijbewijs', 'voertuig', 'gedragscode']) {
      if (b[vlag] !== undefined) v[vlag] = b[vlag] === true;
    }
    if (b.vogGeldigTot !== undefined) {
      const d = schoon(b.vogGeldigTot, 10);
      if (d && Number.isNaN(Date.parse(d))) return { status: 400, error: 'Gebruik een datum als 2027-05-01.' };
      v.vogGeldigTot = d || null;
      audit(w.key, 'vrijwilliger.vog', v.naam, d ? 'geldig tot ' + d : 'ingetrokken');
    }
    save();
    return { ok: true, vrijwilliger: beeld(v) };
  }

  /* De inzet zelf -- koppelen aan een project (met de VOG-grendel), uren boeken
     en evalueren -- staat in ./vrijwilligers-inzet.js. Afgesplitst op de 10 KB
     van keuringsregel 13; het register en de inzet zijn ook twee onderwerpen. */
  const inzet = require('./vrijwilligers-inzet')(ctx, { vind, vogGeldig, beeld, VOG_VERPLICHT });

  return { lijst, maak, zet, koppel: inzet.koppel, urenBoek: inzet.urenBoek,
    evaluatie: inzet.evaluatie, vogGeldig, beeld, STATUS, DAGDELEN, VOG_VERPLICHT };
};
module.exports.STATUS = STATUS;
module.exports.VOG_VERPLICHT = VOG_VERPLICHT;
