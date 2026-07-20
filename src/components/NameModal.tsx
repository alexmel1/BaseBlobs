/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';

interface NameModalProps {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onSave: (newName: string) => void;
}

export const NameModal: React.FC<NameModalProps> = ({
  isOpen,
  currentName,
  onClose,
  onSave,
}) => {
  const [nameInput, setNameInput] = useState(currentName);

  useEffect(() => {
    setNameInput(currentName);
  }, [currentName, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      onSave(trimmed);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-[#0d1535] border border-[#0078ff]/40 rounded-2xl p-6 w-full max-w-[320px] shadow-2xl">
        <h3 className="text-white text-base font-bold mb-4">✏️ Your trainer name</h3>
        <input
          type="text"
          className="w-full bg-white/5 border border-[#0078ff]/40 rounded-xl text-white text-sm px-4 py-3 outline-none focus:border-[#00aaff] transition-colors"
          maxLength={20}
          placeholder="Enter name…"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
          autoFocus
        />
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/10 hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#0066ff] to-[#00aaff] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
