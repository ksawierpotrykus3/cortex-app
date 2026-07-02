import React, { useState } from 'react';
import { useUsemeStore } from '../../renderer/store/usemeStore';
import { X, Check, RefreshCw, Trash2 } from 'lucide-react';

export function ReviewQueueModal() {
  const { pendingReviews, submitReviewDecision } = useUsemeStore();
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [editProposal, setEditProposal] = useState('');
  const [editMode, setEditMode] = useState(false);

  if (pendingReviews.length === 0) return null;

  const current = pendingReviews[activeReviewIndex] || pendingReviews[0];

  React.useEffect(() => {
    if (current) {
      setEditProposal(current.proposal);
    }
  }, [current?.jobId]);

  const handleApprove = async () => {
    await submitReviewDecision(current.jobId, 'approve');
    setActiveReviewIndex((prev) => Math.min(prev, pendingReviews.length - 2));
  };

  const handleReviseAndApprove = async () => {
    await submitReviewDecision(current.jobId, 'update_and_approve', editProposal);
    setActiveReviewIndex((prev) => Math.min(prev, pendingReviews.length - 2));
  };

  const handleDiscard = async () => {
    await submitReviewDecision(current.jobId, 'discard');
    setActiveReviewIndex((prev) => Math.min(prev, pendingReviews.length - 2));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">Review Required</h2>
            <span className="px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 text-xs font-medium">
              {pendingReviews.length} pending
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>{activeReviewIndex + 1} of {pendingReviews.length}</span>
            <button
              onClick={() => setActiveReviewIndex((p) => Math.max(0, p - 1))}
              disabled={activeReviewIndex === 0}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30"
            >
              ←
            </button>
            <button
              onClick={() => setActiveReviewIndex((p) => Math.min(pendingReviews.length - 1, p + 1))}
              disabled={activeReviewIndex >= pendingReviews.length - 1}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30"
            >
              →
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-base font-medium text-zinc-200">{current.jobTitle}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{current.jobId}</p>
          </div>

          {/* Audit Report */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Auditor Report
            </h4>
            <pre className="text-sm text-red-300 whitespace-pre-wrap font-sans">
              {current.auditReport}
            </pre>
          </div>

          {/* Price */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-zinc-500 block mb-1">Price (PLN)</label>
              <div className="text-base font-semibold text-zinc-200">{current.price}</div>
            </div>
          </div>

          {/* Proposal */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-zinc-500">Proposal Content</label>
              <button
                onClick={() => setEditMode(!editMode)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {editMode ? 'Preview' : 'Edit'}
              </button>
            </div>
            {editMode ? (
              <textarea
                value={editProposal}
                onChange={(e) => setEditProposal(e.target.value)}
                className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 font-mono resize-none focus:outline-none focus:border-blue-600"
              />
            ) : (
              <pre className="w-full max-h-40 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 whitespace-pre-wrap font-sans">
                {editProposal}
              </pre>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={handleDiscard}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
          >
            <Trash2 size={14} />
            Discard Offer
          </button>
          <button
            onClick={handleApprove}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-sm font-medium transition-colors"
          >
            <Check size={14} />
            Approve & Execute
          </button>
          <button
            onClick={handleReviseAndApprove}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-700 text-blue-100 text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} />
            Apply Revisions & Execute
          </button>
        </div>
      </div>
    </div>
  );
}
