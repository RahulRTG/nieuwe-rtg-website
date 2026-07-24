/* SSRF-afweer: keur uitgaande-verzoek-doelen die (deels) door een client worden
   bepaald. Het scherpste voorbeeld is de web-push-subscription: het `endpoint`
   komt van de browser, en de server POST daar later naartoe. Zonder controle kan
   een aanvaller een endpoint als http://169.254.169.254/... (cloud-metadata) of
   een intern adres opgeven en de server laten port-scannen of geheimen laten
   ophalen (blinde SSRF).

   Aanpak: voor push staan we ALLEEN https toe naar de hostnamen van bekende
   push-diensten (FCM/Google, Mozilla, Apple, Windows). Dat sluit IP-literals en
   interne hosts inherent uit. Daarnaast een generieke `veiligeExternalUrl` die
   privé/gereserveerde IP-ranges en metadata-adressen weigert, als vangnet voor
   toekomstige uitgaande fetches. Pure functies, geen state, geen DNS-lookup
   (een hostname op de allowlist volstaat; DNS-rebinding hoort thuis achter de
   egress-proxy in productie -- zie PRODUCTION.md). */

// IPv4-literal? (vier decimale octetten)
function isIpv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  if (o.some(n => n > 255)) return null;
  return o;
}

// Privé/gereserveerd/metadata IPv4-bereik?
function privaatIpv4(o) {
  const [a, b] = o;
  if (a === 10) return true;                         // 10.0.0.0/8
  if (a === 127) return true;                        // loopback
  if (a === 0) return true;                          // 0.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
  if (a === 192 && b === 168) return true;           // 192.168.0.0/16
  if (a === 169 && b === 254) return true;           // link-local + cloud-metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a >= 224) return true;                         // multicast/gereserveerd
  return false;
}

// Een IP-literal (v4 of v6) die we voor uitgaand verkeer nooit vertrouwen.
function onveiligIpLiteral(host) {
  const v4 = isIpv4(host);
  if (v4) return privaatIpv4(v4);
  const h = host.replace(/^\[|\]$/g, '').toLowerCase(); // [::1] -> ::1
  if (h === '::1' || h === '::' || h === '::0') return true;       // loopback/onbepaald
  if (h.startsWith('fe80:')) return true;                          // link-local
  if (h.startsWith('fc') || h.startsWith('fd')) return true;       // unique-local fc00::/7
  if (h.startsWith('fec0:')) return true;                          // site-local (verouderd)
  if (h.startsWith('::ffff:')) {                                   // IPv4-mapped
    const v = isIpv4(h.slice(7));
    if (v) return privaatIpv4(v);
    return true;
  }
  if (/^[0-9a-f:]+$/.test(h) && h.includes(':')) return false;     // publiek IPv6: toegestaan als literal
  return false;
}

function isIpLiteral(host) {
  if (isIpv4(host)) return true;
  const h = host.replace(/^\[|\]$/g, '');
  return /^[0-9a-f:]+$/i.test(h) && h.includes(':');
}

// Bekende push-dienst-hosts. Een echt endpoint zit hier altijd op.
const PUSH_HOSTS = [
  /(^|\.)googleapis\.com$/,             // fcm/android.googleapis.com
  /(^|\.)push\.services\.mozilla\.com$/, // updates.push.services.mozilla.com
  /(^|\.)push\.apple\.com$/,            // web.push.apple.com
  /(^|\.)notify\.windows\.com$/,        // WNS
  /(^|\.)wns\.windows\.com$/
];

/* Mag de server naar dit push-endpoint POSTen? https + een bekende push-host. */
function pushEndpointOk(endpoint) {
  let u;
  try { u = new URL(String(endpoint || '')); } catch (e) { return false; }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (isIpLiteral(host)) return false;        // push-endpoints zijn hostnamen, nooit IP's
  return PUSH_HOSTS.some(re => re.test(host));
}

/* Generiek vangnet voor toekomstige uitgaande fetches: weiger niet-http(s),
   IP-literals in privé/gereserveerde ranges en metadata-adressen. */
function veiligeExternalUrl(url) {
  let u;
  try { u = new URL(String(url || '')); } catch (e) { return { ok: false, reden: 'geen geldige URL' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, reden: 'alleen http(s)' };
  const host = u.hostname.toLowerCase();
  if (onveiligIpLiteral(host)) return { ok: false, reden: 'privé/gereserveerd/metadata-adres' };
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return { ok: false, reden: 'interne hostnaam' };
  }
  return { ok: true };
}

module.exports = { pushEndpointOk, veiligeExternalUrl, onveiligIpLiteral };
