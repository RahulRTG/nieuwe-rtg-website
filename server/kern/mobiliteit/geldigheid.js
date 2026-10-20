/* Geldigheid van vervoerbewijzen, zonder koop- of betaalbevoegdheid.
   Losse kaarten houden hun ritlimiet; abonnementen hun eigen periodebeleid.
   De abonnementfunctie blijft laat gebonden omdat de modules na elkaar mounten. */

// hoe een product zich tot de enkele-reisprijs verhoudt, en hoe lang het geldt
const PRODUCTEN = {
  enkel: { naam: 'Enkele reis', factor: 1, urenGeldig: 2, ritten: 1 },
  // de terugweg met korting: een retour is geen twee losse kaartjes
  retour: { naam: 'Retour', factor: 1.8, urenGeldig: 24, ritten: 2 },
  dagkaart: { naam: 'Dagkaart', factor: 3, urenGeldig: 24, ritten: 99 },
  zitplaats: { naam: 'Zitplaats', factor: 1, urenGeldig: 24, ritten: 1, toeslag: 150 }
};

const dagenMs = d => d * 24 * 3600 * 1000;

/* De stand. Geen ritlimiet, dus alleen het venster en een eventuele volledige
   terugbetaling tellen. */
function aboStand(a) {
  if (a.terugbetaald && a.terugbetaald.volledig)
    return { stand: 'terugbetaald', reden: 'het abonnement is beeindigd en terugbetaald' };
  const nuMs = Date.now();
  if (nuMs < new Date(a.geldigVan).getTime())
    return { stand: 'nog-niet-geldig', reden: 'geldig vanaf ' + a.geldigVan.slice(0, 10) };
  if (nuMs > new Date(a.geldigTot).getTime())
    return { stand: 'verlopen', reden: 'verlopen op ' + a.geldigTot.slice(0, 10) };
  const over = Math.ceil((new Date(a.geldigTot).getTime() - nuMs) / dagenMs(1));
  return { stand: 'geldig', reden: 'nog ' + over + ' dag(en) geldig', dagenOver: over };
}

/* Geldt dit abonnement op DEZE lijn? De overeenkomst bepaalt dat, niet het
   abonnement zelf -- en de lijnenlijst wordt bij de aankoop gekopieerd, zodat
   een latere wijziging van het contract een lopend abonnement niet stilletjes
   uitkleedt. */
function aboGeldtOp(a, lijnId) {
  if (!lijnId) return true;
  return (a.lijnen || []).includes(lijnId);
}


module.exports = (ctx) => {
  const { abonnementStand } = ctx;
  /* Wat is dit kaartje nu waard? Geldig, opgebruikt of verlopen -- uitgerekend
     uit het venster en de validaties, nooit uit een bewaard vlaggetje. */
  function kaartStand(k) {
    /* Een abonnement rekent zijn eigen stand uit (geen ritlimiet, wel een
       looptijd) en woont in dezelfde voorraad. Via ctx, want ./abonnement wordt
       NA deze module gemount. Zonder deze aftakking viel een abonnement terug
       op de regels van een enkeltje en was het na een rit "gebruikt". */
    if (k.product === 'abonnement' && abonnementStand()) return abonnementStand()(k);
    /* Alleen een VOLLEDIGE teruggave maakt het kaartje ongeldig. Bij een
       vertraging krijgt de reiziger een deel terug als vergoeding en rijdt hij
       gewoon mee -- hier stond eerst dat elke teruggave het kaartje afsloot, en
       dan pakt de compensatie voor een late bus zijn rit af. Bij uitval is het
       omgekeerd juist: die rit is niet gereden en het geld is helemaal terug. */
    if (k.terugbetaald && k.terugbetaald.volledig)
      return { stand: 'terugbetaald', reden: 'de rit is uitgevallen; het bedrag is terugbetaald op ' +
        k.terugbetaald.at.slice(0, 16).replace('T', ' ') };
    const p = PRODUCTEN[k.product] || PRODUCTEN.enkel;
    const gebruikt = (k.validaties || []).length;
    if (gebruikt >= p.ritten) return { stand: 'gebruikt', reden: 'volledig gebruikt (' + gebruikt + ' van ' + p.ritten + ')' };
    const nuMs = Date.now();
    if (nuMs < new Date(k.geldigVan).getTime())
      return { stand: 'nog-niet-geldig', reden: 'geldig vanaf ' + k.geldigVan.slice(0, 16).replace('T', ' ') };
    if (nuMs > new Date(k.geldigTot).getTime())
      return { stand: 'verlopen', reden: 'verlopen op ' + k.geldigTot.slice(0, 16).replace('T', ' ') };
    return { stand: 'geldig', reden: 'geldig tot ' + k.geldigTot.slice(0, 16).replace('T', ' '),
      rittenOver: p.ritten - gebruikt };
  }

  return { kaartStand };
};
Object.assign(module.exports, { PRODUCTEN, dagenMs, aboStand, aboGeldtOp });
