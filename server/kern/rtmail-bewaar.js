/* RTMAIL (deelmodule): bewaartermijn, juridische bewaring en export.

   DIT IS DE PLEK WAAR POST ECHT WEGGAAT. Overal elders in RTMAIL is
   "verwijderen" een MAP (kern/rtmail-vak.js): de prullenbak. Dat is met opzet,
   want een systeem waarin "weg" soms echt weg is en soms niet, is bij een
   juridisch onderzoek onbruikbaar. Hier, en alleen hier, verdwijnen bytes -- en
   altijd met een spoor dat blijft staan.

   DE DRIE BEGRIPPEN, en ze werken tegen elkaar in:

   1. BEWAARTERMIJN: na hoeveel dagen post uit een postvak verdwijnt. Nul of
      leeg betekent "nooit automatisch", en dat is de standaard -- een systeem
      dat uit zichzelf begint te wissen, is gevaarlijker dan een volle schijf.
   2. JURIDISCHE BEWARING (legal hold): zolang die aanstaat, verdwijnt er NIETS
      uit dat postvak, ook niet wat allang over de termijn is en ook niet als
      iemand het met de hand probeert. De bewaring wint altijd van de termijn.
      Dat is de hele reden dat hij bestaat.
   3. AANTOONBARE VERNIETIGING: wat verdwijnt, laat een regel achter met het
      aantal, het tijdvak, wie het deed en waarom. Niet de inhoud -- dat zou de
      vernietiging ongedaan maken -- maar wel het feit.

   EXPORT is de tegenhanger: het postvak als tekst meenemen. Hij vraagt een
   recht EN een reden (kern/rtmail-recht.js), en hij komt altijd in het
   journaal. Een export is een kopie die het systeem verlaat; wie dat stil kan
   doen, heeft geen postvak maar een lek. */
const adresLaag = require('./rtmail-adres');

