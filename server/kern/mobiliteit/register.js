/* Mobility OS (deelmodule): de schakelaarlogica van het vervoersmoduleregister.
   De catalogus zelf staat in ./modulecatalogus (pure data + de fail-fast bij
   het opstarten); hier staat wat een schakelaar betekent.

   TWEE DINGEN MAKEN DIT ANDERS DAN EEN LIJSTJE BOOLEANS.

   1. AFHANKELIJKHEDEN. Een module die leunt op iets dat uit staat, staat zelf
      uit -- ook als iemand hem net heeft aangezet. Een helikoptercharter zonder
      identiteitscontrole, zonder partnercontract, zonder menselijke bevestiging
      en zonder weertoets is geen halve functie maar een gevaar. Aanzetten
      weigert daarom met de NAAM van wat er ontbreekt, en het antwoord van
      modAan draagt altijd zijn eigen reden.

   2. NIVEAUS. Een schakelaar geldt wereldwijd, per land, per stad, per
      organisatie, per vervoerder, per doelgroep, voor testers, of voor een
      percentage. Het fijnste niveau dat een uitspraak doet wint, zodat IJmuiden
      andere regels kan hebben dan Amsterdam zonder een tweede codepad.

   Dit register gaat over WAT er in een gebied aan staat. Het is niet de
   functieschakelkast van de boardroom (server/functies/): die bepaalt of een
   DOELGROEP een RTG-app mag zien. Deze bepaalt of een vervoersproduct in een
   gebied bestaat. De boardroom-schakelaar 'mobiliteit' staat boven dit
   register: gaat die uit, dan is er geen app om iets in aan te zetten. */

const { MODULES, OP_ID, NIVEAUS } = require('./modulecatalogus');

