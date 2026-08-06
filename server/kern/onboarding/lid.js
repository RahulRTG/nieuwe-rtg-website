/* Onboarding (deelmodule): de lid-kant. Leest de onboarding-status voor een
   sessie, slaat de intake-velden op, bewaart de paspoort-meta, bewaakt de
   RTG Pay-poort (eenmalig paspoort bij de gratis pas) en tekent het contract.
   Draait op de gedeelde context die kern/onboarding.js een keer opbouwt. */
module.exports = (ctx) => {
  const { accounts, save, schoon, crypto, nu, scopeVan, profielVan, profielId } = ctx;
  // het paspoort is een eigen onderwerp en staat daarom apart
  const { bewaarPaspoort } = require('./paspoort')(ctx);

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
    const sc = scopeVan(scope);
    const tier = (sess && sess.tier) || 'guest';
    const profiel = profielVan(profielId(sess));
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
    const ond = (profiel.ondertekend || {})[scope];
    const getekend = !!(ond && ond.versie === sc.contract.versie);
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

  /* RTG Pay-gebruik door een gratis lid. Vanaf het eerste gebruik is het
     paspoort eenmalig vereist; de betaalde passen hebben dat al bij de
     onboarding gedaan. Geeft {ok:true} als het door mag; anders een nette
     403 met kyc:true, zodat de app het lid naar de paspoort-stap stuurt.
     (Demo-/gastsessies zonder echt account laten we door: die kunnen geen
     identiteitsbewijs uploaden.) */
  function payGate(sess) {
    const tier = (sess && sess.tier) || 'guest';
    if (tier === 'lifestyle' || tier === 'business') return { ok: true };
    if (tier !== 'rtg') return { ok: true };
    const profiel = profielVan(profielId(sess));
    if (!profiel.payGebruikt) { profiel.payGebruikt = true; save(); }
    const acc = sess && sess.account;
    const geverifieerd = acc && ['pending', 'approved', 'geverifieerd', 'verified'].includes(acc.verified);
    if (!acc || geverifieerd) return { ok: true };
    return { ok: false, status: 403, kyc: true,
      error: 'RTG Pay vraagt eenmalig je paspoort. Open de app; Rahul helpt je het te bevestigen.' };
  }

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
  function teken(scope, sess, naam, akkoord) {
    if (!akkoord) return { status: 400, error: 'Zet een vinkje dat u akkoord bent met de overeenkomst.' };
    naam = schoon(String(naam || ''), 80);
    if (naam.length < 2) return { status: 400, error: 'Typ uw volledige naam om digitaal te ondertekenen.' };
    const sc = scopeVan(scope);
    const pid = profielId(sess);
    const p = profielVan(pid);
    const hash = crypto.createHash('sha256').update(sc.contract.versie + '|' + sc.contract.tekst + '|' + naam + '|' + pid).digest('hex');
    p.ondertekend[scope] = { versie: sc.contract.versie, naam, at: nu(), hash };
    save();
    return { status: 200, ok: true, ...status(scope, sess) };
  }

  return { status, klaar, payGate, slaOp, bewaarPaspoort, teken };
};
