/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ToastProps {
  message: string;
  onClear: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClear }) => {
  const onClearRef = React.useRef(onClear);
  useEffect(() => {
    onClearRef.current = onClear;
  });

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => {
      onClearRef.current();
    }, 2800);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="absolute top-20 left-4 right-4 bg-gradient-to-r from-[#0b1636]/98 to-[#050b1e]/98 border border-[#0078ff]/40 rounded-xl px-4 py-3 text-white text-xs font-semibold z-[120] whitespace-normal break-words text-center shadow-2xl shadow-black/80 pointer-events-none flex items-center justify-center gap-2"
        >
          <span className="flex-shrink-0 text-sky-400">✨</span>
          <span className="leading-tight">{message}</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

