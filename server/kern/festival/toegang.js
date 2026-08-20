/* RTG Festival (deelmodule): DE SCAN. Een handeling, geen vraag.

   ./poort.js beantwoordt "mag deze pas hier, nu" en schrijft niets. Hier wordt
   het onthouden, en daarmee komen er drie dingen bij die een vraag niet heeft:
   dubbelgebruik, de telling, en het feit dat een poort offline kan staan.

   DE ZIN DIE DE MEDEWERKER LEEST IS HET PRODUCT. Niet een foutcode, niet een
   veld. Drie standen, en meer moeten het er niet worden:

     GROEN    binnen, met wat hij moet weten (soort pas, waar hij heen mag)
     ORANJE   er is iets, en het is aan een mens -- meestal dubbelgebruik
     ROOD     nee, met de reden waar hij iets mee kan

   WAAROM ORANJE BESTAAT EN GEEN ROOD IS. Een pas die al binnen is, is meestal
   geen fraude: iemand liep terug naar zijn auto, een band werd doorgegeven, een
   poort stond offline. Rood aan de deur maakt daar een ruzie van; oranje met
   "al gescand bij Noord om 10:41" maakt er een gesprek van. Wie het echt wil
   weigeren, weigert -- dat is een mens.

   DE POORT MAG WEL DICHT BIJ VOL, EN DAT BOTST NIET MET FESTIVAL.md par. 5.3.
   Die paragraaf verbiedt de AI een zone te sluiten, want dat is een oordeel.
   De capaciteit uit de vergunning is geen oordeel: het is een getal dat een mens
   heeft ondertekend voordat de poorten opengingen. De scanner telt alleen. Bij
   de VEILIGE capaciteit gaat er niets dicht -- daar begint de uitzondering, en
   die gaat naar een mens (zie ./uitzondering.js). */
'use strict';

