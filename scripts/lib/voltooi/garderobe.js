/* ============================================================================
   VOLTOOIPROEF: GARDE-ROBE (link:garderobe, /apps/garderobe.html).

   De belofte, in de woorden van kern/rechterhand/garderobe.js: de digitale
   garderobe. Per stuk het type, het merk, de kleur, de maat en waar het hangt
   of ligt; daarnaast de vaklui (kleermaker, schoenmaker, stomerij) met contact.
   Het overzicht telt per categorie, zodat het lid ziet wat hij heeft en waar.
   Het lid is een Lifestyle-lid langs het menselijke besluit van het kantoor
   (../voltooiwereld.js lifestyleLid; zie het scenario van Reisboek).
   ========================================================================== */
'use strict';
const { lifestyleLid, KANTOORWERELD } = require('../voltooiwereld');
const { bewaarblok } = require('../voltooiboek');

const KAST = '/api/member/rechterhand/garderobe';
const STUK = '/api/member/rechterhand/garderobe/stuk';
const STUK_WEG = '/api/member/rechterhand/garderobe/stuk/weg';
const VAKMAN = '/api/member/rechterhand/garderobe/vakman';
const VAKMAN_WEG = '/api/member/rechterhand/garderobe/vakman/weg';

async function loop(w, stap) {
  const merk = 'gr' + Date.now().toString(36);
  const lid = await lifestyleLid(w, 'gar');
  const T = lid.token;
  const kast = async (tok) => { const r = await w.post(KAST, {}, tok || T); return r.status === 200 ? r.data : null; };
  let pak = null;

  await stap('voltooibaar', 'twee pakken en een paar schoenen, met waar ze hangen; het overzicht telt per categorie', async () => {
    const a = await w.post(STUK, { naam: 'Navy pak ' + merk, categorie: 'pak', merk: 'Huntsman', maat: '50', waar: 'Amsterdam, kast 2' }, T);
    const b = await w.post(STUK, { naam: 'Grijs pak ' + merk, categorie: 'pak', waar: 'Londen' }, T);
    const c = await w.post(STUK, { naam: 'Oxfords ' + merk, categorie: 'schoenen', maat: '43' }, T);
    pak = a.data && a.data.stuk;
    const k = await kast();
    return { klopt: [a, b, c].every((r) => r.status === 200) && k.aantal === 3 && k.perCategorie.pak === 2 && k.perCategorie.schoenen === 1 && k.stukken[0].categorie === 'pak',
      ziet: k.aantal + ' stukken, per categorie ' + JSON.stringify(k.perCategorie) };
  });

  await stap('voltooibaar', 'een stuk verhuist: de nieuwe plek staat erbij en er komt geen tweede stuk bij', async () => {
    const r = await w.post(STUK, { id: pak.id, naam: 'Navy pak ' + merk, categorie: 'pak', merk: 'Huntsman', maat: '50', waar: 'Gstaad, chalet' }, T);
    const k = await kast();
    const s = k.stukken.filter((x) => x.naam === 'Navy pak ' + merk);
    return { klopt: r.status === 200 && s.length === 1 && s[0].waar === 'Gstaad, chalet' && k.aantal === 3, ziet: s.length + ' navy pak, nu in ' + (s[0] && s[0].waar) };
  });

  await stap('voltooibaar', 'een onbekende categorie wordt "overig", en een stuk zonder naam wordt geweigerd met de reden', async () => {
    const r = await w.post(STUK, { naam: 'Sjaal ' + merk, categorie: 'ruimtepak' }, T);
    const leeg = await w.post(STUK, { naam: '' }, T);
    const k = await kast();
    const s = k.stukken.find((x) => x.naam === 'Sjaal ' + merk);
    return { klopt: r.status === 200 && s && s.categorie === 'overig' && leeg.status === 400 && /Wat voor stuk/.test(leeg.data.error),
      ziet: 'sjaal in ' + (s && s.categorie) + '; zonder naam: ' + leeg.status + ' (' + (leeg.data && leeg.data.error) + ')' };
  });

  await stap('voltooibaar', 'de kleermaker en de stomerij staan bij de vaklui; een vakman weghalen laat de ander staan', async () => {
    const a = await w.post(VAKMAN, { naam: 'Kleermaker ' + merk, vak: 'kleermaker', plaats: 'Londen', telefoon: '+44 20' }, T);
    const b = await w.post(VAKMAN, { naam: 'Stomerij ' + merk, vak: 'stomerij' }, T);
    const k0 = await kast();
    const stomerij = k0.vaklui.find((v) => v.naam === 'Stomerij ' + merk);
    const x = await w.post(VAKMAN_WEG, { id: stomerij.id }, T);
    const k = await kast();
    return { klopt: a.status === 200 && b.status === 200 && x.status === 200 && k.vaklui.length === 1 && k.vaklui[0].vak === 'kleermaker',
      ziet: 'vaklui: ' + k.vaklui.map((v) => v.vak).join(', ') };
  });

  await bewaarblok(w, stap, {
    T, lid, merk, wat: 'stuk',
    alle: async (tok) => { const k = await kast(tok); return k ? k.stukken : null; },
    naamVan: (s) => s.naam,
    maak: (naam) => ({ pad: STUK, lijf: { naam, categorie: 'jas', waar: 'Amsterdam' } }),
    weg: (s) => ({ pad: STUK_WEG, lijf: { id: s.id } })
  });
}

module.exports = {
  functie: 'link:garderobe',
  ingang: '/apps/garderobe.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een Lifestyle-lid houdt zijn garderobe bij: per stuk wat het is en waar het hangt, geteld per categorie, met zijn vaklui erbij',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. De vaklui zijn contacten van het lid en geen accounts; er gaat geen opdracht naar een kleermaker. De Lifestyle Pass komt van het eigenaarsaccount van de testomgeving (zie Reisboek). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
