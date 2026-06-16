import React, { useState, useMemo } from "react";
import { WikiArticle } from "../types";
import { uid } from "../utils/ids";
import { Search, Plus, Trash2, Save, BookOpen, History } from "lucide-react";
import { useDiffStore } from "../renderer/store/diffStore";

export function WikiPanel({
  articles,
  onSave,
  onDelete,
}: {
  articles: WikiArticle[];
  onSave: (article: WikiArticle) => void;
  onDelete: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set<string>(articles.map((a) => a.category));
    return ["Wszystkie", ...Array.from(cats).sort()];
  }, [articles]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (selectedCategory && selectedCategory !== "Wszystkie" && a.category !== selectedCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q));
      }
      return true;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [articles, selectedCategory, search]);

  const selected = articles.find((a) => a.id === selectedId) || null;

  const handleNew = () => {
    const article: WikiArticle = {
      id: uid(),
      title: "Nowy artykuł",
      content: "",
      tags: [],
      category: "General",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(article);
    setSelectedId(article.id);
    setEditId(article.id);
  };

  const handleSaveEdit = () => {
    if (editing) {
      // Snapshot before saving wiki changes
      const original = articles.find((a) => a.id === editing.id);
      if (original && original.content !== editing.content) {
        useDiffStore.getState().snapshotBeforeEdit(editing.id, 'wiki', original.content, original.title);
      }
      onSave({ ...editing, updatedAt: new Date().toISOString() });
      setEditId(null);
    }
  };

  // Local edit state
  const [editing, setEditing] = useState<WikiArticle | null>(null);

  const startEdit = (article: WikiArticle) => {
    setEditing({ ...article });
    setEditId(article.id);
  };

  return (
    <div className="h-full flex">
      {/* Left panel — categories + list */}
      <div className="w-[240px] shrink-0 border-r border-[rgb(var(--border))] flex flex-col">
        <div className="p-3 border-b border-[rgb(var(--border))]">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj..."
              className="w-full bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
        </div>
        <div className="p-3 border-b border-[rgb(var(--border))] space-y-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === "Wszystkie" ? null : cat)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                (cat === "Wszystkie" && !selectedCategory) || cat === selectedCategory
                  ? "bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {cat} {cat !== "Wszystkie" && `(${articles.filter((a) => a.category === cat).length})`}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map((article) => (
            <button
              key={article.id}
              onClick={() => { setSelectedId(article.id); startEdit(article); }}
              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                article.id === selectedId
                  ? "bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]"
                  : "text-gray-300 hover:bg-[rgb(var(--border))]/20"
              }`}
            >
              <div className="font-medium truncate">{article.title}</div>
              <div className="text-[10px] text-gray-500 truncate">{article.category}</div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-[rgb(var(--border))]">
          <button
            onClick={handleNew}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[rgb(var(--accent))] text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus size={14} />
            Nowy artykuł
          </button>
        </div>
      </div>

      {/* Right panel — editor */}
      <div className="flex-1 flex flex-col">
        {editing ? (
          <>
            <div className="p-4 border-b border-[rgb(var(--border))] flex items-center justify-between">
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="text-lg font-semibold bg-transparent border-none outline-none flex-1 mr-4"
                placeholder="Tytuł artykułu"
              />
              <div className="flex items-center gap-2">
                <select
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-xs"
                >
                  {categories.filter((c) => c !== "Wszystkie").map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="General">General</option>
                </select>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    useDiffStore.getState().openDiff({
                      entityId: editing.id,
                      entityType: 'wiki',
                      title: editing.title,
                      currentContent: editing.content,
                    });
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/10 border border-amber-500/30 cursor-pointer"
                  title="Pokaż historię zmian"
                >
                  <History size={14} />
                  Zmiany
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[rgb(var(--accent))] text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  <Save size={14} />
                  Zapisz
                </button>
                <button
                  onClick={() => onDelete(editing.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-red-400 hover:bg-red-500/10 rounded-lg text-xs cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
              {/* Editor */}
              <textarea
                value={editing.content}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                className="flex-1 p-4 bg-[rgb(var(--background))] text-sm font-mono resize-none outline-none border-r border-[rgb(var(--border))]"
                placeholder="Treść w Markdown..."
              />
              {/* Tags */}
              <div className="w-[200px] p-4 shrink-0 space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Tagi</label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {editing.tags.map((tag, i) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))] flex items-center gap-1">
                        {tag}
                        <button
                          onClick={() => setEditing({ ...editing, tags: editing.tags.filter((_, j) => j !== i) })}
                          className="hover:text-red-400 cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const tag = fd.get("tag") as string;
                      if (tag?.trim()) setEditing({ ...editing, tags: [...editing.tags, tag.trim()] });
                      e.currentTarget.reset();
                    }}
                    className="mt-1 flex gap-1"
                  >
                    <input name="tag" placeholder="+ tag" className="w-full bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[10px]" />
                  </form>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Szczegóły</label>
                  <div className="mt-1 text-[10px] text-gray-500 space-y-1">
                    <div>Utworzono: {new Date(editing.createdAt).toLocaleDateString("pl-PL")}</div>
                    <div>Edytowano: {new Date(editing.updatedAt).toLocaleDateString("pl-PL")}</div>
                    <div>Znaki: {editing.content.length}</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Wybierz artykuł z listy lub utwórz nowy</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
