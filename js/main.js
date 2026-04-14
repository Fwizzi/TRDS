/* ═══ MAIN — Point d'entrée v1.0.0-static (version statique sans auth) ═ */
import { applyTheme, toggleTheme, showAlert, closeAlert, buildQs, setAns } from './ui.js';
import { updateCD, toggleChrono, resumeTme, tickC, advPeriod, activerProlong, resetChrono, applyRecal } from './timer.js';
import { chgScore, buildTme, refreshTme, addTme, deleteTme, tmeVal } from './score.js';
import { buildQuickNotes, closeDetail, saveDetail, refreshCounters, renderTable, renderEndTable, sorted } from './observations.js';
import { setSynFilter, buildSynTable } from './synthesis.js';
import { exportPDF } from './pdf.js';
import { autosave, autosaveDebounced, flushAutosave, checkResume, resumeMatch, discardMatch, saveToHistory, openHistory, closeHistory, renderHistory, deleteHistory, reexportPDF, startSafetyAutosave, stopSafetyAutosave } from './storage.js';
import { startMatch, endMatch, backMatch, goHome } from './match.js';
import { pad, escapeHtml } from './utils.js';
import { S } from './state.js';
import { log, exportLogs } from './logger.js';
import { APP_VERSION, APP_YEAR, APP_AUTHOR } from './version.js';

/* ── Registre central ── */
window.App = {
  showAlert, closeAlert, buildQs, setAns, applyTheme, toggleTheme,
  updateCD, toggleChrono, resumeTme, advPeriod, activerProlong, resetChrono, applyRecal,
  chgScore, buildTme, refreshTme, addTme, deleteTme,
  buildQuickNotes, closeDetail, saveDetail, refreshCounters, renderTable, renderEndTable,
  setSynFilter, buildSynTable,
  exportPDF,
  autosave, autosaveDebounced, checkResume, resumeMatch, discardMatch, saveToHistory,
  openHistory, closeHistory, renderHistory, deleteHistory, reexportPDF,
  startSafetyAutosave, stopSafetyAutosave,
  startMatch, endMatch, backMatch, goHome,
  exportLogs
};

/* ── Exposition window ── */
window.startMatch          = startMatch;
window.endMatch            = endMatch;
window.backMatch           = backMatch;
window.goHome              = goHome;
window.toggleChrono        = toggleChrono;
window.resumeTme           = resumeTme;
window.applyRecal          = applyRecal;
window.activerProlong      = activerProlong;
window.resetChrono         = resetChrono;
window.chgScore            = chgScore;
window.addTme              = (t, i) => window.App.addTme(t, i);
window.deleteTme           = (t, i) => window.App.deleteTme(t, i);
window.setSynFilter        = setSynFilter;
window.exportPDF           = exportPDF;
window.resumeMatch         = resumeMatch;
window.discardMatch        = discardMatch;
window.openHistory         = openHistory;
window.closeHistory        = closeHistory;
window.deleteHistory       = deleteHistory;
window.reexportPDF         = reexportPDF;
window.syncDate = function() {
  const v = document.getElementById('mDate').value;
  const d = document.getElementById('mDateDisplay');
  if (d && v) { const p = v.split('-'); d.value = p[2]+'/'+p[1]+'/'+p[0]; }
};
window.syncTime = function() {
  const v = document.getElementById('mTime').value;
  const d = document.getElementById('mTimeDisplay');
  if (d && v) d.value = v;
};
window.toggleTheme         = toggleTheme;
window.closeAlert          = closeAlert;
window.setAns              = setAns;
window.exportLogs          = exportLogs;
window.renderTable         = renderTable;
window.renderEndTable      = renderEndTable;
window.closeDetail         = closeDetail;
window.saveDetail          = saveDetail;


/* ── Erreurs globales ── */
window.addEventListener('error', e => {
  log.error('GLOBAL', 'js_erreur_non_geree', { message: e.message, source: e.filename, ligne: e.lineno });
});
window.addEventListener('unhandledrejection', e => {
  log.error('GLOBAL', 'promise_rejetee_non_geree', { message: e.reason?.message || String(e.reason) });
});

/* ─────────────────────────────────────────────────────────────────────
   v0.3.20 (BUG-2) — Filets de sécurité sur fermeture / arrière-plan
   ─────────────────────────────────────────────────────────────────────
   beforeunload     : déclenché à la fermeture/rechargement de l'onglet
                      sur desktop. Peu fiable sur iOS, d'où l'ajout de
                      visibilitychange en complément.
   visibilitychange : déclenché quand l'app passe en arrière-plan
                      (verrouillage écran, changement d'app, onglet
                      masqué). C'est le filet le plus important sur
                      mobile, où l'OS peut tuer l'app à tout moment
                      sans préavis une fois qu'elle est masquée.
   Les deux écouteurs déclenchent un autosave silencieux protégé par
   try/catch — il ne faut surtout pas qu'une erreur ici empêche la
   fermeture de la page.
═════════════════════════════════════════════════════════════════════ */
/* v0.3.31 (BUG-5) : exposer setMatchActif pour le handler oninput du contexte */
window.App.setMatchActif = function() { S.matchActif = true; };

/* _initApp : initialise l'écran Setup au chargement (version statique sans auth) */
function _initApp() {
  document.getElementById('SS').style.display = 'flex';
  checkResume();
  const now = new Date();
  const isoDate = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate());
  const isoTime = pad(now.getHours()) + ':' + pad(now.getMinutes());
  document.getElementById('mDate').value = isoDate;
  document.getElementById('mTime').value = isoTime;
  const dd = document.getElementById('mDateDisplay');
  const dt = document.getElementById('mTimeDisplay');
  if (dd) dd.value = pad(now.getDate()) + '/' + pad(now.getMonth()+1) + '/' + now.getFullYear();
  if (dt) dt.value = isoTime;
}

