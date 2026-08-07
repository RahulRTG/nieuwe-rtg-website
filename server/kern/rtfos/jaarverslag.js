/* Foundation OS, deel "jaarverslag": het jaarstuk en de ANBI-publicatie.

   EEN ANBI MOET PUBLICEREN. Dat is geen nette gewoonte maar een voorwaarde voor
   de status waar de hele giftenaftrek aan hangt: balans, staat van baten en
   lasten, en een verslag van de activiteiten, openbaar en vindbaar. Een
   stichting die dat vergeet, hoort het van de Belastingdienst en niet van
   zichzelf.

   DE GRENDEL DIE DIT DOCUMENT ANDERS MAAKT DAN EEN RAPPORTAGE: DE CIJFERS
   WORDEN BEVROREN. Een rapportagescherm rekent live -- dat hoort ook. Een
   jaarverslag mag dat niet: een verantwoording die meebeweegt met de database
   is geen verantwoording. Bij het opstellen wordt de stand van dat moment in
   het document geschreven, en daarna verandert hij niet meer, ook niet als er
   morgen een uitgave uit dat jaar wordt bijgeboekt. Wie dan een ander getal
   wil, stelt een nieuw verslag op met een reden erbij.

   EN VERDER, IN VOLGORDE:
   1. OPSTELLEN kan iedereen met landelijke bevoegdheid; het is een concept.
   2. VASTSTELLEN kan alleen met een AANGENOMEN besluit uit VASTGESTELDE
      notulen (bestuur-notulen.js). Een jaarverslag zonder bestuursbesluit is
      een tekst, geen jaarrekening.
   3. PUBLICEREN kan alleen na vaststelling, en daarna ligt het stuk vast --
      publiceren en dan bijwerken is precies wat de publicatieplicht moet
      voorkomen.

   WAT ER NIET IN ZIT: geen balans en geen accountantsverklaring. Dit OS voert
   geen dubbele boekhouding voor de stichting (die staat in kern/bank); wat hier
   staat zijn de baten, de bestedingen en wat ermee bereikt is. De balans komt
   uit de boekhouding en wordt hier als bijlage aangehaakt. */

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, S, audit, wie, save } = ctx;
  const { cijfersVan, besluitVindbaar } = eigen;

  const vind = id => S().jaarverslagen.find(j => j.id === String(id || '')) || null;

  const beeld = j => ({ id: j.id, jaar: j.jaar, titel: j.titel, verhaal: j.verhaal,
    cijfers: j.cijfers, opgesteldOp: j.at, opgesteldDoor: j.door,
    vastgesteld: j.vastgesteld || null, gepubliceerd: j.gepubliceerd || null,
    bijlagen: (j.bijlagen || []).map(b => ({ naam: b.naam, url: b.url })),
    reden: j.reden || null });

  /* De bevroren stand: alle steden opgeteld, plus per stad. Wat hier in gaat is
     wat er OP DIT MOMENT in het systeem staat -- inclusief de wetenschap dat
     dat niet compleet is. Daarom gaat "gemeten: false" gewoon mee: een nul die
     "niet gemeten" betekent, moet dat ook in het jaarverslag zeggen. */
  function bevries() {
    const steden = S().steden.filter(s => s.status !== 'verkend');
    const per = steden.map(s => ({ stad: s.id, naam: s.naam, cijfers: cijfersVan(s.id) }));
    const tel = (pad) => per.reduce((a, p) => {
      const v = pad.split('.').reduce((o, k) => (o || {})[k], p.cijfers);
      return a + (Number(v) || 0);
    }, 0);
    return {
      bevrorenOp: nu(),
      steden: per.length,
      totaal: {
        projectenActief: tel('projecten.actief'),
        uniekGeholpen: tel('mensen.uniekGeholpen'),
        vrijwilligers: tel('mensen.vrijwilligers'),
        vrijwilligersuren: Math.round(tel('mensen.vrijwilligersuren') * 10) / 10,
        batenEuro: Math.round(tel('geld.binnen') * 100) / 100,
        bestedingenEuro: Math.round(tel('geld.besteed') * 100) / 100,
        hulpvragen: tel('hulpvragen.totaal'),
        partnersActief: tel('partners.actief'),
        // eerlijk blijven: hoeveel steden hebben hun bereik uberhaupt gemeten
        stedenMetMeting: per.filter(p => p.cijfers.mensen.gemeten).length
      },
      perStad: per.map(p => ({ stad: p.stad, naam: p.naam,
        projectenActief: p.cijfers.projecten.actief,
        uniekGeholpen: p.cijfers.mensen.uniekGeholpen,
        gemeten: p.cijfers.mensen.gemeten,
        vrijwilligers: p.cijfers.mensen.vrijwilligers,
        batenEuro: p.cijfers.geld.binnen, bestedingenEuro: p.cijfers.geld.besteed }))
    };
  }

  function stelOp(req, b) {
    b = b || {};
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'Het jaarverslag stelt het landelijke bestuur op.' };
    const jaar = Math.round(Number(b.jaar) || 0);
    if (jaar < 2000 || jaar > 2100) return { status: 400, error: 'Over welk jaar gaat dit verslag?' };
    const bestaand = S().jaarverslagen.filter(j => j.jaar === jaar);
    /* Een tweede verslag over hetzelfde jaar mag, maar niet stilletjes: er moet
       een reden bij, en het vorige blijft staan. Een verantwoording die je kunt
       overschrijven is er geen. */
    const reden = schoon(b.reden, 300);
    if (bestaand.length && !reden) {
      return { status: 400, error: 'Er is al een verslag over ' + jaar + '. Een tweede kan, maar dan met een reden erbij ' +
        '-- en het eerste blijft staan.' };
    }
    if (bestaand.some(j => j.gepubliceerd) && !reden) {
      return { status: 400, error: 'Het verslag over ' + jaar + ' is al gepubliceerd. Een herziening vraagt een reden.' };
    }
    const j = { id: rid(), jaar, titel: schoon(b.titel, 120) || ('Jaarverslag ' + jaar),
      verhaal: schoon(b.verhaal, 6000), cijfers: bevries(),
      reden: reden || null, bijlagen: [], vastgesteld: null, gepubliceerd: null,
      door: w.key, at: nu() };
    S().jaarverslagen.push(j);
    audit(w.key, 'jaarverslag.opgesteld', j.id, String(jaar) + (reden ? ' (herziening: ' + reden + ')' : ''));
    save();
    return { ok: true, jaarverslag: beeld(j),
      melding: 'De cijfers van dit moment staan nu vast in het verslag. Wat er hierna in het systeem verandert, ' +
        'verandert dit stuk niet meer.' };
  }

  function vulAan(req, id, b) {
    b = b || {};
    const j = vind(id);
    if (!j) return { status: 404, error: 'Dit jaarverslag bestaat niet.' };
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'Het jaarverslag beheert het landelijke bestuur.' };
    if (j.gepubliceerd) return { status: 400, error: 'Dit verslag is gepubliceerd en ligt vast. Stel een herziening op, met een reden.' };
    if (j.vastgesteld) return { status: 400, error: 'Dit verslag is door het bestuur vastgesteld; de tekst ligt vast.' };
    if (b.verhaal !== undefined) j.verhaal = schoon(b.verhaal, 6000);
    if (b.titel !== undefined && schoon(b.titel, 120)) j.titel = schoon(b.titel, 120);
    if (b.bijlage && schoon(b.bijlage.naam, 80)) {
      if (!Array.isArray(j.bijlagen)) j.bijlagen = [];
      if (j.bijlagen.length >= 12) return { status: 400, error: 'Twaalf bijlagen is genoeg.' };
      j.bijlagen.push({ naam: schoon(b.bijlage.naam, 80), url: schoon(b.bijlage.url, 300) });
    }
    save();
    return { ok: true, jaarverslag: beeld(j) };
  }

  function stelVast(req, id, besluitId) {
    const j = vind(id);
    if (!j) return { status: 404, error: 'Dit jaarverslag bestaat niet.' };
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'Het jaarverslag stelt het landelijke bestuur vast.' };
    if (j.vastgesteld) return { status: 400, error: 'Dit verslag is al vastgesteld.' };
    const g = besluitVindbaar(besluitId, { soort: 'landelijk' });
    if (!g.ok) return g;
    j.vastgesteld = { besluitId: g.besluit.id, vergadering: g.vergadering.datum, door: w.key, at: nu() };
    audit(w.key, 'jaarverslag.vastgesteld', j.id, 'besluit van ' + g.vergadering.datum);
    save();
    return { ok: true, jaarverslag: beeld(j),
      melding: 'Vastgesteld op grond van het besluit van ' + g.vergadering.datum + '. Publiceren kan nu.' };
  }

  function publiceer(req, id) {
    const j = vind(id);
    if (!j) return { status: 404, error: 'Dit jaarverslag bestaat niet.' };
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'Publiceren doet het landelijke bestuur.' };
    if (!j.vastgesteld) {
      return { status: 400, error: 'Dit verslag is niet door het bestuur vastgesteld. Publiceren zonder vaststelling zet een ' +
        'concept op de site met het gezag van een jaarrekening.' };
    }
    if (j.gepubliceerd) return { status: 400, error: 'Dit verslag staat al openbaar sinds ' + String(j.gepubliceerd.at).slice(0, 10) + '.' };
    j.gepubliceerd = { door: w.key, at: nu() };
    audit(w.key, 'jaarverslag.gepubliceerd', j.id, String(j.jaar));
    save();
    return { ok: true, jaarverslag: beeld(j),
      melding: 'Openbaar. Het stuk ligt hiermee vast; een correctie is een herziening met een reden, geen wijziging.' };
  }

  function lijst(req) {
    const w = wie(req);
    if (!w.key) return { status: 403, error: 'Log in om de jaarverslagen te beheren.' };
    const rijen = S().jaarverslagen.slice().sort((a, b) => b.jaar - a.jaar || String(b.at).localeCompare(String(a.at)));
    return { ok: true, aantal: rijen.length,
      nietGepubliceerd: rijen.filter(j => !j.gepubliceerd).length,
      jaarverslagen: rijen.slice(0, 60).map(beeld) };
  }

  /* De openbare kant: alleen wat is vastgesteld EN gepubliceerd. Dit is de
     ANBI-publicatie, dus hij hangt onder /publiek en niet achter een inlog. */
  function openbaar() {
    const rijen = S().jaarverslagen.filter(j => j.gepubliceerd && j.vastgesteld)
      .sort((a, b) => b.jaar - a.jaar);
    return { ok: true, aantal: rijen.length, jaarverslagen: rijen.slice(0, 20).map(j => ({
      jaar: j.jaar, titel: j.titel, verhaal: j.verhaal, cijfers: j.cijfers,
      vastgesteldOp: j.vastgesteld.vergadering, gepubliceerdOp: String(j.gepubliceerd.at).slice(0, 10),
      bijlagen: (j.bijlagen || []).map(b => ({ naam: b.naam, url: b.url })) })) };
  }

  return { stelOp, vulAan, stelVast, publiceer, lijst, openbaar, vind, beeld, bevries };
};
