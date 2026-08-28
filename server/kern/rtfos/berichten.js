/* Foundation OS, deel "berichten": communicatie per stad, onder een landelijk
   merk.

   DE SCHEIDSLIJN LOOPT NIET LANGS HET KANAAL MAAR LANGS HET PUBLIEK. Een stad
   die zijn eigen vrijwilligers een appje stuurt over de zaterdag, moet dat
   gewoon kunnen -- daar tussen gaan zitten maakt een landelijk bureau tot een
   flessenhals en zorgt ervoor dat het bericht buiten het systeem om gaat, via
   een privé-appgroep waar niemand meer bij kan.

   Maar een verklaring NAAR BUITEN draagt de naam van de hele stichting. Een
   ongelukkige zin van een stadsvrijwilliger over een incident is geen lokaal
   probleem: hij staat de volgende dag onder de naam RTFoundation in de krant.
   Merk- en naamgebruik staat daarom bij het landelijke toezicht, en dat is hier
   een grendel: publieke berichten gaan pas de deur uit na landelijke
   goedkeuring.

   ER IS GEEN NOODUITGANG, WEL VOORRANG. De verleiding is groot om bij crisis
   een omweg te maken ("het moet nu"). Dat is precies het moment waarop de
   verkeerde zin naar buiten gaat. In plaats daarvan krijgt een spoedbericht een
   vlag en staat het bovenaan de landelijke lijst. Snelheid komt van prioriteit,
   niet van het weglaten van de controle.

   GOEDKEUREN GAAT OVER DEZE TEKST, NIET OVER DIT BERICHT. Wie de tekst na de
   goedkeuring wijzigt, valt terug op concept. Anders is een goedkeuring een
   handtekening onder een blanco vel: je keurt "de mededeling over zaterdag"
   goed en er staat de volgende dag iets heel anders.

   VERZONDEN IS EEN EINDPUNT. Een bericht gaat een keer de deur uit; daarna kan
   het niet worden gewijzigd en niet opnieuw worden verzonden. Wat eruit is, is
   eruit -- en dat hoort de administratie ook te zeggen. */

const DOELGROEPEN = ['vrijwilligers', 'partners', 'projectgroep', 'deelnemers', 'ondernemers', 'publiek'];
/* HERNOEMD VAN `KANALEN`. Vier domeinen droegen dat woord met vier
   betekenissen en een onderlinge overlap van 0,10 -- SEMANTIEK.json had het in
   de top staan als botsing. Het woord `kanaal` is nu van de VERKOOPWEG
   (kern/horeca.js: tafel, bar, terras, afhaal, bezorging), omdat dat de enige
   betekenis is waar een nieuwe laag hem voor nodig heeft; zie COMMERCE.md
   par. 3. Dit is langs welke weg een bericht wordt verstuurd (app, e-mail, sms, push).

   Er is niets aan de WAARDEN veranderd, alleen aan de naam ervan. */
