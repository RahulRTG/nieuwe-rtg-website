/* RTG School: de Memory Engine -- van leren-toets-vergeten naar onthouden.

   Schoolsoftware kijkt naar gisteren: wat is er gemaakt, wat was het cijfer.
   Deze laag kijkt naar wat een leerling DREIGT TE VERGETEN. Elk behaald
   leerdoel krijgt een herhaalmoment; wat terugkomt zijn drie korte vragen, niet
   de hele les opnieuw.

   Deze module gaat alleen over de PLANNING (wanneer komt iets terug), niet over
   de vragen zelf: die staan in kern/leerstof-herhalen.js, want het geheugen
   weet niets van sommen en de leerstof weet niets van tijd.

   Drie regels die dit eerlijk houden:

   1. HERHALEN IS GEEN STRAF EN GEEN ACHTERSTAND. Er wordt daarom nergens
      bijgehouden of gemeld HOE LAAT iets is. Dat is geen keuze van het scherm
      maar van deze module: de lijst met open herhalingen draagt geen datum en
      geen achterstand, dus er kan er ook geen op een scherm belanden.
   2. EEN GEMISTE HERHALING WIST NIETS. Het leerdoel blijft behaald en de
      opgebouwde reeks valt een stap terug, niet naar nul: wie het na twee
      maanden even kwijt is, begint niet opnieuw bij af.
   3. WAT JE OP SCHOOL LAAT ZIEN, HOEF JE THUIS NIET NOG EENS. Bewijs van
      school schuift het moment vooruit, maar nooit naar achteren.

   De reeks in dagen. Ruim uit elkaar, want de bedoeling is onthouden op de
   lange termijn en niet elke dag een rondje langs alles. */
const INTERVALLEN = [2, 7, 21, 60, 180];
const HERHAAL_VRAGEN = 3;
const HERHAAL_DREMPEL = 2;
const MAX_OPEN = 50;

const dagenErbij = (iso, dagen) => new Date(new Date(iso).getTime() + dagen * 86400000).toISOString();
const stapVan = rij => Math.min(Math.max(Number((rij.herhaal || {}).stap) || 0, 0), INTERVALLEN.length - 1);

/* Het eerste moment. Een doel van VOOR deze laag krijgt het bij de eerste keer
   kijken en niet met terugwerkende kracht: dat laatste zou een leerling die al
   honderd doelen heeft op dag een honderd herhalingen geven, en dat is precies
   de berg waar deze laag tegen bedoeld is. */
function begin(rij, nu) {
  if (rij.herhaal && rij.herhaal.volgende) return false;
  rij.herhaal = { stap: 0, volgende: dagenErbij(nu, INTERVALLEN[0]) };
  return true;
}

/* Bewijs van school: je hebt het net laten zien, dus niet nu nog een keer.
   Alleen vooruit -- dit mag een moment nooit naar voren halen. */
function uitstel(rij, nu) {
  if (!rij.herhaal || !rij.herhaal.volgende) return begin(rij, nu);
  const voorstel = dagenErbij(nu, INTERVALLEN[stapVan(rij)]);
  if (voorstel > rij.herhaal.volgende) { rij.herhaal.volgende = voorstel; return true; }
  return false;
}

/* Na een ophaling uit het geheugen. Gelukt: een trede hoger en pas veel later
   terug. Niet gelukt: EEN trede terug (niet naar nul) en binnenkort weer, want
   dit is precies het moment waarop herhalen helpt. */
function naOphaling(rij, gelukt, nu) {
  const stap = stapVan(rij);
  const nieuw = gelukt ? Math.min(stap + 1, INTERVALLEN.length - 1) : Math.max(stap - 1, 0);
  rij.herhaal = { stap: nieuw, volgende: dagenErbij(nu, gelukt ? INTERVALLEN[nieuw] : INTERVALLEN[0]),
    laatst: nu };
  return rij.herhaal;
}

/* paspoort/save/nu komen uit onderwijs.js: het herhaalmoment hoort bij het
   leerdoel in het paspoort en niet in een tweede administratie ernaast. */
function maakGeheugen({ paspoort, save, nu }) {
  /* Wat staat er open, en wat komt er later. De open lijst draagt met opzet
     GEEN datum: zie regel 1 hierboven. De latere lijst wel -- "komt terug op"
     is een vooruitzicht en geen verwijt. */
  function herhalingen(key) {
    const p = paspoort(key);
    const tijd = nu();
    let geraakt = false;
    const open = [], later = [];
    for (const [id, rij] of Object.entries(p.doelen)) {
      if (begin(rij, tijd)) geraakt = true;
      if (rij.herhaal.volgende <= tijd) open.push({ doel: id });
      else later.push({ doel: id, volgende: rij.herhaal.volgende });
    }
    if (geraakt) { p.at = tijd; save(); }
    later.sort((a, b) => a.volgende < b.volgende ? -1 : 1);
    return { ok: true, open: open.slice(0, MAX_OPEN), aantal: open.length,
      later: later.slice(0, MAX_OPEN), vragen: HERHAAL_VRAGEN,
      uitleg: 'Wat hier staat komt terug omdat het een tijd geleden is, niet omdat het fout ging.' };
  }

  function noteerOphaling(key, doel, gelukt) {
    const p = paspoort(key);
    const rij = p.doelen[String(doel || '')];
    if (!rij) return { status: 404, error: 'Dit leerdoel staat niet in je paspoort.' };
    const stand = naOphaling(rij, !!gelukt, nu());
    p.at = nu(); save();
    return { ok: true, doel, volgende: stand.volgende };
  }

  /* Voor het paspoortscherm: staat dit doel vandaag open? Een enkel woord,
     geen datum en geen aantal dagen. */
  function staatOpen(key, doel) {
    const rij = paspoort(key).doelen[String(doel || '')];
    return !!(rij && rij.herhaal && rij.herhaal.volgende <= nu());
  }

  return { herhalingen, noteerOphaling, staatOpen };
}

module.exports = { maakGeheugen, begin, uitstel, naOphaling, INTERVALLEN, HERHAAL_VRAGEN, HERHAAL_DREMPEL };
