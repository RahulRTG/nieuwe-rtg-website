/* Browser-driver, deel "toetsenbord": echte toetsaanslagen via CDP.

   Apart bestand omdat browser-page.js anders over de 10 KB-lat komt, en
   omdat dit een eigen onderwerp is: welke toets welke code en welk teken
   levert. */
'use strict';

/* De toetsen die onze tests met naam indrukken. Voor alles wat een gewoon
   teken is (een letter, een cijfer, "?") leidt toetsCode() het zelf af. */
const TOETSEN = {
  Escape: { code: 'Escape', vk: 27 },
  Enter: { code: 'Enter', vk: 13, tekst: '\r' },
  Tab: { code: 'Tab', vk: 9 },
  Backspace: { code: 'Backspace', vk: 8 },
  ArrowLeft: { code: 'ArrowLeft', vk: 37 },
  ArrowUp: { code: 'ArrowUp', vk: 38 },
  ArrowRight: { code: 'ArrowRight', vk: 39 },
  ArrowDown: { code: 'ArrowDown', vk: 40 },
  ' ': { code: 'Space', vk: 32, tekst: ' ' }
};
function toetsCode(c) {
  if (/^[a-z]$/i.test(c)) return 'Key' + c.toUpperCase();
  if (/^[0-9]$/.test(c)) return 'Digit' + c;
  return '';
}

/* Het toetsenbord. Dit MOET via Input.dispatchKeyEvent, en niet via een
   waarde in een veld zetten: een toets die belooft dat typen voorgaat op een
   sneltoets bewijst niets als er nooit een keydown langs de luisteraars van
   de pagina komt (LAT regel 9). Een keyDown MET tekst laat Chromium het
   teken ook echt in het veld zetten; zonder tekst blijft het een kale toets. */
class Keyboard {
  constructor(page) { this.page = page; }
  async press(toets) {
    const t = TOETSEN[toets] || {};
    const enkel = String(toets).length === 1;
    const tekst = t.tekst !== undefined ? t.tekst : (enkel ? String(toets) : '');
    const vk = t.vk || (enkel ? String(toets).toUpperCase().charCodeAt(0) : 0);
    const p = {
      key: String(toets), code: t.code || toetsCode(String(toets)),
      windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
      text: tekst, unmodifiedText: tekst, modifiers: 0
    };
    const stuur = (extra) => this.page.conn.stuur('Input.dispatchKeyEvent', Object.assign({}, p, extra), this.page.sessionId);
    await stuur({ type: tekst ? 'keyDown' : 'rawKeyDown' });
    await stuur({ type: 'keyUp', text: '', unmodifiedText: '' });
  }
  async type(tekst) { for (const c of String(tekst)) await this.press(c); }
}

module.exports = { Keyboard };
