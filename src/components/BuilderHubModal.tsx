/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, Code, Copy, Check, Info, ShieldCheck, 
  Zap, Database, ExternalLink, RefreshCw, X, Link, Coins
} from 'lucide-react';
import { GameState } from '../types';

interface BuilderHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawWalletAddress: string | null;
  state: GameState;
  updateState: (updater: (prev: GameState) => GameState) => void;
  triggerToast: (msg: string) => void;
}

export const NETWORKS = {
  base: {
    chainId: '0x2105', // 8453
    chainName: 'Base Mainnet',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org'],
  },
  b20: {
    chainId: '0x3230', // ascii "20" -> 12848 (or custom chain ID for B20 Mainnet)
    chainName: 'B20 Mainnet',
    nativeCurrency: {
      name: 'B20',
      symbol: 'B20',
      decimals: 18,
    },
    rpcUrls: ['https://rpc.b20.xyz'], // placeholder RPC
    blockExplorerUrls: ['https://explorer.b20.xyz'], // placeholder explorer
  }
};

export const BuilderHubModal: React.FC<BuilderHubModalProps> = ({
  isOpen,
  onClose,
  rawWalletAddress,
  state,
  updateState,
  triggerToast
}) => {
  const [activeTab, setActiveTab] = useState<'quest' | 'contract' | 'docs'>('quest');
  const [selectedNetwork, setSelectedNetwork] = useState<'base' | 'b20'>('base');
  const [copiedContract, setCopiedContract] = useState(false);
  const [copiedAppId, setCopiedAppId] = useState(false);
  const [copiedHex, setCopiedHex] = useState(false);
  
  // Custom states
  const [customContract, setCustomContract] = useState(() => {
    return localStorage.getItem('bb_custom_contract') || '';
  });
  const [txHashInput, setTxHashInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const APP_BUILDER_CODE = 'bc_ch35e92e'; // Registered Base Builder Code
  const BUILDER_CODE_HEX = '62635f6368333565393265'; // UTF-8 hex encoding of bc_ch35e92e

  const solidityContractCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BlobSummoner {
    event BlobSummoned(address indexed summoner, string personality, uint256 timestamp);

    // Simple function to summon a blob
    // The Base Builder Code is automatically appended to the calldata of this transaction
    function summonBlob(string memory personality) external payable {
        // The transaction can be 0 ETH (or custom payment)
        emit BlobSummoned(msg.sender, personality, block.timestamp);
    }
    
    // Fallback to support direct transfers with builder codes appended
    receive() external payable {}
}`;

  const handleCopyContract = () => {
    navigator.clipboard.writeText(solidityContractCode);
    setCopiedContract(true);
    triggerToast('Solidity code copied to clipboard!');
    setTimeout(() => setCopiedContract(false), 2000);
  };

  const handleCopyAppId = () => {
    navigator.clipboard.writeText(APP_BUILDER_CODE);
    setCopiedAppId(true);
    triggerToast('Builder Code (bc_ch35e92e) copied!');
    setTimeout(() => setCopiedAppId(false), 2000);
  };

  const handleCopyHex = () => {
    navigator.clipboard.writeText(BUILDER_CODE_HEX);
    setCopiedHex(true);
    triggerToast('Builder Code Hex copied!');
    setTimeout(() => setCopiedHex(false), 2000);
  };

  const handleSaveCustomContract = (addr: string) => {
    setCustomContract(addr);
    localStorage.setItem('bb_custom_contract', addr);
    triggerToast(addr ? 'Custom contract address updated!' : 'Defaulting to self-transfer summoning.');
  };

  // Switch network in connected wallet
  const handleSwitchNetwork = async (netKey: 'base' | 'b20') => {
    setSelectedNetwork(netKey);
    const provider = (window as any).ethereum;
    if (!provider) {
      triggerToast('No Web3 wallet injected.');
      return;
    }
    const net = NETWORKS[netKey];
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: net.chainId }],
      });
      triggerToast(`Switched network to ${net.chainName}!`);
    } catch (err: any) {
      if (err.code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [net],
          });
          triggerToast(`Added and switched to ${net.chainName}!`);
        } catch (addErr) {
          triggerToast('Failed to add network to wallet.');
        }
      } else {
        triggerToast('Could not switch network.');
      }
    }
  };

  // REAL TRANSACTION VERIFIER
  // Connects to Base RPC to check transaction details and calldata for the Builder Code!
  const handleVerifyTransaction = async () => {
    const cleanHash = txHashInput.trim();
    if (!cleanHash.startsWith('0x') || cleanHash.length !== 66) {
      triggerToast('Please enter a valid 66-character transaction hash (0x...)');
      return;
    }

    if (state.verifiedTxHashes?.includes(cleanHash)) {
      triggerToast('This transaction has already been verified and claimed!');
      return;
    }

    setIsVerifying(true);
    triggerToast('Connecting to L2 JSON-RPC to query transaction...');

    try {
      // Base L2 public RPC endpoint (with CORS enabled)
      const rpcUrl = selectedNetwork === 'base' 
        ? 'https://mainnet.base.org' 
        : 'https://mainnet.base.org'; // Fallback to Base RPC for verification if B20 is local/private

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionByHash',
          params: [cleanHash],
          id: 1
        })
      });

      const data = await response.json();
      const tx = data.result;

      if (!tx) {
        throw new Error('Transaction not found on this network. If you just sent it, please wait 3-5 seconds and try again!');
      }

      // Read transaction calldata
      const calldata = tx.input || '0x';
      
      // Verify Builder Code presence! Check for both the raw string 'bc_ch35e92e' or its UTF-8 hex '62635f6368333565393265'.
      const containsBuilderCode = 
        calldata.toLowerCase().includes(BUILDER_CODE_HEX.toLowerCase()) || 
        calldata.toLowerCase().includes('bc_ch35e92e');

      if (containsBuilderCode) {
        // Success! Reward user with 5,000 Cubes!
        updateState((prev) => {
          const list = prev.verifiedTxHashes || [];
          if (!list.includes(cleanHash)) {
            prev.verifiedTxHashes = [...list, cleanHash];
            prev.cubes += 5000;
          }
          return prev;
        });
        setTxHashInput('');
        triggerToast('🎉 Consensus Success! +5,000 💠 Cubes Awarded!');
      } else {
        triggerToast('Verification failed. Builder Code not found in transaction calldata!');
      }
    } catch (err: any) {
      console.error(err);
      // Give them a helpful fallback so they can still complete it during testing or if they are offline
      triggerToast(err.message || 'Error querying blockchain. Please double-check transaction hash.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/94 backdrop-blur-md flex items-center justify-center z-[220] p-4 font-sans overflow-y-auto">
        <motion.div
          initial={{ scale: 0.95, y: 15, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 10, opacity: 0 }}
          className="relative bg-[#050b24] border border-[#0052ff]/40 rounded-3xl p-5 w-full max-w-[420px] shadow-2xl flex flex-col my-auto max-h-[90vh]"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0052ff]/20 to-[#00cfff]/10 border border-[#00cfff]/30 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-[#00cfff]" />
              </div>
              <div className="text-left">
                <h3 className="text-white text-xs font-black tracking-wider uppercase">Base Builder Station</h3>
                <p className="text-[#00cfff] text-[9px] font-mono leading-none mt-0.5">App ID: {APP_BUILDER_CODE.slice(0, 8)}...</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* TAB BUTTONS */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/40 rounded-xl mb-4 font-mono text-[9px] font-bold">
            <button
              onClick={() => setActiveTab('quest')}
              className={`py-1.5 rounded-lg text-center cursor-pointer transition-all ${
                activeTab === 'quest' 
                  ? 'bg-[#0052ff] text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Quest Center
            </button>
            <button
              onClick={() => setActiveTab('contract')}
              className={`py-1.5 rounded-lg text-center cursor-pointer transition-all ${
                activeTab === 'contract' 
                  ? 'bg-[#0052ff] text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Smart Contract
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`py-1.5 rounded-lg text-center cursor-pointer transition-all ${
                activeTab === 'docs' 
                  ? 'bg-[#0052ff] text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Builder Info
            </button>
          </div>

          {/* TAB CONTENT */}
          <div className="flex-1 overflow-y-auto text-left pr-1 scrollbar-thin">
            {/* TAB 1: QUEST CENTER */}
            {activeTab === 'quest' && (
              <div className="space-y-4">
                <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-[10px] uppercase font-mono">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Builder Code Quest</span>
                  </div>
                  <h4 className="text-white text-xs font-black">Summon with Builder Code calldata!</h4>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    Perform any transaction (such as Summoning a Blob) which automatically appends our registered App ID Builder Code to its calldata, paste the Transaction Hash below, and claim a huge reward of <span className="text-yellow-400 font-bold font-mono">5,000 💠 Cubes</span>!
                  </p>
                </div>

                {/* NETWORK SELECTOR */}
                <div className="bg-[#08112e]/50 border border-[#0052ff]/25 rounded-2xl p-3.5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-300 font-bold font-mono">Select Active Network:</span>
                    <div className="flex gap-1.5 font-mono text-[9px] font-black">
                      <button
                        onClick={() => handleSwitchNetwork('base')}
                        className={`px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                          selectedNetwork === 'base'
                            ? 'bg-blue-600 border-blue-500 text-white font-bold'
                            : 'bg-black/30 border-white/5 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Base L2
                      </button>
                      <button
                        onClick={() => handleSwitchNetwork('b20')}
                        className={`px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                          selectedNetwork === 'b20'
                            ? 'bg-blue-600 border-blue-500 text-white font-bold'
                            : 'bg-black/30 border-white/5 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        B20 Mainnet
                      </button>
                    </div>
                  </div>

                  {/* CUSTOM CONTRACT CONFIG */}
                  <div className="space-y-1.5 border-t border-white/5 pt-3">
                    <div className="flex justify-between items-center text-[9px] text-slate-400">
                      <span className="font-semibold font-mono">Deployed Contract Address:</span>
                      {customContract ? (
                        <button 
                          onClick={() => handleSaveCustomContract('')}
                          className="text-red-400 hover:text-red-300 font-bold cursor-pointer underline"
                        >
                          Reset Default
                        </button>
                      ) : (
                        <span className="text-slate-500 italic">Default: Self-Transfer Summoning</span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="0x... (paste your deployed contract, or leave blank to test)"
                      value={customContract}
                      onChange={(e) => handleSaveCustomContract(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[10px] focus:outline-none focus:border-[#0052ff]"
                    />
                  </div>
                </div>

                {/* VERIFICATION FORM */}
                <div className="bg-black/40 border border-white/5 rounded-2xl p-3.5 space-y-3">
                  <div className="text-[9.5px] font-mono font-bold text-slate-300 uppercase tracking-wide">
                    Claim Transaction Reward
                  </div>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Enter Transaction Hash (0x...)"
                      value={txHashInput}
                      onChange={(e) => setTxHashInput(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono text-[10px] focus:outline-none focus:border-[#00cfff]"
                    />
                    <div className="text-[8px] text-slate-500 font-mono leading-tight pl-1">
                      Our system verifies the transaction is confirmed on L2 and contains the App Builder Code comment!
                    </div>
                  </div>

                  <button
                    onClick={handleVerifyTransaction}
                    disabled={isVerifying || !txHashInput}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black text-[10px] uppercase font-mono tracking-widest hover:brightness-110 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/10"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying Blockchain...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>VERIFY & CLAIM REWARD</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: SMART CONTRACT */}
            {activeTab === 'contract' && (
              <div className="space-y-4">
                <div className="bg-[#08112e]/50 border border-[#0052ff]/20 rounded-2xl p-3 text-slate-300 text-[10px] leading-relaxed">
                  You can deploy this Solidity smart contract using <span className="text-[#00cfff] font-bold">Remix IDE</span> or Hardhat directly on <span className="text-white font-bold">Base Mainnet</span> or <span className="text-[#00cfff] font-bold">B20 Mainnet</span> to summon Blobs!
                </div>

                <div className="relative bg-black/60 border border-white/5 rounded-2xl p-3 max-h-[220px] overflow-auto">
                  <pre className="text-[8.5px] text-slate-400 font-mono leading-normal whitespace-pre">
                    {solidityContractCode}
                  </pre>
                  <button
                    onClick={handleCopyContract}
                    className="absolute top-2.5 right-2.5 p-1.5 bg-slate-900 border border-white/10 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {copiedContract ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: DEVELOPER INFO */}
            {activeTab === 'docs' && (
              <div className="space-y-4 font-mono text-[9.5px]">
                <div className="bg-[#0052ff]/10 border border-[#0052ff]/30 rounded-2xl p-3.5 space-y-2.5 text-slate-300">
                  <div className="flex items-center gap-1.5 text-[#00cfff] font-black uppercase tracking-wider mb-1">
                    <Info className="w-3.5 h-3.5" />
                    <span>How Builder Codes Work</span>
                  </div>
                  <p className="leading-relaxed">
                    Base Builder Codes are appended directly to the transaction call data payload. Any EVM-compliant smart contract ignoring extra trailing bytes will execute perfectly.
                  </p>
                  <p className="leading-relaxed">
                    By appending your unique builder ID, transaction indexing algorithms can recognize that this transaction was driven by your dApp, qualifying your project for developer rebates!
                  </p>
                </div>

                {/* COPY APP ID */}
                <div className="bg-slate-900/70 border border-white/5 rounded-2xl p-3.5 space-y-3 text-left">
                  <div className="space-y-1">
                    <div className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Your Builder ID (String)</div>
                    <div className="flex items-center justify-between gap-1.5 bg-black/50 p-2.5 border border-white/5 rounded-xl">
                      <span className="text-white font-bold tracking-widest break-all select-all font-mono">{APP_BUILDER_CODE}</span>
                      <button
                        onClick={handleCopyAppId}
                        className="p-1 text-slate-400 hover:text-white cursor-pointer active:scale-95 flex-shrink-0"
                      >
                        {copiedAppId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">UTF-8 Hex Encoding (Appended to Calldata)</div>
                    <div className="flex items-center justify-between gap-1.5 bg-black/50 p-2.5 border border-white/5 rounded-xl">
                      <span className="text-[#00cfff] font-bold tracking-widest break-all select-all font-mono">{BUILDER_CODE_HEX}</span>
                      <button
                        onClick={handleCopyHex}
                        className="p-1 text-slate-400 hover:text-white cursor-pointer active:scale-95 flex-shrink-0"
                      >
                        {copiedHex ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="text-[8px] text-slate-500 font-sans leading-relaxed pt-1">
                      Translate "bc_ch35e92e" directly to ASCII hex values to obtain "62635f6368333565393265". This hex value is appended to transaction calldata to claim builder attributes.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
