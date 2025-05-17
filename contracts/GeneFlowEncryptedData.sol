// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title GeneFlowEncryptedData
/// @notice Stores encrypted genetic data securely on-chain
/// @dev Only the owner of the data can decrypt it client-side with their wallet
contract GeneFlowEncryptedData {
    // Mapping from user address to their encrypted data
    mapping(address => bytes) private encryptedData;
    
    // Events
    event DataStored(address indexed user, uint256 dataLength);
    event DataDeleted(address indexed user);
    
    /// @notice Store encrypted genetic data
    /// @dev Overwrites any existing data for the sender
    /// @param data The encrypted SNP data (client-side encrypted with wallet-derived key)
    function storeData(bytes calldata data) external {
        require(data.length > 0, "Empty data not allowed");
        encryptedData[msg.sender] = data;
        emit DataStored(msg.sender, data.length);
    }
    
    /// @notice Retrieve encrypted genetic data for any address
    /// @dev The data can only be decrypted by the owner with their wallet
    /// @param user The address whose data to retrieve
    /// @return The encrypted data for the specified user
    function getData(address user) external view returns (bytes memory) {
        return encryptedData[user];
    }
    
    /// @notice Check if a user has stored data
    /// @param user The address to check
    /// @return True if the user has stored data
    function hasData(address user) external view returns (bool) {
        return encryptedData[user].length > 0;
    }
    
    /// @notice Delete stored data
    /// @dev Only the owner can delete their own data
    function deleteData() external {
        require(encryptedData[msg.sender].length > 0, "No data to delete");
        delete encryptedData[msg.sender];
        emit DataDeleted(msg.sender);
    }
    
    /// @notice Get the size of stored data for a user
    /// @param user The address to check
    /// @return The size of the stored encrypted data in bytes
    function getDataSize(address user) external view returns (uint256) {
        return encryptedData[user].length;
    }
} 