/* ============================================================================
   DE AFBAKENING -- puur oordeel voor de vierde gang van de IDOR-proef.

   HET GAT. De IDOR-proef probeert B met A's id's. Maar een ledenroute die op de
   SESSIE afbakent (/api/bank/overzicht, /api/geld/cockpit, /api/sociaal/graaf)
   draagt geen id: er valt niets te verrijken, B werd nooit geprobeerd, en de
   route bleef `onbereikbaar` met "geen id van A in dit domein". Ruim een derde
   van alle ledenroutes bleef zo ongesteld, en BETROUWBAARHEID.md par. 4f heeft
   gemeten dat juist ledenSCHERMEN zo werken.

   DE VRAAG bij zo'n route is niet "mag B bij A's object" (er wordt geen object
   genoemd) maar "krijgt B, met hetzelfde verzoek, iets van A terug?". Dat is een
   experiment met een uitslag, mits het aan drie voorwaarden voldoet:

     1  A KRIJGT IETS VAN ZICHZELF. A's antwoord draagt een merkteken: een waarde
        die van A is. Zonder merkteken kan B's antwoord niets over A zeggen, en
        dan blijft de route onbereikbaar -- nooit "afgebakend".
     2  HET MERKTEKEN IS ECHT VAN A. Een controlelid C liep dezelfde routes VOOR
        A. Wat C ook zag (seed-inrichting, publieke catalogus, server-brede
        waarden), is geen merkteken. Een waarde die in het VERZOEK zelf staat
        ook niet: die echoot de route voor iedereen terug.
     3  B STUURT LETTERLIJK HETZELFDE VERZOEK.

   DE UITKOMSTEN:
     gescheiden   B kreeg 401/403/404 (dezelfde lezing als scripts/lib/idor.js,
                  inclusief de toesteldeur die niets bewijst).
     afgebakend   B kreeg 2xx en zijn antwoord draagt GEEN van A's merktekens.
     doorbraak    B kreeg 2xx MET een merkteken van A. Een BEVINDING: het object
                  kan bedoeld openbaar zijn (een gepubliceerde post). Nakijken.
     onbereikbaar A kreeg geen 2xx, A's antwoord droeg geen merkteken, of B kreeg
                  iets anders dan 2xx/401/403/404.

   WAT DIT NIET BEWIJST: dat een schrijfroute zonder id B niet in A's gegevens
   laat schrijven. De gang leest het ANTWOORD; een stille schrijfactie in A's
   naamruimte zonder dat het antwoord iets laat zien, ziet hij niet.
   ========================================================================== */
'use strict';
const { oordeelIdor } = require('./idor');

/* Een waarde die als merkteken kan dienen: lang genoeg om niet toevallig samen
   te vallen, met een cijfer of een @ erin (id's, codenamen, e-mail,
   rekeningnummers), zonder spatie, en GEEN datum of tijd -- die vallen voor
   iedereen die op dezelfde dag of in dezelfde minuut kijkt samen.

   ZONDER SPATIE is gemeten: in de eerste ronde stonden "Er staan nog 5 dingen
   open." (/api/dag) en een zin over "7 dagen zonder verplichtingen"
   (/api/balans) als merkteken van A, omdat C ze voor A's komst met een ander
   getal zag. Dat is huiszinnen-met-een-teller, geen gegeven van A, en B kreeg
   dezelfde zin: twee valse doorbraken. Een id of codenaam heeft geen spatie. */
const DATUM = /^\d{4}-\d{2}-\d{2}|^\d{1,2}:\d{2}(:\d{2})?$|^\d{13}$|^\d{10}$/;
function merkbaar(s) {
  if (typeof s !== 'string') return false;
  if (s.length < 8 || s.length > 200 || /\s/.test(s)) return false;
  if (!/[\d@]/.test(s)) return false;
  return !DATUM.test(s);
}

/* Alle merkbare scalars in een antwoord, tot zes lagen diep. */
function waarden(data, uit = new Set()) {
  (function loop(v, d) {
    if (d > 6 || v === null || v === undefined) return;
    if (typeof v === 'string') { if (merkbaar(v)) uit.add(v); return; }
    if (Array.isArray(v)) { for (const el of v.slice(0, 50)) loop(el, d + 1); return; }
    if (typeof v === 'object') for (const w of Object.values(v)) loop(w, d + 1);
  })(data, 0);
  return uit;
}

/* Staat de waarde in deze tekst, zoals JSON hem zou schrijven? */
function draagt(tekst, waarde) {
  return String(tekst || '').includes(JSON.stringify(waarde).slice(1, -1));
}

/* De merktekens van A in EEN antwoord: wat A hier terugkreeg, wat van A is
   (vanA), wat de controle nooit zag, en wat niet in het verzoek stond. */
function merktekens({ antwoordA, vanA, controle, lijf }) {
  const lijfTekst = JSON.stringify(lijf || {});
  const uit = [];
  for (const w of waarden(antwoordA)) {
    if (!vanA.has(w) || controle.has(w)) continue;
    if (draagt(lijfTekst, w)) continue;
    uit.push(w);
  }
  return uit;
}

function oordeelAfbakening({ a, b, merken }) {
  const ok = (s) => s >= 200 && s < 300;
  if (!ok(a.status)) return { staat: 'onbereikbaar', reden: 'A kreeg zelf ' + a.status + ': er is geen open deur om tegen te ijken' };
  if (!merken.length) {
    return { staat: 'onbereikbaar',
      reden: 'A\'s eigen antwoord draagt niets dat alleen van A is: B\'s antwoord kan hier niets over A zeggen' };
  }
  if (!ok(b.status)) {
    const o = oordeelIdor(b.status, b.tekst);
    return o.staat === 'gescheiden'
      ? Object.assign({}, o, { reden: o.reden + ' (A kreeg ' + a.status + ' met ' + merken.length + ' merkteken(s))' })
      : o;
  }
  const gezien = merken.filter((m) => draagt(b.tekst, m));
  if (gezien.length) {
    return { staat: 'doorbraak', merken: gezien.length, gezien: gezien.slice(0, 3),
      reden: 'B kreeg ' + b.status + ' met hetzelfde verzoek en zag ' + gezien.length + ' van de ' + merken.length +
        ' merktekens van A: NAKIJKEN of dat bedoeld openbaar is' };
  }
  return { staat: 'afgebakend', merken: merken.length, voorbeeld: merken.slice(0, 2),
    reden: 'A kreeg ' + a.status + ' met ' + merken.length + ' merkteken(s) van zichzelf; B kreeg met hetzelfde verzoek ' +
      b.status + ' en geen enkel daarvan: de route bakent af op de sessie' };
}

module.exports = { merkbaar, waarden, draagt, merktekens, oordeelAfbakening };
