/* Spellen (deelmodule): DE HERHAALSLEUTEL VAN "NODIG UIT EN START".

   Een tweede tik die binnenkwam terwijl de eerste nog liep, of dezelfde tik na
   een crash, maakte een TWEEDE potje: de vriend kreeg twee uitnodigingen. De
   voltooiproef (scripts/lib/voltooi/spelen.js) liet het zien.

   Het scherm stuurt per bedoeling een sleutel mee; die staat gehasht met de
   maker op het potje, dus hij overleeft een herstart. Dezelfde sleutel met
   dezelfde inhoud is hetzelfde potje; dezelfde sleutel met een ander spel of
   andere spelers is een conflict. Hier stond eerst een venster van tien seconden
   op de inhoud, en dat raadde: wie bewust binnen die tijd een tweede potje
   startte raakte het kwijt, en een dubbele tik na elf seconden kwam erdoor.

   De vergelijking staat na het laatste `await` van spelNieuw, in hetzelfde
   synchrone stuk als het aanmaken: zo kan geen tweede verzoek ertussen glippen. */
'use strict';

function merkVan(crypto, mij, idem) {
  const s = typeof idem === 'string' && idem.trim() ? idem.trim().slice(0, 80) : null;
  return s ? crypto.createHash('sha256').update(String(mij) + '|' + s).digest('hex').slice(0, 32) : null;
}

const inhoudVan = (v) => JSON.stringify([v.soort, v.grootte, (v.uitgenodigd || []).slice().sort(),
  v.modus || null, v.variant || null, v.tempo || null]);

function herhaal(potjes, merk, inhoud) {
  if (!merk) return null;
  const p = Object.values(potjes || {}).find((x) => x && x.idemMerk === merk);
  if (!p) return null;
  return p.idemInhoud === inhoud ? { potje: p } : { conflict: true };
}

/* Alles wat spelNieuw nodig heeft in een vraag: een antwoord als het een
   herhaling of een conflict is, en anders de velden voor het nieuwe potje. */
function vind(crypto, potjes, mij, idem, vraag) {
  const merk = merkVan(crypto, mij, idem);
  const inhoud = crypto.createHash('sha256').update(inhoudVan(vraag)).digest('hex').slice(0, 32);
  const al = herhaal(potjes, merk, inhoud);
  if (al && al.conflict) return { antwoord: { status: 409, error: 'Deze uitnodiging is al met een ander spel of andere spelers verstuurd.' } };
  if (al) return { antwoord: { status: 200, ok: true, id: al.potje.id, herhaald: true } };
  return { velden: merk ? { idemMerk: merk, idemInhoud: inhoud } : {} };
}

module.exports = { merkVan, inhoudVan, herhaal, vind };
