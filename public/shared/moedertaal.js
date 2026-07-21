/* ============================================================================
   Moedertaal op de werkvloer (personeel).

   Wie bijvoorbeeld Spaans spreekt maar in een Nederlands systeem werkt, krijgt
   zijn HELE werkscherm in zijn moedertaal: de vaste UI-teksten via een live
   vertaald woordenboek (RTGi18n), en de losse regels (bonnen, taken,
   opdrachten) via een batch-vertaler met cache en herteken-callback.

   Gebruik vanuit een werk-app (na het inloggen):
     MoederTaal.start(API.call, () => renderAll());
   In de templates voor dynamische tekst:
     MoederTaal.tekst(it.name)   // meteen de cache, anders origineel + straks
                                 // een herteken zodra de vertaling binnen is
   De taal zelf zet het personeelslid met MoederTaal.zet('es') (de kiezer in
   de PDA); hij hoort bij de persoon en geldt in elke werk-app.
   ========================================================================== */
(function (w) {
  let taal = 'nl';        // de moedertaal van de ingelogde medewerker
  let roep = null;        // de API-aanroep van de app: (pad, body) -> Promise
  let herteken = null;    // callback zodra er nieuwe vertalingen binnen zijn
  const cache = {};       // taal -> { origineel: vertaling }
  let rij = new Set();    // teksten die nog vertaald moeten worden
  let timer = null;

  const basis = t => !t || t === 'nl' || t === 'en';

  function zetUiWoordenboek(dict) {
    w.I18N = w.I18N || {};
    w.I18N[taal] = dict;
    if (w.RTGi18n) RTGi18n.apply(taal);
  }

  /* Het UI-woordenboek van deze pagina in de moedertaal: bron zijn de Engelse
     UI-teksten (window.I18N.en dekt elke sleutel), vertaald door de server en
     per pagina en taal bewaard op het toestel. */
  async function laadUi() {
    const en = (w.I18N && w.I18N.en) || {};
    const keys = Object.keys(en).slice(0, 400);
    if (!keys.length) { if (w.RTGi18n) RTGi18n.apply(taal); return; }
    const ck = 'rtg_mt_' + taal + '_' + location.pathname.replace(/\W+/g, '') + '_' + keys.length;
    let dict = null;
    try { dict = JSON.parse(localStorage.getItem(ck) || 'null'); } catch (e) {}
    if (!dict) {
      try {
        const r = await roep('/supplier/vertaal/ui', { teksten: keys.map(k => en[k]), naar: taal });
        dict = {};
        keys.forEach((k, i) => { dict[k] = (r.teksten && r.teksten[i]) || en[k]; });
        try { localStorage.setItem(ck, JSON.stringify(dict)); } catch (e) {}
      } catch (e) { dict = null; }
    }
    if (dict) zetUiWoordenboek(dict);
  }

  /* De losse regels: bonnen, taken, opdrachten. Eerst de cache; wat we nog
     niet kennen gaat in een batch naar de server en daarna hertekent de app. */
  function tekst(t) {
    t = String(t == null ? '' : t);
    if (basis(taal) || !t.trim() || !roep) return t;
    const c = cache[taal] = cache[taal] || {};
    if (c[t] !== undefined) return c[t];
    rij.add(t);
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const teksten = [...rij].slice(0, 60);
      rij = new Set();
      try {
        const r = await roep('/supplier/vertaal', { teksten, naar: taal });
        teksten.forEach((s, i) => { c[s] = (r.teksten && r.teksten[i]) || s; });
        if (herteken) herteken();
      } catch (e) { teksten.forEach(s => { c[s] = s; }); }
    }, 250);
    return t;
  }

  /* Na het inloggen: de eigen moedertaal ophalen en alles omzetten. */
  async function start(apiRoep, opnieuw) {
    roep = apiRoep;
    herteken = opnieuw || herteken;
    try { taal = (await roep('/supplier/mijn/taal', {})).taal || 'nl'; } catch (e) { taal = 'nl'; }
    if (taal === 'en' && w.RTGi18n) RTGi18n.apply('en');
    if (!basis(taal)) await laadUi();
    if (herteken) herteken();
    return taal;
  }

  /* De kiezer: de actieve wereldtalen van het platform. */
  async function talen() {
    try { return (await roep('/supplier/mijn/taal', {})).talen || []; } catch (e) { return []; }
  }

  /* Het personeelslid kiest zijn taal; die reist mee naar elke werk-app. */
  async function zet(nieuweTaal) {
    const r = await roep('/supplier/mijn/taal', { taal: String(nieuweTaal || '') });
    taal = r.taal || 'nl';
    if (basis(taal)) { if (w.RTGi18n) RTGi18n.apply(taal === 'en' ? 'en' : 'nl'); }
    else await laadUi();
    if (herteken) herteken();
    return taal;
  }

  w.MoederTaal = { start, zet, talen, tekst, actueel: () => taal };
})(window);
