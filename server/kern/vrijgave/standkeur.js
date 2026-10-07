/* DE KEURING VAN HET STANDBESTAND (./stand.js): een gesloten vorm, en geen veld
   meer dan die vorm noemt. Uit ./stand.js gehaald (keuringsregel 13): dat bestand
   gaat over LEZEN en SCHRIJVEN met een slot en een versie, dit over wat er mag
   STAAN. */
'use strict';
const { STANDEN, BESLUITEN } = require('./register');
const FORMAAT = 'rtg-vrijgave-stand-v1';

/* DE VELDEN DIE ER MOGEN STAAN, en geen ander. Dit bestand draagt de
   ingeschakeld-as en de vastgelegde besluiten -- en verder NIETS. In het
   bijzonder geen `beschikbaar`, `geverifieerd`, `available` of `verified`: die
   worden per verzoek uitgerekend (./oordeel.js) en bestaan nergens als opgeslagen
   waarde. Een bestand met zo'n veld is met de hand bewerkt of door iets anders
   geschreven dan ./schakelen.js, en dan is het geheel ongeldig (configuratiefout,
   alles dicht) in plaats van dat de lezer het veld stil overslaat. Stil
   overslaan zou vandaag veilig zijn en morgen, bij de eerste lezer die het veld
   WEL leest, een knop. */
const VELDEN = Object.freeze({
  bestand: ['formaat', 'versie', 'standen', 'besluiten', 'geschiedenis'],
  stand: ['stand', 'wie', 'sinds', 'reden'],
  besluit: ['wie', 'op', 'bron', 'sha256', 'reden', 'ingetrokken']
});
function alleen(obj, toegestaan, waar) {
  for (const k of Object.keys(obj)) if (!toegestaan.includes(k)) throw new Error('onbekend veld "' + k + '" in ' + waar);
}

/* De vorm van het bestand nalopen. Gooit bij iedere afwijking; de lezer zet
   dat om in een configuratiefout. */
function keur(obj) {
  if (!obj || obj.formaat !== FORMAAT) throw new Error('onbekend formaat');
  alleen(obj, VELDEN.bestand, 'het standbestand');
  if (!Number.isSafeInteger(obj.versie) || obj.versie < 0) throw new Error('versie ongeldig');
  if (!obj.standen || typeof obj.standen !== 'object' || Array.isArray(obj.standen)) throw new Error('standen ongeldig');
  for (const [id, s] of Object.entries(obj.standen)) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('stand van ' + id + ' ongeldig');
    alleen(s, VELDEN.stand, 'de stand van ' + id);
    if (!STANDEN.includes(s.stand)) throw new Error('onbekende stand "' + s.stand + '" bij ' + id);
  }
  if (!obj.besluiten || typeof obj.besluiten !== 'object' || Array.isArray(obj.besluiten)) throw new Error('besluiten ongeldig');
  for (const [id, b] of Object.entries(obj.besluiten)) {
    if (!BESLUITEN[id]) throw new Error('onbekend besluit ' + id);
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error('besluit ' + id + ' ongeldig');
    alleen(b, VELDEN.besluit, 'het besluit ' + id);
    if (typeof b.wie !== 'string' || !/^[a-f0-9]{64}$/.test(String(b.sha256 || ''))) throw new Error('besluit ' + id + ' ongeldig');
  }
  if (!Array.isArray(obj.geschiedenis)) throw new Error('geschiedenis ongeldig');
  return obj;
}

module.exports = { FORMAAT, VELDEN, keur };
