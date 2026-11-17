// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./UserRegistry.sol";

/// @title RecordRegistry
/// @notice Stores pointers (IPFS CID + file hash) to encrypted medical records
///         and enforces on-chain consent for who may access each one. The
///         blockchain never holds the file itself — only the hash/CID and the
///         access-control state, plus an immutable event log of every grant,
///         revoke, and upload as the audit trail.
contract RecordRegistry {
    UserRegistry public immutable userRegistry;

    struct Record {
        address owner; // patient who owns this record
        string cid; // IPFS content identifier of the encrypted file
        bytes32 fileHash; // SHA-256 hash of the (unencrypted) file, for integrity checks
        uint256 timestamp; // block timestamp the record was added
        bool exists;
    }

    // recordId => Record
    mapping(uint256 => Record) private records;
    /// @dev A consent grant: who may read, until when, and why.
    struct Grant {
        bool active;
        uint64 expiry; // unix seconds; 0 = no expiry (until revoked)
        string purpose; // e.g. "second opinion"
    }

    uint256 public constant MAX_PURPOSE_LENGTH = 128;

    // recordId => doctor address => consent grant
    mapping(uint256 => mapping(address => Grant)) private grants;
    // patient address => list of record IDs they own (for listing "my records")
    mapping(address => uint256[]) private recordsByOwner;

    uint256 private nextRecordId = 1;

    event RecordAdded(uint256 indexed recordId, address indexed owner, string cid, bytes32 fileHash, uint256 timestamp);
    event AccessGranted(
        uint256 indexed recordId,
        address indexed owner,
        address indexed doctor,
        uint64 expiry,
        string purpose
    );
    event AccessRevoked(uint256 indexed recordId, address indexed owner, address indexed doctor);
    /// @notice Proof that `accessor` was authorised and opened `recordId` at `timestamp`.
    ///         Emitted by recordAccess(); the backend releases content only after this is mined.
    event AccessReceipt(uint256 indexed recordId, address indexed owner, address indexed accessor, uint256 timestamp);

    error NotAPatient(address account);
    error NotADoctor(address account);
    error RecordDoesNotExist(uint256 recordId);
    error NotRecordOwner(uint256 recordId, address caller);
    error AccessDenied(uint256 recordId, address caller);
    error ExpiryInPast(uint64 expiry);
    error PurposeRequired();
    error PurposeTooLong(uint256 length);

    modifier onlyPatient() {
        if (!userRegistry.isPatient(msg.sender)) revert NotAPatient(msg.sender);
        _;
    }

    modifier onlyDoctor() {
        if (!userRegistry.isDoctor(msg.sender)) revert NotADoctor(msg.sender);
        _;
    }

    modifier recordExists(uint256 recordId) {
        if (!records[recordId].exists) revert RecordDoesNotExist(recordId);
        _;
    }

    modifier onlyRecordOwner(uint256 recordId) {
        if (records[recordId].owner != msg.sender) revert NotRecordOwner(recordId, msg.sender);
        _;
    }

    constructor(address userRegistryAddress) {
        userRegistry = UserRegistry(userRegistryAddress);
    }

    /// @notice Adds a new record pointer for the calling patient. The actual
    ///         file must already be encrypted and pinned to IPFS by the caller
    ///         (backend) before this is called — this only logs the pointer.
    function addRecord(string calldata cid, bytes32 fileHash) external onlyPatient returns (uint256 recordId) {
        recordId = nextRecordId++;
        records[recordId] = Record({
            owner: msg.sender,
            cid: cid,
            fileHash: fileHash,
            timestamp: block.timestamp,
            exists: true
        });
        recordsByOwner[msg.sender].push(recordId);

        emit RecordAdded(recordId, msg.sender, cid, fileHash, block.timestamp);
    }

    /// @notice Patient grants a doctor access to one of their records, bound to a
    ///         purpose and (optionally) an expiry. Re-granting replaces the previous
    ///         grant (e.g. to extend it). `expiry` is a unix timestamp; pass 0 for
    ///         "until revoked". Once the expiry passes, access ends on its own — no
    ///         revoke transaction needed.
    function grantAccess(uint256 recordId, address doctor, uint64 expiry, string calldata purpose)
        external
        onlyPatient
        recordExists(recordId)
        onlyRecordOwner(recordId)
    {
        if (!userRegistry.isDoctor(doctor)) revert NotADoctor(doctor);
        if (expiry != 0 && expiry <= block.timestamp) revert ExpiryInPast(expiry);
        uint256 len = bytes(purpose).length;
        if (len == 0) revert PurposeRequired();
        if (len > MAX_PURPOSE_LENGTH) revert PurposeTooLong(len);

        grants[recordId][doctor] = Grant({active: true, expiry: expiry, purpose: purpose});
        emit AccessGranted(recordId, msg.sender, doctor, expiry, purpose);
    }

    /// @notice Patient revokes a doctor's access to one of their records.
    ///         After this, checkAccess(doctor, recordId) returns false immediately —
    ///         there is no grace period or cached permission.
    function revokeAccess(uint256 recordId, address doctor)
        external
        onlyPatient
        recordExists(recordId)
        onlyRecordOwner(recordId)
    {
        delete grants[recordId][doctor];
        emit AccessRevoked(recordId, msg.sender, doctor);
    }

    /// @notice Returns whether `account` currently has access to `recordId`.
    ///         The record owner always has access to their own record; a doctor
    ///         has access only while a grant exists and has not expired.
    function checkAccess(address account, uint256 recordId) public view recordExists(recordId) returns (bool) {
        return _hasAccess(account, recordId);
    }

    /// @notice Returns the grant a doctor holds on a record (for the patient's UI).
    ///         `active` is true only if the grant exists AND has not expired.
    function getGrant(uint256 recordId, address doctor)
        external
        view
        recordExists(recordId)
        returns (bool active, uint64 expiry, string memory purpose)
    {
        Grant storage g = grants[recordId][doctor];
        return (_grantLive(g), g.expiry, g.purpose);
    }

    /// @notice Logs that the caller is opening `recordId`. Reverts unless the caller
    ///         is the owner or a doctor with a live grant. The backend calls this and
    ///         waits for it to be mined BEFORE releasing any file content, so every
    ///         release of a record is backed by an on-chain receipt.
    function recordAccess(uint256 recordId) external recordExists(recordId) {
        if (!_hasAccess(msg.sender, recordId)) revert AccessDenied(recordId, msg.sender);
        emit AccessReceipt(recordId, records[recordId].owner, msg.sender, block.timestamp);
    }

    /// @notice Returns the record's pointer data, if the caller is authorized.
    ///         Reverts if the caller (owner or granted doctor) is not authorized —
    ///         this is the on-chain gate the backend must pass before it will
    ///         fetch/decrypt the file from IPFS. (This is a free view call and leaves
    ///         no trace; the receipted path is recordAccess().)
    function getRecord(uint256 recordId)
        external
        view
        recordExists(recordId)
        returns (address owner, string memory cid, bytes32 fileHash, uint256 timestamp)
    {
        require(_hasAccess(msg.sender, recordId), "RecordRegistry: caller not authorized");
        Record storage r = records[recordId];
        return (r.owner, r.cid, r.fileHash, r.timestamp);
    }

    function _grantLive(Grant storage g) private view returns (bool) {
        return g.active && (g.expiry == 0 || block.timestamp < g.expiry);
    }

    function _hasAccess(address account, uint256 recordId) private view returns (bool) {
        if (records[recordId].owner == account) return true;
        return _grantLive(grants[recordId][account]);
    }

    /// @notice Lists the record IDs owned by `patient` (for the patient's own dashboard).
    function getRecordsByOwner(address patient) external view returns (uint256[] memory) {
        return recordsByOwner[patient];
    }
}
