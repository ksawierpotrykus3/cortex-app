# Synteza — Dalsza ekspansja projektu Nexus

> **Stan obecny**: F1 (UI) + F2 (UI) + F3 (Topologia) + F5 (Eksport) = **100% zrobione**
> **Pozostaje**: F4 (Tablica Zmian, P3) + F6 (AI Warsztat, P1)
> **Całość**: ~110-160h roboty

---

## Którą fazę robić?

### F4 — Tablica Zmian (~30-40h)
| Za | Przeciw |
|---|---------|
| + Samodzielna, nie blokuje się z niczym | - P3 (najniższy priorytet) |
| + Najszybsza do wdrożenia | - Zmniejsza wartość per hour |
| + "Brakuje mi..." — realna wartość UX | - Nikt nie prosił o changelog |

### F6 — AI Warsztat (~80-120h)
| Za | Przeciw |
|---|---------|
| + Backend agentów już w 100% zrobiony | - Duży upfront (~40h na Wiki + Presety) |
| + P1 (priorytet projektu) | - Wymaga sekwencyjności (6.1→6.2→6.6) |
| + Wiki — największa wartość dla projektu | - Pipeline (6.6) to ~25-35h samego |
| + Presety — mało roboty, efekt "wow" | |

---

## Rekomendowana ścieżka: **F4 → F6.4 → F6.5 → F6.1 → F6.2 → F6.3 → F6.6**

### Dlaczego taka kolejność?

```
F4 (30-40h) ──→ rozgrzewka, szybki win, feedback loop
   │
   ▼
F6.4 Wiki (20-25h) ──→ największa wartość w F6
   │
   ▼
F6.5 Presety (5-10h) ──→ szybki win, "wow" efekt
   │
   ▼
F6.1 Permisje (15-20h) ──→ blokuje 6.2 i 6.3
   │
   ▼
F6.2 Context Builder (20-25h) ──→ blokuje 6.6
   │
   ▼
F6.3 Historia (15-20h) ──→ zależne od 6.1
   │
   ▼
F6.6 Pipeline (25-35h) ──→ największe, na koniec
```

### Uzasadnienie

1. **F4 jako pierwsza** — mała, samodzielna, szybko robi różnicę. "Brakuje mi..." daje pętlę feedbacku od razu.
2. **Wiki (6.4) zaraz potem** — 20-25h, największa funkcjonalna wartość w F6. Daje bazę wiedzy, której brakuje między Sandboxem a agentami.
3. **Presety (6.5) przed permisjami** — 5-10h, mało roboty, duży efekt wizualny.
4. **Permisje (6.1) → Context Builder (6.2) → Historia (6.3)** — sekwencyjnie, bo każdy poprzedni blokuje następny.
5. **Pipeline (6.6) na koniec** — największe zadanie, zależne od 6.1 i 6.2.

### Czego nie robić od razu
- **Nie łączyć F4 i F6 w jednej sesji** — zbyt dużo zmian naraz, ryzyko konfliktów
- **Nie zaczynać od Pipeline'u** (6.6) — wymaga permisji i context buildera
- **Nie pomijać testów** — każde zadanie ma minimum 3 testy

---

## Szczegółowy harmonogram

| Krok | Faza | Zadanie | Czas | Łącznie | Kamień milowy |
|------|------|---------|------|---------|---------------|
| 1 | F4 | 4.1 ChangeLog Engine | 8-10h | 10h | ChangeLog rejestruje zmiany |
| 2 | F4 | 4.2 ChangesPanel | 12-15h | 25h | Widok "Tablica Zmian" |
| 3 | F4 | 4.3 FeedbackButton | 10-15h | 40h | "Brakuje mi..." działa |
| 4 | F6 | 6.4 Wiki Panel | 20-25h | 65h | CRUD Wiki + wyszukiwarka |
| 5 | F6 | 6.5 Presety | 5-10h | 75h | 4 szablony agentów |
| 6 | F6 | 6.1 Permisje | 15-20h | 95h | System permisji |
| 7 | F6 | 6.2 Context Builder | 20-25h | 120h | Wybór kontekstu |
| 8 | F6 | 6.3 AgentHistory | 15-20h | 140h | Pełna historia |
| 9 | F6 | 6.6 Pipeline | 25-35h | 175h | Pipeline DAG |

## Wszystkie plany w strukturze

```
_plans/
├── f3-f5/                       ← ZROBIONE
│   ├── F3_TOPOLOGIA.md
│   ├── F5_EKSPORT.md
│   └── IMPLEMENTATION_ORDER.md
│
├── f4-changes/                  ← GOTOWE DO IMPLEMENTACJI
│   ├── README.md
│   └── F4_TABLICA_ZMIAN.md      ← 3 zadania, dokładne typy i kod
│
├── f6-ai-workshop/              ← GOTOWE DO IMPLEMENTACJI
│   ├── README.md
│   └── F6_AI_WORKSHOP.md        ← 6 zadań, dokładne typy i kod
│
├── CHANGELOG_SESSION.md         ← Historia tej sesji
├── NEXT_AI_HANDOFF.md           ← Handoff dla nowego AI
└── SYNTEZA.md                   ← Ten plik — co dalej
```
