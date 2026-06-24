# 02 - Plan Rozbudowy Mapy AI i Poprawy UI

Zgodnie z poleceniem, przyjrzałem się logice przechowywania danych oraz interfejsowi. Zrozumiałem Twój punkt widzenia: aplikacja musi być absolutnym "lustrem" wszystkiego, co dzieje się w systemie, a AI pracujące w tle (agenci, taski, rozmowy) musi zostawiać ślad widoczny na jednej wspólnej "Mapie" (Database Explorerze), niezależnie od tego, czy trafi to na główne płótno, czy nie.

Oto mądry plan naprawy obu problemów:

## 1. Zmiana logiki Database Explorer (Prawdziwa Mapa Wszystkiego)

**Diagnoza:**
Obecnie w zrzucie ekranu "DATABASE" krzyczy pustkami (same zera dla Agentów AI, Workflow, Rozmów). To dlatego, że aplikacja trzyma rozmowy agentów ukryte w IndexedDB (widoczne tylko w `FloatingAgentPanel`), a surowe pliki wynikowe (outputs) zapisuje w ukrytym folderze `data/outputs` bez podpinania ich pod lewy panel.

**Rozwiązanie (Co zostanie zmienione):**
- **Ożywienie "Rozmowy AI":** W `DatabaseExplorer.tsx` dopiszemy logikę nasłuchującą na pamięć IndexedDB (`chatStorage`). Każda konwersacja z pływającego panelu zostanie załadowana do sekcji "Rozmowy AI". Po kliknięciu w eksploratorze – automatycznie wysunie się odpowiedni czat z agentem.
- **Śledzenie artefaktów (Hidden AI Actions):** Gdy AI generuje coś, co nie jest wprost notatką (np. kod, JSON, skrypt z `AgentOrchestrator`), musi to zostać zarejestrowane. Stworzymy nową podkategorię w "DATABASE" -> **"Artefakty AI"**, by mieć pełną transparentność tego, co agent wytworzył pod spodem.
- **Pełne podpięcie agentów:** "Agenci AI" zaczną pokazywać status na żywo (Aktywny/Śpiący) na podstawie `useAgentStore`, tworząc prawdziwe "centrum dowodzenia".

## 2. Poprawa nakładających się przycisków (UI Fix)

**Diagnoza:**
Na Twoim screenie z nakładającymi się przyciskami (ikona czatu i "pomysł") widać klasyczny błąd w pozycjonowaniu CSS. 
W pliku `FeedbackModal.tsx` przycisk "Przekaż pomysł" jest przypięty sztywno do prawego dolnego rogu (`bottom-4 right-4`). Ze względu na to, że ma tekst, jest szeroki. Z kolei przycisk agentów w `FloatingAgentPanel.tsx` jest zablokowany na `right-20` (80 pikseli od prawej). W efekcie szeroki przycisk pomysłu "połyka" przycisk agentów.

**Rozwiązanie (Jak to zrobić mądrze):**
- Zamiast wciskać przyciski na siłę w rzędzie z marnym marginesem, wprowadzimy **pionowy układ Floating Action Buttons (FAB)**.
- Przycisk "Przekaż pomysł" zrzuci długi tekst, stanie się eleganckim okrągłym przyciskiem z samą ikonką (plus estetyczny tooltip na najechanie).
- Oba przyciski (Agenci i Feedback) zostaną ułożone w kolumnie w prawym dolnym rogu (np. `bottom-4` i `bottom-16`), co na zawsze wyeliminuje ryzyko nakładania się na siebie, niezależnie od rozdzielczości ekranu.

---
Ten plan sprawi, że Nexus stanie się ostatecznym źródłem prawdy dla wszystkich poczynań AI, a "kaszana" w interfejsie pożegna się z nami na dobre. Daj znać, jak tylko będziesz chciał przystąpić do jego wdrożenia.
