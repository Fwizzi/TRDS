# Instructions de test — v0.3.31

> **À l'attention de toute personne (humaine ou IA assistante) qui met à jour ce fichier :** lis attentivement la section "Comment ce fichier est maintenu" ci-dessous **avant** d'écrire quoi que ce soit. Ces conventions sont persistantes et ne doivent pas être redemandées à chaque conversation.

---

## Comment ce fichier est maintenu

### Règle absolue : ce fichier est RÉÉCRIT à chaque version

Ce fichier n'est **pas** un historique cumulatif. À chaque nouvelle version livrée, il est **entièrement réécrit**. L'historique complet reste dans `docs/CHANGELOG.md`.

### Structure obligatoire

1. Cet encart (recopié intégralement à chaque version).
2. **Section A — Tests des nouveautés de la version courante.**
3. **Section B — Tests de non-régression.**
4. **Section C — Tests destructifs (optionnels).**
5. **Comment me faire un retour utile.**

### Approche : tests qui cherchent à casser

Ces tests ne sont **pas** des tests "happy path". Ils sont conçus pour trouver des bugs avant la production.

### Référence

`docs/README.md`, `docs/CHANGELOG.md`, `docs/ARCHITECTURE.md`.

---

# Tests pour la version 0.3.31

Correction **BUG-5** : le bandeau de reprise ne doit apparaître que si une action réelle a été effectuée dans l'écran match. Le simple démarrage du match (bouton "Démarrer") ne suffit plus.

---

## Section A — Tests des nouveautés v0.3.31

### A.1 — Pas de bandeau après démarrage sans action

1. Remplir les données du match (équipes, arbitres, date).
2. Appuyer sur **Démarrer**.
3. Ne faire **aucune action** (ne pas toucher au chrono, score, TME, observations ni contexte).
4. Fermer complètement l'app.
5. Rouvrir.
6. **Résultat attendu :** aucun bandeau de reprise.

---

### A.2 — Bandeau présent après chrono démarré

1. Démarrer le match, appuyer sur **Démarrer le chrono**.
2. Fermer brutalement l'app.
3. Rouvrir.
4. **Résultat attendu :** bandeau de reprise affiché.

---

### A.3 — Chaque action individuelle déclenche le bandeau

Tester chacune isolément (vider `arbitres_hb_current` en console entre chaque) :

| Action | Bandeau attendu |
|---|---|
| Démarrer le chrono | ✅ Oui |
| Modifier le score | ✅ Oui |
| Ajouter un temps mort | ✅ Oui |
| Saisir une observation rapide | ✅ Oui |
| Écrire dans le contexte | ✅ Oui |
| Démarrer le match sans rien faire | ❌ Non |
| Remplir les données sans démarrer | ❌ Non |

---

### A.4 — Reset correct après retour à l'accueil

1. Démarrer un match, déclencher une action (chrono).
2. Retourner à l'accueil via le bouton retour (confirmer l'abandon).
3. Fermer et rouvrir l'app.
4. **Résultat attendu :** aucun bandeau de reprise (flag remis à false).

---

### A.5 — Reprise d'un match existant fonctionne toujours

1. Démarrer un match, ajouter une observation, fermer brutalement.
2. Rouvrir → bandeau de reprise → cliquer **Reprendre**.
3. **Résultat attendu :** match restauré complet, aucune alerte.
4. Depuis le match repris, ajouter une nouvelle action, fermer brutalement.
5. Rouvrir.
6. **Résultat attendu :** bandeau de reprise à nouveau (la nouvelle action a activé le flag).

---

## Section B — Tests de non-régression

### B.1 — Détection rapide de mise à jour (v0.3.28)
1. Modifier `js/version.js` sur le serveur (`'0.3.31-test'`), recharger.
2. **Résultat attendu :** bandeau en moins de 5 secondes.

### B.2 — Ouverture instantanée (FRAG-2)
1. Recharger plusieurs fois, même en Slow 3G.
2. **Résultat attendu :** affichage instantané.

### B.3 — Ouverture hors ligne (FRAG-2)
1. Mode avion + fermer + rouvrir.
2. **Résultat attendu :** app depuis le cache.

### B.4 — BUG-1 + BUG-3 : reprise de match (v0.3.20 + v0.3.21)
1. Match démarré, 3 obs, fermer, Reprendre.
2. **Résultat attendu :** match restauré, aucune alerte.

### B.5 — BUG-2 : filet d'autosave 30 s (v0.3.20)
1. Match démarré + action, inactif 35 s.
2. **Résultat attendu :** log `STORAGE/autosave_filet_30s`.

### B.6 — FRAG-1 : debounce contexte (v0.3.22)
1. Taper « ABC » dans le contexte, fermer immédiatement, Reprendre.
2. **Résultat attendu :** contexte contient « ABC ».

### B.7 — Historique local utilisateur (v0.3.29)
1. Connecté en utilisateur, faire un match complet, sauvegarder.
2. Ouvrir l'historique.
3. **Résultat attendu :** match visible avec bouton PDF.

### B.8 — Export PDF
1. Finir un match, exporter.
2. **Résultat attendu :** PDF téléchargé, match dans l'historique.

---

## Section C — Tests destructifs (optionnels)

### C.1 — Fermeture juste après startMatch

1. Appuyer sur Démarrer, fermer l'app dans la seconde qui suit sans rien faire.
2. Rouvrir.
3. **Résultat attendu :** aucun bandeau.

### C.2 — Actions en rafale puis fermeture

1. Démarrer, chrono + score + obs en 5 secondes, fermer brutalement.
2. Rouvrir.
3. **Résultat attendu :** bandeau présent, toutes les actions restaurées à la reprise.

---

## Comment me faire un retour utile

1. **Numéro du test** et étape
2. **Affiché** vs **attendu**
3. **Logs console** filtrés sur `STORAGE` ou `LIFECYCLE`
4. **`localStorage.getItem('arbitres_hb_current')`** en console
5. **Navigateur et OS**
6. **Reproductible ?** Combien de fois sur 5 essais
