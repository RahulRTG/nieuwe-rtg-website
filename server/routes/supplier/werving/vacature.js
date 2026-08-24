/* De invoergrens van een vacature. De route bewaakt bezit en opslag; hier
   staat op één plek wat een werkgever aan het Opportunity OS mag aanbieden. */
'use strict';

const VALUTA = ['EUR', 'GBP', 'USD', 'JPY'];
const WERKVORMEN = ['op-locatie', 'hybride', 'op-afstand', 'flexibel'];

function salaris(waarde) {
  const getal = Number(waarde);
  return Number.isFinite(getal) && getal > 0 ? Math.min(1000000, Math.round(getal)) : null;
}

function lijst(waarde, lengte, aantal) {
  return (Array.isArray(waarde) ? waarde : String(waarde || '').split(','))
    .map(item => String(item || '').trim().slice(0, lengte))
    .filter(Boolean)
    .slice(0, aantal);
}

function vulVacature(vacature, invoer, soorten) {
  const func = String(invoer.func || '').trim().slice(0, 60);
  if (!func) return { error: 'Geef de functie een naam.' };

  let minLeeftijd = parseInt(invoer.minLeeftijd, 10);
  if (!Number.isFinite(minLeeftijd) || minLeeftijd < 16) minLeeftijd = 16;
  if (minLeeftijd > 99) minLeeftijd = 99;

  const salarisMin = salaris(invoer.salarisMin);
  const salarisMax = salaris(invoer.salarisMax);
  if (salarisMin && salarisMax && salarisMax < salarisMin)
    return { error: 'Het maximale salaris moet gelijk aan of hoger dan het minimum zijn.' };

  vacature.func = func;
  vacature.omschrijving = String(invoer.omschrijving || '').trim().slice(0, 500);
  vacature.plaats = String(invoer.plaats || '').trim().slice(0, 60);
  vacature.uren = String(invoer.uren || '').trim().slice(0, 40);
  vacature.salarisMin = salarisMin;
  vacature.salarisMax = salarisMax;
  const valuta = String(invoer.valuta || '').toUpperCase();
  vacature.valuta = VALUTA.includes(valuta) ? valuta : 'EUR';
  vacature.werkvorm = WERKVORMEN.includes(invoer.werkvorm) ? invoer.werkvorm : null;
  vacature.vaardigheden = lijst(invoer.vaardigheden, 40, 12);
  vacature.voordelen = lijst(invoer.voordelen, 60, 10);
  vacature.soort = soorten.includes(invoer.soort) ? invoer.soort : 'bijbaan';
  vacature.minLeeftijd = minLeeftijd;
  vacature.open = invoer.open !== false;
  return { func };
}

module.exports = { vulVacature };
