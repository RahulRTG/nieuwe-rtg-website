/* Tap to pay: de betaalcode reist contactloos van het toestel van de gast
   naar de kassa of de PDA, via Web NFC. De gast zendt (schrijf), de kassa
   luistert (lees). Op toestellen zonder NFC-ondersteuning geeft kan() false
   en valt de kassa terug op het intypen van de code; betalen werkt dus
   altijd, tap to pay maakt het alleen sneller. */
(function () {
  const kan = () => typeof window !== 'undefined' && 'NDEFReader' in window;

  // de kassa-kant: luister tot er een geldige betaalcode voorbij komt
  async function lees(timeoutMs) {
    if (!kan()) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 15000);
    try {
      return await new Promise((resolve) => {
        ctrl.signal.addEventListener('abort', () => resolve(null));
        const lezer = new NDEFReader();
        lezer.onreading = (ev) => {
          for (const rec of ev.message.records) {
            try {
              if (rec.recordType !== 'text') continue;
              const tekst = new TextDecoder(rec.encoding || 'utf-8').decode(rec.data).trim().toUpperCase();
              if (/^[0-9A-F]{6}$/.test(tekst)) { resolve(tekst); return; }
            } catch (e) {}
          }
        };
        lezer.scan({ signal: ctrl.signal }).catch(() => resolve(null));
      });
    } finally { clearTimeout(timer); ctrl.abort(); }
  }

  // de gast-kant: zet de code klaar; het schrijven gebeurt op het tikmoment
  async function schrijf(code, timeoutMs) {
    if (!kan()) return false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 300000);
    try {
      await new NDEFReader().write({ records: [{ recordType: 'text', data: String(code) }] }, { signal: ctrl.signal });
      return true;
    } catch (e) { return false; }
    finally { clearTimeout(timer); }
  }

  window.TapPay = { kan, lees, schrijf };
})();
