/* eslint-disable no-console */
import dotenv from "dotenv";
dotenv.config();
import {
  Account,
  AccountAddress,
  AnyNumber,
  Cedra,
  CedraConfig,
  InputViewFunctionJsonData,
  MoveString,
  Network,
  NetworkToNetworkName,
  Serializable,
  Serializer,
  U64,
} from "@cedra-labs/ts-sdk";
import { compilePackage, getPackageBytesToPublish } from "./utils";

const ALICE_INITIAL_BALANCE = 100_000_000;
const BOB_INITIAL_BALANCE = 100_000_000;
const TRANSFER_AMOUNT = 10000;

// Default to devnet, but allow for overriding
const CEDRA_NETWORK: Network = NetworkToNetworkName[process.env.CEDRA_NETWORK ?? Network.DEVNET];

/**
 * Prints the balance of an account
 * @param cedra
 * @param name
 * @param address
 * @returns {Promise<*>}
 *
 */
const balance = async (cedra: Cedra, name: string, address: AccountAddress): Promise<any> => {
  const payload: InputViewFunctionJsonData = {
    function: "0x1::coin::balance",
    typeArguments: ["0x1::cedra_coin::CedraCoin"],
    functionArguments: [address.toString()],
  };
  const [balance] = await cedra.viewJson<[number]>({ payload: payload });

  console.log(`${name}'s balance is: ${balance}`);
  return Number(balance);
};

/**
 * Matches the on-chain <address>::claims::Claim struct
 */
export class Claim extends Serializable {
  // Contract's address
  public readonly contractAddress: AccountAddress;

  // Module name, i.e: 0x1::account
  public readonly moduleName: MoveString = new MoveString("claims");

  // The struct name
  public readonly structName: MoveString = new MoveString("Claim");

  // Signer's address
  public readonly sender: AccountAddress;

  // Receiver's address
  public readonly receiver: AccountAddress;

  // Claim number
  public readonly claimNumber: U64;

  constructor(args: {
    contractAddress: AccountAddress;
    sender: AccountAddress;
    receiver: AccountAddress;
    claimNumber: AnyNumber;
  }) {
    super();
    this.contractAddress = args.contractAddress;
    this.sender = args.sender;
    this.receiver = args.receiver;
    this.claimNumber = new U64(args.claimNumber);
  }

  serialize(serializer: Serializer): void {
    serializer.serialize(this.contractAddress);
    serializer.serialize(this.moduleName);
    serializer.serialize(this.structName);
    serializer.serialize(this.sender);
    serializer.serialize(this.receiver);
    serializer.serialize(this.claimNumber);
  }
}

const example = async () => {
  console.log("This example will publish a contract, and show how to sign a struct and prove it on-chain");

  // Set up the client
  const config = new CedraConfig({ network: CEDRA_NETWORK });
  const cedra = new Cedra(config);

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
    amount: ALICE_INITIAL_BALANCE,
  });

  await cedra.fundAccount({
    accountAddress: bob.accountAddress,
    amount: BOB_INITIAL_BALANCE,
  });

  // Show the balances
  console.log("\n=== Balances ===\n");
  const aliceBalance = await balance(cedra, "Alice", alice.accountAddress);
  const bobBalance = await balance(cedra, "Bob", bob.accountAddress);

  if (aliceBalance !== ALICE_INITIAL_BALANCE) throw new Error("Alice's balance is incorrect");
  if (bobBalance !== BOB_INITIAL_BALANCE) throw new Error("Bob's balance is incorrect");

  console.log("\n=== Compiling the package locally ===");
  compilePackage("move/claims", "move/claims/claims.json", [{ name: "my_addr", address: alice.accountAddress }]);

  const { metadataBytes, byteCode } = getPackageBytesToPublish("move/claims/claims.json");

  console.log("\n===Publishing Claims package===");
  const transaction = await cedra.publishPackageTransaction({
    account: alice.accountAddress,
    metadataBytes,
    moduleBytecode: byteCode,
  });
  const response = await cedra.signAndSubmitTransaction({
    signer: alice,
    transaction,
  });
  console.log(`Transaction hash: ${response.hash}`);
  await cedra.waitForTransaction({
    transactionHash: response.hash,
  });

  console.log("\n=== Balances after publish of package ===\n");
  await balance(cedra, "Alice", alice.accountAddress);
  await balance(cedra, "Bob", bob.accountAddress);

  // Setup a claim
  const createClaim = await cedra.transaction.build.simple({
    sender: alice.accountAddress,
    data: {
      function: `${alice.accountAddress.toString()}::claims::create_claim`,
      functionArguments: [TRANSFER_AMOUNT],
    },
  });
  const createClaimResponse = await cedra.signAndSubmitTransaction({
    signer: alice,
    transaction: createClaim,
  });
  console.log(`Create Claim Transaction hash: ${createClaimResponse.hash}`);
  await cedra.waitForTransaction({
    transactionHash: createClaimResponse.hash,
  });

  console.log("\n=== Balances after creating claim ===\n");
  await balance(cedra, "Alice", alice.accountAddress);
  await balance(cedra, "Bob", bob.accountAddress);

  // Claim the coins
  const claim = new Claim({
    contractAddress: alice.accountAddress,
    sender: alice.accountAddress,
    receiver: bob.accountAddress,
    claimNumber: 0,
  });
  const serializer = new Serializer();
  serializer.serialize(claim);
  const signature = alice.sign(serializer.toUint8Array());

  const claimCoins = await cedra.transaction.build.simple({
    sender: bob.accountAddress,
    data: {
      function: `${alice.accountAddress.toString()}::claims::claim`,
      functionArguments: [alice.accountAddress, 0, alice.publicKey.toUint8Array(), signature.toUint8Array()],
    },
  });
  const claimCoinsResponse = await cedra.signAndSubmitTransaction({
    signer: bob,
    transaction: claimCoins,
  });
  console.log(`Claim Coins Transaction hash: ${claimCoinsResponse.hash}`);
  await cedra.waitForTransaction({
    transactionHash: claimCoinsResponse.hash,
  });

  console.log("\n=== Balances after claiming ===\n");
  await balance(cedra, "Alice", alice.accountAddress);
  await balance(cedra, "Bob", bob.accountAddress);
};

example();
