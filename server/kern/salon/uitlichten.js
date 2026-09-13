/* De Salon (deelmodule): UITLICHTEN IS EEN REDACTIEHANDELING.

   HET GAT DAT DIT DICHT (13 september 2026). `kern/salonviraal.js` zegt in zijn
   kop "RTG cureert: altijd zichtbaar" en `CLAUDE.md` belooft hetzelfde bij het
   site- en campagnebeeld. Maar `featured` werd NERGENS gezet behalve in de seed:
   er bestond geen handeling waarmee RTG cureerde. De merkregel was waar in de
   tekst en nergens in de code -- gevonden door scripts/wekdekking.js, die van elk
   publiek moment vraagt of zijn AANLEIDING in de bron staat.

   HET BESLUIT: EEN MENS LICHT UIT, EN NIETS ANDERS.

   Geen AI-curatie en geen automatische viraal-selectie. `salonviraal.js` mag
   hoogstens zeggen welke posts redactionele aandacht VERDIENEN -- de overgang
   naar uitgelicht zet een mens. Zonder die regel verandert "RTG cureert" stil in
   "een engagementalgoritme cureert namens RTG", en dat is precies wat dit huis
   elders overal tegenhoudt.

   VIER DINGEN LIGGEN DAAROM VAST:

   1. EEN GROND IS VERPLICHT, uit een gesloten lijst. Niet omdat de lezer hem
      moet zien -- hij is niet openbaar -- maar omdat de handeling daarmee
      navraagbaar wordt. "engagementscore 8,2" staat er met opzet niet tussen:
      een cijfer als grond is precies de automatisering die hier niet mag.
   2. HET GEBEURT OP NAAM. Wie met de GEDEELDE kantoorcode inlogt kan niet
      uitlichten -- dezelfde grens die de toelatingsketen al vond. Een spoor dat
      eindigt bij een gedeelde code is geen spoor (KANTOOR.md).
   3. INTREKKEN IS EVEN EXPLICIET. Er blijft geen post achter die "nog featured"
      heet omdat niemand hem heeft teruggehaald. Een looptijd mag, en dan vervalt
      hij vanzelf -- maar dat verval is BEREKEND en niet een tweede waarheid.
   4. HET IS EEN GEBEURTENIS EN GEEN VINKJE. Post, redacteur, grond, tijdstip en
      looptijd staan er alle vijf; `featured` blijft bestaan omdat de feed en de
      beeldbron erop lezen, maar hij is nu de PROJECTIE van deze handeling en
      niet zelf de waarheid. */
'use strict';

/* De gesloten lijst gronden. Wat hier niet staat, bestaat niet als grond -- dat
   is de enige manier waarop "waarom is dit uitgelicht" een jaar later nog te
   beantwoorden is. */
const GRONDEN = Object.freeze([
  { id: 'bijzonder', naam: 'Bijzonder werk' },
  { id: 'lokaal', naam: 'Lokaal moment' },
  { id: 'maatschappelijk', naam: 'Maatschappelijke betekenis' },
  { id: 'talent', naam: 'Nieuw talent' },
  { id: 'actualiteit', naam: 'Actualiteit' },
  { id: 'redactie', naam: 'Redactionele selectie' }
]);
const GROND_IDS = GRONDEN.map(g => g.id);

