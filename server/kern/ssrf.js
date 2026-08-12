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

/* DE CANONIEKE VORM VAN EEN HOST, EN DIE STAAT OP EEN PLEK.

   De foutklasse: zelfde betekenis, andere bytevorm, andere veiligheidsuitkomst.
   Een security-identiteit die je vergelijkt, moet daarvoor eerst tot EEN vorm
   worden teruggebracht -- anders vergelijk je de vorm en niet de betekenis.

   Dit is hier geen theorie. metadataDoel() en onveiligIpLiteral() deden allebei
   hun eigen normalisatie, en die twee liepen uiteen: onveiligIpLiteral pakte
   `::ffff:169.254.169.254` netjes uit tot het IPv4-adres eronder, metadataDoel
   niet. Gevolg was dat veiligeWebhookUrl(url, {intern:true}) -- de lichtere
   poort, die alleen metadata en link-local hoort te weren -- het cloud-metadata-
   endpoint gewoon doorliet zodra je het in IPv4-mapped IPv6 opschreef:

       http://169.254.169.254/       geweigerd
       http://[::ffff:169.254.169.254]/   DOOR

   Hetzelfde geldt voor de sluitpunt (`169.254.169.254.`), die in DNS dezelfde
   naam aanwijst maar niet als IPv4-literal wordt herkend.

   De reparatie is niet "die ene controle erbij in metadataDoel" maar EEN
   canonieke vorm die allebei de poorten gebruiken. Twee plekken die dezelfde
   waarheid vasthouden lopen vroeg of laat uit elkaar (LAT.md regel 4), en dat is
   precies wat hier gebeurd was.

   Wat Node's URL-parser al doet, doen we hier NIET over: die zet decimale,
   octale en hexadecimale IPv4-vormen (2852039166, 0251.0376.0251.0376,
   0xa9fea9fe) zelf al om naar het punt-formaat. Wat hij NIET doet is een
   IPv4-mapped IPv6-literal uitpakken, en dat gat zit hier. */
function canoniekHost(host) {
  let h = String(host || '').replace(/^\[|\]$/g, '').toLowerCase();
  if (h.length > 1 && h.endsWith('.')) h = h.slice(0, -1); // sluitpunt: dezelfde naam
  if (h.startsWith('::ffff:')) {
    const rest = h.slice(7);
    if (isIpv4(rest)) return rest;           // ::ffff:10.0.0.1 IS 10.0.0.1
    /* EN DE DERDE VORM, die de parser zelf maakt. new URL() comprimeert
       [::ffff:169.254.169.254] tot [::ffff:a9fe:a9fe] -- hetzelfde adres, in
       hexadecimale woorden. Wie alleen de puntvorm uitpakt, mist dus precies de
       vorm die er in de praktijk uitkomt: de eerste reparatie hier repareerde
       metadataDoel() wel als functie, maar veiligeWebhookUrl() liet het
       metadata-endpoint nog steeds door, omdat de hostname uit de parser al
       omgezet was. Een canonieke vorm die de vorm van je eigen parser niet kent,
       is geen canonieke vorm. */
    const m = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(rest);
    if (m) {
      const n = ((parseInt(m[1], 16) * 65536) + parseInt(m[2], 16)) >>> 0;
      return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    }
  }
  return h;
}

// Een IP-literal (v4 of v6) die we voor uitgaand verkeer nooit vertrouwen.
function onveiligIpLiteral(host) {
  const h = canoniekHost(host);
  const v4 = isIpv4(h);
  if (v4) return privaatIpv4(v4);
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

/* Het cloud-metadata-endpoint en link-local: NOOIT een legitiem uitgaand doel,
   ook niet voor operator-ingestelde targets (webhook, SMTP-smarthost). Andere
   interne adressen (127.*, 10.*, ...) laten we hier BEWUST met rust -- een
   lokale collector- of mailrelay-sidecar (MailHog op localhost:1025, een intern
   log-endpoint) is een gangbaar en legitiem doel. Dit is het harde minimum dat
   overal geldt; de strengere veiligeExternalUrl blokkeert ook de privé-ranges. */
function metadataDoel(host) {
  const h = canoniekHost(host);   // EEN canonieke vorm, gedeeld met onveiligIpLiteral
  const v4 = isIpv4(h);
  if (v4) return v4[0] === 169 && v4[1] === 254;   // 169.254.0.0/16 (IMDS + link-local)
  if (h.startsWith('fe80:')) return true;          // IPv6 link-local
  if (h === 'fd00:ec2::254') return true;          // AWS IPv6 IMDS
  return false;
}

/* Mag de server naar dit operator-ingestelde webhook-doel POSTen? Standaard
   dezelfde strenge poort als veiligeExternalUrl (privé + metadata weigeren, zo
   kan een fout-webhook nooit een intern adres port-scannen). Zet intern=true
   (bewuste collector-sidecar) om alleen het metadata/link-local-adres te
   blokkeren en de rest toe te staan. */
function veiligeWebhookUrl(url, opts) {
  opts = opts || {};
  if (!opts.intern) return veiligeExternalUrl(url);
  let u;
  try { u = new URL(String(url || '')); } catch (e) { return { ok: false, reden: 'geen geldige URL' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, reden: 'alleen http(s)' };
  if (metadataDoel(u.hostname)) return { ok: false, reden: 'cloud-metadata/link-local-adres' };
  return { ok: true };
}

module.exports = { pushEndpointOk, veiligeExternalUrl, veiligeWebhookUrl, metadataDoel, onveiligIpLiteral, canoniekHost };
