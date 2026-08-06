/* Foundation OS, deel "vrijwilligerportaal": de vrijwilliger zelf.

   TOT NU TOE WAS DE VRIJWILLIGER EEN RIJ IN EEN REGISTER. Hij werd beheerd,
   gekoppeld, geëvalueerd en uitgeleend -- en hij kon nergens zelf kijken. Dat
   is niet alleen onaardig, het is ook slecht voor de organisatie: elke
   beschikbaarheid die iemand niet zelf kan bijwerken, wordt per WhatsApp
   doorgegeven en staat een maand later verkeerd in het systeem.

   DE CODE IS ZIJN INGANG, EN DAT BEPAALT WAT ER IN STAAT. Een vrijwilliger
   heeft geen RTG-account; hij krijgt een code van zijn coördinator (RTFV-...).
   Een code kan over een schouder worden meegelezen en op een gedeelde laptop
   blijven staan. Daarom staat er hier GEEN contactgegeven, geen adres en geen
   telefoonnummer -- ook niet dat van hemzelf. Hij weet zijn eigen nummer; het
   toevoegen levert hem niets op en levert een meelezer alles.

   WAT HIJ WEL ZIET: waar hij op staat, hoeveel uren er op zijn naam staan, of
   zijn VOG nog geldig is en wanneer die verloopt, en welke activiteiten
   eraan komen waar hij begeleider is.

   WAT HIJ NIET ZIET, EN WAAROM DAT ZO IS: de evaluaties die de organisatie
   over hem schrijft. Niet omdat hij er geen recht op heeft -- dat heeft hij,
   het is een persoonsgegeven -- maar omdat een inzageverzoek langs een mens
   hoort te lopen die het kan uitleggen, en niet langs een scherm dat een
   oordeel zonder context toont. Dat staat ook in het portaal zelf, met de weg
   ernaartoe. Stilzwijgend weglaten zou hier het verkeerde zijn.

   EN HIJ ZET ZIJN EIGEN VOG NIET. Dat is de grendel van deze module: een
   vrijwilliger die zijn eigen VOG-datum kan invullen, is precies geen VOG-
   controle meer. Beschikbaarheid, talen en vaardigheden zijn van hem; de
   VOG, de gedragscode en zijn status zijn van de organisatie. */

const DAGDELEN = ['ma-o', 'ma-m', 'ma-a', 'di-o', 'di-m', 'di-a', 'wo-o', 'wo-m', 'wo-a',
  'do-o', 'do-m', 'do-a', 'vr-o', 'vr-m', 'vr-a', 'za', 'zo'];