module.exports = (ctx) => {
  const { db, save, crypto, schoon, nu, opslag } = ctx;

  function ensureRegister() {
    opslag.bak('mobModules');
  }
  const stand = id => {
    ensureRegister();
    return opslag.bak('mobModules')[id] || null;
  };

  /* Stabiel percentage: dezelfde gebruiker krijgt bij dezelfde module altijd
     hetzelfde antwoord. Met Math.random zou een reiziger de functie zien
     verschijnen en verdwijnen bij elke keer verversen, en dat leest als een
     kapotte app in plaats van als een uitrol. */
  function inPercentage(id, sleutel, pct) {
    if (pct >= 100) return true;
    if (pct <= 0) return false;
    if (!sleutel) return false;                      // niemand herkenbaar = niet in de uitrol
    const h = crypto.createHash('sha256').update(id + ':' + sleutel).digest();
    return (h.readUInt32BE(0) % 100) < pct;
  }

  /* Staat deze module aan, hier, voor deze partij? Geeft altijd een reden
     terug: een functie die zonder uitleg weg is, kost een middag zoeken. */
  function modAan(id, waar = {}, _pad = []) {
    const m = OP_ID[id];
    if (!m) return { aan: false, reden: 'onbekende module ' + id };
    if (_pad.includes(id)) return { aan: false, reden: 'kring in de vereisten' };
    const s = stand(id) || {};
    if (s.storing) return { aan: false, reden: 'uitgeschakeld wegens storing: ' + s.storing.reden, storing: true };

    // de vereisten eerst: een product is nooit meer aan dan waar het op leunt
    for (const v of m.vereist) {
      const r = modAan(v, waar, _pad.concat(id));
      if (!r.aan) return { aan: false, reden: OP_ID[v].naam + ' staat uit (' + r.reden + ')', ontbreekt: v };
    }

    // het fijnste niveau dat een uitspraak doet wint
    for (let i = NIVEAUS.length - 1; i >= 0; i--) {
      const n = NIVEAUS[i];
      const sleutel = waar[n.ctx];
      const tabel = s[n.sleutel];
      if (sleutel && tabel && Object.prototype.hasOwnProperty.call(tabel, sleutel))
        return { aan: !!tabel[sleutel], reden: (tabel[sleutel] ? 'aan' : 'uit') + ' op ' + n.ctx + ' ' + sleutel };
    }

    const wereld = Object.prototype.hasOwnProperty.call(s, 'wereld') ? !!s.wereld : m.standaard;
    if (!wereld) return { aan: false, reden: 'wereldwijd uit' };
    if (s.test && !waar.test) return { aan: false, reden: 'alleen voor testgebruikers' };
    const pct = Number.isFinite(s.pct) ? s.pct : 100;
    if (!inPercentage(id, waar.key || waar.vervoerder || '', pct))
      return { aan: false, reden: 'buiten de uitrol van ' + pct + '%' };
    return { aan: true, reden: 'aan' };
  }

  /* Zetten. Aanzetten kan alleen als de vereisten OP DEZELFDE PLEK aan staan;
     anders krijg je een module die in de kast aan lijkt en in de app nooit
     verschijnt -- de duurste soort schakelaar die er is. */
  function modZet(body = {}) {
    ensureRegister();
    const id = schoon(body.id, 40);
    const m = OP_ID[id];
    if (!m) return { status: 404, error: 'Onbekende vervoersmodule.' };
    const aan = !!body.aan;
    const niveau = NIVEAUS.find(n => n.ctx === body.niveau);
    const waar = { land: body.land, stad: body.stad, org: body.org, vervoerder: body.vervoerder, groep: body.groep, test: true };
    if (aan) {
      for (const v of m.vereist) {
        const r = modAan(v, waar);
        if (!r.aan) return { status: 409, error: m.naam + ' kan niet aan: ' + OP_ID[v].naam + ' staat uit (' + r.reden + ').', ontbreekt: v };
      }
    }
    const s = opslag.bak('mobModules')[id] || (opslag.bak('mobModules')[id] = {});
    if (!niveau) {
      s.wereld = aan;
    } else {
      const sleutel = schoon(body[niveau.ctx], 60);
      if (!sleutel) return { status: 400, error: 'Geef een ' + niveau.ctx + ' op.' };
      s[niveau.sleutel] = s[niveau.sleutel] || {};
      if (body.wis) delete s[niveau.sleutel][sleutel]; else s[niveau.sleutel][sleutel] = aan;
    }
    if (Number.isFinite(body.pct)) s.pct = Math.min(100, Math.max(0, Math.round(body.pct)));
    if (body.test != null) s.test = !!body.test;
    s.gewijzigd = nu();
    save();
    return { ok: true, id, stand: modStandBeeld(id) };
  }

  /* Automatisch uitschakelen bij storing (en met de hand weer aan). Bewust een
     apart veld en niet 'wereld = false': anders is na het herstel niet meer te
     zien wat iemand bewust had uitgezet en wat een storing was. */
  function modStoring(id, reden) {
    ensureRegister();
    if (!OP_ID[id]) return { status: 404, error: 'Onbekende vervoersmodule.' };
    const s = opslag.bak('mobModules')[id] || (opslag.bak('mobModules')[id] = {});
    s.storing = reden ? { sinds: nu(), reden: schoon(reden, 200) } : null;
    save();
    return { ok: true, id, storing: s.storing };
  }

  function modStandBeeld(id) {
    const m = OP_ID[id], s = stand(id) || {};
    return { id, naam: m.naam, laag: m.laag, uitleg: m.uitleg, vereist: m.vereist, standaard: m.standaard,
      wereld: Object.prototype.hasOwnProperty.call(s, 'wereld') ? !!s.wereld : m.standaard,
      pct: Number.isFinite(s.pct) ? s.pct : 100, test: !!s.test, storing: s.storing || null,
      landen: s.landen || {}, steden: s.steden || {}, groepen: s.groepen || {}, orgs: s.orgs || {}, vervoerders: s.vervoerders || {} };
  }

  // het hele bord, met per module het oordeel voor de gevraagde plek erbij
  function modBord(waar = {}) {
    ensureRegister();
    return { modules: MODULES.map(m => Object.assign(modStandBeeld(m.id), { hier: modAan(m.id, waar) })), waar };
  }

  return { MODULES, MOD_OP_ID: OP_ID, modAan, modZet, modStoring, modBord, modStandBeeld, ensureRegister };
};
