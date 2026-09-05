/* Gedeelde levenscyclus voor codes die zonder account een kleine deur openen.

   In PostgreSQL en SQLite loopt iedere beslissing door EEN collectietransactie.
   Daardoor zijn max-use versus max-use en intrekken versus gebruiken werkelijk
   geserialiseerd tussen processen. `transactie()` laat de portalen bovendien
   de code, de koppeling aan de persoon en hun auditregel in diezelfde commit
   zetten. De kale code verlaat alleen de uitgifte; op schijf staat zijn hash. */
'use strict';

const DEFAULT_DAGEN = 90;
const DEFAULT_MAX_GEBRUIK = 500;
const MAX_DAGEN = 366;
const MAX_GEBRUIK = 10000;

module.exports = ({ opslag, staat, nu, rid, crypto, save, bewerkCollectie }) => {
  if (typeof opslag !== 'function' || typeof nu !== 'function' || typeof rid !== 'function' ||
      !crypto || typeof crypto.randomBytes !== 'function' || typeof save !== 'function') {
    throw new Error('codelevenscyclus mist zijn opslag, klok, generator, crypto of save');
  }

  const schoon = v => String(v == null ? '' : v).trim();
  const normaal = v => schoon(v).toUpperCase().slice(0, 80);
  const hash = v => crypto.createHash('sha256').update('rtg-code-v1|' + normaal(v)).digest('hex');
  const lijst = () => {
    const r = opslag();
    if (!Array.isArray(r)) throw new Error('codelevenscyclus-opslag is geen lijst');
    return r;
  };
  const getal = (v, standaard, max) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : standaard;
  };
  const publiek = r => ({
    id: r.id, issuer: r.issuer, doel: r.doel, scope: [...r.scope],
    issued_at: r.issued_at, expires_at: r.expires_at,
    max_gebruik: r.max_gebruik, gebruik: r.gebruik,
    ingetrokken_at: r.ingetrokken_at, rotatie: r.rotatie
  });
  const fout = waarom => ({ status: waarom === 'onbekend' ? 404 : 403,
    error: 'Deze toegangscode is niet geldig of niet meer geldig. Vraag een bevoegde medewerker om een nieuwe code.',
    reden: waarom });

  function reden(r, verwacht) {
    if (!r) return 'onbekend';
    if (verwacht && verwacht.doel && r.doel !== verwacht.doel) return 'verkeerd-doel';
    if (verwacht && verwacht.soort && (!r.onderwerp || r.onderwerp.soort !== verwacht.soort)) {
      return 'verkeerd-onderwerp';
    }
    const nodig = verwacht && verwacht.scope ? [].concat(verwacht.scope) : [];
    if (nodig.some(x => !r.scope.includes(x))) return 'scope-ontbreekt';
    if (r.ingetrokken_at) return 'ingetrokken';
    if (!Number.isFinite(Date.parse(r.expires_at)) || Date.parse(r.expires_at) <= Date.parse(nu())) return 'verlopen';
    if (r.gebruik >= r.max_gebruik) return 'opgebruikt';
    return null;
  }

  function maak(invoer, at, rotatie, rijen) {
    const scopes = [...new Set([].concat(invoer.scope || []).map(schoon).filter(Boolean))];
    const issuer = schoon(invoer.issuer).slice(0, 80);
    const doel = schoon(invoer.doel).slice(0, 80);
    const onderwerp = invoer.onderwerp || {};
    if (!issuer || !doel || !scopes.length || !schoon(onderwerp.soort) || !schoon(onderwerp.id)) {
      return { status: 400, error: 'Een code vereist issuer, doel, scope en onderwerp.' };
    }
    const dagen = getal(invoer.geldig_dagen, DEFAULT_DAGEN, MAX_DAGEN);
    const maxGebruik = getal(invoer.max_gebruik, DEFAULT_MAX_GEBRUIK, MAX_GEBRUIK);
    let kaal, codeHash;
    do {
      // Bearer credential: zestien willekeurige bytes, dus 128 bits.
      kaal = schoon(invoer.prefix).slice(0, 12).toUpperCase() + '-' +
        crypto.randomBytes(16).toString('hex').toUpperCase();
      codeHash = hash(kaal);
    } while (rijen.some(x => x.code_hash === codeHash));
    const r = {
      id: rid(), code_hash: codeHash, issuer, doel, scope: scopes,
      onderwerp: { soort: schoon(onderwerp.soort).slice(0, 40), id: schoon(onderwerp.id).slice(0, 120) },
      issued_at: at, expires_at: new Date(Date.parse(at) + dagen * 86400000).toISOString(),
      max_gebruik: maxGebruik, gebruik: 0, ingetrokken_at: null,
      rotatie: Math.max(1, Math.round(Number(rotatie) || 1)),
      vervangt_id: invoer.vervangt_id || null, geroteerd_naar: null
    };
    return { r, code: kaal };
  }

  function deur(bron, rijen) {
    function uitgeven(invoer) {
      const gemaakt = maak(invoer || {}, nu(), (invoer || {}).rotatie, rijen);
      if (!gemaakt.r) return gemaakt;
      rijen.push(gemaakt.r);
      return { ok: true, code: gemaakt.code, toegang: publiek(gemaakt.r) };
    }

    function controleer(kaleCode, verwacht, binding) {
      const r = rijen.find(x => x.code_hash === hash(kaleCode)) || null;
      const waarom = reden(r, verwacht || {});
      if (waarom) return fout(waarom);
      /* De onderwerp-koppeling wordt BINNEN hetzelfde slot bekeken en VOOR de
         teller. Een verweesde of verkeerd gekoppelde code verbruikt dus geen
         toegang en kan niet tussen controle en increment worden ingetrokken. */
      const gebonden = typeof binding === 'function' ? binding(bron, r) : true;
      if (!gebonden) return fout('binding-ontbreekt');
      r.gebruik += 1;
      r.laatst_gebruikt_at = nu();
      return { ok: true, toegang: publiek(r), onderwerp: { ...r.onderwerp }, gebonden };
    }

    function intrekken(id, actor, intrekreden) {
      const r = rijen.find(x => x.id === String(id || ''));
      if (!r) return { status: 404, error: 'Deze toegangscode bestaat niet.' };
      if (!r.ingetrokken_at) {
        r.ingetrokken_at = nu();
        r.ingetrokken_door = schoon(actor).slice(0, 80) || 'onbekend';
        r.intrekreden = schoon(intrekreden).slice(0, 200) || 'ingetrokken door bevoegde medewerker';
      }
      return { ok: true, toegang: publiek(r) };
    }

    function roteer(id, invoer) {
      const oud = rijen.find(x => x.id === String(id || ''));
      if (!oud) return { status: 404, error: 'Deze toegangscode bestaat niet.' };
      if (oud.geroteerd_naar) return { status: 409, error: 'Deze toegangscode is al geroteerd.' };
      const at = nu();
      const gemaakt = maak({
        prefix: invoer && invoer.prefix, issuer: invoer && invoer.issuer,
        doel: oud.doel, scope: oud.scope, onderwerp: oud.onderwerp,
        geldig_dagen: invoer && invoer.geldig_dagen,
        max_gebruik: invoer && invoer.max_gebruik, vervangt_id: oud.id
      }, at, oud.rotatie + 1, rijen);
      if (!gemaakt.r) return gemaakt;
      if (!oud.ingetrokken_at) {
        oud.ingetrokken_at = at;
        oud.ingetrokken_door = schoon(invoer && invoer.issuer).slice(0, 80) || 'onbekend';
        oud.intrekreden = schoon(invoer && invoer.reden).slice(0, 200) || 'geroteerd';
      }
      oud.geroteerd_naar = gemaakt.r.id;
      rijen.push(gemaakt.r);
      return { ok: true, code: gemaakt.code, toegang: publiek(gemaakt.r), vorige: publiek(oud) };
    }

    const stand = id => {
      const r = rijen.find(x => x.id === String(id || '')) || null;
      return r ? { ok: !reden(r), reden: reden(r), toegang: publiek(r), onderwerp: { ...r.onderwerp } }
        : { ok: false, reden: 'onbekend' };
    };
    return { staat: bron, uitgeven, controleer, intrekken, roteer, stand };
  }

  const herstel = (doel, json) => {
    const oud = JSON.parse(json);
    if (Array.isArray(doel)) doel.splice(0, doel.length, ...oud);
    else {
      for (const k of Object.keys(doel)) delete doel[k];
      Object.assign(doel, oud);
    }
  };

  /* Voor PostgreSQL is dit een Promise; voor SQLite/geheugen blijft het oude
     synchrone contract behouden. De callback zelf is altijd synchroon, zoals
     bewerkCollectie vereist. */
  function transactie(werk) {
    if (typeof werk !== 'function') throw new Error('Een codetransactie vereist een bewerker.');
    if (typeof bewerkCollectie === 'function') {
      return bewerkCollectie('rtfos', bron => {
        if (!bron || typeof bron !== 'object' || Array.isArray(bron))
          throw new Error('De rtfos-collectie is geen object.');
        if (!Array.isArray(bron.codelevenscycli)) bron.codelevenscycli = [];
        return werk(deur(bron, bron.codelevenscycli));
      });
    }
    const bron = typeof staat === 'function' ? staat() : null;
    const rijen = bron ? (Array.isArray(bron.codelevenscycli) ? bron.codelevenscycli : (bron.codelevenscycli = [])) : lijst();
    const doel = bron || rijen;
    const voor = JSON.stringify(doel);
    try {
      const antwoord = werk(deur(bron, rijen));
      if (antwoord && typeof antwoord.then === 'function')
        throw new Error('De bewerker van een codetransactie mag niet asynchroon zijn.');
      if (JSON.stringify(doel) !== voor) save();
      return antwoord;
    } catch (e) {
      herstel(doel, voor);
      throw e;
    }
  }

  return {
    transactie,
    uitgeven: invoer => transactie(x => x.uitgeven(invoer)),
    controleer: (code, verwacht, binding) => transactie(x => x.controleer(code, verwacht, binding)),
    intrekken: (id, actor, reden) => transactie(x => x.intrekken(id, actor, reden)),
    roteer: (id, invoer) => transactie(x => x.roteer(id, invoer)),
    stand: id => transactie(x => x.stand(id)), publiek
  };
};

module.exports.DEFAULT_DAGEN = DEFAULT_DAGEN;
module.exports.DEFAULT_MAX_GEBRUIK = DEFAULT_MAX_GEBRUIK;
