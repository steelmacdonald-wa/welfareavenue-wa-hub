/* =====================================================================
   WA v198 the Hub in French (03/10/26)
   =====================================================================
   Steel (02/10/26): "He's also french so I'd love to make the effort in
   putting the entire hub in french as an option. This is for future
   recruits too." His choices: the interface, the onboarding and the
   Avenue Academy in French (what people type stays as written); Quebec
   French, vous; each person picks their language.

   How it works (no page is rewritten):
   1. Each person's language: the account menu's Français / English,
      kept in hub_user_prefs (follows them to any device) and in this
      browser (localStorage wa198lang, so the page starts in it). Changing
      it reloads the page.
   2. The interface: a dictionary of the Hub's own words (hub_i18n:
      English as the page shows it, numbers as {0}, {1}...; read once
      through wa198_dict and kept in this browser until it changes).
      Every piece of text the page draws is looked up as it appears
      (a MutationObserver): whole, then with its numbers set aside, then
      piece by piece around separators (·, —, |), then as a known
      phrase followed or preceded by a name or a number; dates and
      times read the French way. Text that is not the Hub's own (names,
      tasks, notes, messages) has no entry and stays as written. Text
      with no entry yet is reported (wa198_seen); i18n-translate
      translates it overnight when its words are in the Hub's code.
   3. The onboarding and the Avenue Academy: their French (hub_i18n_
      content, served by wa198_content only while the English is
      unchanged) replaces the English as the page reads those tables,
      except on the HR centre and the Admin centre, where they are
      edited. A save never writes the French over the English.
   Off: English readers get none of this (one localStorage read).
   ===================================================================== */
(function () {
  if (window.__wa198) return; window.__wa198 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2';
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var S = { lang: 'en', d: null, v: '', cmap: null, rev: {}, q: {}, qn: 0, sent: 0, names: {}, on: false, ready: false, stats: { hit: 0, miss: 0 }, burst: { n: 0, t: 0, hot: false } };
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } return null; }
  S.lang = ls('wa198lang') === 'fr' ? 'fr' : 'en';
  function lower(s) { return String(s || '').trim().toLowerCase(); }
  function myEmail() { try { return lower(USER && USER.email); } catch (e) { return ''; } }
  var NBSP = ' ';

  /* French dates: Oct 2 → 2 oct., Fri, Oct 2, 8:47 PM → ven. 2 oct., 20 h 47 */
  var MON = { jan: 'janv.', feb: 'févr.', mar: 'mars', apr: 'avr.', may: 'mai', jun: 'juin', jul: 'juill.', aug: 'août', sep: 'sept.', oct: 'oct.', nov: 'nov.', dec: 'déc.' };
  var MONL = { january: 'janvier', february: 'février', march: 'mars', april: 'avril', may: 'mai', june: 'juin', july: 'juillet', august: 'août', september: 'septembre', october: 'octobre', november: 'novembre', december: 'décembre' };
  var DAY = { mon: 'lun.', tue: 'mar.', wed: 'mer.', thu: 'jeu.', fri: 'ven.', sat: 'sam.', sun: 'dim.' };
  var DAYL = { monday: 'lundi', tuesday: 'mardi', wednesday: 'mercredi', thursday: 'jeudi', friday: 'vendredi', saturday: 'samedi', sunday: 'dimanche' };

  var css = document.createElement('style');
  css.id = 'wa198css';
  css.textContent = '' +
    '#w115menu .w198lang{display:flex;align-items:center;gap:8px;}' +
    '#w115menu .w198lang small{margin-left:auto;font-size:11px;font-weight:700;letter-spacing:.6px;color:var(--wa-muted);}' +
    '.w198busy{position:fixed;inset:0;z-index:99999;background:rgba(16,63,57,.92);color:' + CREAM + ';display:flex;align-items:center;justify-content:center;font-family:' + BODY + ';font-size:18px;font-weight:700;}';
  document.head.appendChild(css);
