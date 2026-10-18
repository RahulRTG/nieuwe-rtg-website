/* ============================================================================
   VOLTOOIPROEF: NALATENSCHAP (link:nalatenschap, /apps/geld.html#nalatenschap).

   De belofte, in de woorden van kern/rechterhand/nalatenschap.js: de
   belangrijke documenten met waar ze liggen, de vertrouwenspersonen met hun
   contact, en de persoonlijke wensen. En: "De gevoelige velden -- waar iets
   ligt, de contactgegevens en de wensen -- staan VERSLEUTELD op schijf", zodat
   ze onleesbaar zijn als het databasebestand in verkeerde handen valt.

   Dat tweede is precies wat een persistent-proef kan nagaan en een route niet:
   de route geeft de tekst ontsleuteld terug, dus "het staat er" en "het staat er
   niet leesbaar" zijn twee metingen. De proef leest het bestand zelf.
   ========================================================================== */
'use strict';
const { lifestyleLid, KANTOORWERELD } = require('../voltooiwereld');
const { bewaarblok } = require('../voltooiboek');

const DOSSIER = '/api/member/rechterhand/nalatenschap';
const DOC = '/api/member/rechterhand/nalatenschap/doc';
const DOC_WEG = '/api/member/rechterhand/nalatenschap/doc/weg';
const CONTACT = '/api/member/rechterhand/nalatenschap/contact';
const CONTACT_WEG = '/api/member/rechterhand/nalatenschap/contact/weg';
const WENS = '/api/member/rechterhand/nalatenschap/wens';
const WENS_WEG = '/api/member/rechterhand/nalatenschap/wens/weg';