module.exports = (ctx) => {
  const { nu, schoon, code, S, audit, wie, poort, save, stadVan, vogGeldig } = ctx;

  const vindCode = c => S().vrijwilligers.find(v => v.code === String(c || '').trim().toUpperCase()) || null;
  const urenVan = v => (v.uren || []).reduce((s, u) => s + u.uren, 0);

  /* Het beeld voor de vrijwilliger zelf. Een eigen functie en niet het
     kantoorbeeld met een filter erover: een filter dat je vergeet, lekt alles,
     en hier zou dat een evaluatie zijn. */
  function eigenBeeld(v) {
    const stad = stadVan(v.stad) || {};
    const projecten = (v.projecten || []).map(id => S().projecten.find(p => p.id === id))
      .filter(Boolean).map(p => ({ naam: p.naam, soort: p.soort, doelgroep: p.doelgroep, status: p.status }));
    const vandaag = nu().slice(0, 10);
    const komend = S().activiteiten.filter(a => (a.begeleiders || []).includes(v.id) &&
      (!a.wanneer || a.wanneer >= vandaag) && !['afgerond', 'afgelast'].includes(a.status))
      .map(a => ({ naam: a.naam, soort: a.soort, wanneer: a.wanneer, tijd: a.tijd, locatie: a.locatie,
        status: a.status, ingeschreven: (a.inschrijvingen || []).filter(i => i.status !== 'afgemeld').length,
        capaciteit: a.capaciteit }));
    const uitleen = S().uitleen.filter(u => u.vrijwilligerId === v.id && u.status === 'lopend' &&
      (!u.tot || Date.parse(u.tot) >= Date.now()))
      .map(u => ({ naarStad: (stadVan(u.naarStad) || {}).naam || null, tot: u.tot, reden: u.reden }));
    return {
      naam: v.naam, stad: stad.naam || null, status: v.status,
      beschikbaar: v.beschikbaar || [], talen: v.talen || [], vaardigheden: v.vaardigheden || [],
      rijbewijs: !!v.rijbewijs, voertuig: !!v.voertuig,
      gedragscode: !!v.gedragscode, vogGeldigTot: v.vogGeldigTot || null, vogGeldig: vogGeldig(v),
      trainingen: v.trainingen || [], urenTotaal: Math.round(urenVan(v) * 10) / 10,
      urenRecent: (v.uren || []).slice(-12).reverse().map(u => ({ datum: u.datum, uren: u.uren, km: u.km })),
      projecten, komend, uitleen, dagdelen: DAGDELEN,
      inzage: 'Wat de organisatie over u noteert (evaluaties) staat niet in dit scherm. ' +
        'U heeft daar wel recht op: vraag het bij uw coördinator, dan loopt het langs iemand die het kan toelichten.'
    };
  }

  function portaal(c) {
    const v = vindCode(c);
    if (!v) return { status: 404, error: 'Deze vrijwilligerscode kennen we niet. Vraag uw coördinator om een nieuwe.' };
    if (v.status === 'gestopt') {
      return { status: 403, error: 'Uw vrijwilligerswerk bij RTF is afgerond. Wilt u weer meedoen, neem dan contact op met de afdeling.' };
    }
    return { ok: true, vrijwilliger: eigenBeeld(v) };
  }

  /* Bijwerken. Alleen de drie dingen die van HEM zijn: wanneer hij kan, welke
     talen hij spreekt, wat hij kan. Niet zijn VOG, niet zijn gedragscode, niet
     zijn status -- die zijn van de organisatie, en een vrijwilliger die zijn
     eigen VOG-datum kan zetten, maakt van de VOG-controle een formaliteit. */
  function zetEigen(c, b) {
    b = b || {};
    const v = vindCode(c);
    if (!v) return { status: 404, error: 'Deze vrijwilligerscode kennen we niet.' };
    if (v.status === 'gestopt') return { status: 403, error: 'Dit dossier is afgesloten.' };
    for (const veld of ['vogGeldigTot', 'gedragscode', 'status']) {
      if (b[veld] !== undefined) {
        return { status: 403, error: 'Uw VOG, de gedragscode en uw status zet de afdeling, niet u zelf. ' +
          'Beschikbaarheid, talen en vaardigheden kunt u hier wel bijwerken.' };
      }
    }
    if (Array.isArray(b.beschikbaar)) {
      const on = b.beschikbaar.map(String).filter(x => !DAGDELEN.includes(x));
      if (on.length) return { status: 400, error: 'Onbekend dagdeel: ' + on.slice(0, 3).join(', ') + '.' };
      v.beschikbaar = [...new Set(b.beschikbaar.map(String))];
    }
    for (const veld of ['talen', 'vaardigheden']) {
      if (Array.isArray(b[veld])) v[veld] = b[veld].map(x => schoon(x, 40)).filter(Boolean).slice(0, 20);
    }
    if (b.rijbewijs !== undefined) v.rijbewijs = b.rijbewijs === true;
    if (b.voertuig !== undefined) v.voertuig = b.voertuig === true;
    audit('vrijwilliger:' + v.id, 'vrijwilliger.zelf-bijgewerkt', v.naam, 'beschikbaarheid of vaardigheden');
    save();
    return { ok: true, vrijwilliger: eigenBeeld(v) };
  }

  /* Uren die hij zelf opgeeft. Ze komen binnen als GEMELD en niet als geboekt:
     de coördinator bevestigt ze. Dat is geen wantrouwen maar hetzelfde
     vierogenprincipe als bij geld -- uren dragen het jaarverslag en de
     subsidieverantwoording, en een getal dat niemand heeft gezien, draagt niets. */
  function meldUren(c, b) {
    b = b || {};
    const v = vindCode(c);
    if (!v) return { status: 404, error: 'Deze vrijwilligerscode kennen we niet.' };
    if (v.status !== 'actief') return { status: 400, error: 'U staat op "' + v.status + '"; uren opgeven kan als u actief bent.' };
    const n = Number(b.uren);
    if (!Number.isFinite(n) || n <= 0 || n > 24) return { status: 400, error: 'Hoeveel uren? Meer dan nul, hoogstens 24 op een dag.' };
    const pid = schoon(b.projectId, 20);
    if (pid && !(v.projecten || []).includes(pid)) return { status: 400, error: 'U staat niet op dat project.' };
    if (!Array.isArray(v.gemeldeUren)) v.gemeldeUren = [];
    if (v.gemeldeUren.length >= 500) return { status: 400, error: 'Er staan te veel meldingen open; vraag uw coördinator ze te bevestigen.' };
    v.gemeldeUren.push({ id: ctx.rid(), projectId: pid || null, uren: Math.round(n * 100) / 100,
      datum: schoon(b.datum, 10) || nu().slice(0, 10),
      km: Math.max(0, Math.min(2000, Math.round(Number(b.km) || 0))), at: nu() });
    save();
    return { ok: true, gemeld: v.gemeldeUren.length,
      melding: 'Doorgegeven. Uw coördinator bevestigt de uren; daarna tellen ze mee.' };
  }

  /* De kantoorkant -- de code uitgeven en de gemelde uren bevestigen -- staat in
     ./vrijwilligerportaal-kantoor.js. Dat is de andere kant van dezelfde deur
     en het hoort bij elkaar; dit bestand liep tegen de 10 KB van
     keuringsregel 13. */
  const kantoor = require('./vrijwilligerportaal-kantoor')(ctx, { vindCode, urenVan });

  return { portaal, zetEigen, meldUren, codeVoor: kantoor.codeVoor,
    bevestigUren: kantoor.bevestigUren, vindCode, DAGDELEN };
};
module.exports.DAGDELEN = DAGDELEN;
