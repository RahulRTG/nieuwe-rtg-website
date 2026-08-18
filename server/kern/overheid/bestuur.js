/* Overheid-domein "bestuur": de democratische en algemene laag. Het referendum
   (stemmen, uitslag, openen/sluiten door de ambtenaar), bezwaar maken en de
   afhandeling, de rijksbekendmakingen (lezen + plaatsen) en het regie-dashboard
   dat de openstaande zaken over alle pijlers telt. Krijgt de gedeelde ctx van
   kern/overheid/index.js. */
module.exports = (ctx) => {
  const { db, save, nu, jaar, id, ref, schoon, seed, bericht, lidstandVan } = ctx;
  const { voldoet } = require('../betrouwbaarheid');

  /* ---- referendum ---- */

  /* WIE ER MAG STEMMEN, en waarom die poort er staat.

     Hiervoor was de enige eis "ingelogd en geen gast". Daarmee stond een
     stemming open voor iedereen die een e-mailadres kon bedenken, en "een mens,
     een stem" was een aanname in plaats van iets dat werd nagegaan.

     DRIE EISEN, en ze doen elk iets anders:

       niveau     minstens A3: RTG heeft het identiteitsbewijs gezien. Zonder
                  dat is er geen grond om te geloven dat twee accounts twee
                  mensen zijn.
       leeftijd   18 of ouder -- de gewone ondergrens voor een stem.
       herkomst   die leeftijd moet van het DOCUMENT komen en niet uit het
                  aanmeldformulier. Dit is de plek waar dat verschil het meest
                  telt: een zelf ingetypte geboortedatum is precies zo hard als
                  de wens om mee te doen.

     DE EIS STAAT OP DE VERKIEZING en niet in deze functie: een raadgevend
     referendum onder leden mag lichter zijn dan een bindende stemming, en dat
     hoort de ambtenaar te kunnen zetten in plaats van een programmeur. Zonder
     opgave gelden de drie hierboven.

     DE UITKOMST GAAT ALTIJD MEE NAAR HET SCHERM, ook als hij nee is. Een
     stemknop die verdwijnt zonder uitleg leest als een storing; deze zegt wat
     er ontbreekt en wat eraan te doen is. */
  const EIS_STANDAARD = { niveau: 'A3', leeftijd: 18, uitDocument: true };
  function stemrecht(key, v) {
    const eis = Object.assign({}, EIS_STANDAARD, (v && v.eis) || {});
    if (!key) return { ok: false, reden: 'Log in om te kunnen stemmen.', eis };
    const st = typeof lidstandVan === 'function' ? lidstandVan(key) : null;
    if (!st) return { ok: false, reden: 'De ledenstand is niet op te halen; stemmen kan nu niet.', eis };
    const uit = { eis, niveau: st.niveau, leeftijd: st.leeftijd, leeftijdBron: st.leeftijdBron };
    if (!st.account) return Object.assign(uit, { ok: false,
      reden: 'Stemmen hoort bij een eigen RTG-account; een gast of demo-persona heeft er geen.' });
    if (!voldoet(st.niveau, eis.niveau)) return Object.assign(uit, { ok: false,
      reden: 'Voor deze stemming is niveau ' + eis.niveau + ' nodig en u staat op ' + st.niveau.id +
        ' (' + st.niveau.naam + '). Laat uw identiteitsbewijs door RTG controleren.' });
    if (st.leeftijd == null || st.leeftijd < eis.leeftijd) return Object.assign(uit, { ok: false,
      reden: 'Stemmen kan vanaf ' + eis.leeftijd + ' jaar.' });
    if (eis.uitDocument && st.leeftijdBron !== 'paspoort') return Object.assign(uit, { ok: false,
      reden: 'Uw geboortedatum staat nog zoals u hem zelf opgaf. Voor een stemming telt de datum van uw ' +
        'identiteitsbewijs; RTG neemt die over bij de controle.' });
    return Object.assign(uit, { ok: true, reden: null });
  }

  function verkiezing(key) {
    seed();
    const v = db.data.rijkVerkiezing;
    if (!v) return { ok: true, verkiezing: null };
    const alGestemd = key ? (db.data.rijkStemmen || []).some(s => s.verkiezingId === v.id && s.key === key) : false;
    const totaal = v.opties.reduce((s, o) => s + o.stemmen, 0);
    return { ok: true, verkiezing: { id: v.id, titel: v.titel, toelichting: v.toelichting, open: !!v.open,
      opties: v.opties.map(o => ({ id: o.id, label: o.label, stemmen: o.stemmen, pct: totaal ? Math.round(o.stemmen / totaal * 100) : 0 })),
      totaal, alGestemd, gesloten: v.gesloten, stemrecht: stemrecht(key, v) } };
  }
  function stem(key, keuze) {
    seed();
    const v = db.data.rijkVerkiezing;
    if (!v || !v.open) return { status: 409, error: 'Er is op dit moment geen open stemming.' };
    const o = v.opties.find(x => x.id === String(keuze || ''));
    if (!o) return { status: 400, error: 'Kies een geldige optie.' };
    /* De poort staat VOOR de dubbel-stem-controle: iemand die niet mag stemmen
       hoort te horen dat hij niet mag, en niet dat hij al gestemd heeft. */
    const recht = stemrecht(key, v);
    if (!recht.ok) return { status: 403, error: recht.reden, stemrecht: recht };
    if ((db.data.rijkStemmen || []).some(s => s.verkiezingId === v.id && s.key === key)) return { status: 409, error: 'Je hebt al gestemd.' };
    o.stemmen++;
    /* Het stembriefje blijft geheim: dit register weet DAT u stemde, de teller
       hierboven weet WAT er is gekozen, en ze worden nergens aan elkaar
       geknoopt. Dat stond er al en blijft zo. */
    db.data.rijkStemmen.push({ verkiezingId: v.id, key, at: nu() });
    save();
    return { ok: true, ...verkiezing(key) };
  }
  function verkiezingSluit(open) {
    seed();
    const v = db.data.rijkVerkiezing;
    if (!v) return { status: 404, error: 'Er is geen stemming.' };
    v.open = !!open; v.gesloten = open ? null : nu();
    save();
    return { ok: true, ...verkiezing(null) };
  }

  /* ---- bezwaar ---- */
  function bezwaarIndienen(sess, codenaam, data) {
    seed();
    data = data || {};
    const tegen = schoon(data.tegen, 120), reden = schoon(data.reden, 800);
    if (tegen.length < 3 || reden.length < 6) return { status: 400, error: 'Vul in waartegen je bezwaar maakt en waarom.' };
    const b = { id: id(), ref: ref('BZ'), key: sess.key, codenaam, tegen, reden, status: 'ingediend', at: nu() };
    db.data.rijkBezwaren.unshift(b);
    db.data.rijkBezwaren = db.data.rijkBezwaren.slice(0, 40000);
    bericht(sess.key, 'Rijksoverheid', 'Bezwaar ontvangen', 'Je bezwaar tegen "' + tegen + '" is geregistreerd (' + b.ref + ') en wordt behandeld.', 'bezwaar');
    save();
    return { ok: true, bezwaar: { ref: b.ref, tegen, status: b.status, at: b.at } };
  }
  function mijnBezwaren(key) { seed(); return { ok: true, bezwaren: (db.data.rijkBezwaren || []).filter(b => b.key === key).slice(0, 30).map(b => ({ ref: b.ref, tegen: b.tegen, status: b.status, besluit: b.besluit || null, at: b.at })) }; }
  function bezwarenLijst(filter) {
    seed(); filter = filter || {};
    let list = (db.data.rijkBezwaren || []);
    list = filter.status ? list.filter(b => b.status === filter.status) : list.filter(b => ['ingediend', 'in behandeling'].includes(b.status));
    return { ok: true, bezwaren: list.slice(0, 200).map(b => ({ ref: b.ref, tegen: b.tegen, reden: b.reden, status: b.status, aanvrager: b.codenaam, at: b.at })) };
  }
  function bezwaarBeslis(actor, r, data) {
    data = data || {};
    const b = (db.data.rijkBezwaren || []).find(x => x.ref === String(r || ''));
    if (!b) return { status: 404, error: 'Bezwaar niet gevonden.' };
    const besluit = ['gegrond', 'ongegrond', 'in behandeling'].includes(data.besluit) ? data.besluit : null;
    if (!besluit) return { status: 400, error: 'Kies een geldig besluit.' };
    b.status = besluit; b.besluit = { door: actor || 'rijk', motivatie: schoon(data.motivatie, 400) || null, at: nu() };
    if (b.key) bericht(b.key, 'Rijksoverheid', 'Beslissing op bezwaar', 'Je bezwaar tegen "' + b.tegen + '" is ' + besluit + ' verklaard.', 'bezwaar');
    save();
    return { ok: true, bezwaar: { ref: b.ref, tegen: b.tegen, status: b.status } };
  }

  /* ---- bekendmakingen ---- */
  function bekendmakingen() {
    seed();
    return { ok: true, bekendmakingen: (db.data.rijkBekend || []).slice(0, 40).map(b => ({ id: b.id, titel: b.titel, tekst: b.tekst, soort: b.soort, at: b.at })) };
  }
  function bekendmakingMaak(actor, data) {
    seed(); data = data || {};
    const titel = schoon(data.titel, 120), tekst = schoon(data.tekst, 800);
    if (titel.length < 3 || tekst.length < 3) return { status: 400, error: 'Vul een titel en tekst in.' };
    const soort = ['algemeen', 'belasting', 'rdw', 'sociaal', 'wet'].includes(data.soort) ? data.soort : 'algemeen';
    const b = { id: id(), titel, tekst, soort, door: actor || 'rijk', at: nu() };
    db.data.rijkBekend.unshift(b);
    db.data.rijkBekend = db.data.rijkBekend.slice(0, 500);
    save();
    return { ok: true, bekendmaking: { id: b.id, titel, tekst, soort, at: b.at } };
  }

  /* ---- regie: het dashboard van de rijksambtenaar ---- */
  function regie() {
    seed();
    return { ok: true,
      toeslagenOpen: (db.data.rijkToeslagen || []).filter(t => t.status === 'aangevraagd').length,
      uitkeringenOpen: (db.data.rijkUitkeringen || []).filter(u => ['aangevraagd', 'in behandeling'].includes(u.status)).length,
      bezwarenOpen: (db.data.rijkBezwaren || []).filter(b => ['ingediend', 'in behandeling'].includes(b.status)).length,
      subsidiesOpen: (db.data.rijkSubsidies || []).filter(s => s.status === 'aangevraagd').length,
      waterMeldingenOpen: (db.data.waterMeldingen || []).filter(m => !['opgelost', 'afgewezen'].includes(m.status)).length,
      aangiftenJaar: (db.data.rijkAanslagen || []).filter(a => a.jaar === jaar()).length,
      inschrijvingen: (db.data.rijkKvk || []).length,
      stemmen: db.data.rijkVerkiezing ? (db.data.rijkStemmen || []).filter(s => s.verkiezingId === db.data.rijkVerkiezing.id).length : 0 };
  }

  return { verkiezing, stem, verkiezingSluit, bezwaarIndienen, mijnBezwaren, bezwarenLijst, bezwaarBeslis,
    bekendmakingen, bekendmakingMaak, regie };
};
