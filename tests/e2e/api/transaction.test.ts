// Copyright © Cedra Foundation
// SPDX-License-Identifier: Apache-2.0

import { Account, TransactionResponse, U64 } from "../../../src";
import { FUND_AMOUNT } from "../../unit/helper";
import { getCedraClient } from "../helper";
import { longWaitForTransaction } from "../../../src/internal/transaction";

// use it here since all tests use the same configuration
const { cedra } = getCedraClient();

describe("transaction api", () => {
  test("it queries for the network estimated gas price", async () => {
    const data = await cedra.getGasPriceEstimation();
    expect(data).toHaveProperty("gas_estimate");
    expect(data).toHaveProperty("deprioritized_gas_estimate");
    expect(data).toHaveProperty("prioritized_gas_estimate");
  });

  test("returns true when transaction is pending", async () => {
    const senderAccount = Account.generate();
    await cedra.fundAccount({ accountAddress: senderAccount.accountAddress, amount: FUND_AMOUNT });
    const bob = Account.generate();
    const rawTxn = await cedra.transaction.build.simple({
      sender: senderAccount.accountAddress,
      data: {
        function: "0x1::cedra_account::transfer",
        functionArguments: [bob.accountAddress, new U64(10)],
      },
    });
    const authenticator = cedra.transaction.sign({
      signer: senderAccount,
      transaction: rawTxn,
    });
    const response = await cedra.transaction.submit.simple({
      transaction: rawTxn,
      senderAuthenticator: authenticator,
    });
    const isPending = await cedra.isPendingTransaction({ transactionHash: response.hash });
    expect(isPending).toBeTruthy();
  });

  describe("fetch transaction queries", () => {
    let txn: TransactionResponse;
    beforeAll(async () => {
      const senderAccount = Account.generate();
      await cedra.fundAccount({ accountAddress: senderAccount.accountAddress, amount: FUND_AMOUNT });
      const bob = Account.generate();
      const rawTxn = await cedra.transaction.build.simple({
        sender: senderAccount.accountAddress,
        data: {
          function: "0x1::cedra_account::transfer",
          functionArguments: [bob.accountAddress, new U64(10)],
        },
      });
      const authenticator = cedra.transaction.sign({
        signer: senderAccount,
        transaction: rawTxn,
      });
      const response = await cedra.transaction.submit.simple({
        transaction: rawTxn,
        senderAuthenticator: authenticator,
      });
      txn = await cedra.waitForTransaction({ transactionHash: response.hash });
    });

    test("it queries for transactions on the chain", async () => {
      const transactions = await cedra.getTransactions();
      expect(transactions.length).toBeGreaterThan(0);
    });

    test("it queries for transactions by version", async () => {
      if (!("version" in txn)) {
        throw new Error("Transaction is still pending!");
      }

      const transaction = await cedra.getTransactionByVersion({
        ledgerVersion: Number(txn.version),
      });
      expect(transaction).toStrictEqual(txn);
    });

    test("it queries for transactions by hash", async () => {
      const transaction = await cedra.getTransactionByHash({
        transactionHash: txn.hash,
      });
      expect(transaction).toStrictEqual(txn);
    });
  });

  describe("long poll", () => {
    let txn: TransactionResponse;
    beforeAll(async () => {
      const senderAccount = Account.generate();
      await cedra.fundAccount({ accountAddress: senderAccount.accountAddress, amount: FUND_AMOUNT });
      const bob = Account.generate();
      const rawTxn = await cedra.transaction.build.simple({
        sender: senderAccount.accountAddress,
        data: {
          function: "0x1::cedra_account::transfer",
          functionArguments: [bob.accountAddress, 10],
        },
      });
      const authenticator = cedra.transaction.sign({
        signer: senderAccount,
        transaction: rawTxn,
      });
      const response = await cedra.transaction.submit.simple({
        transaction: rawTxn,
        senderAuthenticator: authenticator,
      });
      txn = await longWaitForTransaction({ cedraConfig: cedra.config, transactionHash: response.hash });
    });

    test("it queries for transactions by hash", async () => {
      const transaction = await cedra.getTransactionByHash({
        transactionHash: txn.hash,
      });
      expect(transaction).toStrictEqual(txn);
    });
  });

  describe("block APIs", () => {
    test("it fetches block data by block height", async () => {
      const blockHeight = 1;
      const blockData = await cedra.getBlockByHeight({ blockHeight });
      expect(blockData.block_height).toBe(blockHeight.toString());
      expect(blockData.transactions).toBe(null);
    });

    test("it fetches block data by block height with transactions", async () => {
      const info = await cedra.getLedgerInfo();
      const blockHeight = BigInt(info.block_height);
      const blockData = await cedra.getBlockByHeight({ blockHeight, options: { withTransactions: true } });
      expect(blockData.block_height).toBe(blockHeight.toString());
      const length = BigInt(blockData.transactions?.length ?? 0);

      const txnVersions = blockData.transactions!.map((txn) => BigInt((txn as any).version));
      // Check that every exists
      for (let i = 0; i < txnVersions.length - 1; i += 1) {
        expect(txnVersions[i]).toBe(txnVersions[i + 1] - 1n);
      }

      // Check the borders
      expect(txnVersions[0]).toBe(BigInt(blockData.first_version));
      expect(txnVersions[txnVersions.length - 1]).toBe(BigInt(blockData.last_version));

      // Check the length
      const expectedLength = BigInt(blockData.last_version) - BigInt(blockData.first_version) + 1n;
      expect(length).toBe(expectedLength);
    });

    test("it fetches block data by block version", async () => {
      const blockVersion = 1;
      const blockData = await cedra.getBlockByVersion({ ledgerVersion: blockVersion });
      expect(blockData.block_height).toBe(blockVersion.toString());
    });

    test("it fetches block data by block version with transactions", async () => {
      const info = await cedra.getLedgerInfo();
      const ledgerVersion = BigInt(info.ledger_version);
      const blockData = await cedra.getBlockByVersion({ ledgerVersion, options: { withTransactions: true } });
      expect(blockData.block_height).toBe(info.block_height.toString());
      const length = BigInt(blockData.transactions?.length ?? 0);

      const txnVersions = blockData.transactions!.map((txn) => BigInt((txn as any).version));
      // Check that every exists
      for (let i = 0; i < txnVersions.length - 1; i += 1) {
        expect(txnVersions[i]).toBe(txnVersions[i + 1] - 1n);
      }

      // Check the borders
      expect(txnVersions[0]).toBe(BigInt(blockData.first_version));
      expect(txnVersions[txnVersions.length - 1]).toBe(BigInt(blockData.last_version));

      // Check the length
      const expectedLength = BigInt(blockData.last_version) - BigInt(blockData.first_version) + 1n;
      expect(length).toBe(expectedLength);
    });
  });
});