async function loop(w, stap) {
  const merk = 'nl' + Date.now().toString(36);
  const geheim = { waar: 'Kluis bank ' + merk + ' vak 77', tel: '0699' + merk.slice(-4), wens: 'Asverstrooiing op zee ' + merk };
  const lid = await lifestyleLid(w, 'nal');
  const T = lid.token;
  const dossier = async (tok) => { const r = await w.post(DOSSIER, {}, tok || T); return r.status === 200 ? r.data : null; };

  await stap('voltooibaar', 'het testament staat in het dossier met waar het ligt', async () => {
    const r = await w.post(DOC, { titel: 'Testament ' + merk, soort: 'testament', waar: geheim.waar }, T);
    const d = await dossier();
    const t = d && d.documenten.find((x) => x.titel === 'Testament ' + merk);
    return { klopt: r.status === 200 && !!t && t.soort === 'testament' && t.waar === geheim.waar, ziet: t ? t.soort + ', waar: leesbaar voor het lid' : 'niet gevonden' };
  });

  await stap('voltooibaar', 'de notaris staat erbij met telefoon; een onbekende rol wordt "overig"', async () => {
    const a = await w.post(CONTACT, { naam: 'Notaris ' + merk, rol: 'notaris', telefoon: geheim.tel, email: 'notaris@voorbeeld.nl' }, T);
    const b = await w.post(CONTACT, { naam: 'Buurman ' + merk, rol: 'astronaut' }, T);
    const d = await dossier();
    const n = d.contacten.find((x) => x.naam === 'Notaris ' + merk);
    const m = d.contacten.find((x) => x.naam === 'Buurman ' + merk);
    return { klopt: a.status === 200 && b.status === 200 && n && n.telefoon === geheim.tel && m && m.rol === 'overig', ziet: 'notaris met telefoon, buurman als ' + (m && m.rol) };
  });

  await stap('voltooibaar', 'een persoonlijke wens vastleggen; een lege wens wordt geweigerd met de reden', async () => {
    const a = await w.post(WENS, { titel: 'Uitvaart', tekst: geheim.wens }, T);
    const leeg = await w.post(WENS, { titel: 'Leeg', tekst: '' }, T);
    const d = await dossier();
    return { klopt: a.status === 200 && d.wensen.some((x) => x.tekst === geheim.wens) && leeg.status === 400 && /vastleggen/.test(leeg.data.error),
      ziet: d.wensen.length + ' wens; leeg: ' + leeg.status + ' (' + (leeg.data && leeg.data.error) + ')' };
  });

  await stap('voltooibaar', 'een contact en een wens weghalen haalt precies die weg', async () => {
    const d0 = await dossier();
    const b = d0.contacten.find((x) => x.naam === 'Buurman ' + merk);
    const x = await w.post(CONTACT_WEG, { id: b.id }, T);
    const tijdelijk = await w.post(WENS, { titel: 'Tijdelijk', tekst: 'Tijdelijke wens ' + merk }, T);
    const d1 = await dossier();
    const tw = d1.wensen.find((v) => v.titel === 'Tijdelijk');
    const y = await w.post(WENS_WEG, { id: tw && tw.id }, T);
    const d = await dossier();
    return { klopt: x.status === 200 && tijdelijk.status === 200 && y.status === 200 && d.contacten.length === 1 && d.wensen.length === 1,
      ziet: d.contacten.length + ' contact, ' + d.wensen.length + ' wens over' };
  });

  /* De versleuteling: de titel mag gewoon in de opslag staan (hij is geen geheim),
     de plek, het telefoonnummer en de wens niet leesbaar. Gemeten VOOR het
     bewaarblok, zodat de herstart erna ook over deze rij gaat. */
  await stap('persistent', 'de gevoelige velden staan versleuteld op schijf: de titel wel leesbaar, de plek, het nummer en de wens niet', async () => {
    const titel = w.vindInOpslag('Testament ' + merk).length;
    const waar = w.vindInOpslag(geheim.waar).length;
    const tel = w.vindInOpslag(geheim.tel).length;
    const wens = w.vindInOpslag(geheim.wens).length;
    return { klopt: titel >= 1 && waar === 0 && tel === 0 && wens === 0,
      ziet: 'titel op ' + titel + ' plek(ken); plek ' + waar + ', telefoon ' + tel + ', wens ' + wens + ' keer leesbaar op schijf' };
  });

  await bewaarblok(w, stap, {
    T, lid, merk, wat: 'document',
    alle: async (tok) => { const d = await dossier(tok); return d ? d.documenten : null; },
    naamVan: (x) => x.titel,
    maak: (naam) => ({ pad: DOC, lijf: { titel: naam, soort: 'verzekering', waar: 'Map ' + naam } }),
    weg: (x) => ({ pad: DOC_WEG, lijf: { id: x.id } })
  });

  await stap('persistent', 'na de herstarts en crashes leest het lid de versleutelde velden nog gewoon terug', async () => {
    const d = await dossier();
    const t = d.documenten.find((x) => x.titel === 'Testament ' + merk);
    const n = d.contacten.find((x) => x.naam === 'Notaris ' + merk);
    return { klopt: !!t && t.waar === geheim.waar && !!n && n.telefoon === geheim.tel && d.wensen.some((x) => x.tekst === geheim.wens),
      ziet: 'plek, telefoon en wens ontsleuteld na ' + (w.herstarts.netjes + w.herstarts.crash) + ' herstarts' };
  });
}

module.exports = {
  functie: 'link:nalatenschap',
  ingang: '/apps/geld.html#nalatenschap',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een Lifestyle-lid legt zijn nalatenschap vast -- documenten en waar ze liggen, vertrouwenspersonen, wensen -- en de gevoelige velden staan versleuteld op schijf',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Wie het dossier na overlijden mag openen, regelt deze app niet en wordt niet gemeten. "Versleuteld op schijf" is gemeten als: de tekst staat nergens leesbaar in de .db-bestanden van de datamap; de sterkte van de versleuteling en de plek van de sleutel zijn niet beproefd. De Lifestyle Pass komt van het eigenaarsaccount van de testomgeving (zie Reisboek). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
