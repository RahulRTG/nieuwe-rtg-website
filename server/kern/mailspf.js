/* SPF: mag deze server namens dit domein verzenden?

   WAAROM DIT ER MOET ZIJN. kern/mailinkomend.js meldde deze twee tot nu toe als
   "niet gecontroleerd". Dat was eerlijk maar niet af: een ontvanger die zelf
   post aanneemt, hoort te doen wat elke andere mailserver doet, en anders is
   de handtekening van server/dkim.js het enige slot op een deur met drie
   sloten.

   DMARC staat in ./mailauth.js -- dat is een ander onderwerp: SPF beantwoordt
   "mag dit IP", DMARC "hoort dat bij het domein dat de LEZER ziet". Ze zijn
   gesplitst toen dit bestand over de tien kilobyte ging, en dat viel samen met
   de echte naad.

   DE DRIE CONTROLES, en hoe ze samenhangen:

     SPF   - staat het IP van de verzendende server in het TXT-record van het
             domein uit de ENVELOPE (MAIL FROM)? Dat is een ander domein dan
             wat de lezer ziet staan; vandaar DMARC.
     DKIM  - is de handtekening geldig (server/dkim.js)?
     DMARC - hoort het domein uit de ZICHTBARE From-kop bij een van die twee?
             Dat heet uitlijning, en het is de hele reden dat DMARC bestaat:
             SPF en DKIM kunnen allebei slagen op een domein dat de lezer nooit
             te zien krijgt.

   DRIE REGELS DIE HIER VASTLIGGEN

   1. GEEN ANTWOORD IS GEEN GOEDKEURING. Een domein zonder SPF-record levert
      'geen' op en nooit 'geslaagd'. Een DNS-fout levert 'tijdelijke fout' en
      nooit 'gezakt' -- dat verschil is precies waarom SPF een aparte uitslag
      `temperror` kent: een storing bij ons mag geen post van een ander
      veroordelen.
   2. WIJ HANDHAVEN NIET, WIJ STEMPELEN. Deze laag weigert geen post en gooit
      niets weg; hij zet de uitslag op het bericht. Wat er met een gezakte
      DMARC gebeurt, is beleid en hoort bij een mens (of bij de regels van een
      postvak), niet bij een ontleder.
   3. BEGRENSD OPZOEKEN. Een SPF-record mag naar andere records verwijzen
      (include, redirect), en dat is een bekende manier om een ontvanger tien
      DNS-vragen per bericht te laten stellen. De RFC noemt tien als bovengrens
      en die staat hier hard.

   GEEN NETWERK IN DE TOETS. Alle DNS-vragen lopen via een meegegeven `dns`;
   de toets geeft er een die uit een tabel antwoordt. Zo is dit te beproeven
   zonder van het internet af te hangen -- en dat moet, want de belangrijkste
   beweringen gaan over wat er gebeurt als het MISGAAT. */
'use strict';

const MAX_LOOKUPS = 10;          // RFC 7208: hoogstens tien DNS-vragen per controle
const PRIVAAT = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

// een IPv4-adres naar een getal, of null als het er geen is
function ipGetal(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || ''));
  if (!m) return null;
  const d = m.slice(1).map(Number);
  if (d.some(x => x > 255)) return null;
  return ((d[0] << 24) >>> 0) + (d[1] << 16) + (d[2] << 8) + d[3];
}
// valt `ip` binnen `net/prefix`? Zonder prefix is het een exacte vergelijking.
function inNet(ip, net, prefix) {
  const a = ipGetal(ip), b = ipGetal(net);
  if (a == null || b == null) return false;
  const p = prefix == null ? 32 : Math.max(0, Math.min(32, parseInt(prefix, 10)));
  if (p === 0) return true;
  const masker = p === 32 ? 0xFFFFFFFF : (~((1 << (32 - p)) - 1)) >>> 0;
  return ((a & masker) >>> 0) === ((b & masker) >>> 0);
}
const domeinVan = (adres) => String(adres || '').split('@').pop().trim().toLowerCase().replace(/[>,;].*$/, '');
// het organisatiedomein: "post.hotel.example" en "hotel.example" horen bij elkaar
const orgDomein = (d) => String(d || '').split('.').slice(-2).join('.');

