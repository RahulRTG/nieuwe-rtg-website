/* RTMAIL (deelmodule): rechten op een postvak, fijner dan "mag erin".

   WAAROM DIT NIET EEN VLAGGETJE IS. "Toegang tot de mailbox" is bij post geen
   bruikbaar recht. Een supportmedewerker mag antwoorden vanuit support@ maar
   het postvak niet exporteren; een teamleider mag gesprekken toewijzen maar
   geen bewaartermijn wijzigen; een jurist mag bij een onderzoek de METADATA
   zien zonder de inhoud te lezen. Zonder aparte rechten wordt dat een keuze
   tussen alles of niets, en dan wordt het in de praktijk altijd alles.

   DE RECHTEN, en waarom ze los staan:

     metadata     wie, aan wie, wanneer, onderwerp -- zonder de tekst
     lezen        de inhoud van een bericht
     antwoorden   reageren in een bestaand gesprek
     verzenden    nieuw bericht vanuit dit adres
     namens       schrijven met de eigen naam eronder (delegatie)
     verwijderen  naar de prullenbak (terug te halen)
     vernietigen  echt weg, met een spoor -- nooit hetzelfde recht als het vorige
     exporteren   het postvak als bestand meenemen
     regels       filters en afwezigheid instellen
     delegatie    anderen rechten geven op dit postvak
     bewaarbeleid de bewaartermijn en de juridische bewaring zetten
     zoekenBreed  over meerdere postvakken zoeken
     inzage       juridische inzage: metadata over alles, inhoud alleen met reden

   TWEE REGELS DIE NIET TE OMZEILEN ZIJN:

   1. DE EIGENAAR VAN EEN POSTVAK HEEFT ALTIJD ALLES OP ZIJN EIGEN POSTVAK,
      behalve `inzage` -- dat is geen recht dat je jezelf geeft.
   2. VIER RECHTEN VRAGEN ALTIJD EEN REDEN: vernietigen, exporteren,
      zoekenBreed en inzage. Zonder reden is het antwoord nee, niet "ja maar we
      loggen het". Een reden achteraf verzinnen kan iedereen; een reden vooraf
      opschrijven is een drempel. */
const adresLaag = require('./rtmail-adres');

const RECHTEN = ['metadata', 'lezen', 'antwoorden', 'verzenden', 'namens', 'verwijderen',
  'vernietigen', 'exporteren', 'regels', 'delegatie', 'bewaarbeleid', 'zoekenBreed', 'inzage'];
const REDEN_NODIG = ['vernietigen', 'exporteren', 'zoekenBreed', 'inzage'];
// wat een eigenaar op zijn eigen postvak sowieso mag; inzage staat er bewust niet bij
const EIGEN = RECHTEN.filter(r => r !== 'inzage');

