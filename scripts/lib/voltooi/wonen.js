/* ============================================================================
   VOLTOOIPROEF: WONEN (link:wonen, /apps/wonen.html).

   De belofte, in de woorden van kern/woningonderhoud.js en public/apps/wonen.js:
   het lid meldt zelf wat er thuis stuk is, en "een melding begint altijd als
   gemeld: zonder gekoppelde vakman doen we niet alsof iemand onderweg is". En
   het woningdossier: contracten, garanties en handleidingen in een eigen map
   "Woningdossier" in de kluis, zodat het lid ze bij zijn huis terugvindt.

   De proef doet wat het scherm doet: de map aanmaken als hij er nog niet is
   (het antwoord draagt `id`), het document als data-URL insturen met die map,
   en het dossier lezen als de documenten in die map die niet weg zijn.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const ONDERHOUD = '/api/home/onderhoud';
const MELD = '/api/home/onderhoud/meld';
const ANNULEER = '/api/home/onderhoud/annuleer';
const MAP = '/api/bestanden/map';
const UPLOAD = '/api/bestanden/upload';
const MIJN = '/api/bestanden/mijn';
const HUIS = '/api/home';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const pdf = (tekst) => 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n% ' + tekst + '\n%%EOF\n').toString('base64');

async function loop(w, stap) {
  const merk = 'wn' + Date.now().toString(36);
  const lid = await nieuwLid(w, 'won');
  const T = lid.token;
  const meldingen = async (tok) => ((((await w.post(ONDERHOUD, {}, tok || T)).data) || {}).meldingen || []);
  /* Het dossier zoals public/apps/wonen.js het leest. */
  const dossier = async (tok) => {
    const b = ((await w.post(MIJN, {}, tok || T)).data) || {};
    const m = (b.mappen || []).find((x) => String(x.naam).toLowerCase() === 'woningdossier');
    return m ? (b.items || []).filter((x) => !x.weg && x.map === m.id) : [];
  };
  let mapId = null, lek = null;

  await stap('voltooibaar', 'het lid meldt een lekkende kraan; de melding staat er als "gemeld" en niet als "onderweg"', async () => {
    const r = await w.post(MELD, { titel: 'Kraan lekt ' + merk, plek: 'Keuken', urgentie: 'hoog', notitie: 'druppelt' }, T);
    lek = r.data && r.data.melding;
    const m = (await meldingen()).find((x) => x.id === (lek && lek.id));
    return { klopt: r.status === 200 && !!m && m.status === 'gemeld' && m.urgentie === 'hoog', ziet: 'melden ' + r.status + ', stand ' + (m && m.status) + ', urgentie ' + (m && m.urgentie) };
  });

  await stap('voltooibaar', 'een melding zonder plek of met een te korte omschrijving wordt geweigerd met de reden', async () => {
    const a = await w.post(MELD, { titel: 'Lamp kapot', plek: '' }, T);
    const b = await w.post(MELD, { titel: 'x', plek: 'Hal' }, T);
    return { klopt: a.status === 400 && /plek in huis/.test(a.data.error) && b.status === 400 && /Vertel kort/.test(b.data.error), ziet: a.status + ' (' + (a.data && a.data.error) + '), ' + b.status };
  });

  await stap('voltooibaar', 'annuleren zet de melding op geannuleerd, en hij blijft als historie zichtbaar', async () => {
    const r = await w.post(MELD, { titel: 'Deurbel ' + merk, plek: 'Voordeur' }, T);
    const a = await w.post(ANNULEER, { id: r.data.melding.id }, T);
    const m = (await meldingen()).find((x) => x.id === r.data.melding.id);
    return { klopt: a.status === 200 && !!m && m.status === 'geannuleerd', ziet: 'annuleren ' + a.status + ', stand ' + (m && m.status) };
  });

  await stap('voltooibaar', 'het woningdossier: de map ontstaat, een garantiebewijs gaat erin en staat in het dossier', async () => {
    const m = await w.post(MAP, { naam: 'Woningdossier' }, T);
    mapId = m.data && m.data.id;
    const u = await w.post(UPLOAD, { naam: 'Garantie cv-ketel ' + merk + '.pdf', map: mapId, dataUrl: pdf('garantie ' + merk) }, T);
    const d = await dossier();
    return { klopt: m.status === 200 && !!mapId && u.status === 200 && d.length === 1 && d[0].naam.includes(merk), ziet: 'map ' + m.status + ', upload ' + u.status + ', dossier: ' + d.map((x) => x.naam).join(', ') };
  });

  await stap('voltooibaar', 'het huisoverzicht laadt naast het dossier, zoals het scherm ze samen leest', async () => {
    const h = await w.post(HUIS, {}, T);
    return { klopt: h.status === 200 && !!h.data, ziet: 'huis ' + h.status + ' (' + Object.keys(h.data || {}).slice(0, 5).join(',') + ')' };
  });

  /* ---------------- persistent ---------------- */
  const voorM = JSON.stringify((await meldingen()).find((x) => x.id === lek.id));
  const voorD = JSON.stringify(await dossier());
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan de melding en het dossier er nog, gelijk', async () => {
    const m = JSON.stringify((await meldingen()).find((x) => x.id === lek.id));
    const d = JSON.stringify(await dossier());
    return { klopt: m === voorM && d === voorD && voorD.length > 2, ziet: 'melding ' + (m === voorM ? 'gelijk' : 'ANDERS') + ', dossier ' + (d === voorD ? 'gelijk' : 'ANDERS') };
  });
  await stap('persistent', 'een nieuwe sessie ziet dezelfde melding en hetzelfde document', async () => {
    const C = await inloggen(w, lid);
    const m = (await meldingen(C)).find((x) => x.id === lek.id);
    const d = await dossier(C);
    return { klopt: !!m && d.length === 1, ziet: 'melding ' + (m ? m.status : 'WEG') + ', ' + d.length + ' document' };
  });
  await stap('persistent', 'de melding en het document staan in de opslag zelf', async () => {
    const m = w.vindInOpslag(lek.id);
    const d = w.vindInOpslag('Garantie cv-ketel ' + merk);
    return { klopt: m.length >= 1 && d.length >= 1, ziet: 'melding in ' + m.map((p) => p.sleutel || p.tabel).join(',') + '; document in ' + d.map((p) => p.sleutel || p.tabel).join(',') };
  });

  /* ---------------- bevoegd ---------------- */
  await stap('bevoegd', 'een ander lid ziet of wijzigt de onderhoudsmelding en het woningdossier niet, en houdt een eigen woningadministratie', async () => {
    const ander = await nieuwLid(w, 'won-ander');
    const B = ander.token;
    const doelDocument = (await dossier())[0];
    const voorB = await meldingen(B);
    const dossierVoorB = await dossier(B);
    const aanvalMelding = await w.post(ANNULEER, { id: lek.id }, B);
    const aanvalDocument = await w.post(UPLOAD, {
      id: doelDocument && doelDocument.id,
      dataUrl: pdf('vreemde versie ' + merk)
    }, B);
    const eigenB = await w.post(MELD, { titel: 'Eigen melding ' + merk, plek: 'Schuur' }, B);
    const naA = await meldingen();
    const naB = await meldingen(B);
    const dossierNaA = await dossier();
    const dossierNaB = await dossier(B);
    const aBehoudtMelding = naA.some((x) => x.id === lek.id && x.status === 'gemeld');
    const bZietA = voorB.concat(naB).some((x) => x.id === lek.id);
    const aZietB = naA.some((x) => x.id === (eigenB.data && eigenB.data.melding && eigenB.data.melding.id));
    const bZietEigen = naB.some((x) => x.id === (eigenB.data && eigenB.data.melding && eigenB.data.melding.id));
    const aBehoudtDocument = dossierNaA.length === 1 && dossierNaA[0].id === (doelDocument && doelDocument.id);
    const bZietDocument = dossierVoorB.concat(dossierNaB).some((x) => x.id === (doelDocument && doelDocument.id));
    return {
      klopt: geen5xx(aanvalMelding) && geen5xx(aanvalDocument) && eigenB.status === 200 &&
        aBehoudtMelding && !bZietA && !aZietB && bZietEigen && aBehoudtDocument && !bZietDocument,
      ziet: 'vreemd annuleren ' + aanvalMelding.status + ', vreemde versie ' + aanvalDocument.status +
        '; A behoudt melding/document=' + aBehoudtMelding + '/' + aBehoudtDocument +
        ', B ziet A=' + (bZietA || bZietDocument) + ', B houdt eigen=' + bZietEigen + ', A ziet B=' + aZietB
    };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "melding versturen": een melding, niet twee', async () => {
    const lijf = { titel: 'Dubbel ' + merk, plek: 'Badkamer', urgentie: 'normaal', notitie: '' };
    const [a, b] = await w.dubbel(MELD, lijf, T);
    const n = (await meldingen()).filter((x) => x.titel === lijf.titel).length;
    return { klopt: a.status === 200 && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' melding(en)' };
  });
  await stap('herstelbaar', 'dubbeltik op een document toevoegen: een document in het dossier, niet twee', async () => {
    const lijf = { naam: 'Handleiding ' + merk + '.pdf', map: mapId, dataUrl: pdf('handleiding ' + merk) };
    const [a, b] = await w.dubbel(UPLOAD, lijf, T);
    const n = (await dossier()).filter((x) => x.naam === lijf.naam).length;
    return { klopt: a.status === 200 && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' document(en)' };
  });
  await stap('herstelbaar', 'een crash direct na het melden: de melding staat er na de herstart', async () => {
    const r = await w.post(MELD, { titel: 'Crash ' + merk, plek: 'Zolder' }, T);
    await w.crash();
    const m = (await meldingen()).find((x) => x.id === (r.data && r.data.melding && r.data.melding.id));
    return { klopt: r.status === 200 && !!m, ziet: 'melden ' + r.status + ', na SIGKILL ' + (m ? m.status : 'WEG') };
  });
  await stap('herstelbaar', 'een crash direct na het annuleren: geannuleerd blijft geannuleerd', async () => {
    const a = await w.post(ANNULEER, { id: lek.id }, T);
    await w.crash();
    const m = (await meldingen()).find((x) => x.id === lek.id);
    return { klopt: a.status === 200 && !!m && m.status === 'geannuleerd', ziet: 'annuleren ' + a.status + ', na SIGKILL ' + (m && m.status) };
  });
}

module.exports = {
  functie: 'link:wonen',
  ingang: '/apps/wonen.html',
  persona: 'lid',
  belofte: 'een lid meldt wat er thuis stuk is zonder dat RTG een vakman veinst, en houdt zijn woningdocumenten bij in een eigen dossier',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Er is geen vakman gekoppeld en de proef beweert dat ook niet; "opgelost" heeft geen route en is niet gelopen. De slimme apparaten (Home) leest het scherm alleen mee. Het document is een PDF van een paar bytes; de virusscan is niet beproefd. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