module.exports = ({ db, save, schoon, nieuwMoment, aanwezigZorg, codenaamVan }) => {
  const nu = () => new Date().toISOString();
  const posts = () => (Array.isArray(db.data.posts) ? db.data.posts : []);
  const vind = (id) => posts().find(p => p && String(p.id) === String(id)) || null;

  function R() {
    if (!Array.isArray(db.data.salonUitlicht)) db.data.salonUitlicht = [];
    return db.data.salonUitlicht;
  }

  /* VERVAL IS BEREKEND EN GEEN TWEEDE WAARHEID. Een looptijd die om is, maakt de
     uitlichting niet ongedaan in de data -- hij telt alleen niet meer mee. Zo kan
     niemand later zien dat er "niets was", terwijl er wel degelijk iets was. */
  const loopt = (r) => !r.ingetrokken && (!r.tot || r.tot > nu());

  const actief = () => R().filter(loopt);

  /* De projectie terug naar het veld waar de feed en de beeldbron op lezen. Eén
     schrijver, zodat `featured` niet op twee plekken kan ontstaan. */
  function projecteer() {
    const aan = new Set(actief().map(r => String(r.post)));
    let veranderd = false;
    for (const p of posts()) {
      const hoort = aan.has(String(p.id));
      if (!!p.featured !== hoort) { p.featured = hoort; veranderd = true; }
    }
    if (veranderd) save();
    return aan.size;
  }

  /* ---- uitlichten ---- */
  function uitlicht(redacteur, data) {
    data = data || {};
    if (!redacteur) return { status: 403, error: 'Uitlichten gebeurt op naam. Log in met een eigen account, niet met de gedeelde kantoorcode.' };
    const post = vind(data.postId);
    if (!post) return { status: 404, error: 'Deze post bestaat niet.' };
    const grond = String(data.grond || '');
    if (!GROND_IDS.includes(grond))
      return { status: 400, error: 'Kies een grond.', gronden: GRONDEN };
    if (actief().some(r => String(r.post) === String(post.id)))
      return { status: 409, error: 'Deze post is al uitgelicht.' };
    /* Een looptijd is optioneel; is hij er, dan moet hij in de toekomst liggen.
       Een looptijd in het verleden zou een uitlichting maken die nooit liep. */
    let tot = null;
    if (data.tot) {
      tot = String(data.tot);
      if (!(tot > nu())) return { status: 400, error: 'Een looptijd ligt in de toekomst.' };
    }
    const regel = { id: 'ul' + Date.now().toString(36), post: String(post.id),
      redacteur: String(redacteur), grond, toelichting: schoon(data.toelichting, 200) || null,
      at: nu(), tot, ingetrokken: null };
    R().push(regel);
    projecteer();
    save();

    /* HET MOMENT. Pas hier, en pas na een mens: dit is de aanleiding waar
       scripts/wekdekking.js naar zoekt. De aanwezigheid is die van de AUTEUR --
       het is zijn werk dat wordt uitgelicht, niet dat van de redactie. */
    let moment = null;
    if (nieuwMoment && aanwezigZorg && post.authorKey) {
      try {
        const a = aanwezigZorg('lid', post.authorKey, codenaamVan ? codenaamVan(post.authorKey) : null);
        if (a) moment = nieuwMoment(a.id, 'uitgelicht', schoon(post.text, 60) || null);
      } catch (e) { /* een melding die niet lukt, houdt de uitlichting niet tegen */ }
    }
    return { status: 200, ok: true, uitlichting: regel, moment };
  }

  /* ---- intrekken: even expliciet, en met een reden ---- */
  function trekIn(redacteur, data) {
    data = data || {};
    if (!redacteur) return { status: 403, error: 'Intrekken gebeurt op naam.' };
    const regel = actief().find(r => r.id === String(data.id || '') || String(r.post) === String(data.postId || ''));
    if (!regel) return { status: 404, error: 'Er loopt hier geen uitlichting.' };
    const reden = schoon(data.reden, 200);
    if (!reden) return { status: 400, error: 'Geef de reden van het intrekken.' };
    regel.ingetrokken = { door: String(redacteur), reden, at: nu() };
    projecteer();
    save();
    return { status: 200, ok: true, uitlichting: regel };
  }

  /* ---- wat de redactie ziet ----
     De VOORSTELLEN komen uit salonviraal en heten met zoveel woorden een
     voorstel: die module telt betrokkenheid en mag daarmee zeggen waar aandacht
     naartoe KAN. Hij zet niets. */
  function bord(voorstellen) {
    projecteer();
    return {
      status: 200, ok: true, gronden: GRONDEN,
      lopend: actief().map(r => ({ id: r.id, post: r.post, grond: r.grond, door: r.redacteur, at: r.at, tot: r.tot })),
      geschiedenis: R().filter(r => !loopt(r)).slice(-30).reverse()
        .map(r => ({ id: r.id, post: r.post, grond: r.grond, door: r.redacteur, at: r.at,
          ingetrokken: r.ingetrokken || null, verlopen: !r.ingetrokken && !!r.tot })),
      voorstellen: Array.isArray(voorstellen) ? voorstellen : [],
      /* Even groot erbij, want een leeg vak wordt gevuld met iemands eigen
         indruk: dit bord rangschikt niet en beveelt niets aan. */
      watDitNietDoet: 'Er staat geen volgorde en geen score. Voorstellen zijn posts met veel betrokkenheid; of iets uitgelicht hoort te worden, beslist een mens.'
    };
  }

  return { uitlicht, trekIn, uitlichtBord: bord, uitlichtProjecteer: projecteer,
    UITLICHT_GRONDEN: GRONDEN };
};
module.exports.GRONDEN = GRONDEN;