/* ─────────────────────────────────────────────────────────────────────────
   v0.3.31 (BUG-5) — Garde d'autosave simplifiée.
   Un match est considéré "actif" uniquement si au moins une action réelle
   a été effectuée dans l'écran match : chrono, score, TME, observation ou
   contexte. Le simple fait de démarrer le match (startMatch) ne suffit pas.
   Le flag S.matchActif est positionné par chaque déclencheur concerné et
   remis à false par startMatch() et goHome().
═════════════════════════════════════════════════════════════════════════ */
function _hasMatchData() {
  return S.matchActif === true;
}

window.addEventListener('beforeunload', () => {
  if (!_hasMatchData()) return;
  /* v0.3.22 (FRAG-1) : flush du debounce de saisie contexte avant fermeture
     pour ne perdre aucun caractère tapé dans les 500 dernières ms. */
  try { flushAutosave(); } catch (e) { /* silencieux */ }
  try { autosave(); } catch (e) { /* silencieux : ne pas bloquer la fermeture */ }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (!_hasMatchData()) return;
    /* v0.3.22 (FRAG-1) : idem flush avant passage en arrière-plan. */
    try { flushAutosave(); } catch (e) { /* silencieux */ }
    try { autosave(); } catch (e) { /* silencieux */ }
  }
});

/* ── Initialisation ── */
window.addEventListener('load', () => {
  log.info('LIFECYCLE', 'app_initialisee', { version: APP_VERSION });

  document.querySelectorAll('.copyright-bar').forEach(el => {
    const btn = el.querySelector('button');
    el.innerHTML =
      '\u00a9 ' + APP_YEAR + ' <strong>' + APP_AUTHOR + '</strong>' +
      ' \u2014 Tous droits r\u00e9serv\u00e9s \u2014 <span style="opacity:.6;font-size:.9em;">v' + APP_VERSION + '</span>';
    if (btn) el.appendChild(btn);
  });
  document.querySelectorAll('.copyright-bar-inline').forEach(el => {
    el.style.cssText = 'font-size:10px;color:#bbb;text-align:center;padding:4px 0;';
    el.innerHTML =
      '\u00a9 ' + APP_YEAR + ' <strong style="color:#999;">' + APP_AUTHOR + '</strong>' +
      ' \u2014 <span style="opacity:.6;">v' + APP_VERSION + '</span>';
  });

  const saved       = localStorage.getItem('arbitres_hb_theme');
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const isDark      = saved === 'dark' || (!saved && prefersDark);
  applyTheme(isDark, false);
  document.documentElement.classList.remove('dark-init');

  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('arbitres_hb_theme')) applyTheme(e.matches, false);
  });

  document.getElementById('rMin').addEventListener('input', function () {
    if (this.value.length >= 2) document.getElementById('rSec').focus();
  });

  /* Fermer l'overlay detail en cliquant en dehors de la sheet */
  document.getElementById('detailOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('detailOverlay')) closeDetail();
  });

  /* Version statique : démarrage direct sur l'écran Setup */
  _initApp();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => log.info('SW', 'service_worker_enregistre'))
    .catch(e  => log.error('SW', 'service_worker_erreur', { message: e.message }));

  /* ─────────────────────────────────────────────────────────────────────
     v0.3.27 (FRAG-2) — Réception des messages du service worker
     ─────────────────────────────────────────────────────────────────────
     Quand le SW détecte en arrière-plan (via stale-while-revalidate)
     qu'une nouvelle version de l'app est disponible sur le serveur, il
     envoie un postMessage { type: 'APP_UPDATE_AVAILABLE' } à tous les
     clients actifs. On affiche alors un bandeau discret en bas de
     l'écran proposant à l'utilisateur de recharger pour activer la
     nouvelle version.

     Bandeau créé dynamiquement (pas dans le HTML statique) car c'est
     une notification transverse qui doit pouvoir s'afficher depuis
     n'importe quel écran. Protection contre les déclenchements
     multiples : une fois le bandeau affiché, on ignore les postMessages
     suivants jusqu'au rechargement.
  ═════════════════════════════════════════════════════════════════════ */
  let _updateBannerShown = false;
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'APP_UPDATE_AVAILABLE') {
      log.info('SW', 'update_disponible');
      if (_updateBannerShown) return;
      _updateBannerShown = true;
      _showUpdateBanner();
    }
  });

  function _showUpdateBanner() {
    /* Évite les doublons si appelé deux fois */
    if (document.getElementById('swUpdateBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'swUpdateBanner';
    banner.className = 'sw-update-banner';
    banner.innerHTML =
      '<span class="sw-update-text">Une nouvelle version de l\'application est disponible.</span>' +
      '<button class="sw-update-btn" id="swUpdateReload">Recharger</button>' +
      '<button class="sw-update-close" id="swUpdateDismiss" title="Plus tard">&times;</button>';
    document.body.appendChild(banner);
    document.getElementById('swUpdateReload').addEventListener('click', () => {
      log.info('SW', 'update_reload_demande');
      window.location.reload();
    });
    document.getElementById('swUpdateDismiss').addEventListener('click', () => {
      log.info('SW', 'update_reload_differe');
      banner.remove();
    });
  }
}
