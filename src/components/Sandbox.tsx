import React, { useState } from "react";
import { Terminal, PackageOpen, Download, Monitor, FileText, ChevronRight, RefreshCcw, SearchX, CloudOff, Plug, ServerCog } from "lucide-react";

export function Sandbox() {
  const [activeArticle, setActiveArticle] = useState("electron-setup");

  return (
    <div className="flex h-full w-full bg-[rgb(var(--background))] text-[rgb(var(--text-main))] overflow-hidden">
      
      {/* Sidebar List */}
      <div className="w-64 border-r border-[rgb(var(--border))] bg-[rgb(var(--panel))] flex flex-col pt-6 shrink-0 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.2)]">
        <h3 className="text-xs font-bold tracking-widest text-gray-500 uppercase px-6 mb-4">Biblioteka</h3>
        <div className="flex flex-col px-3 space-y-1">
          <button 
            onClick={() => setActiveArticle("electron-setup")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${activeArticle === "electron-setup" ? "bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))] shadow-sm" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"}`}
          >
            <Monitor className="w-4 h-4 shrink-0" />
            <span className="flex-1 truncate">Kompilacja .exe</span>
            {activeArticle === "electron-setup" && <ChevronRight className="w-4 h-4 opacity-50" />}
          </button>
          
          <button 
            onClick={() => setActiveArticle("sync-issues")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${activeArticle === "sync-issues" ? "bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))] shadow-sm" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"}`}
          >
            <RefreshCcw className="w-4 h-4 shrink-0" />
            <span className="flex-1 truncate">Problem synchronizacji</span>
            {activeArticle === "sync-issues" && <ChevronRight className="w-4 h-4 opacity-50" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-12">
        <div className="max-w-3xl mx-auto space-y-8 pb-32">
          
          {activeArticle === "electron-setup" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="text-left space-y-4 mb-12">
                <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 text-blue-400 rounded-2xl mb-2">
                  <Monitor className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-medium tracking-tight text-white">Tworzenie pliku instalacyjnego (.exe)</h2>
                <p className="text-[rgb(var(--text-muted))] text-lg max-w-2xl leading-relaxed">
                  Projekt został już w pełni skonfigurowany pod kątem desktopowym (Electron). Oto co musisz zrobić na swoim komputerze, aby wygenerować ostateczny plik "Setup.exe".
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4 items-start bg-[rgb(var(--panel))] p-6 rounded-2xl border border-[rgb(var(--border))] shadow-sm hover:border-gray-600 transition-colors">
                  <div className="bg-gray-800 text-gray-300 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 mt-1">1</div>
                  <div>
                    <h3 className="text-xl font-medium text-white flex items-center gap-2 mb-2">
                      <Download className="w-5 h-5 text-emerald-400" /> Pobierz projekt
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      W prawym górnym rogu platformy Google AI Studio kliknij w ikonkę ustawień / koła zębatego i wybierz <strong>Export Project (ZIP)</strong>. Rozpakuj pobrane archiwum w dowolnym miejscu na swoim dysku.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start bg-[rgb(var(--panel))] p-6 rounded-2xl border border-[rgb(var(--border))] shadow-sm hover:border-gray-600 transition-colors">
                  <div className="bg-gray-800 text-gray-300 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 mt-1">2</div>
                  <div>
                    <h3 className="text-xl font-medium text-white flex items-center gap-2 mb-2">
                      <PackageOpen className="w-5 h-5 text-orange-400" /> Zainstaluj zależności
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-3">
                      Otwórz terminal (lub Wiersz polecenia / PowerShell) w wypakowanym folderze i uruchom instalację pakietów NPM. Zostaną pobrane wszystkie niezbędne biblioteki, w tym Electron.
                    </p>
                    <div className="bg-black/50 p-3 rounded-lg border border-white/5 font-mono text-sm text-emerald-400 select-all">
                      npm install
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 items-start bg-[rgb(var(--panel))] p-6 rounded-2xl border border-blue-500/30 relative overflow-hidden shadow-lg">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                  <div className="bg-blue-500/20 text-blue-300 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 mt-1">3</div>
                  <div className="w-full">
                    <h3 className="text-xl font-medium text-white flex items-center gap-2 mb-2">
                      <Terminal className="w-5 h-5 text-blue-400" /> Zbuduj instalator (Setup.exe)
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-3">
                      Teraz wystarczy uruchomić zaprogramowany skrypt, który skompiluje aplikację React, a silnik <strong>electron-builder</strong> ulepi z tego gotowy program Windows.
                    </p>
                    <div className="bg-black/50 p-3 rounded-lg border border-white/5 font-mono text-sm text-emerald-400 mb-4 select-all">
                      npm run electron:build
                    </div>
                    <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20 text-sm text-blue-200">
                      <strong>Gotowe!</strong> Gdy proces się zakończy, w głównym folderze projektu pojawi się nowy katalog o nazwie <code className="bg-black/40 px-1.5 py-0.5 rounded text-blue-100">release/</code>. W środku znajdziesz swój plik <code>Nexus System Setup.exe</code> – gotowy do instalacji i udostępniania!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeArticle === "sync-issues" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="text-left space-y-4 mb-12">
                <div className="inline-flex items-center justify-center p-3 bg-red-500/10 text-red-400 rounded-2xl mb-2">
                  <SearchX className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-medium tracking-tight text-white">Rozwiązywanie problemów: Brak auto-detekcji plików</h2>
                <p className="text-[rgb(var(--text-muted))] text-lg max-w-2xl leading-relaxed">
                  Podręcznik dewelopera opisujący dlaczego lokalny folder Nexus (zapisywany na komputerze) nie jest sprawdzany pod kątem nadpisań z zewnątrz oraz jak to docelowo obejść.
                </p>
              </div>

              <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-2xl p-8 mb-8">
                <h3 className="text-xl font-medium text-white mb-4 border-b border-[rgb(var(--border))] pb-4 flex items-center gap-2">
                  <CloudOff className="w-5 h-5 text-gray-400" /> Dlaczego system sam z siebie nie wgrywa zmian?
                </h3>
                <ol className="list-decimal pl-5 space-y-4 text-gray-300 text-sm leading-relaxed">
                  <li>
                    <strong className="text-white block mb-1">Architektura oparta o "Tylko Push"</strong>
                    Aplikacja prawidłowo i szybko wysyła stworzone dane do podłączonego folderu za każdym razem gdy coś zmieniasz, ale w kodzie <strong className="text-red-400 font-mono">brakuje mechanizmu "Auto-Pull"</strong> (tj. File Watchera). Silnik nigdy samodzielnie nie powraca do odczytania zawartości plików, chyba że sam zresetujesz aplikację. Brak w nim standardowej biblioteki takiej jak <code>chokidar</code> z Node.js, która nasłuchuje zdarzeń ruszania plików wewnątrz katalogu.
                  </li>
                  <li>
                    <strong className="text-white block mb-1">Utrata Referencji w IndexedDB (File System Access API)</strong>
                    Niestety, do czytania systemu plików z poziomu Twojego pulpitu użyto przeglądarkowego <em>File System Access API</em>. Aby w ogóle pisać do podłączonego folderu, przeglądarka udziela tymczasowego uchwytu pamięcią (zapisywanego w IndexedDB pod kluczem <code>nexus_dir_handle</code>). Te uchwyty często "wygasają" przy przeczyszczaniu okna lub ponownej autoryzacji aplikacji po buildzie, zmuszając do ręcznego parowania jeszcze raz pomimo pamiętania poprzedniej lokalizacji.
                  </li>
                </ol>
              </div>

              <div className="bg-blue-900/10 border border-blue-500/20 rounded-2xl p-8">
                <h3 className="text-xl font-medium text-white mb-4 flex items-center gap-2">
                  <ServerCog className="w-5 h-5 text-blue-400" /> Instrukcje Naprawy po stronie własnego kodu
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  Ze względu na ograniczenia środowiska web platformy AI Studio (które w ogóle ignoruje uprawnienia instalacji natywnych procesów backendowych), niemożliwe tu było doklejenie mechanizmu watch-mode. Jeśli wyeksportujesz ten projekt na komputer, wdróż opisane niżej zmiany w strukturze zbudowanego <strong className="text-white">Electrona</strong>:
                </p>

                <div className="space-y-4">
                  <div className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] p-5 rounded-xl">
                    <h4 className="font-medium text-emerald-400 mb-2 flex items-center gap-2">
                       <Plug className="w-4 h-4" /> Krok 1: Włączenie Preload.js po stronie Electrona
                    </h4>
                    <p className="text-sm text-gray-400">
                      Stwórz skrypt wprowadzający kanał komunikacyjny IPC między React a Electron (bridge nodeIntegration w <code>electron-main.cjs</code>). Odrzuć obsługę <strong>File System Access API</strong>, z którego aplikacja i React próbują korzystać bezpośrednio.
                    </p>
                  </div>
                  
                  <div className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] p-5 rounded-xl">
                    <h4 className="font-medium text-emerald-400 mb-2 flex items-center gap-2">
                       <RefreshCcw className="w-4 h-4" /> Krok 2: Podpięcie biblioteki Chokidar
                    </h4>
                    <p className="text-sm text-gray-400">
                      W pliku startowym node.js w backendzie Electrona użyj <code className="bg-black/30 px-1 py-0.5 rounded text-gray-300">npm install chokidar</code>. Następnie każ my skanować ścieżkę absolutną zadeklarowanego folderu z repozytoriami użytkownika, a w przypadku wykrycia zmiany na pliku docelowym wyślij sygnał <code>window.webContents.send('aktualizacja-pliku')</code> wywołujący odświeżenie danych u frontendu.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}




