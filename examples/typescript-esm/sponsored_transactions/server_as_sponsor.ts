/* eslint-disable no-console */

/**
 * This example demonstrates how one can use an external server
 * as a sponsor to sign a transaction to eventually pay the gas fees.
 *
 * A server (for example, frontend) generates a transaction, have it serialized and send
 * it to another server (for example, backend) to deserialize and signs as the sponsor,
 * then sends it back to the other server (the frontend server) to submit the transaction.
 */
import dotenv from "dotenv";
dotenv.config();
import {
  Account,
  AccountAuthenticator,
  Cedra,
  CedraConfig,
  Deserializer,
  Network,
  NetworkToNetworkName,
  SimpleTransaction,
} from "@cedra-labs/ts-sdk";

const INITIAL_BALANCE = 100_000_000;
const TRANSFER_AMOUNT = 100;

// Default to devnet, but allow for overriding
const CEDRA_NETWORK: Network = NetworkToNetworkName[process.env.CEDRA_NETWORK] || Network.DEVNET;
// Set up the client
const config = new CedraConfig({ network: CEDRA_NETWORK });
const cedra = new Cedra(config);

// The sponsor server gets the serialized transaction to sign as the fee payer
const sendToTheSponsorServer = async (transactionBytes: Uint8Array) => {
  const sponsor = Account.generate();
  console.log(`Sponsor's address is: ${sponsor.accountAddress}`);
  await cedra.fundAccount({ accountAddress: sponsor.accountAddress, amount: INITIAL_BALANCE });

  // deserialize raw transaction
  const deserializer = new Deserializer(transactionBytes);
  const transaction = SimpleTransaction.deserialize(deserializer);

  // Sponsor signs
  const sponsorAuth = cedra.transaction.signAsFeePayer({
    signer: sponsor,
    transaction,
  });

  const sponsorAuthBytes = sponsorAuth.bcsToBytes();

  return { sponsorAuthBytes, signedTransaction: transaction };
};

const example = async () => {
  // Create two accounts
  const alice = Account.generate();
  const bob = Account.generate();

  console.log("=== Addresses ===\n");
  console.log(`Alice's address is: ${alice.accountAddress}`);
  console.log(`Bob's address is: ${bob.accountAddress}`);

  // Fund the accounts
  console.log("\n=== Funding accounts ===\n");

  await cedra.fundAccount({
    accountAddress: alice.accountAddress,
    amount: INITIAL_BALANCE,
  });

  console.log("\n=== Accounts funded ===\n");

  const transaction = await cedra.transaction.build.simple({
    sender: alice.accountAddress,
    withFeePayer: true,
    data: {
      function: "0x1::cedra_account::transfer",
      functionArguments: [bob.accountAddress, TRANSFER_AMOUNT],
    },
  });

  // Alice signs
  const senderAuth = cedra.transaction.sign({ signer: alice, transaction });

  // Send the serialized transaction to the sponsor server to sign
  const { sponsorAuthBytes, signedTransaction } = await sendToTheSponsorServer(transaction.bcsToBytes());

  // deserialize fee payer authenticator
  const deserializer = new Deserializer(sponsorAuthBytes);
  const feePayerAuthenticator = AccountAuthenticator.deserialize(deserializer);

  const response = await cedra.transaction.submit.simple({
    transaction: signedTransaction,
    senderAuthenticator: senderAuth,
    feePayerAuthenticator,
  });

  const executedTransaction = await cedra.waitForTransaction({ transactionHash: response.hash });
  console.log("executed transaction", executedTransaction.hash);
};

example();
