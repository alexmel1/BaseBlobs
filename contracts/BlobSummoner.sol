// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BlobSummoner
 * @dev A lightweight smart contract on Base or B20 L2 to handle Blob Summoning transactions.
 * Designed with standard EVM compatibility so that Base Builder Codes can be safely 
 * appended as extra trailing calldata bytes without affecting execution.
 */
contract BlobSummoner {
    
    // Triggered when a new blob is summoned
    event BlobSummoned(address indexed summoner, string personality, uint256 timestamp);

    // Summons a blob.
    // The Base Builder Code is automatically appended to the calldata of this transaction.
    // Trailing calldata is safely ignored by standard EVM functions.
    function summonBlob(string memory personality) external payable {
        // The transaction can be 0 ETH (or custom payment)
        emit BlobSummoned(msg.sender, personality, block.timestamp);
    }
    
    // Fallback to support direct transfers with builder codes appended
    receive() external payable {}
}
