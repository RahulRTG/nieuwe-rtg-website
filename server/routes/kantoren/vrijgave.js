/* Kantoren, deel "vrijgave": de schakelkast van de vrijgavepoort
   (server/kern/vrijgave/). Wat staat er aan, waarom niet, en wie zette het om.

   DRIE DEUREN, EN ZE ZIJN BEWUST NIET GELIJK.
     lezen      de boardroom. Het overzicht toont de interne redenen (welk
                dossier ontbreekt, welke controle niet PASS staat); dat is
                bestuursinformatie en geen werkinformatie.
     uitzetten  de boardroom, een mens op naam en een reden -- en verder NIETS.
                Een noodknop die op een passkey wacht, is geen noodknop. Uitzetten
                mag dus nooit trager zijn dan aanzetten.
     aanzetten  de boardroom, een mens op naam, een reden EN een verse passkey
                zonder terugval (het besluit van 25 september 2026 voor geld op
                kantoor: kern/zwaarbewijs.js `zonderTerugval`). Wie een open
                sessie steelt, kan wel alles uitzetten en niets aanzetten.

   WAT DEZE ROUTES NIET KUNNEN: iets BESCHIKBAAR maken. Ze zetten alleen de
   ingeschakeld-as. Bewijs, autorisatie en de gezondheid van de provider komen
   van elders, en een stand `enabled` zonder die drie geeft nog steeds dicht. Er
   is ook geen ledenroute en geen leverancierroute die een stand kan raken: de
   klant kan een servercapability per definitie niet omzetten.

   WIE er schakelt komt uit de sessie (de envelop), nooit uit het lichaam van het
   verzoek -- AUTHORITY.md: de actor van een auditregel komt uit de sessie. */
'use strict';
const { wie: envelopWie } = require('../../opzet/envelop');

module.exports = (ctx) => {
  const { app, boardroomAuth, veilig, afdelingen, kern, zwaar, boardroomUser } = ctx;
  const { standaard } = require('../../kern/vrijgave');
  const vrijgave = standaard();
  /* De opstartkeuring (keurBijStart) staat in server/opzet/startcontrole.js. */

  /* De late koppeling: de bevoegdheidslaag, de capability-gezondheid en het
     auditlog leven in de kern-tas. Tot dit punt staat de autorisatie-as op
     onbekend -- en dus dicht. De gezondheid wordt GELEZEN uit de lijst en niet
     via `mag()`, want die maakt bij een onbekende capability een rij aan, en
     een oordeel hoort niets te schrijven. */
  vrijgave.koppel({
    bevoegd: kern.bevoegd,
    gezondheid: id => {
      const r = (kern.capGezondheid && kern.capGezondheid.lijst() || []).find(x => x.cap === id);
      return r && r.quarantaine ? { door: false, error: r.quarantaine.reden || 'quarantaine' } : { door: true };
    },
    audit: (wie, wat) => afdelingen.audit(wie, wat)
  });

  const wie = req => envelopWie(req) || null;
  const stap = async (req, res, omschrijving) => {
    const b = await zwaar.eis(boardroomUser(req), 'eigenaar-vrijgave', zwaar.sessieSleutel(req), req,
      omschrijving, { zonderTerugval: true });
    if (!b.ok) { zwaar.stuur(res, b); return false; }
    return true;
  };

  app.post('/api/office/vrijgave', boardroomAuth, (req, res) => veilig(res, () =>
    ({ status: 200, ok: true, ...vrijgave.overzicht(), schaduw: vrijgave.schaduwTelling() })));

  app.post('/api/office/vrijgave/stand', boardroomAuth, async (req, res) => {
    const b = req.body || {};
    const id = String(b.id || ''), nieuw = String(b.stand || '');
    const cap = require('../../kern/vrijgave/register').vind(id);
    const activeert = require('../../kern/vrijgave/register').ACTIVEREND.includes(nieuw);
    /* De passkey wordt gevraagd VOORDAT de stand wordt aangeraakt, en alleen bij
       activeren van geld of veiligheid. De kern controleert het nog een keer
       (`stapOmhoog`), zodat een andere route die hem vergeet niet stil opent. */
    let stapOmhoog = false;
    if (cap && activeert && (cap.geld || cap.beveiliging)) {
      if (!(await stap(req, res, 'Het aanzetten van ' + cap.naam))) return;
      stapOmhoog = true;
    }
    return veilig(res, () => {
      const r = vrijgave.zet(id, nieuw, { wie: wie(req), reden: b.reden, versie: b.versie, stapOmhoog });
      return r.ok ? Object.assign({ status: 200 }, r, { oordeel: vrijgave.beoordeel(id, { recht: true }) }) : r;
    });
  });

  app.post('/api/office/vrijgave/besluit', boardroomAuth, async (req, res) => {
    const b = req.body || {};
    const naam = String(b.besluit || '');
    if (b.intrekken === true) return veilig(res, () =>
      vrijgave.besluitIntrekken(naam, { wie: wie(req), reden: b.reden, versie: b.versie }));
    if (!(await stap(req, res, 'Het vastleggen van een vrijgavebesluit'))) return;
    return veilig(res, () => vrijgave.besluitVastleggen(naam, { wie: wie(req), bron: b.bron, sha256: b.sha256,
      reden: b.reden, versie: b.versie, stapOmhoog: true }));
  });
};
