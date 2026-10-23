/* Onboarding (deelmodule): de lid-kant. Leest de onboarding-status voor een
   sessie, slaat de intake-velden op, bewaart de paspoort-meta, bewaakt de
   RTG Pay-poort (eenmalig paspoort bij de gratis pas) en tekent het contract.
   Draait op de gedeelde context uit kern/onboarding.js. */
module.exports = (ctx) => {
  const { accounts, save, schoon, crypto, nu, scopeVan, profielVan, profielId, scopeLezen, profielLezen } = ctx;
  const { momentopname, versieConflict, bereidVoor, ontvangstVan, afdruk, geldig } = require('./ontvangst');
  // De paspoortcontrole staat apart.
  const { bewaarPaspoort } = require('./paspoort')(ctx);
  const payGate = require('./paypoort')({ profielVan, profielId, save });

  // wat we al van een echt account weten (naam, e-mail, paspoortstatus ...)
  function bekend(veldId, sess) {
    const acc = sess && sess.account;
    const md = acc && accounts.getMemberState ? (accounts.getMemberState(acc.id) || {}) : {};
    switch (veldId) {
      case 'naam': return acc ? accounts.realNameOf(acc) : null;
      case 'email': return acc ? accounts.emailOf(acc) : null;
      case 'telefoon': return acc ? accounts.phoneOf(acc) : null;
      case 'geboortedatum': return md.geboren || null;
      case 'land': return md.land || null;
      case 'nationaliteit': return md.nationaliteit || null;
      // Demo-sessies zonder account kunnen geen identiteitsbewijs uploaden
      // (de upload eist een echt account); daar telt het veld als voldaan,
      // anders zou de demo eeuwig voor de onboarding-poort blijven staan.
      case 'paspoort': return acc
        ? (['pending', 'approved', 'geverifieerd', 'verified'].includes(acc.verified) ? 'ingediend' : null)
        : 'demo-sessie';
      default: return null;
    }
  }
  function waardeVan(veld, sess, profiel) {
    const eigen = profiel.velden[veld.id];
    if (eigen != null && eigen !== '') return eigen;
    return bekend(veld.id, sess);
  }

  // Het paspoort (KYC-upload) is standaard bij de betaalde passen (Lifestyle,
  // Business). Bij de gratis RTG Pass hoeft niemand een paspoort te laten zien
  // -- behalve wie RTG Pay gebruikt: dan wordt het eenmalig gevraagd. Guests en
  // RTFoundation laten nooit een paspoort zien via deze poort.
  function paspoortVerplicht(tier, profiel) {
    if (tier === 'lifestyle' || tier === 'business') return true;
    if (tier === 'rtg') return !!(profiel && profiel.payGebruikt);
    return false;
  }

  /* Vragen we dit veld NU? Een veld met moment 'later' hoort bij een handeling
     en niet bij de voordeur: dat vraagt Rahul pas als er een derde partij bij
     komt (kern/gegevenspoort.js). Het paspoort is de uitzondering: het staat
     hierboven al alleen in de lijst als de pas of RTG Pay erom vraagt, en dan is
     zijn moment per definitie nu. */
  function nuNodig(v, tier, profiel) {
    if (v.id === 'paspoort') return paspoortVerplicht(tier, profiel);
    return (v.moment || 'nu') !== 'later';
  }

  // De volledige onboarding-status voor deze sessie binnen een scope.
  function status(scope, sess) {
    const sc = scopeLezen(scope);
    const tier = (sess && sess.tier) || 'guest';
    const profiel = profielLezen(profielId(sess));
    const toon = (v) => {
      const w = waardeVan(v, sess, profiel);
      return { id: v.id, label: v.label, type: v.type, ingevuld: !!(w && String(w).trim()),
        waarde: v.type === 'kyc' ? undefined : (w != null ? String(w) : '') };
    };
    const mijn = sc.velden
      .filter(v => (v.voorWie || []).includes(tier))
      .filter(v => v.id !== 'paspoort' || paspoortVerplicht(tier, profiel));
    const velden = mijn.filter(v => nuNodig(v, tier, profiel)).map(toon);
    /* De later-velden gaan apart mee: een scherm mag ze tonen als "nog aan te
       vullen", maar ze zijn geen poort. Ze staan dus NIET in ontbrekend en
       houden `klaar` niet tegen. */
    const laterVelden = mijn.filter(v => !nuNodig(v, tier, profiel)).map(toon);
    const ontbrekend = velden.filter(v => !v.ingevuld).map(v => v.id);
    const ond = ontvangstVan(profiel, scope, sc.contract.versie);
    const getekend = geldig(crypto, sc, ond, profielId(sess), scope);
    return {
      scope, tier,
      velden, laterVelden, ontbrekend,
      contract: { versie: sc.contract.versie, titel: sc.contract.titel, tekst: sc.contract.tekst,
        ondertekend: getekend, ondertekendAt: getekend ? ond.at : null },
      klaar: ontbrekend.length === 0 && getekend
    };
  }
  // Snelle ja/nee: is de onboarding van deze sessie (platform-scope) rond?
  function klaar(sess, scope) { return status(scope || 'rtg', sess).klaar; }

  // De intake-velden opslaan (paspoort loopt via de KYC-upload, niet hier).
  function slaOp(scope, sess, velden) {
    const sc = scopeVan(scope);
    const geldig = new Set(sc.velden.map(v => v.id));
    const p = profielVan(profielId(sess));
    const acc = sess && sess.account;
    for (const [k, v] of Object.entries(velden || {})) {
      if (!geldig.has(k) || k === 'paspoort') continue;
      const waarde = schoon(String(v == null ? '' : v), 200);
      p.velden[k] = waarde;
      /* HIER SCHRIJFT NIETS NAAR md.nationaliteit, EN DAT IS MET OPZET.

         Deze route staat alleen achter `auth`, dus elk lid kan er zijn eigen
         velden in zetten. Een regel die de nationaliteit doorschrijft naar het
         ledendossier maakt daarmee een tweede schrijver naast de enige die er
         hoort te zijn: de identiteitscontrole van het kantoor
         (routes/office/verificaties.js). Die stond hier even, en het gat was
         precies zo groot als het klinkt: een lid dat door het kantoor als
         Duitse was vastgelegd zette zichzelf op Nederlandse en liep zo langs de
         landregel van de eigenaar (gemeten: 503 werd 200).

         Wie de nationaliteit WEL mag zetten doet dat met bewijs: het kantoor na
         verificatie, of de MRZ-scan van het paspoort (bewaarPaspoort, dezelfde
         module). Wat een lid hier typt blijft in het onboardingprofiel staan,
         en bekend() leest md.nationaliteit al voor wie er wel een heeft. */
    }
    save();
    return status(scope, sess);
  }

  /* Paspoort-meta (vervaldatum, nummer) uit de MRZ-scan bewaren op het profiel.
     Rahul gebruikt de vervaldatum om een half jaar vooraf te seinen dat het
     paspoort verloopt (zie kern/fluister). Alleen een geldige ISO-datum telt. */
  /* Wat de scan van het paspoort oplevert, bewaren we -- en niet minder dan dat.

     Hier stonden alleen nummer en vervaldatum, terwijl shared/mrz.js de hele
     strook al leest: naam, nummer, nationaliteit, geboortedatum, vervaldatum en
     geslacht. De rest werd stil weggegooid, en het gevolg was dat een lid dat
     zijn paspoort al had gescand bij een vlucht ALSNOG zijn nationaliteit moest
     intypen. Twee keer hetzelfde vragen is precies wat dit huis niet doet.

     Alleen wat een grens of een luchtvaartmaatschappij echt van je wil, en
     niets meer: geslacht en de naamvelden laten we hier bewust liggen -- de
     naam staat al in de kluis en het geslacht heeft hier geen lezer.
     Nationaliteit en geboortedatum gaan ook naar het ledendossier, want daar
     kijkt de gegevenspoort. */
  function teken(scope, sess, naam, akkoord, expectedVersion) {
    if (!akkoord) return { status: 400, error: 'Zet een vinkje dat u akkoord bent met de overeenkomst.' };
    naam = schoon(String(naam || ''), 80).trim();
    if (naam.length < 2) return { status: 400, error: 'Typ uw volledige naam om digitaal te ondertekenen.' };
    const sc = scopeVan(scope);
    const pid = profielId(sess);
    if (expectedVersion!==undefined && expectedVersion!==sc.contract.versie)
      return versieConflict();
    const p = profielVan(pid);
    const bestaand = ontvangstVan(p, scope, sc.contract.versie);
    const hash = afdruk(crypto, sc.contract, naam, pid, scope, bestaand ? bestaand.hashVersie || 1 : 2);
    const voorbereid = bereidVoor(sc, p, scope, naam, hash);
    if (voorbereid.error) return voorbereid;
    if (voorbereid.herhaald) {
      if (voorbereid.gewijzigd) save();
      return { status: 200, ok: true, herhaald: true, ...status(scope, sess) };
    }
    if (!p.ondertekend) p.ondertekend = {};
    p.ondertekend[scope] = { versie: sc.contract.versie, naam, at: nu(), hash,
      hashVersie: 2, meaningId:'identity.agreement.accept',meaningVersion:1, contract: momentopname(sc.contract) };
    p.ondertekeningen[scope][sc.contract.versie] = JSON.parse(JSON.stringify(p.ondertekend[scope]));
    save();
    return { status: 200, ok: true, ...status(scope, sess) };
  }

  return { status, klaar, payGate, slaOp, bewaarPaspoort, teken };
};