module.exports = ({ dns }) => {
  const txt = async (naam) => {
    const rijen = await dns.resolveTxt(naam);
    // node levert TXT als stukken per record; die horen aaneengeplakt te worden
    return (rijen || []).map(r => (Array.isArray(r) ? r.join('') : String(r)));
  };

  /* SPF. Geeft { uitslag, waarom, opgezocht } met uitslag uit:
       geslaagd | gezakt | zacht gezakt | neutraal | geen | tijdelijke fout | fout */
  async function spf(ip, envelopeVan, helo) {
    const domein = domeinVan(envelopeVan) || String(helo || '').toLowerCase();
    if (!domein) return { uitslag: 'geen', waarom: 'er is geen envelope-afzender om op te zoeken' };
    if (!ipGetal(ip)) return { uitslag: 'geen', waarom: 'het verzendende IP is geen IPv4-adres; deze laag kent alleen IPv4' };
    const staat = { n: 0 };
    try {
      const uit = await evalueer(domein, ip, staat, 0);
      return uit;
    } catch (e) {
      if (e && e.tijdelijk) return { uitslag: 'tijdelijke fout', waarom: e.message, opgezocht: staat.n };
      return { uitslag: 'fout', waarom: (e && e.message) || 'onbekende fout', opgezocht: staat.n };
    }
  }

  async function recordVan(domein, staat) {
    if (++staat.n > MAX_LOOKUPS) {
      const e = new Error('meer dan ' + MAX_LOOKUPS + ' DNS-vragen nodig; dat weigert deze laag (RFC 7208)');
      throw e;
    }
    let rijen;
    try { rijen = await txt(domein); }
    catch (e) {
      if (/ENOTFOUND|ENODATA|NXDOMAIN/i.test(String(e && e.code || e))) return null;
      const f = new Error('het DNS antwoordde niet voor ' + domein + ': ' + (e && e.message));
      f.tijdelijk = true;
      throw f;
    }
    const spfs = (rijen || []).filter(r => /^v=spf1(\s|$)/i.test(r.trim()));
    if (!spfs.length) return null;
    if (spfs.length > 1) throw new Error('dit domein heeft ' + spfs.length + ' SPF-records; dat is er een te veel en de uitslag is daarom onbepaald');
    return spfs[0].trim();
  }

  const OORDEEL = { '+': 'geslaagd', '-': 'gezakt', '~': 'zacht gezakt', '?': 'neutraal' };

  /* Geen aparte dieptegrens. Hier stond `if (diep > 5) throw`, en die sloeg toe
     VOOR de tien-vragen-grens -- waardoor die laatste in het gewone geval (een
     keten van includes) nooit aan bod kwam en dus dode code was. De teller is
     bovendien de juiste bescherming: hij is wat RFC 7208 voorschrijft, en hij
     vangt ook een KRING (a verwijst naar b verwijst naar a), want elke stap
     kost een DNS-vraag en die zijn op na tien. Twee grendels waarvan er een
     nooit klemt, is een grendel te veel. */
  async function evalueer(domein, ip, staat, diep) {
    const record = await recordVan(domein, staat);
    if (!record) return { uitslag: 'geen', waarom: domein + ' heeft geen SPF-record', opgezocht: staat.n };

    let redirect = null;
    for (const deel of record.split(/\s+/).slice(1)) {
      if (!deel) continue;
      const rm = /^redirect=(.+)$/i.exec(deel);
      if (rm) { redirect = rm[1]; continue; }
      if (/^exp=/i.test(deel)) continue;
      const teken = '+-~?'.includes(deel[0]) ? deel[0] : '+';
      const rest = '+-~?'.includes(deel[0]) ? deel.slice(1) : deel;
      const [naam, arg] = rest.split(':');
      const kleine = naam.toLowerCase();
      let raak = false;

      if (kleine === 'all') raak = true;
      else if (kleine === 'ip4') {
        const [net, pre] = String(arg || '').split('/');
        raak = inNet(ip, net, pre);
      } else if (kleine === 'ip6') raak = false;              // deze laag kent alleen IPv4
      else if (kleine === 'a' || kleine === 'mx') {
        const doel = (arg || domein).split('/')[0];
        const pre = (rest.split('/')[1]) || null;
        raak = await aOfMx(kleine, doel, ip, pre, staat);
      } else if (kleine === 'include') {
        const uit = await evalueer(arg, ip, staat, diep + 1);
        raak = uit.uitslag === 'geslaagd';
      } else if (kleine === 'exists') {
        if (++staat.n > MAX_LOOKUPS) throw new Error('te veel DNS-vragen (RFC 7208)');
        try { raak = !!(await dns.resolve4(arg)).length; } catch (e) { raak = false; }
      }
      if (raak) {
        return { uitslag: OORDEEL[teken] || 'neutraal', waarom: 'het record van ' + domein + ' beslist met "' + deel + '"',
          record, opgezocht: staat.n };
      }
    }
    if (redirect) return evalueer(redirect, ip, staat, diep + 1);
    return { uitslag: 'neutraal', waarom: 'het record van ' + domein + ' zegt niets over dit IP', record, opgezocht: staat.n };
  }

  async function aOfMx(soort, doel, ip, prefix, staat) {
    if (++staat.n > MAX_LOOKUPS) throw new Error('te veel DNS-vragen (RFC 7208)');
    try {
      if (soort === 'a') {
        const adressen = await dns.resolve4(doel);
        return (adressen || []).some(a => inNet(ip, a, prefix));
      }
      const mx = await dns.resolveMx(doel);
      for (const rij of (mx || []).slice(0, 10)) {
        if (++staat.n > MAX_LOOKUPS) throw new Error('te veel DNS-vragen (RFC 7208)');
        const adressen = await dns.resolve4(rij.exchange).catch(() => []);
        if ((adressen || []).some(a => inNet(ip, a, prefix))) return true;
      }
      return false;
    } catch (e) {
      if (/te veel DNS-vragen/.test(String(e && e.message))) throw e;
      return false;
    }
  }

  return { spf, ipGetal, inNet, domeinVan, orgDomein, MAX_LOOKUPS };
};
