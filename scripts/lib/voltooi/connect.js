/* ============================================================================
   VOLTOOIPROEF: FOUNDATION CONNECT VOOR HET GEZIN (link:connect, /apps/connect.html).

   De belofte van het scherm: je ontdekt iets, opent het, zegt wat je meer of
   minder wilt en wat je al kent, zet de schuif tussen vertrouwd en nieuw, en je
   leerdossier en portfolio zeggen wat er is gebeurd -- per onderwerp en zonder
   score, rangorde of niveau. Het dossier is van jou: geen ander gezin en geen
   ander profiel in je eigen gezin leest het.

   DE DEUR. connect.html kiest bij een gezinssessie (rtf_sessie, geen
   ledentoken) de gezinsdeur /api/rtf/connect/*, met code en token in het lijf.
   Dat is de deur die deze proef loopt: de persona van deze rij is het gezin.
   De ledendeur /api/connect/* (dezelfde motor) loopt de lusproef
   (scripts/lusproef.js) met twee leden; hier alleen zijn weigering zonder
   account.

   DE WERELD. Een gezin met een eigenaar-account en een kind (../voltooigezin.js,
   accountplicht aan); een tweede gezin is de kruisproef op de gezinscode.

   DE LEERDOSSIERGRENS (CLAUDE.md, progressielaag): het dossier mag op elke
   leeftijd bestaan zolang het over de persoon zelf gaat en nooit vergelijkt.
   De proef ziet dat het kind een eigen, leeg dossier heeft en dat niets van de
   ouder erin staat; een ranglijst of niveau komt in geen antwoord voor.
   ========================================================================== */
'use strict';
const { GEZINSWERELD, accountGezin } = require('../voltooigezin');

const ONTDEK = '/api/rtf/connect/ontdek';
const OPEN = '/api/rtf/connect/open';
const SIGNAAL = '/api/rtf/connect/signaal';
const SCHUIF = '/api/rtf/connect/schuif';
const HORIZON = '/api/rtf/connect/horizon';
const DOSSIER = '/api/rtf/connect/dossier';
const PORTFOLIO = '/api/rtf/connect/portfolio';
const NOTEER = '/api/rtf/connect/noteer';
const WERK = '/api/rtf/connect/werk';
const LID_ONTDEK = '/api/connect/ontdek';

const regels = (r) => ((r && r.data && r.data.regels) || []);

