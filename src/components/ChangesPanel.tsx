import React, { useState, useRef, useEffect } from "react";
import { ChangeEntry, ChangeEntityType, ChangeType } from "../types";

const TYPE_COLORS: Record<ChangeType, string> = {
  create: "text-green-400 bg-green-500/10 border-green-500/30",
  update: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  delete: "text-red-400 bg-red-500/10 border-red-500/30",
  export: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  ai_output: "text-purple-400 bg-purple-500/10 border-purple-500/30",
};

const TYPE_LABELS: Record<ChangeType, string> = {
  create: "Utworzono",
  update: "Edytowano",
  delete: "Usunięto",
  export: "Eksport",
  ai_output: "AI Output",
};

export function ChangesPanel({
  changelog,
  onNavigateToEntity,
}: {
  changelog: ChangeEntry[];
  onNavigateToEntity?: (entityType: ChangeEntityType, entityId: string) => void;
}) {
  const [filterType, setFilterType] = useState<"all" | ChangeType>("all");
  const [filterDate, setFilterDate] = useState<"1h" | "24h" | "7d" | "all">("all");
  const [visibleCount, setVisibleCount] = useState(50);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const now = Date.now();

  const filtered = changelog.filter((entry) => {
    if (filterType !== "all" && entry.type !== filterType) return false;
    if (filterDate !== "all") {
      const ms = { "1h": 3600000, "24h": 86400000, "7d": 604800000 }[filterDate];
      if (now - new Date(entry.timestamp).getTime() > ms) return false;
    }
    return true;
  });

  const displayed = filtered.slice(0, visibleCount);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visibleCount < filtered.length) {
          setVisibleCount((prev) => Math.min(prev + 50, filtered.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filtered.length, visibleCount]);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleCount(50);
  }, [filterType, filterDate]);

  return (
    <div className="h-full flex flex-col p-6">
      <h1 className="text-lg font-semibold mb-4">Tablica Zmian</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as ChangeType | 'all')}
          className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-3 py-1.5 text-xs text-gray-300"
        >
          <option value="all">Wszystkie typy</option>
          <option value="create">Utworzone</option>
          <option value="update">Edytowane</option>
          <option value="delete">Usunięte</option>
          <option value="export">Eksport</option>
          <option value="ai_output">AI Output</option>
        </select>
        <select
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value as any)}
          className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-3 py-1.5 text-xs text-gray-300"
        >
          <option value="all">Zawsze</option>
          <option value="7d">Ostatnie 7 dni</option>
          <option value="24h">Ostatnie 24h</option>
          <option value="1h">Ostatnia godzina</option>
        </select>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {displayed.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-12">
            Brak zmian spełniających kryteria.
          </div>
        )}
        {displayed.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-[rgb(var(--border))]/20 transition-colors group"
          >
            {/* Type badge */}
            <span
              className={`shrink-0 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${TYPE_COLORS[entry.type]}`}
            >
              {TYPE_LABELS[entry.type]}
            </span>

            {/* Timestamp */}
            <span className="shrink-0 text-[11px] text-gray-500 font-mono w-[140px]">
              {new Date(entry.timestamp).toLocaleString("pl-PL", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            {/* Summary */}
            <span className="text-[13px] text-gray-300 flex-1 truncate">
              {entry.summary}
            </span>

            {/* Navigate button */}
            {onNavigateToEntity && (
              <button
                onClick={() => onNavigateToEntity(entry.entityType, entry.entityId)}
                className="shrink-0 text-[11px] text-[rgb(var(--accent))] opacity-0 group-hover:opacity-100 transition-opacity hover:underline cursor-pointer"
              >
                Pokaż
              </button>
            )}
          </div>
        ))}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-4" />
      </div>

      {/* Count */}
      <div className="pt-2 text-[11px] text-gray-500 border-t border-[rgb(var(--border))] mt-2">
        Pokazano {displayed.length} z {filtered.length} zmian
        {changelog.length > 500 && (
          <span className="ml-1">(ostatnie 500)</span>
        )}
      </div>
    </div>
  );
}
