/* CONCERN: een werknemer koopt geen pas om te werken. Dit is alleen de
   toegang tot een expliciet door de werkgever betaalde rit, geen prijs- of
   commissiedekking. Werkrelatie, zaak en abonnement blijven hun eigen bron.
   Het concrete reisbeleid wordt daarna ongewijzigd door opdrachtMaak getoetst.
   Route en kern gebruiken dezelfde actuele beslissing, niet een clientvlag. */
'use strict';
const dienstFout = require('../aanmeldingen/abonnementsdiensten').fout;
const fout = (status, error) => ({ status, error });
const leden = () => fout(403, 'RTG Vervoer is voor leden.');
const onbeschikbaar = () => fout(503, 'De werktoegang kan nu niet veilig worden gecontroleerd.');

function persoon(accounts, session) {
  const m = /^user-([1-9]\d*)$/.exec(String(session?.key || ''));
  const id = m && Number(m[1]);
  if (!Number.isSafeInteger(id) || Number(session?.account?.id) !== id) return leden();
  if (typeof accounts?.getUserById !== 'function' || typeof accounts?.isActief !== 'function')
    return onbeschikbaar();
  const account = accounts.getUserById(id);
  return account && Number(account.id) === id && accounts.isActief(account) ? { ok: true } : leden();
}

/* Accountcontrole is een pure domeinpolicy, geen extra globale kernfunctie.
   Route en reizigerskern gebruiken rechtstreeks dezelfde actuele bron. */
function mobEigenToegang(accounts, session) {
  // Bestaande betaalde/demo-ingangen blijven gelijk; gratis nazorg vraagt
  // een echte, actuele persoon. De domeinfunctie toetst daarna het object.
  if (session?.key && session.tier !== 'guest') return { ok: true };
  try { return persoon(accounts, session); } catch (_) { return onbeschikbaar(); }
}

module.exports = ({ accounts, werktBij, findSupplier, zaakAbonnement }) => {
  function mobVraagToegang(session, body = {}) {
    const org = typeof body.namensOrganisatie === 'string' ? body.namensOrganisatie.trim().toUpperCase() : '';
    if (body.betaler === 'organisatie' && (!org || org.length > 20))
      return fout(400, 'Kies een geldige werkgever voor deze organisatiebetaling.');
    const werk = body.betaler === 'organisatie' && !!org && org.length <= 20;
    if (session?.tier === 'guest' && !werk) return leden();
    if (!session?.key) return leden();
    if (!werk) return { ok: true, organisatie: org.slice(0, 20) || null };
    try {
      const p = persoon(accounts, session); if (p.error) return p;
      if (typeof werktBij !== 'function' || typeof findSupplier !== 'function' ||
          typeof zaakAbonnement?.mag !== 'function' || typeof zaakAbonnement?.magDienst !== 'function')
        return onbeschikbaar();
      const zaak = findSupplier(org);
      if (!zaak || zaak.code !== org || (zaak.partnerStatus && zaak.partnerStatus !== 'actief'))
        return fout(403, 'Deze partnerwerkplek is gesloten.');
      // Online is etalagezichtbaarheid, geen arbeids- of contractbevoegdheid.
      if (!werktBij(session.key, org)) return fout(403, 'U staat niet als medewerker bij dit bedrijf ingeschreven.');
      if (zaakAbonnement.mag(org, 'can_use_workos') !== true)
        return fout(403, 'Het abonnement van deze werkgever geeft geen toegang tot het Werk OS.');
      if (zaakAbonnement.magDienst(org, { nieuweBetaaldeDienst: true }) !== true) return dienstFout();
      return { ok: true, organisatie: org };
    } catch (_) { return onbeschikbaar(); }
  }
  /* Beide ingangen krijgen dezelfde actuele accountcontrole. De routeadapter
     ontvangt de gefabriceerde domeininterface, dus deze functie moet hier
     worden aangeboden en niet alleen als eigenschap van de factory-export. */
  return { mobVraagToegang, mobEigenToegang: session => mobEigenToegang(accounts, session) };
};
