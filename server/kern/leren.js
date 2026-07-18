/* Kern-module "leren": de leerlaag van de RTFoundation, op de vriendenlaag.

   - Overhoorlijsten: vraag-antwoordparen (woordjes, topografie, begrippen),
     zelf gemaakt of door de AI (met een nette demoterugval zonder sleutel).
     Solo overhoren gebeurt op het scherm; de server bewaart de lijsten en
     de beste score per lijst.
   - Samen leren: een overhoorduel over een van je lijsten. Je nodigt een
     leermaatje uit (vriend of codenaam; samen leren maakt je NIET
     automatisch vrienden), allebei krijgen dezelfde vragen in dezelfde
     volgorde en de standen lopen live mee.
   - Schrijven: schrijfopdrachten per leeftijdsgroep, met buddy-feedback
     (compliment plus tips, nooit een herschrijving) en bewaarde concepten.
   - Projecten: samen aan een werkstuk, spreekbeurt of knutsel. Leden
     verdelen taken (claimen, afvinken), verzamelen notities en kunnen de
     AI een projectplan laten voorstellen.

   Alles is server-authoritatief: de client toont, de server beslist. */
module.exports = ({ db, save, crypto, codenaamVan, zijnVrienden, socialZoek, isGeblokkeerd, sociaalRate, sseToCustomer, anthropic, leeftijdInstr }) => {
  const rid = n => crypto.randomBytes(n).toString('hex');
  const nu = () => new Date().toISOString();
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n);
  function L() {
    if (!db.data.leren) db.data.leren = { lijsten: {}, sessies: {}, projecten: {}, schrijfsels: {} };
    return db.data.leren;
  }
  const seintje = (naar, wat, id) => { try { sseToCustomer(naar, 'social', { kind: wat, id }); } catch (e) {} };
  function schud(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = crypto.randomInt(0, i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  // antwoorden vergelijken zonder gedoe over hoofdletters, accenten en leestekens
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  /* ---------- opschonen: klare duels na een dag weg, wachtende na 6 uur ---------- */
  let opgeruimdOm = 0;
  function opruimen() {
    const t = Date.now();
    if (t - opgeruimdOm < 60000) return;
    opgeruimdOm = t;
    for (const [id, s] of Object.entries(L().sessies)) {
      const leeftijd = t - new Date(s.at).getTime();
      if ((s.status === 'klaar' && leeftijd > 86400000) || (s.status === 'wacht' && leeftijd > 6 * 3600000)) delete L().sessies[id];
    }
  }

  /* ================= overhoorlijsten ================= */

  /* De drie leerdomeinen draaien als submodules op een gedeelde context,
     een keer opgebouwd bij het opstarten. Het overhoordeel gaat eerst de
     context in omdat de projectenlaag nodigUit (vrienden uitnodigen)
     hergebruikt. */
  const ctx = { db, save, crypto, codenaamVan, zijnVrienden, socialZoek, isGeblokkeerd, sociaalRate, sseToCustomer, anthropic, leeftijdInstr,
    rid, nu, schoon, L, schud, opruimen, seintje, norm };
  const deelOverhoren = require('./leren/overhoren')(ctx);
  Object.assign(ctx, deelOverhoren);
  const { lijstenVan, lijstMaak, lijstHaal, lijstWeg, overhoorKlaar, lijstAi,
    sessieStart, sessieAntwoord, sessiesVan, sessieStaat, sessieZet } = deelOverhoren;
  const { projectenVan, projectMaak, projectUitnodig, projectAntwoord, projectStaat, projectWeg, taakMaak, taakZet, notitie, projectAi } = require('./leren/projecten')(ctx);
  const { schrijfOpdracht, schrijfFeedback, schrijfBewaar, schrijfselsVan } = require('./leren/schrijven')(ctx);

  return { leren: { lijstenVan, lijstMaak, lijstHaal, lijstWeg, overhoorKlaar, lijstAi,
    sessieStart, sessieAntwoord, sessiesVan, sessieStaat, sessieZet,
    projectenVan, projectMaak, projectUitnodig, projectAntwoord, projectStaat, projectWeg, taakMaak, taakZet, notitie, projectAi,
    schrijfOpdracht, schrijfFeedback, schrijfBewaar, schrijfselsVan } };
};
