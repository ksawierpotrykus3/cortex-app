// Seed data with X, Y positions laid out on the canvas
export const SEED_DATA = {
  nodes: [
    // Problems — top cluster
    { id: 'p1', title: 'Problem X: Brak infrastruktury poznawczej', type: 'problem', content: 'Nie mam miejsca gdzie mogę zbierać rozrzutki, planować od 0 do 100% i widzieć ogólny obraz. Efekt: prokrastynacja z braku narzędzi.', x: 400, y: 120, createdAt: '2026-05-08T00:00:00.000Z' },
    { id: 'p2', title: 'Brak magazynu na "nie-teraz"', type: 'problem', content: 'Nie ma gdzie wrzucić rzeczy, które nie pasują do aktualnego problemu, ale będą potrzebne później.', x: 160, y: 220, createdAt: '2026-05-08T00:00:00.000Z' },
    { id: 'p3', title: 'Przebłyski toną w tekście', type: 'problem', content: 'Ważne insighty giną w szumie rozmowy z AI. AI nie uznaje ich za priorytetowe, jeśli nie są wyraźnie oznaczone.', x: 800, y: 100, createdAt: '2026-05-08T00:00:00.000Z' },

    // Axioms — center-left cluster
    { id: 'a1', title: 'Plik liniowy nie ogarnie rozrzutek', type: 'aksjomat', content: 'Nie da się zlinearyzować sieci myśli w jeden plik bez utraty połączeń. Potrzebna sieć/graf.', x: 300, y: 360, createdAt: '2026-05-08T00:00:00.000Z' },
    { id: 'a2', title: '"Przetworzone = martwe"', type: 'aksjomat', content: 'Nigdy nie czytam tego, co sam napisałem o sobie po fakcie. Notatki muszą być żywe i operacyjne.', x: 80, y: 480, createdAt: '2026-05-08T00:00:00.000Z' },
    { id: 'a3', title: 'Utrata przykładów = utrata wzorca', type: 'aksjomat', content: 'Każdy przykład jest dowodem na wzorzec. Bez przykładu nie mogę generalizować i budować systemów.', x: 500, y: 500, createdAt: '2026-05-08T00:00:00.000Z' },
    { id: 'a4', title: 'Stres czasowego zaniku wartości', type: 'aksjomat', content: 'Obawa, że pomysł wdrożony zbyt późno nic nie da. Trudność w ocenie ROI niszowych rozwiązań.', x: 700, y: 380, createdAt: '2026-05-08T00:00:00.000Z' },

    // Pewniki — center-right
    { id: 'pw1', title: 'Rozrzutki powstają masowo', type: 'pewnik', content: 'Szybsze powstawanie niż łapanie to norma podczas pracy kognitywnej.', x: 950, y: 280, createdAt: '2026-05-08T00:00:00.000Z' },
    { id: 'pw2', title: 'Filtr na bzdury blokuje własne pomysły', type: 'pewnik', content: 'Odrzucam potencjalnie dobre rzeczy, jeśli nie mam na nie natychmiastowego dowodu.', x: 900, y: 520, createdAt: '2026-05-08T00:00:00.000Z' },
    { id: 'pw3', title: '100% ogólnego obrazu najpierw', type: 'pewnik', content: 'Wystarczy raz zobaczyć strukturę, żeby ogarnąć całość. Potem można operować w głowie.', x: 600, y: 200, createdAt: '2026-05-08T00:00:00.000Z' },

    // Przebłyski — bottom-right
    { id: 'pr1', title: 'System markerów [!] [AKSJOMAT]', type: 'przeblysk', content: 'Sposób na wymuszenie na AI priorytetyzacji konkretnych fragmentów tekstu.', x: 1050, y: 140, createdAt: '2026-05-08T00:00:00.000Z' },
    { id: 'pr2', title: '"Wskazywanie palcem"', type: 'przeblysk', content: 'Surowe stany z głowy + luźne instrukcje. Lepiej pokazać coś niedoskonałego niż budować od zera.', x: 850, y: 680, createdAt: '2026-05-08T00:00:00.000Z' },

    // Rozrzutki — scattered
    { id: 'r1', title: 'Bezstratna kompresja dla AI', type: 'rozrzutka', content: 'Jak człowiek automatycznie kompresuje kontekst? Cel na przyszłość.', x: 350, y: 680, createdAt: '2026-05-08T00:00:00.000Z' },
    { id: 'r2', title: 'Badator niszowości', type: 'rozrzutka', content: 'Meta-rozrzutka o tym, czy dany pomysł jest wart wdrożenia.', x: 1100, y: 440, createdAt: '2026-05-08T00:00:00.000Z' },
    { id: 'r3', title: 'AI dające zadania domowe', type: 'rozrzutka', content: 'Chciałbym, żeby AI aktywnie wyznaczało kroki do nauki.', x: 150, y: 700, createdAt: '2026-05-08T00:00:00.000Z' },
  ],
  links: [
    { source: 'p1', target: 'a1' },
    { source: 'p1', target: 'p2' },
    { source: 'p1', target: 'pw3' },
    { source: 'a1', target: 'pw3' },
    { source: 'a3', target: 'pw2' },
    { source: 'a4', target: 'p1' },
    { source: 'pr1', target: 'p3' },
    { source: 'pr2', target: 'pw3' },
    { source: 'r1', target: 'a3' },
    { source: 'r2', target: 'a4' },
  ]
};