module.exports = ({ db, save, crypto }) => {
  const nu = () => new Date().toISOString();
  const busVan = (adres) => {
    const o = adresLaag.ontleed(adres);
    return o.binnenshuis ? String(o.lokaal || '').replace(/[.-]/g, '') : String(o.adres || '');
  };
  const kap = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, n);

  function D() {
    if (!db.data.rtmailRecht || typeof db.data.rtmailRecht !== 'object')
      db.data.rtmailRecht = { delegaties: [], journaal: [] };
    const d = db.data.rtmailRecht;
    if (!Array.isArray(d.delegaties)) d.delegaties = [];
    if (!Array.isArray(d.journaal)) d.journaal = [];
    return d;
  }

  /* Het journaal. Elke handeling die iets zegt over ANDERMANS post komt hier
     langs -- lezen, zoeken, exporteren, vernietigen, rechten geven. Hij staat
     nieuwste eerst en is niet te wissen via een gewone weg; wat hier eenmaal
     in staat, hoort een vraag te kunnen beantwoorden die pas over een jaar
     gesteld wordt. */
  function log(wie, wat, waarover, reden, extra) {
    const d = D();
    d.journaal.unshift(Object.assign({ id: crypto.randomBytes(5).toString('hex'),
      wie: kap(wie, 80) || 'onbekend', wat, waarover: kap(waarover, 120) || null,
      reden: kap(reden, 300) || null, at: nu() }, extra || {}));
    d.journaal = d.journaal.slice(0, 50000);
    save();
    return d.journaal[0];
  }

  /* Rechten geven op een postvak. Alleen wie zelf `delegatie` heeft (dus de
     eigenaar, of iemand die dat recht kreeg) mag dit -- en nooit meer geven dan
     hij zelf heeft. Anders is elke delegatie een manier om rechten te maken
     die niemand had. */
  function delegeer(gever, { postvak, aan, rechten, tot, reden } = {}) {
    const bus = busVan(postvak);
    const aanBus = busVan(aan);
    if (!bus || !aanBus) return { error: 'Welk postvak, en aan wie?' };
    if (!mag(gever, postvak, 'delegatie').ok) return { error: 'U mag op dit postvak geen rechten weggeven.' };
    const gevraagd = (Array.isArray(rechten) ? rechten : []).map(r => String(r)).filter(r => RECHTEN.includes(r));
    if (!gevraagd.length) return { error: 'Welke rechten? Kies uit: ' + RECHTEN.join(', ') + '.' };
    const teveel = gevraagd.filter(r => !mag(gever, postvak, r, 'delegatie').ok);
    if (teveel.length) return { error: 'U kunt niet weggeven wat u zelf niet heeft: ' + teveel.join(', ') + '.' };
    const t = tot ? new Date(tot) : null;
    if (t && isNaN(t.getTime())) return { error: 'Dat is geen tijdstip.' };
    const d = D();
    const bestaand = d.delegaties.find(x => x.postvak === bus && x.aan === aanBus);
    const rij = bestaand || { id: crypto.randomBytes(5).toString('hex'), postvak: bus, aan: aanBus, at: nu() };
    rij.rechten = gevraagd;
    rij.tot = t ? t.toISOString() : null;
    rij.door = busVan(gever);
    rij.reden = kap(reden, 300) || null;
    if (!bestaand) d.delegaties.push(rij);
    log(gever, 'rechten gegeven', postvak, reden, { aan: aanBus, rechten: gevraagd, tot: rij.tot });
    save();
    return { ok: true, delegatie: publiek(rij) };
  }

  function neemAf(gever, { postvak, aan } = {}) {
    const d = D();
    const bus = busVan(postvak), aanBus = busVan(aan);
    if (!mag(gever, postvak, 'delegatie').ok) return { error: 'U mag op dit postvak geen rechten wijzigen.' };
    const i = d.delegaties.findIndex(x => x.postvak === bus && x.aan === aanBus);
    if (i < 0) return { error: 'Die delegatie bestaat niet.' };
    d.delegaties.splice(i, 1);
    log(gever, 'rechten afgenomen', postvak, null, { aan: aanBus });
    save();
    return { ok: true };
  }

  const publiek = (r) => ({ id: r.id, postvak: r.postvak, aan: r.aan, rechten: r.rechten,
    tot: r.tot || null, door: r.door || null, at: r.at });

  const geldig = (r, t) => !r.tot || r.tot >= t;

  /* De kernvraag: mag DEZE persoon DIT op DAT postvak? Geeft altijd een reden
     terug bij nee -- "u mag dit niet" zonder waarom kost een supportgesprek. */
  function mag(wie, postvak, recht, alsDelegatieCheck) {
    if (!RECHTEN.includes(recht)) return { ok: false, waarom: 'Dat recht bestaat niet.' };
    const eigen = busVan(wie), bus = busVan(postvak);
    if (!eigen || !bus) return { ok: false, waarom: 'Postvak of persoon niet te bepalen.' };
    if (eigen === bus) {
      return EIGEN.includes(recht)
        ? { ok: true, via: 'eigen postvak' }
        : { ok: false, waarom: 'Juridische inzage geeft niemand zichzelf; die loopt via een onderzoek.' };
    }
    const t = nu();
    const d = D().delegaties.find(x => x.postvak === bus && x.aan === eigen && geldig(x, t));
    if (d && d.rechten.includes(recht)) return { ok: true, via: 'delegatie', tot: d.tot || null };
    const verlopen = D().delegaties.find(x => x.postvak === bus && x.aan === eigen && !geldig(x, t));
    if (verlopen && !alsDelegatieCheck) {
      return { ok: false, waarom: 'Uw toegang tot dit postvak is verlopen op ' + verlopen.tot + '.' };
    }
    return { ok: false, waarom: 'U heeft op dit postvak geen recht "' + recht + '".' };
  }

  /* De poort die routes gebruiken. Vraagt een reden waar dat hoort, weigert
     zonder, en schrijft ALTIJD een regel in het journaal wanneer het om
     andermans postvak gaat -- ook als het antwoord nee was. Een geweigerde
     poging is precies wat een beveiligingsonderzoek wil zien. */
  function poort(wie, postvak, recht, reden) {
    const r = mag(wie, postvak, recht);
    const eigenPostvak = busVan(wie) === busVan(postvak);
    if (REDEN_NODIG.includes(recht) && !kap(reden, 300)) {
      if (!eigenPostvak || recht !== 'exporteren') {
        const uit = { ok: false, waarom: 'Hiervoor is een reden nodig; die wordt vastgelegd in het journaal.' };
        if (!eigenPostvak) log(wie, 'geweigerd: ' + recht, postvak, null, { waarom: uit.waarom });
        return uit;
      }
    }
    if (!eigenPostvak) log(wie, (r.ok ? '' : 'geweigerd: ') + recht, postvak, reden, r.ok ? {} : { waarom: r.waarom });
    return r;
  }

  function journaal({ postvak, wie, limit = 100 } = {}) {
    const bus = postvak ? busVan(postvak) : null;
    const w = wie ? busVan(wie) : null;
    return D().journaal
      .filter(r => (!bus || busVan(r.waarover || '') === bus) && (!w || busVan(r.wie) === w))
      .slice(0, Math.max(1, Math.min(500, limit)));
  }

  const opPostvak = (postvak) => {
    const bus = busVan(postvak), t = nu();
    return D().delegaties.filter(x => x.postvak === bus).map(x => Object.assign(publiek(x), { geldig: geldig(x, t) }));
  };

  return { RECHTEN, REDEN_NODIG, EIGEN, mag, poort, delegeer, neemAf, journaal, opPostvak, log };
};
