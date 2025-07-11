/* eslint-disable no-console */

/**
 * This example shows how to use the Cedra client to create accounts, fund them, and transfer between them.
 * Similar to ./simple_transfer.ts, but uses transferCoinTransaction to generate the transaction.
 */

import { Account, AccountAddress, Cedra, CedraConfig, Network, NetworkToNetworkName } from "@cedra-labs/ts-sdk";
import dotenv from "dotenv";
dotenv.config();

const ALICE_INITIAL_BALANCE = 100_000_000;
const BOB_INITIAL_BALANCE = 0;
const TRANSFER_AMOUNT = 1_000_000;

// Set up the client
const CEDRA_NETWORK: Network = NetworkToNetworkName[process.env.CEDRA_NETWORK ?? Network.DEVNET];
const config = new CedraConfig({ network: CEDRA_NETWORK });
const cedra = new Cedra(config);

/**
 * Prints the balance of an account
 * @param name
 * @param accountAddress
 * @param versionToWaitFor
 * @returns {Promise<number>}
 *
 */
const balance = async (name: string, accountAddress: AccountAddress, versionToWaitFor?: bigint): Promise<number> => {
  const amount = await cedra.getAccountCEDRAAmount({
    accountAddress,
    minimumLedgerVersion: versionToWaitFor,
  });
  console.log(`${name}'s balance is: ${amount}`);
  return amount;
};

const example = async () => {
  console.log(
    "This example will create two accounts (Alice and Bob), fund Alice, and transfer between them using transferCoinTransaction.",
  );

  // Create two accounts
  const alice = Account.generate();
  const bob = Account.generate();

  console.log("=== Addresses ===\n");
  console.log(`Alice's address is: ${alice.accountAddress}`);
  console.log(`Bob's address is: ${bob.accountAddress}`);

  // Fund the accounts
  console.log("\n=== Funding accounts ===\n");

  // Fund alice account
  await cedra.fundAccount({
    accountAddress: alice.accountAddress,
    amount: ALICE_INITIAL_BALANCE,
  });
  // Show the balances
  console.log("\n=== Initial Balances ===\n");
  const aliceBalance = await balance("Alice", alice.accountAddress);
  const bobBalance = await balance("Bob", bob.accountAddress);

  if (aliceBalance !== ALICE_INITIAL_BALANCE) throw new Error("Alice's balance is incorrect");
  if (bobBalance !== BOB_INITIAL_BALANCE) throw new Error("Bob's balance is incorrect");

  // Transfer between users
  console.log(`\n=== Transfer ${TRANSFER_AMOUNT} from Alice to Bob ===\n`);
  const transaction = await cedra.transferCoinTransaction({
    sender: alice.accountAddress,
    recipient: bob.accountAddress,
    amount: TRANSFER_AMOUNT,
  });
  const pendingTxn = await cedra.signAndSubmitTransaction({ signer: alice, transaction });
  const response = await cedra.waitForTransaction({ transactionHash: pendingTxn.hash });
  console.log(`Committed transaction: ${response.hash}`);

  console.log("\n=== Balances after transfer ===\n");
  const newAliceBalance = await balance("Alice", alice.accountAddress, BigInt(response.version));
  const newBobBalance = await balance("Bob", bob.accountAddress);

  // Bob should have the transfer amount
  if (newBobBalance !== TRANSFER_AMOUNT + BOB_INITIAL_BALANCE)
    throw new Error("Bob's balance after transfer is incorrect");

  // Alice should have the remainder minus gas
  if (newAliceBalance >= ALICE_INITIAL_BALANCE - TRANSFER_AMOUNT)
    throw new Error("Alice's balance after transfer is incorrect");
};

example();
