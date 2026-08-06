/* Foundation OS, deel "voorraad-uitgifte": eruit halen en afschrijven.

   DRIE GRENDELS, DRIE ZINNEN. Ze vragen om drie verschillende handelingen, en
   een gedeelde foutmelding zou de vrijwilliger achter de balie laten raden:

   1. OVER DE DATUM GAAT NIET DE DEUR UIT. Bij bederfelijke waar weigert het
      systeem de uitgifte -- niet met een waarschuwing, want een waarschuwing
      klik je weg op de drukke donderdag waarop je te weinig hebt. Afschrijven
      kan wel, en dat is een andere handeling met een andere naam.

   2. ER GAAT NOOIT MEER UIT DAN ERIN ZIT. Het restant wordt uit de batch zelf
      gerekend (ontvangen min uitgegeven min afgeschreven), niet uit een
      saldoveld dat kan gaan afwijken (LAT.md regel 4).

   3. ER IS ALTIJD EEN BESTEMMING, EN NOOIT EEN PERSOON. Een uitgifte wijst naar
      een project of naar een hulpvraag-CODENAAM. Wie het kreeg staat in de
      casus, met toestemming en een bewaartermijn, of nergens. Een
      ontvangerslijst in het magazijn is de makkelijkste manier om buiten alle
      afspraken om een lijst van arme mensen aan te leggen.

   EN AFSCHRIJVEN VRAAGT EEN REDEN. Verspilling die niemand opschrijft, bestaat
   volgend jaar niet -- en dan valt er ook niets aan te verbeteren.

   Afgesplitst uit voorraad.js op de 10 KB van keuringsregel 13. */

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, S, audit, wie, poort, save } = ctx;
  const { vind, beeld, rest, overDatum, BEDERFELIJK } = eigen;

  /* Uitgifte. Hier zitten de drie grendels bij elkaar: de datum, het restant en
     de bestemming. Elk met een eigen zin, want ze vragen om iets anders --
     afschrijven, minder pakken, of eerst een bestemming kiezen. */
  function uitgifte(req, id, b) {
    b = b || {};
    const rij = vind(id);
    if (!rij) return { status: 404, error: 'Deze partij staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, rij.stad, 'geld.beheren', 'warehouse_management');
    if (!g.ok) return g;
    const aantal = Math.round(Number(b.aantal));
    if (!Number.isFinite(aantal) || aantal <= 0) return { status: 400, error: 'Hoeveel gaat eruit?' };
    if (overDatum(rij) && BEDERFELIJK.includes(rij.soort)) {
      return { status: 403, error: 'Deze partij ' + rij.wat + ' was houdbaar tot ' + rij.houdbaarTot +
        ' en gaat niet meer de deur uit. Schrijf hem af als hij weg moet.' };
    }
    const over = rest(rij);
    if (aantal > over) {
      return { status: 400, error: 'Er is nog ' + over + ' ' + rij.eenheid + ' van deze partij; er wordt ' + aantal + ' gevraagd.' };
    }
    // De bestemming: een project of een hulpvraag-codenaam. Nooit een persoon.
    const projectId = schoon(b.projectId, 20) || null;
    const codenaam = schoon(b.codenaam, 20) || null;
    if (!projectId && !codenaam) {
      return { status: 400, error: 'Waar gaat dit heen? Kies een project of vul de codenaam van de hulpvraag in. Namen van ontvangers horen hier niet.' };
    }
    if (projectId) {
      const p = S().projecten.find(x => x.id === projectId);
      if (!p || p.stad !== rij.stad) return { status: 400, error: 'Dat project hoort niet bij deze stad.' };
    }
    if (codenaam) {
      const c = S().casussen.find(x => x.codenaam === codenaam && x.stad === rij.stad);
      if (!c) return { status: 404, error: 'Deze codenaam kennen we niet in deze stad.' };
    }
    if (!Array.isArray(rij.uitgiftes)) rij.uitgiftes = [];
    if (rij.uitgiftes.length >= 5000) return { status: 400, error: 'Deze partij heeft al vijfduizend uitgiftes.' };
    rij.uitgiftes.push({ id: rid(), aantal, projectId, codenaam,
      vervoer: schoon(b.vervoer, 80), door: w.key, at: nu() });
    audit(w.key, 'voorraad.uit', rij.wat, aantal + ' naar ' + (projectId ? 'project ' + projectId : codenaam));
    save();
    return { ok: true, batch: beeld(rij) };
  }

  /* Afschrijven: bederf, breuk, of teruggestuurd. Verplichte reden, want
     verspilling die je niet opschrijft, bestaat volgend jaar niet en dan is er
     niets te verbeteren. */
  function afschrijven(req, id, b) {
    b = b || {};
    const rij = vind(id);
    if (!rij) return { status: 404, error: 'Deze partij staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, rij.stad, 'geld.beheren', 'warehouse_management');
    if (!g.ok) return g;
    const aantal = Math.round(Number(b.aantal));
    if (!Number.isFinite(aantal) || aantal <= 0) return { status: 400, error: 'Hoeveel wordt er afgeschreven?' };
    const over = rest(rij);
    if (aantal > over) return { status: 400, error: 'Er is nog ' + over + ' ' + rij.eenheid + ' van deze partij.' };
    const reden = schoon(b.reden, 200);
    if (reden.length < 3) return { status: 400, error: 'Waarom wordt dit afgeschreven? Bederf, breuk, retour -- schrijf het op.' };
    if (!Array.isArray(rij.afschrijvingen)) rij.afschrijvingen = [];
    rij.afschrijvingen.push({ id: rid(), aantal, reden, door: w.key, at: nu() });
    audit(w.key, 'voorraad.afschrijving', rij.wat, aantal + ': ' + reden);
    save();
    return { ok: true, batch: beeld(rij) };
  }

  return { uitgifte, afschrijven };
};
