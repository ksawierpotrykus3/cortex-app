import React, { useEffect, useState } from 'react';
import { useUsemeStore } from '../../renderer/store/usemeStore';
import { Save, FileText, BookOpen } from 'lucide-react';

export function PromptRepository() {
  const {
    promptFiles,
    selectedPrompt,
    promptContent,
    isPromptDirty,
    loadPromptFiles,
    selectPrompt,
    savePrompt,
    setPromptContent,
  } = useUsemeStore();

  const [filter, setFilter] = useState<'all' | 'prompts' | 'knowledge'>('all');

  useEffect(() => {
    loadPromptFiles();
  }, []);

  const filtered = promptFiles.filter((f) => {
    if (filter === 'all') return true;
    if (filter === 'prompts') return f.relativePath.startsWith('config/prompts');
    if (filter === 'knowledge') return f.relativePath.startsWith('config/knowledge');
    return true;
  });

  const handleSave = async () => {
    if (selectedPrompt) {
      await savePrompt(selectedPrompt, promptContent);
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
        <div className="p-3 border-b border-zinc-800">
          <div className="flex gap-1">
            {(['all', 'prompts', 'knowledge'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {f === 'all' ? 'All' : f === 'prompts' ? 'Prompts' : 'Knowledge'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((f) => (
            <button
              key={f.relativePath}
              onClick={() => selectPrompt(f.relativePath)}
              className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                selectedPrompt === f.relativePath
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
              }`}
            >
              {f.relativePath.startsWith('config/knowledge') ? (
                <BookOpen size={12} className="shrink-0 text-amber-500" />
              ) : (
                <FileText size={12} className="shrink-0 text-blue-500" />
              )}
              <span className="truncate">{f.filename}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {selectedPrompt ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
              <span className="text-xs text-zinc-400 truncate">{selectedPrompt}</span>
              <button
                onClick={handleSave}
                disabled={!isPromptDirty}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  isPromptDirty
                    ? 'bg-blue-800 hover:bg-blue-700 text-blue-100'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <Save size={12} />
                Save
              </button>
            </div>
            <textarea
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              className="flex-1 bg-zinc-950 text-zinc-300 text-sm font-mono p-4 resize-none focus:outline-none border-0"
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
            Select a file from the sidebar to edit
          </div>
        )}
      </div>
    </div>
  );
}
