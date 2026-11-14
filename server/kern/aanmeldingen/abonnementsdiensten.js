/* Alleen NIEUWE betaalde dienstverlening. Domeineigenaren vragen dit nadat
   zij een bestaande opdracht hebben herkend; nooit een algemene accountpoort.
   De zaak blijft haar nominale pas houden voor administratie en afhandeling. */
'use strict';
const klok = require('../../lib/klok');
const { BASISRECHTEN } = require('./abonnementsherstel');
const iso = s => typeof s === 'string' && Number.isFinite(Date.parse(s));
const fout = () => ({ status: 402, error: 'Nieuwe betaalde diensten zijn voor dit abonnement niet beschikbaar.' +
  ' Facturen, betalen, opzeggen en noodzakelijke nazorg blijven bereikbaar.' });

module.exports = ({ db, nu = () => new Date(klok.nu()).toISOString() }) => {
  const meldingen = require('./abonnementsmeldingen')({ db, nu });
  const organisaties = require('../commercie/organisatieabonnement')({ db, nu });
  const nieuw = d => d?.nieuweBetaaldeDienst === true && !BASISRECHTEN.includes(d.basisrecht);
  function contractMag(c, dienst) {
    if (!['ACTIEF', 'VERLENGBAAR', 'OPZEGGEND'].includes(c.status) ||
        c.eindigtOp && (!iso(c.eindigtOp) || Date.parse(c.eindigtOp) <= Date.parse(nu()))) return false;
    return meldingen.magDienst(meldingen.beoordeel(c), dienst);
  }
  function organisatie(org, dienst) {
    if (!nieuw(dienst)) return true;
    const r = organisaties.vanOrganisatie(org);
    return !r || r.ok && contractMag(r.contract, dienst);
  }
  function zaak(code, dienst) {
    if (!nieuw(dienst)) return true;
    const org = organisaties.vanZaak(code);
    if (org) return org.ok && contractMag(org.contract, dienst);
    const sleutel = String(code || '').toUpperCase(), rij = db.data.zaakAbonnement?.[sleutel];
    // Bestaande voor-de-ladder rechten worden niet gemigreerd of ingetrokken.
    if (!rij?.contractId) return true;
    const c = (db.data.contracten || []).find(c => c.id === rij.contractId);
    if (!c && rij.door === 'abonnement:' + rij.contractId) return false;
    if (!c?.automatischAbonnement) return true;
    const scope = c.aanbod?.scope;
    if (scope?.soort !== 'zaak' || c.zaakCode !== sleutel || scope.code && scope.code !== sleutel ||
        c.pas !== rij.pas || !iso(c.activering?.at) || Date.parse(c.activering.at) > Date.parse(nu())) return false;
    // Contracteinde is iets anders dan achterstand. Alleen nieuw gebruik stopt;
    // hetzelfde dossier/abonnement blijft bestaan voor de afhandeling.
    return contractMag(c, dienst);
  }
  return { zaak, organisatie };
};
module.exports.fout = fout;
