# FrenchFox

Kleine Web-App zum Üben von Französisch-Vokabeln (Lehrmittel «dis donc!», 1. Sekundarstufe, Schweiz).
Deutsch ↔ Französisch, Auswählen, Tippen und Karteikarten, Wiederholungsplan, Punkte, Testvorbereitung.

- Reine Web-App: HTML, CSS und JavaScript, kein Server, kein Build, keine Abhängigkeiten.
- Der Fortschritt bleibt im Browser des Geräts (`localStorage`), es gibt kein Konto.
- Läuft als App auf dem Home-Bildschirm und nach dem ersten Öffnen offline.

## Hinweis zu den Inhalten

FrenchFox ist eine private, nicht kommerzielle Lernhilfe. Die Wörter folgen dem Lehrmittel «dis donc!»; die Rechte an den Inhalten liegen bei den Rechteinhabern. FrenchFox steht in keiner Verbindung zum Verlag.

## Lokal ausprobieren

```bash
python3 serve.py        # http://localhost:8080
npm test                # Tests (Node 22 oder neuer)
```

## Aufbau

- `app/` die App (wird veröffentlicht)
- `app/data/units/` Wortlisten als JSON (Unité → Lernziel → Wörter)
- `tests/` Tests der Logik, der Wortlisten, des Offline-Speichers
- `.github/workflows/pages.yml` Tests, danach Veröffentlichung auf GitHub Pages bei jedem Push auf `main`