const BERICHTWEGEN = ['app', 'email', 'sms', 'push', 'nieuwsbrief'];
const STATUS = ['concept', 'wacht_op_landelijk', 'goedgekeurd', 'verzonden', 'afgekeurd'];
// Wie hier in staat, spreekt namens de hele stichting.
const NAAR_BUITEN = ['publiek'];

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, wie, poort, save } = ctx;

  const B = () => S().berichten;
  const vind = id => B().find(b => b.id === String(id || '')) || null;
  const beeld = b => ({ id: b.id, stad: b.stad, doelgroep: b.doelgroep, kanaal: b.kanaal,
    onderwerp: b.onderwerp, tekst: b.tekst, projectId: b.projectId || null, status: b.status,
    spoed: !!b.spoed, naarBuiten: NAAR_BUITEN.includes(b.doelgroep),
    door: b.door, besluit: b.besluit || null, verzondenAt: b.verzondenAt || null, at: b.at });

  function lijst(req, stadId) {
    const w = wie(req);
    // Het landelijke bestuur zonder stad: de goedkeurbak, spoed bovenaan.
    if (w.landelijk && !stadId) {
      const wacht = B().filter(b => b.status === 'wacht_op_landelijk');
      wacht.sort((a, b) => (b.spoed ? 1 : 0) - (a.spoed ? 1 : 0));
      return { ok: true, doelgroepen: DOELGROEPEN, kanalen: BERICHTWEGEN, statussen: STATUS, landelijk: true,
        teBeoordelen: wacht.map(beeld), berichten: B().slice(-200).reverse().map(beeld) };
    }
    const g = poort(w, stadId, 'stad.lezen');
    if (!g.ok) return g;
    const rijen = B().filter(b => b.stad === g.stad.id);
    return { ok: true, doelgroepen: DOELGROEPEN, kanalen: BERICHTWEGEN, statussen: STATUS, landelijk: !!w.landelijk,
      teBeoordelen: rijen.filter(b => b.status === 'wacht_op_landelijk').map(beeld),
      berichten: rijen.slice(-200).reverse().map(beeld) };
  }

  function maak(req, b) {
    b = b || {};
    const w = wie(req);
    const g = poort(w, b.stad, 'project.beheren');
    if (!g.ok) return g;
    const doelgroep = String(b.doelgroep || '');
    if (!DOELGROEPEN.includes(doelgroep)) return { status: 400, error: 'Kies een doelgroep (' + DOELGROEPEN.join(', ') + ').' };
    const kanaal = String(b.kanaal || 'app');
    if (!BERICHTWEGEN.includes(kanaal)) return { status: 400, error: 'Kies een kanaal (' + BERICHTWEGEN.join(', ') + ').' };
    const onderwerp = schoon(b.onderwerp, 120);
    if (onderwerp.length < 3) return { status: 400, error: 'Waar gaat het bericht over?' };
    const tekst = schoon(b.tekst, 4000);
    if (tekst.length < 5) return { status: 400, error: 'Wat wilt u zeggen?' };
    let projectId = schoon(b.projectId, 20) || null;
    if (projectId) {
      const p = S().projecten.find(x => x.id === projectId);
      if (!p || p.stad !== g.stad.id) return { status: 400, error: 'Dat project hoort niet bij deze stad.' };
    }
    if (B().length >= 200000) return { status: 400, error: 'Het berichtenregister zit vol.' };
    const rij = { id: rid(), stad: g.stad.id, doelgroep, kanaal, onderwerp, tekst, projectId,
      status: 'concept', spoed: b.spoed === true, door: w.key, besluit: null, at: nu() };
    B().push(rij);
    save();
    return { ok: true, bericht: beeld(rij) };
  }

  /* Wijzigen zet de goedkeuring terug op concept. Dat is de grendel die van een
     goedkeuring een goedkeuring maakt: hij hoort bij DEZE tekst. */
  function zet(req, id, b) {
    b = b || {};
    const rij = vind(id);
    if (!rij) return { status: 404, error: 'Dit bericht bestaat niet.' };
    const w = wie(req);
    const g = poort(w, rij.stad, 'project.beheren');
    if (!g.ok) return g;
    if (rij.status === 'verzonden') {
      return { status: 400, error: 'Dit bericht is op ' + rij.verzondenAt + ' verzonden. Wat eruit is, is eruit; stuur een nieuw bericht met de correctie.' };
    }
    let gewijzigd = false;
    if (b.onderwerp !== undefined) {
      const o = schoon(b.onderwerp, 120);
      if (o.length < 3) return { status: 400, error: 'Waar gaat het bericht over?' };
      if (o !== rij.onderwerp) { rij.onderwerp = o; gewijzigd = true; }
    }
    if (b.tekst !== undefined) {
      const t = schoon(b.tekst, 4000);
      if (t.length < 5) return { status: 400, error: 'Wat wilt u zeggen?' };
      if (t !== rij.tekst) { rij.tekst = t; gewijzigd = true; }
    }
    if (b.spoed !== undefined) rij.spoed = b.spoed === true;
    if (gewijzigd && ['goedgekeurd', 'wacht_op_landelijk', 'afgekeurd'].includes(rij.status)) {
      rij.status = 'concept';
      rij.besluit = null;
      audit(w.key, 'bericht.herzien', rij.onderwerp, 'tekst gewijzigd; goedkeuring vervallen');
    }
    save();
    return { ok: true, bericht: beeld(rij), goedkeuringVervallen: gewijzigd && rij.status === 'concept' };
  }

  /* Verzenden. Hier splitst het pad: naar binnen mag de stad zelf, naar buiten
     alleen met een landelijk besluit. Het bericht wordt niet stil in de wacht
     gezet -- het antwoord zegt dat het is voorgelegd, en waarom. */
  function verzend(req, id) {
    const rij = vind(id);
    if (!rij) return { status: 404, error: 'Dit bericht bestaat niet.' };
    const w = wie(req);
    const g = poort(w, rij.stad, 'project.beheren');
    if (!g.ok) return g;
    if (rij.status === 'verzonden') return { status: 400, error: 'Dit bericht is al verzonden.' };
    if (rij.status === 'afgekeurd') {
      return { status: 403, error: 'Dit bericht is landelijk afgekeurd' +
        (rij.besluit && rij.besluit.reden ? ': ' + rij.besluit.reden : '') + '. Pas de tekst aan en leg hem opnieuw voor.' };
    }
    const buiten = NAAR_BUITEN.includes(rij.doelgroep);
    if (buiten && !w.landelijk && rij.status !== 'goedgekeurd') {
      rij.status = 'wacht_op_landelijk';
      audit(w.key, 'bericht.voorgelegd', rij.onderwerp, rij.spoed ? 'spoed' : 'publiek');
      save();
      return { ok: true, bericht: beeld(rij), voorgelegd: true,
        melding: 'Een bericht naar buiten draagt de naam van de hele stichting en gaat daarom langs het landelijke bestuur. ' +
          (rij.spoed ? 'Uw bericht staat als spoed bovenaan hun lijst.' : 'Zet er spoed op als het haast heeft.') };
    }
    rij.status = 'verzonden';
    rij.verzondenAt = nu();
    audit(w.key, 'bericht.verzonden', rij.onderwerp, rij.doelgroep + ' via ' + rij.kanaal);
    save();
    return { ok: true, bericht: beeld(rij),
      melding: 'Verzonden aan ' + rij.doelgroep + ' via ' + rij.kanaal + '.' };
  }

  // Het landelijke besluit over een publiek bericht.
  function besluit(req, id, akkoord, reden) {
    const rij = vind(id);
    if (!rij) return { status: 404, error: 'Dit bericht bestaat niet.' };
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'Over een bericht naar buiten beslist het landelijke RTF-bestuur.' };
    if (rij.status !== 'wacht_op_landelijk') {
      return { status: 400, error: 'Dit bericht ligt niet ter beoordeling (het staat op "' + rij.status + '").' };
    }
    if (akkoord !== true) {
      const r = schoon(reden, 300);
      if (r.length < 5) return { status: 400, error: 'Waarom gaat dit bericht niet naar buiten? Schrijf het op; de stad moet er iets mee kunnen.' };
      rij.status = 'afgekeurd';
      rij.besluit = { door: w.key, akkoord: false, reden: r, at: nu() };
    } else {
      rij.status = 'goedgekeurd';
      rij.besluit = { door: w.key, akkoord: true, reden: schoon(reden, 300), at: nu() };
    }
    audit(w.key, 'bericht.besluit', rij.onderwerp, rij.status);
    save();
    return { ok: true, bericht: beeld(rij) };
  }

  return { lijst, maak, zet, verzend, besluit, vind, beeld, DOELGROEPEN, BERICHTWEGEN, STATUS, NAAR_BUITEN };
};
module.exports.DOELGROEPEN = DOELGROEPEN;
module.exports.NAAR_BUITEN = NAAR_BUITEN;