module.exports = (ctx) => {
  const { save, editieVind, plekVind, plekPad, magHier, PLEK_SOORTEN } = ctx;

  /* De plek WAAR JE BINNEN BENT als je hier scant. Een poort is geen
     verblijfplaats: wie bij hek Noord scant, staat daarna in de zone erachter.
     Loop dus vanaf de gescande plek omhoog tot de eerste die telt. */
  function telplekVan(e, plek) {
    const pad = plekPad(e, plek.id);
    if (!pad) return null;
    return pad.find(p => (PLEK_SOORTEN[p.soort] || {}).telt) || null;
  }

  /* Is deze pas nu binnen op deze telplek, op deze dag? De laatste scan telt;
     dat is de hele toestand. Een aparte "binnen"-vlag naast de scans zou een
     tweede waarheid zijn die na een herstelde back-up uit de pas loopt. */
  function laatsteScan(e, pasId, telplekId, dagId) {
    let uit = null;
    for (const s of e.scans || []) {
      if (s.pas === pasId && s.telplek === telplekId && s.dag === dagId) uit = s;
    }
    return uit;
  }
  const isBinnen = (s) => !!s && s.richting === 'in';

  /* Hoeveel passen staan er nu op deze telplek? Telt de passen waarvan de
     laatste scan op deze plek en dag een 'in' was. */
  function aanwezig(e, telplekId, dagId) {
    const stand = new Map();
    for (const s of e.scans || []) {
      if (s.telplek === telplekId && s.dag === dagId) stand.set(s.pas, s.richting);
    }
    let n = 0;
    for (const r of stand.values()) if (r === 'in') n++;
    return n;
  }

  function scan(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, stand: 'rood', zin: 'Deze editie bestaat niet.' };
    if (!Array.isArray(e.scans)) e.scans = [];
    const d = data || {};
    const richting = d.richting === 'uit' ? 'uit' : 'in';

    const oordeel = magHier(fid, eid, d);
    if (!oordeel.ok) {
      /* Naar buiten mag altijd. Een pas die om welke reden dan ook niet meer
         geldig is -- ingetrokken, dag voorbij -- moet het terrein wel kunnen
         verlaten, en als hij binnen stond hoort die telling te kloppen. Een
         mens die niet naar buiten mag omdat zijn kaartje verlopen is, is een
         ontwerpfout met een draaihek eromheen. */
      if (richting === 'uit' && oordeel.pas && oordeel.plek && oordeel.dag) {
        return zetScan(e, oordeel, d, 'uit', 'groen', 'Uitgescand.');
      }
      return { status: oordeel.status || 403, stand: 'rood', zin: oordeel.reden, pas: oordeel.pas || null };
    }

    const tel = telplekVan(e, oordeel.plek);
    if (!tel) return { status: 409, stand: 'rood', zin: 'Deze plek hangt nergens aan; het terrein is niet in orde.' };
    const vorige = laatsteScan(e, oordeel.pas.id, tel.id, oordeel.dag.id);

    if (richting === 'in') {
      if (isBinnen(vorige)) {
        /* ORANJE, en met alles erin wat de mens nodig heeft om te beslissen. */
        return { stand: 'oranje', zin: 'Al gescand bij ' + vorige.poort + ', om ' + vorige.tijd + '.',
          pas: oordeel.pas, plek: oordeel.plek, telplek: tel, eerdere: vorige };
      }
      const binnen = aanwezig(e, tel.id, oordeel.dag.id);
      if (tel.capaciteit && binnen >= tel.capaciteit) {
        return { status: 409, stand: 'rood', zin: tel.naam + ' zit op de vergunde capaciteit (' + tel.capaciteit + ').',
          pas: oordeel.pas, plek: oordeel.plek, telplek: tel, vol: true };
      }
    } else if (!isBinnen(vorige)) {
      return { stand: 'oranje', zin: 'Deze pas stond hier niet binnen.', pas: oordeel.pas, plek: oordeel.plek, telplek: tel };
    }

    /* DE STAND STAAT NIET IN DE ZIN. Het scherm toont "GROEN" al als het
       grootste element dat er is; het woord hier nog eens herhalen levert
       "GROEN / GROEN -- GAST -- Poort Noord" op, en erger: twee plekken die
       dezelfde uitkomst beweren (LAT-regel 4). De zin draagt dus alleen wat de
       stand NIET zegt -- wat voor pas het is en waar hij binnenkomt. */
    const zin = richting === 'in'
      ? oordeel.pas.soort.toUpperCase() + ' \u00b7 ' + oordeel.plek.naam
      : 'Uitgescand.';
    return zetScan(e, oordeel, d, richting, 'groen', zin, tel);
  }

  function zetScan(e, oordeel, d, richting, stand, zin, tel) {
    const telplek = tel || telplekVan(e, oordeel.plek);
    const s = { id: 'sc' + (e.scans.length + 1) + '-' + oordeel.pas.id.slice(-4),
      pas: oordeel.pas.id, plek: oordeel.plek.id, telplek: telplek ? telplek.id : null,
      dag: oordeel.dag.id, richting, datum: String(d.datum || ''), tijd: String(d.tijd || ''),
      poort: (d.poort ? String(d.poort).slice(0, 40) : oordeel.plek.naam),
      door: d.door ? String(d.door).slice(0, 60) : null,
      offline: !!d.offline, at: new Date().toISOString() };
    e.scans.push(s);
    save();
    return { stand, zin, pas: oordeel.pas, plek: oordeel.plek, telplek, scan: s };
  }

  /* ---------- de offline poort ----------

     EEN OFFLINE POORT KAN EEN DUBBELE DOORLATEN, EN DAT IS GEEN BUG MAAR
     NATUURKUNDE. Twee hekken zonder verbinding weten niet van elkaar. Wat een
     eerlijk systeem daarom moet doen is niet doen alsof het niet gebeurt, maar
     het achteraf VINDEN en BENOEMEN -- want dan weet de beveiliging welke code
     twee keer liep, waar, en hoe laat.

     De bundel wordt op tijd gesorteerd afgespeeld: de eerste scan wint, de rest
     komt terug als dubbel. Er wordt niets teruggedraaid; die mensen staan al
     binnen. */
  function scanBundel(fid, eid, lijst) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const rijen = (Array.isArray(lijst) ? lijst : []).slice(0, 5000)
      .map(r => ({ ...r, offline: true }))
      .sort((a, b) => String(a.datum + a.tijd).localeCompare(String(b.datum + b.tijd)));
    const dubbel = [], geweigerd = [];
    let verwerkt = 0;
    for (const r of rijen) {
      const uit = scan(fid, eid, r);
      if (uit.stand === 'groen') verwerkt++;
      else if (uit.stand === 'oranje') dubbel.push({ code: r.code, poort: r.poort, tijd: r.tijd, eerder: uit.eerdere || null });
      else geweigerd.push({ code: r.code, poort: r.poort, tijd: r.tijd, reden: uit.zin });
    }
    return { ok: true, aangeboden: rijen.length, verwerkt, dubbel, geweigerd };
  }

  return { scan, scanBundel, telplekVan, aanwezig };
};
