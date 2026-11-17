const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("RecordRegistry", function () {
  let userRegistry, recordRegistry;
  let admin, patient, doctor, otherDoctor, stranger;

  const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
  const fileHash = ethers.keccak256(ethers.toUtf8Bytes("test file contents"));
  const purpose = "second opinion";
  const NO_EXPIRY = 0n;

  beforeEach(async function () {
    [admin, patient, doctor, otherDoctor, stranger] = await ethers.getSigners();

    const UserRegistry = await ethers.getContractFactory("UserRegistry");
    userRegistry = await UserRegistry.deploy(admin.address);

    const RecordRegistry = await ethers.getContractFactory("RecordRegistry");
    recordRegistry = await RecordRegistry.deploy(await userRegistry.getAddress());

    await userRegistry.connect(patient).registerAsPatient();
    await userRegistry.connect(admin).registerDoctor(doctor.address);
    await userRegistry.connect(admin).registerDoctor(otherDoctor.address);
  });

  describe("addRecord", function () {
    it("lets a registered patient add a record and emits RecordAdded", async function () {
      const tx = await recordRegistry.connect(patient).addRecord(cid, fileHash);
      await expect(tx).to.emit(recordRegistry, "RecordAdded");

      const ids = await recordRegistry.getRecordsByOwner(patient.address);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(1n);
    });

    it("rejects addRecord from a non-patient", async function () {
      await expect(recordRegistry.connect(stranger).addRecord(cid, fileHash)).to.be.revertedWithCustomError(
        recordRegistry,
        "NotAPatient"
      );
    });
  });

  describe("grantAccess / checkAccess", function () {
    let recordId;

    beforeEach(async function () {
      await recordRegistry.connect(patient).addRecord(cid, fileHash);
      recordId = 1n;
    });

    it("owner always has access to their own record", async function () {
      expect(await recordRegistry.checkAccess(patient.address, recordId)).to.equal(true);
    });

    it("doctor has no access before being granted", async function () {
      expect(await recordRegistry.checkAccess(doctor.address, recordId)).to.equal(false);
    });

    it("lets the owner grant a doctor access and emits AccessGranted", async function () {
      await expect(recordRegistry.connect(patient).grantAccess(recordId, doctor.address, NO_EXPIRY, purpose))
        .to.emit(recordRegistry, "AccessGranted")
        .withArgs(recordId, patient.address, doctor.address, NO_EXPIRY, purpose);

      expect(await recordRegistry.checkAccess(doctor.address, recordId)).to.equal(true);
    });

    it("rejects granting access to an address that is not a registered doctor", async function () {
      await expect(recordRegistry.connect(patient).grantAccess(recordId, stranger.address, NO_EXPIRY, purpose)).to.be.revertedWithCustomError(
        recordRegistry,
        "NotADoctor"
      );
    });

    it("rejects grantAccess from a different patient who does not own the record", async function () {
      await userRegistry.connect(stranger).registerAsPatient();
      await expect(
        recordRegistry.connect(stranger).grantAccess(recordId, doctor.address, NO_EXPIRY, purpose)
      ).to.be.revertedWithCustomError(
        recordRegistry,
        "NotRecordOwner"
      );
    });

    it("rejects grantAccess for a record that does not exist", async function () {
      await expect(recordRegistry.connect(patient).grantAccess(999, doctor.address, NO_EXPIRY, purpose)).to.be.revertedWithCustomError(
        recordRegistry,
        "RecordDoesNotExist"
      );
    });
  });

  describe("revokeAccess — the grant then deny flow", function () {
    let recordId;

    beforeEach(async function () {
      await recordRegistry.connect(patient).addRecord(cid, fileHash);
      recordId = 1n;
      await recordRegistry.connect(patient).grantAccess(recordId, doctor.address, NO_EXPIRY, purpose);
    });

    it("doctor can access the record once granted", async function () {
      expect(await recordRegistry.checkAccess(doctor.address, recordId)).to.equal(true);
      const record = await recordRegistry.connect(doctor).getRecord(recordId);
      expect(record.cid).to.equal(cid);
    });

    it("revoking access emits AccessRevoked and immediately denies the doctor", async function () {
      await expect(recordRegistry.connect(patient).revokeAccess(recordId, doctor.address))
        .to.emit(recordRegistry, "AccessRevoked")
        .withArgs(recordId, patient.address, doctor.address);

      expect(await recordRegistry.checkAccess(doctor.address, recordId)).to.equal(false);
      await expect(recordRegistry.connect(doctor).getRecord(recordId)).to.be.revertedWith(
        "RecordRegistry: caller not authorized"
      );
    });

    it("rejects revokeAccess from a different patient who does not own the record", async function () {
      await userRegistry.connect(stranger).registerAsPatient();
      await expect(recordRegistry.connect(stranger).revokeAccess(recordId, doctor.address)).to.be.revertedWithCustomError(
        recordRegistry,
        "NotRecordOwner"
      );
    });
  });

  describe("getRecord", function () {
    it("reverts for an unauthorized caller", async function () {
      await recordRegistry.connect(patient).addRecord(cid, fileHash);
      await expect(recordRegistry.connect(stranger).getRecord(1)).to.be.revertedWith(
        "RecordRegistry: caller not authorized"
      );
    });

    it("returns full record data for the owner", async function () {
      await recordRegistry.connect(patient).addRecord(cid, fileHash);
      const record = await recordRegistry.connect(patient).getRecord(1);
      expect(record.owner).to.equal(patient.address);
      expect(record.cid).to.equal(cid);
      expect(record.fileHash).to.equal(fileHash);
    });
  });

  describe("purpose- and time-bound grants", function () {
    const recordId = 1n;

    beforeEach(async function () {
      await recordRegistry.connect(patient).addRecord(cid, fileHash);
    });

    it("stores the purpose and expiry and exposes them via getGrant", async function () {
      const expiry = BigInt((await time.latest()) + 3600);
      await recordRegistry.connect(patient).grantAccess(recordId, doctor.address, expiry, purpose);
      const g = await recordRegistry.getGrant(recordId, doctor.address);
      expect(g.active).to.equal(true);
      expect(g.expiry).to.equal(expiry);
      expect(g.purpose).to.equal(purpose);
    });

    it("access ends on its own once the expiry passes, with no revoke transaction", async function () {
      const expiry = BigInt((await time.latest()) + 3600);
      await recordRegistry.connect(patient).grantAccess(recordId, doctor.address, expiry, purpose);
      expect(await recordRegistry.checkAccess(doctor.address, recordId)).to.equal(true);

      await time.increaseTo(expiry); // exactly at expiry -> expired
      expect(await recordRegistry.checkAccess(doctor.address, recordId)).to.equal(false);
      await expect(recordRegistry.connect(doctor).getRecord(recordId)).to.be.revertedWith(
        "RecordRegistry: caller not authorized"
      );
      await expect(recordRegistry.connect(doctor).recordAccess(recordId)).to.be.revertedWithCustomError(
        recordRegistry,
        "AccessDenied"
      );
      expect((await recordRegistry.getGrant(recordId, doctor.address)).active).to.equal(false);
    });

    it("expiry 0 means the grant lasts until revoked", async function () {
      await recordRegistry.connect(patient).grantAccess(recordId, doctor.address, NO_EXPIRY, purpose);
      await time.increase(10 * 365 * 24 * 3600);
      expect(await recordRegistry.checkAccess(doctor.address, recordId)).to.equal(true);
    });

    it("re-granting replaces the old grant, so an expired grant can be extended", async function () {
      const first = BigInt((await time.latest()) + 100);
      await recordRegistry.connect(patient).grantAccess(recordId, doctor.address, first, purpose);
      await time.increaseTo(first);
      expect(await recordRegistry.checkAccess(doctor.address, recordId)).to.equal(false);

      const second = BigInt((await time.latest()) + 3600);
      await recordRegistry.connect(patient).grantAccess(recordId, doctor.address, second, "follow-up");
      expect(await recordRegistry.checkAccess(doctor.address, recordId)).to.equal(true);
      expect((await recordRegistry.getGrant(recordId, doctor.address)).purpose).to.equal("follow-up");
    });

    it("revoking clears the grant including its purpose", async function () {
      await recordRegistry.connect(patient).grantAccess(recordId, doctor.address, NO_EXPIRY, purpose);
      await recordRegistry.connect(patient).revokeAccess(recordId, doctor.address);
      const g = await recordRegistry.getGrant(recordId, doctor.address);
      expect(g.active).to.equal(false);
      expect(g.purpose).to.equal("");
    });

    it("rejects an expiry that is already in the past", async function () {
      const past = BigInt((await time.latest()) - 10);
      await expect(
        recordRegistry.connect(patient).grantAccess(recordId, doctor.address, past, purpose)
      ).to.be.revertedWithCustomError(recordRegistry, "ExpiryInPast");
    });

    it("rejects an empty purpose", async function () {
      await expect(
        recordRegistry.connect(patient).grantAccess(recordId, doctor.address, NO_EXPIRY, "")
      ).to.be.revertedWithCustomError(recordRegistry, "PurposeRequired");
    });

    it("rejects a purpose longer than the cap", async function () {
      await expect(
        recordRegistry.connect(patient).grantAccess(recordId, doctor.address, NO_EXPIRY, "x".repeat(129))
      ).to.be.revertedWithCustomError(recordRegistry, "PurposeTooLong");
    });

    it("a grant to one doctor does not leak to another", async function () {
      await recordRegistry.connect(patient).grantAccess(recordId, doctor.address, NO_EXPIRY, purpose);
      expect(await recordRegistry.checkAccess(otherDoctor.address, recordId)).to.equal(false);
    });
  });

  describe("recordAccess - receipted reads", function () {
    const recordId = 1n;

    beforeEach(async function () {
      await recordRegistry.connect(patient).addRecord(cid, fileHash);
      await recordRegistry.connect(patient).grantAccess(recordId, doctor.address, NO_EXPIRY, purpose);
    });

    it("a granted doctor gets an AccessReceipt with owner, accessor and block timestamp", async function () {
      const tx = await recordRegistry.connect(doctor).recordAccess(recordId);
      const block = await ethers.provider.getBlock((await tx.wait()).blockNumber);
      await expect(tx)
        .to.emit(recordRegistry, "AccessReceipt")
        .withArgs(recordId, patient.address, doctor.address, block.timestamp);
    });

    it("the owner can also log an access of their own record", async function () {
      const tx = await recordRegistry.connect(patient).recordAccess(recordId);
      const block = await ethers.provider.getBlock((await tx.wait()).blockNumber);
      await expect(tx)
        .to.emit(recordRegistry, "AccessReceipt")
        .withArgs(recordId, patient.address, patient.address, block.timestamp);
    });

    it("every call emits its own receipt (no de-duplication)", async function () {
      await recordRegistry.connect(doctor).recordAccess(recordId);
      await recordRegistry.connect(doctor).recordAccess(recordId);
      const logs = await recordRegistry.queryFilter(recordRegistry.filters.AccessReceipt(recordId));
      expect(logs.length).to.equal(2);
    });

    it("receipts can be filtered by owner (the patient's 'who read my records' view)", async function () {
      await recordRegistry.connect(doctor).recordAccess(recordId);
      const mine = await recordRegistry.queryFilter(recordRegistry.filters.AccessReceipt(null, patient.address));
      const notMine = await recordRegistry.queryFilter(recordRegistry.filters.AccessReceipt(null, stranger.address));
      expect(mine.length).to.equal(1);
      expect(notMine.length).to.equal(0);
    });

    it("rejects a doctor who was never granted access", async function () {
      await expect(recordRegistry.connect(otherDoctor).recordAccess(recordId)).to.be.revertedWithCustomError(
        recordRegistry,
        "AccessDenied"
      );
    });

    it("rejects a doctor after revocation", async function () {
      await recordRegistry.connect(patient).revokeAccess(recordId, doctor.address);
      await expect(recordRegistry.connect(doctor).recordAccess(recordId)).to.be.revertedWithCustomError(
        recordRegistry,
        "AccessDenied"
      );
    });

    it("rejects a stranger and emits no receipt", async function () {
      await expect(recordRegistry.connect(stranger).recordAccess(recordId)).to.be.revertedWithCustomError(
        recordRegistry,
        "AccessDenied"
      );
      const logs = await recordRegistry.queryFilter(recordRegistry.filters.AccessReceipt());
      expect(logs.length).to.equal(0);
    });

    it("rejects a record that does not exist", async function () {
      await expect(recordRegistry.connect(doctor).recordAccess(999)).to.be.revertedWithCustomError(
        recordRegistry,
        "RecordDoesNotExist"
      );
    });
  });

  describe("getRecordsByOwner", function () {
    it("lists multiple records for the same owner in order added", async function () {
      await recordRegistry.connect(patient).addRecord(cid, fileHash);
      await recordRegistry.connect(patient).addRecord("secondcid", fileHash);
      const ids = await recordRegistry.getRecordsByOwner(patient.address);
      expect(ids).to.deep.equal([1n, 2n]);
    });

    it("returns an empty list for an address with no records", async function () {
      const ids = await recordRegistry.getRecordsByOwner(stranger.address);
      expect(ids.length).to.equal(0);
    });
  });
});
