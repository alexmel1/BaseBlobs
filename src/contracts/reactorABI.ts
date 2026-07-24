export const BLOB_REACTOR_ABI = [
  // Admin
  {
    name: 'startEvent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'totalReward', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'setSynthesizing',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'merkleRoot', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'updateMerkleRoot',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newRoot', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'closeEvent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // Player
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'proof', type: 'bytes32[]' },
    ],
    outputs: [],
  },
  // View
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'canClaim',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getCurrentEvent',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'eventId',        type: 'uint256' },
        { name: 'merkleRoot',     type: 'bytes32' },
        { name: 'totalReward',    type: 'uint256' },
        { name: 'claimWindowEnd', type: 'uint256' },
        { name: 'active',         type: 'bool'    },
        { name: 'synthesizing',   type: 'bool'    },
      ],
    }],
  },
  {
    name: 'hasClaimed',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'eventId', type: 'uint256' },
      { name: 'player',  type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getClaimWindowEnd',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getContractBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  // Events
  {
    name: 'TokensClaimed',
    type: 'event',
    inputs: [
      { indexed: true,  name: 'eventId', type: 'uint256' },
      { indexed: true,  name: 'player',  type: 'address' },
      { indexed: false, name: 'amount',  type: 'uint256' },
    ],
  },
] as const;
