'use strict';
// De bestaande bewaarvorm, gedeeld door een losse toevoeging en een selectie.
module.exports = (a, at) => ({
  aanbodId: a.id, titel: a.titel, type: a.type, aanbieder: a.aanbieder.naam,
  prijsBijBewaren: a.prijs ? a.prijs.bedrag : null,
  beschikbaarBijBewaren: a.beschikbaar ? (a.beschikbaar.uit ? 'uit' : 'in') : null,
  plek: a.plek.stad || null, at
});
