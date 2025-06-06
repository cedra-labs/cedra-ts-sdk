/* eslint-disable no-console */
/* eslint-disable max-len */
import dotenv from "dotenv";
dotenv.config();
import {
  Account,
  AccountAddress,
  AnyNumber,
  Cedra,
  CedraConfig,
  InputViewFunctionData,
  Network,
  NetworkToNetworkName,
} from "@cedra-labs/ts-sdk";
import { compilePackage, getPackageBytesToPublish } from "./utils";
/**
 * This example demonstrate how one can compile, deploy, and mint its own fungible asset (FA)
 * It uses the fa_coin.move module that can be found in the move folder
 *
 * Before running this example, we should compile the package locally:
 * 1. Acquire the Cedra CLI, see https://cedra.dev/tools/cedra-cli/
 * 2. cd `~/cedra-ts-sdk/examples/typescript`
 * 3. Run `pnpm run your_fungible_asset`
 */

// Set up the client
const CEDRA_NETWORK: Network = NetworkToNetworkName[process.env.CEDRA_NETWORK ?? Network.DEVNET];
const config = new CedraConfig({ network: CEDRA_NETWORK });
const cedra = new Cedra(config);

/** Admin forcefully transfers the newly created coin to the specified receiver address */
async function transferCoin(
  admin: Account,
  fromAddress: AccountAddress,
  toAddress: AccountAddress,
  amount: AnyNumber,
): Promise<string> {
  const transaction = await cedra.transaction.build.simple({
    sender: admin.accountAddress,
    data: {
      function: `${admin.accountAddress}::fa_coin::transfer`,
      functionArguments: [fromAddress, toAddress, amount],
    },
  });

  const senderAuthenticator = cedra.transaction.sign({ signer: admin, transaction });
  const pendingTxn = await cedra.transaction.submit.simple({ transaction, senderAuthenticator });

  return pendingTxn.hash;
}

/** Admin mint the newly created coin to the specified receiver address */
async function mintCoin(admin: Account, receiver: Account, amount: AnyNumber): Promise<string> {
  const transaction = await cedra.transaction.build.simple({
    sender: admin.accountAddress,
    data: {
      function: `${admin.accountAddress}::fa_coin::mint`,
      functionArguments: [receiver.accountAddress, amount],
    },
  });

  const senderAuthenticator = cedra.transaction.sign({ signer: admin, transaction });
  const pendingTxn = await cedra.transaction.submit.simple({ transaction, senderAuthenticator });

  return pendingTxn.hash;
}

/** Admin burns the newly created coin from the specified receiver address */
async function burnCoin(admin: Account, fromAddress: AccountAddress, amount: AnyNumber): Promise<string> {
  const transaction = await cedra.transaction.build.simple({
    sender: admin.accountAddress,
    data: {
      function: `${admin.accountAddress}::fa_coin::burn`,
      functionArguments: [fromAddress, amount],
    },
  });

  const senderAuthenticator = cedra.transaction.sign({ signer: admin, transaction });
  const pendingTxn = await cedra.transaction.submit.simple({ transaction, senderAuthenticator });

  return pendingTxn.hash;
}

/** Admin freezes the primary fungible store of the specified account */
async function freeze(admin: Account, targetAddress: AccountAddress): Promise<string> {
  const transaction = await cedra.transaction.build.simple({
    sender: admin.accountAddress,
    data: {
      function: `${admin.accountAddress}::fa_coin::freeze_account`,
      functionArguments: [targetAddress],
    },
  });

  const senderAuthenticator = cedra.transaction.sign({ signer: admin, transaction });
  const pendingTxn = await cedra.transaction.submit.simple({ transaction, senderAuthenticator });

  return pendingTxn.hash;
}

/** Admin unfreezes the primary fungible store of the specified account */
async function unfreeze(admin: Account, targetAddress: AccountAddress): Promise<string> {
  const transaction = await cedra.transaction.build.simple({
    sender: admin.accountAddress,
    data: {
      function: `${admin.accountAddress}::fa_coin::unfreeze_account`,
      functionArguments: [targetAddress],
    },
  });

  const senderAuthenticator = cedra.transaction.sign({ signer: admin, transaction });
  const pendingTxn = await cedra.transaction.submit.simple({ transaction, senderAuthenticator });

  return pendingTxn.hash;
}