async function loop(w, stap) {
  const merk = Date.now().toString(36);
  const ouder = await accountGezin(w, 'connect', { kind: true });
  const ander = await accountGezin(w, 'connectander');
  const G = (b, s) => Object.assign({ code: (s || ouder.gezin).code, token: (s || ouder.gezin).token }, b || {});
  const post = (pad, b, s) => w.post(pad, G(b, s));
  const ONDERWERP = 'sterrenkunde' + merk;
  let plek = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de ouder opent Connect via zijn gezin: er zijn ontdekkingen, met waarom en wat het niet dekt, en een leeg dossier', async () => {
    const o = await post(ONTDEK, {});
    const d = await post(DOSSIER, {});
    plek = ((o.data && o.data.plekken) || [])[0] || null;
    return { klopt: o.status === 200 && !!plek && !!plek.waarom && !!plek.ontdekking.dektNiet && d.status === 200 && regels(d).length === 0,
      ziet: 'ontdek ' + o.status + ' met ' + ((o.data && o.data.plekken) || []).length + ' plekken, dossier ' + regels(d).length + ' regels' };
  });

  await stap('voltooibaar', 'de ouder opent een ontdekking: dat is de enige plek waar "gezien" in het dossier komt', async () => {
    const o = await post(OPEN, { id: plek && plek.ontdekking.id, onderwerp: plek && plek.ontdekking.onderwerp, herkomst: plek && plek.ontdekking.herkomst });
    const r = regels(await post(DOSSIER, {}));
    return { klopt: o.status === 200 && r.length === 1 && r[0].trede === 'gezien' && r[0].onderwerp === plek.ontdekking.onderwerp,
      ziet: 'openen ' + o.status + ', dossier ' + r.map((x) => x.onderwerp + ':' + x.trede).join(', ') };
  });

  await stap('voltooibaar', 'de ouder zegt meer van een onderwerp en minder van een ander, en zet de schuif naar nieuw: de horizon toont het', async () => {
    const m = await post(SIGNAAL, { onderwerp: ONDERWERP, signaal: 'meer' });
    const mi = await post(SIGNAAL, { onderwerp: 'voetbal' + merk, signaal: 'minder' });
    const s = await post(SCHUIF, { schuif: 70 });
    const h = (await post(HORIZON, {})).data || {};
    const on = h.onderwerpen || [];
    return { klopt: [m.status, mi.status, s.status].every((x) => x === 200) && h.schuif === 70 &&
      on.some((x) => x.onderwerp === ONDERWERP && x.gewicht > 0) && on.some((x) => x.onderwerp === 'voetbal' + merk && x.gewicht < 0),
      ziet: 'signalen ' + m.status + '/' + mi.status + ', schuif ' + h.schuif + ', ' + on.length + ' onderwerpen op de horizon' };
  });

  await stap('voltooibaar', 'de ouder zegt dat hij iets begrepen heeft: het staat in het dossier en het portfolio als "u zelf gezegd", zonder score of niveau', async () => {
    const n = await post(NOTEER, { trede: 'begrepen', onderwerp: ONDERWERP });
    const d = (await post(DOSSIER, {})).data || {};
    const p = (await post(PORTFOLIO, {})).data || {};
    const b = (p.bewijzen || []).find((x) => x.onderwerp === ONDERWERP) || {};
    const tekst = JSON.stringify([d, p]);
    return { klopt: n.status === 200 && (d.perOnderwerp || []).some((x) => x.onderwerp === ONDERWERP && x.trede === 'begrepen') &&
      b.graad === 'vermoed' && !/ranglijst|"niveau"|"score"|"rang"/i.test(tekst),
      ziet: 'noteren ' + n.status + ', portfolio graad ' + b.graad + ', ' + (d.perOnderwerp || []).length + ' onderwerp(en) in het dossier' };
  });

  await stap('voltooibaar', 'eigen werk erbij halen is een handeling en zegt eerlijk dat er niets nieuws was', async () => {
    const r = await post(WERK, {});
    return { klopt: r.status === 200 && Array.isArray(r.data.nieuw) && r.data.nieuw.length === 0 && !!(r.data.uitleg || r.data.reden),
      ziet: 'werk erbij ' + r.status + ', ' + ((r.data && r.data.nieuw) || []).length + ' nieuw' };
  });

  /* Bevoegdheid. */
  await stap('voltooibaar', 'bevoegdheid: zonder account weigert de ledendeur (401) en zonder gezinssessie de gezinsdeur', async () => {
    const l = await w.post(LID_ONTDEK, {});
    const g = await w.post(DOSSIER, {});
    const s = await w.post(SIGNAAL, { onderwerp: ONDERWERP, signaal: 'meer' });
    return { klopt: l.status === 401 && g.status >= 401 && g.status <= 403 && s.status >= 401 && s.status <= 403,
      ziet: 'ledendeur ' + l.status + ', gezinsdeur dossier ' + g.status + ' en signaal ' + s.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een ander gezin leest het dossier van de ouder niet, ook niet met de gezinscode van de ouder', async () => {
    const eigen = regels(await post(DOSSIER, {}, ander.gezin));
    const kruis = await w.post(DOSSIER, { code: ouder.gezin.code, token: ander.gezin.token });
    const omgekeerd = await w.post(NOTEER, { code: ander.gezin.code, token: ouder.gezin.token, trede: 'begrepen', onderwerp: 'kruis' + merk });
    return { klopt: eigen.length === 0 && kruis.status >= 401 && kruis.status <= 403 && omgekeerd.status >= 401 && omgekeerd.status <= 403 &&
      w.vindInOpslag('kruis' + merk).length === 0,
      ziet: 'ander gezin ziet ' + eigen.length + ' regels, met de code van de ouder ' + kruis.status + ', omgekeerd schrijven ' + omgekeerd.status };
  });

  await stap('voltooibaar', 'bevoegdheid: het kind heeft een eigen dossier, ziet niets van de ouder, en "onderwezen" zegt niemand over zichzelf', async () => {
    const k = regels(await post(DOSSIER, {}, ouder.kind));
    const zelf = await post(NOTEER, { trede: 'onderwezen', onderwerp: ONDERWERP }, ouder.kind);
    const kn = await post(NOTEER, { trede: 'begrepen', onderwerp: 'breuken' + merk }, ouder.kind);
    const kNa = regels(await post(DOSSIER, {}, ouder.kind));
    const oNa = regels(await post(DOSSIER, {}));
    return { klopt: k.length === 0 && zelf.status === 400 && kn.status === 200 && kNa.length === 1 && !oNa.some((x) => x.onderwerp === 'breuken' + merk),
      ziet: 'kind begint met ' + k.length + ' regels, "onderwezen" ' + zelf.status + ', eigen regel ' + kn.status + ', ouder ziet hem ' + oNa.some((x) => x.onderwerp === 'breuken' + merk) };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan het dossier, de horizon en de schuif er nog', async () => {
    const d = regels(await post(DOSSIER, {}));
    const h = (await post(HORIZON, {})).data || {};
    return { klopt: d.length === 2 && h.schuif === 70 && (h.onderwerpen || []).some((x) => x.onderwerp === ONDERWERP),
      ziet: d.length + ' regels, schuif ' + h.schuif + ', ' + (h.onderwerpen || []).length + ' onderwerpen' };
  });

  await stap('persistent', 'een read-only lezer vindt de dossierregel in de opslag, aan het profiel en zonder e-mailadres', async () => {
    const v = w.vindInOpslag(ONDERWERP);
    const d = JSON.stringify((await post(DOSSIER, {})).data || {});
    return { klopt: v.length > 0 && !d.includes(ouder.email),
      ziet: 'gevonden in ' + [...new Set(v.map((p) => p.bestand + (p.sleutel ? ':' + p.sleutel : '')))].join(', ') };
  });

  await stap('persistent', 'na de herstart opent de ouder een nieuwe gezinssessie vanuit zijn account en ziet hetzelfde dossier', async () => {
    const s = await w.post('/api/rtf/eigen-gezin/sessie', {}, ouder.token);
    const d = regels(await w.post(DOSSIER, { code: s.data && s.data.code, token: s.data && s.data.token }));
    return { klopt: s.status === 200 && d.length === 2, ziet: 'nieuwe gezinssessie ' + s.status + ', ' + d.length + ' regels' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Dit snap ik zet een regel in het dossier en geen twee', async () => {
    const O = 'getijden' + merk;
    const [a, b] = await w.dubbel(NOTEER, G({ trede: 'begrepen', onderwerp: O }));
    const n = regels(await post(DOSSIER, {})).filter((x) => x.onderwerp === O).length;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' regel' };
  });

  await stap('herstelbaar', 'een dubbele tik op Bekijken zet "gezien" een keer in het dossier', async () => {
    const voor = regels(await post(DOSSIER, {})).filter((x) => x.trede === 'gezien').length;
    const [a, b] = await w.dubbel(OPEN, G({ id: plek && plek.ontdekking.id, onderwerp: plek && plek.ontdekking.onderwerp, herkomst: plek && plek.ontdekking.herkomst }));
    const na = regels(await post(DOSSIER, {})).filter((x) => x.trede === 'gezien').length;
    return { klopt: a.status === 200 && b.status === 200 && na === voor, ziet: 'tikken ' + a.status + '/' + b.status + ', gezien ' + voor + ' -> ' + na };
  });

  await stap('herstelbaar', 'een afgebroken schuifbeweging en daarna opnieuw: de schuif staat waar hij heen moest', async () => {
    const half = await w.afgebroken(SCHUIF, G({ schuif: 20 }));
    const opnieuw = await post(SCHUIF, { schuif: 20 });
    const h = (await post(HORIZON, {})).data || {};
    return { klopt: opnieuw.status === 200 && h.schuif === 20,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', schuif ' + h.schuif };
  });

  await stap('herstelbaar', 'een crash direct na een dossierregel verliest hem niet', async () => {
    const O = 'vulkanen' + merk;
    const r = await post(NOTEER, { trede: 'toegepast', onderwerp: O });
    await w.crash();
    const n = regels(await post(DOSSIER, {})).filter((x) => x.onderwerp === O).length;
    return { klopt: r.status === 200 && n === 1, ziet: 'noteren ' + r.status + ', na SIGKILL ' + n + ' regel' };
  });
}

module.exports = {
  functie: 'link:connect',
  ingang: '/apps/connect.html',
  persona: 'gezin',
  omgeving: GEZINSWERELD,
  belofte: 'je ontdekt iets, opent het, zegt wat je meer of minder wilt en wat je begrepen hebt, zet de schuif tussen vertrouwd en nieuw, en je dossier en portfolio zeggen wat er gebeurde -- zonder score of niveau, en geen ander gezin of profiel leest het',
  grens: 'De proef loopt de gezinsdeur /api/rtf/connect/*, die connect.html bij een gezinssessie kiest, niet door het scherm zelf. De ledendeur en de bevestiging door een ander mens (naklank) loopt de lusproef (scripts/lusproef.js). Of een dubbele tik op Meer hiervan een of twee keer telt, is hier niet beproefd: een signaal draagt geen herhaalsleutel en telt per tik. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
