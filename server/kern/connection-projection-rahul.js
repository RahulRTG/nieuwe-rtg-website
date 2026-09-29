/* Rahul krijgt uitsluitend een serverprojectie en zijn antwoord passeert
   daarna opnieuw deze disclosuregrens. Dit deel staat los van de serializers:
   het controleert vrije tekst op waarden uit privébronnen die niet in de
   toegestane projectie voorkwamen. */
'use strict';

const GEVOELIGE_SLEUTELS = new Set(['legalName', 'echteNaam', 'birthDate', 'geboortedatum', 'address', 'adres',
  'exactLocation', 'lat', 'lng', 'religion', 'geloof', 'religionImportance', 'thuis']);

function rahulGevoeligeWaarden(value, gevonden, sleutel) {
  const uit = gevonden || [];
  if (Array.isArray(value)) for (const v of value) rahulGevoeligeWaarden(v, uit, sleutel);
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) rahulGevoeligeWaarden(v, uit, k);
  else if (GEVOELIGE_SLEUTELS.has(sleutel) && typeof value === 'string' && value.trim().length >= 3)
    uit.push(value.trim());
  else if (GEVOELIGE_SLEUTELS.has(sleutel) && typeof value === 'number' && Number.isFinite(value))
    uit.push(String(value));
  return uit;
}

function rahulOutputGuard(tekst, toegestaneProjectie, priveBronnen) {
  const antwoord = String(tekst || '');
  const toegestaan = JSON.stringify(toegestaneProjectie || {}).toLowerCase();
  const verboden = rahulGevoeligeWaarden(Array.isArray(priveBronnen) ? priveBronnen : [priveBronnen]);
  const lek = verboden.find(v => !toegestaan.includes(v.toLowerCase()) &&
    antwoord.toLowerCase().includes(v.toLowerCase()));
  if (lek) return { ok: false, tekst: 'Ik kan alleen werken met gegevens die voor deze ontmoeting zijn vrijgegeven.' };
  return { ok: true, tekst: antwoord };
}

module.exports = { rahulOutputGuard };