const getFaBalance = async (owner: Account, assetType: string): Promise<number> => {
  const data = await cedra.getCurrentFungibleAssetBalances({
    options: {
      where: {
        owner_address: { _eq: owner.accountAddress.toStringLong() },
        asset_type: { _eq: assetType },
      },
    },
  });

  return data[0]?.amount ?? 0;
};

/** Return the address of the managed fungible asset that's created when this module is deployed */
async function getMetadata(admin: Account): Promise<string> {
  const payload: InputViewFunctionData = {
    function: `${admin.accountAddress}::fa_coin::get_metadata`,
    functionArguments: [],
  };
  const res = (await cedra.view<[{ inner: string }]>({ payload }))[0];
  return res.inner;
}

async function main() {
  const alice = Account.generate();
  const bob = Account.generate();
  const charlie = Account.generate();

  console.log("\n=== Addresses ===");
  console.log(`Alice: ${alice.accountAddress.toString()}`);
  console.log(`Bob: ${bob.accountAddress.toString()}`);
  console.log(`Charlie: ${charlie.accountAddress.toString()}`);

  await cedra.fundAccount({ accountAddress: alice.accountAddress, amount: 100_000_000 });
  await cedra.fundAccount({
    accountAddress: bob.accountAddress,
    amount: 100_000_000,
  });

  console.log("\n=== Compiling FACoin package locally ===");
  compilePackage("move/facoin", "move/facoin/facoin.json", [{ name: "FACoin", address: alice.accountAddress }]);

  const { metadataBytes, byteCode } = getPackageBytesToPublish("move/facoin/facoin.json");

  console.log("\n===Publishing FACoin package===");
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

  const metadataAddress = await getMetadata(alice);
  console.log("metadata address:", metadataAddress);

  console.log("All the balances in this example refer to balance in primary fungible stores of each account.");
  console.log(`Alice's initial FACoin balance: ${await getFaBalance(alice, metadataAddress)}.`);
  console.log(`Bob's initial FACoin balance: ${await getFaBalance(bob, metadataAddress)}.`);
  console.log(`Charlie's initial balance: ${await getFaBalance(charlie, metadataAddress)}.`);

  console.log("Alice mints Charlie 100 coins.");
  const mintCoinTransactionHash = await mintCoin(alice, charlie, 100);

  await cedra.waitForTransaction({ transactionHash: mintCoinTransactionHash });
  console.log(
    `Charlie's updated FACoin primary fungible store balance: ${await getFaBalance(charlie, metadataAddress)}.`,
  );

  console.log("Alice freezes Bob's account.");
  const freezeTransactionHash = await freeze(alice, bob.accountAddress);
  await cedra.waitForTransaction({ transactionHash: freezeTransactionHash });

  console.log(
    "Alice as the admin forcefully transfers the newly minted coins of Charlie to Bob ignoring that Bob's account is frozen.",
  );
  const transferCoinTransactionHash = await transferCoin(alice, charlie.accountAddress, bob.accountAddress, 100);
  await cedra.waitForTransaction({ transactionHash: transferCoinTransactionHash });
  console.log(`Bob's updated FACoin balance: ${await getFaBalance(bob, metadataAddress)}.`);

  console.log("Alice unfreezes Bob's account.");
  const unfreezeTransactionHash = await unfreeze(alice, bob.accountAddress);
  await cedra.waitForTransaction({ transactionHash: unfreezeTransactionHash });

  console.log("Alice burns 50 coins from Bob.");
  const burnCoinTransactionHash = await burnCoin(alice, bob.accountAddress, 50);
  await cedra.waitForTransaction({ transactionHash: burnCoinTransactionHash });
  console.log(`Bob's updated FACoin balance: ${await getFaBalance(bob, metadataAddress)}.`);

  /// Normal fungible asset transfer between primary stores
  console.log("Bob transfers 10 coins to Alice as the owner.");
  const transferFungibleAssetRawTransaction = await cedra.transferFungibleAsset({
    sender: bob,
    fungibleAssetMetadataAddress: AccountAddress.from(metadataAddress),
    recipient: alice.accountAddress,
    amount: 10,
  });
  const transferFungibleAssetTransaction = await cedra.signAndSubmitTransaction({
    signer: bob,
    transaction: transferFungibleAssetRawTransaction,
  });
  await cedra.waitForTransaction({ transactionHash: transferFungibleAssetTransaction.hash });
  console.log(`Alice's updated FACoin balance: ${await getFaBalance(alice, metadataAddress)}.`);
  console.log(`Bob's updated FACoin balance: ${await getFaBalance(bob, metadataAddress)}.`);
  console.log("done.");
}

main();