module.exports = ({ db, save, rtmail, recht }) => {
  const nu = () => new Date().toISOString();
  const busVan = (adres) => {
    const o = adresLaag.ontleed(adres);
    return o.binnenshuis ? String(o.lokaal || '').replace(/[.-]/g, '') : String(o.adres || '');
  };
  const kap = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, n);

  function B() {
    if (!db.data.rtmailBewaar || typeof db.data.rtmailBewaar !== 'object')
      db.data.rtmailBewaar = { vakken: {}, vernietigingen: [] };
    const b = db.data.rtmailBewaar;
    if (!b.vakken || typeof b.vakken !== 'object') b.vakken = {};
    if (!Array.isArray(b.vernietigingen)) b.vernietigingen = [];
    return b;
  }
  const beleidVan = (adres) => B().vakken[busVan(adres)] || { dagen: 0, bewaring: null };
  const store = () => {
    if (!db.data.rtmail || !Array.isArray(db.data.rtmail.berichten)) db.data.rtmail = { berichten: [] };
    return db.data.rtmail;
  };
  const inVak = (m, bus) => busVan(m.naar) === bus || busVan(m.van) === bus;

  function beleid(wie, adres) {
    const p = recht.poort(wie, adres, 'metadata');
    if (!p.ok) return { error: p.waarom };
    const b = beleidVan(adres);
    return { ok: true, postvak: busVan(adres), dagen: b.dagen || 0, bewaring: b.bewaring || null,
      let: b.bewaring
        ? 'Er ligt een juridische bewaring op dit postvak: er verdwijnt niets, ook niet wat over de termijn is.'
        : (b.dagen ? 'Post ouder dan ' + b.dagen + ' dagen wordt opgeruimd zodra iemand het opruimen aanroept.'
                   : 'Er wordt niets automatisch verwijderd.') };
  }

  function zetTermijn(wie, adres, dagen, reden) {
    const p = recht.poort(wie, adres, 'bewaarbeleid', reden);
    if (!p.ok) return { error: p.waarom };
    const d = Math.max(0, Math.min(36500, parseInt(dagen, 10) || 0));
    const b = B();
    const bus = busVan(adres);
    b.vakken[bus] = Object.assign(b.vakken[bus] || {}, { dagen: d });
    recht.log(wie, 'bewaartermijn gezet op ' + (d || 'nooit'), adres, reden);
    save();
    return { ok: true, dagen: d };
  }

  /* De juridische bewaring. Aanzetten mag met een reden; UITZETTEN vraagt een
     eigen reden, want dat is het moment waarop bewijsmateriaal weer kwetsbaar
     wordt. Wie hem uitzet staat met naam in het journaal. */
  function zetBewaring(wie, adres, { aan, zaak, reden } = {}) {
    const p = recht.poort(wie, adres, 'bewaarbeleid', reden);
    if (!p.ok) return { error: p.waarom };
    if (!kap(reden, 300)) return { error: 'Een juridische bewaring zetten of opheffen kan niet zonder reden.' };
    const b = B();
    const bus = busVan(adres);
    b.vakken[bus] = b.vakken[bus] || { dagen: 0 };
    if (aan === false) {
      if (!b.vakken[bus].bewaring) return { error: 'Er ligt geen bewaring op dit postvak.' };
      const oud = b.vakken[bus].bewaring;
      b.vakken[bus].bewaring = null;
      recht.log(wie, 'juridische bewaring OPGEHEVEN', adres, reden, { zaak: oud.zaak || null, sinds: oud.sinds });
      save();
      return { ok: true, bewaring: null, let: 'Vanaf nu kan er weer post uit dit postvak verdwijnen.' };
    }
    const z = kap(zaak, 60);
    if (!z) return { error: 'Onder welk zaaknummer of onderzoek valt deze bewaring?' };
    b.vakken[bus].bewaring = { zaak: z, sinds: nu(), door: busVan(wie), reden: kap(reden, 300) };
    recht.log(wie, 'juridische bewaring GEZET', adres, reden, { zaak: z });
    save();
    return { ok: true, bewaring: b.vakken[bus].bewaring,
      let: 'Zolang deze bewaring ligt, verdwijnt er niets uit dit postvak -- ook niet wat over de bewaartermijn is.' };
  }

  /* Opruimen. Doet niets zonder termijn, en niets onder een bewaring. Geeft
     terug WAT er weg is, ook als dat nul is -- een opruimactie die stilzwijgend
     niets doet, laat iemand denken dat het gelukt is. */
  function ruimOp(wie, adres, reden) {
    const p = recht.poort(wie, adres, 'vernietigen', reden);
    if (!p.ok) return { error: p.waarom };
    const b = beleidVan(adres);
    if (b.bewaring) return { error: 'Er ligt een juridische bewaring (' + b.bewaring.zaak + ') op dit postvak; er verdwijnt niets.' };
    if (!b.dagen) return { ok: true, verwijderd: 0, let: 'Er is geen bewaartermijn ingesteld, dus er is niets opgeruimd.' };
    const grens = new Date(Date.now() - b.dagen * 86400e3).toISOString();
    const bus = busVan(adres);
    const s = store();
    const weg = s.berichten.filter(m => inVak(m, bus) && String(m.at) < grens);
    if (!weg.length) return { ok: true, verwijderd: 0, let: 'Niets ouder dan ' + b.dagen + ' dagen.' };
    const oudste = weg.reduce((a, m) => (a && a < m.at ? a : m.at), null);
    const jongste = weg.reduce((a, m) => (a && a > m.at ? a : m.at), null);
    s.berichten = s.berichten.filter(m => !weg.includes(m));
    B().vernietigingen.unshift({ postvak: bus, aantal: weg.length, van: oudste, tot: jongste,
      door: busVan(wie), reden: kap(reden, 300) || null, at: nu() });
    recht.log(wie, 'vernietigd: ' + weg.length + ' bericht(en)', adres, reden, { van: oudste, tot: jongste });
    save();
    return { ok: true, verwijderd: weg.length, van: oudste, tot: jongste,
      let: 'De inhoud is weg. Wat blijft staan is het FEIT: aantal, tijdvak, wie en waarom -- dat is wat aantoonbare vernietiging betekent.' };
  }

  const bewijs = (adres) => B().vernietigingen.filter(v => !adres || v.postvak === busVan(adres)).slice(0, 200);

  /* Export. Metadata altijd; de inhoud alleen met het recht `lezen`, zodat een
     jurist met alleen inzage-metadata niet via de export toch meeleest. */
  function exporteer(wie, adres, { reden, metInhoud } = {}) {
    const p = recht.poort(wie, adres, 'exporteren', reden);
    if (!p.ok) return { error: p.waarom };
    const magLezen = recht.mag(wie, adres, 'lezen').ok;
    const bus = busVan(adres);
    const rijen = store().berichten.filter(m => inVak(m, bus)).map(m => {
      const r = { id: m.id, van: m.van, naar: m.naar, onderwerp: m.onderwerp, at: m.at,
        soort: m.soort, vertrouwd: !!m.vertrouwd, draad: m.draad || m.id };
      if (metInhoud !== false && magLezen) r.tekst = m.tekst;
      return r;
    });
    recht.log(wie, 'geexporteerd: ' + rijen.length + ' bericht(en)', adres, reden,
      { metInhoud: !!(metInhoud !== false && magLezen) });
    return { ok: true, postvak: bus, aantal: rijen.length,
      inhoudMee: !!(metInhoud !== false && magLezen), berichten: rijen,
      let: magLezen ? 'Deze export is vastgelegd in het journaal, met uw reden erbij.'
                    : 'U heeft geen leesrecht op dit postvak, dus deze export bevat alleen metadata.' };
  }

  return { beleid, zetTermijn, zetBewaring, ruimOp, bewijs, exporteer, beleidVan };
};
