/**
 * This example shows how to use the Cedra client to create accounts, fund them, and transfer between them.
 */
const dotenv = require("dotenv");
dotenv.config();
const {
  Account,
  Cedra,
  CedraConfig,
  parseTypeTag,
  NetworkToNetworkName,
  Network,
  AccountAddress,
  U64,
} = require("@cedra-labs/ts-sdk");

const CEDRA_COIN = "0x1::cedra_coin::CedraCoin";
const ALICE_INITIAL_BALANCE = 100_000_000;
const BOB_INITIAL_BALANCE = 100;
const TRANSFER_AMOUNT = 100;
const CEDRA_NETWORK = NetworkToNetworkName[process.env.CEDRA_NETWORK] || Network.DEVNET;

/**
 * Prints the balance of an account
 * @param sdk
 * @param name
 * @param address
 * @returns {Promise<*>}
 *
 */
const balance = async (sdk, name, address) => {
  const payload = {
    function: "0x1::coin::balance",
    typeArguments: ["0x1::cedra_coin::CedraCoin"],
    functionArguments: [address.toString()],
  };
  const [balance] = await sdk.viewJson({ payload: payload });

  let amount = Number(balance);

  console.log(`${name}'s balance is: ${amount}`);
  return amount;
};

const example = async () => {
  console.log("This example will create two accounts (Alice and Bob), fund them, and transfer between them.");

  // Set up the client
  const config = new CedraConfig({ network: CEDRA_NETWORK });
  const sdk = new Cedra(config);

  // Create two accounts
  let alice = Account.generate({ scheme: 0 });
  let bob = Account.generate({ scheme: 0 });

  console.log("=== Addresses ===\n");
  console.log(`Alice's address is: ${alice.accountAddress}`);
  console.log(`Bob's address is: ${bob.accountAddress}`);

  // Fund the accounts
  console.log("\n=== Funding accounts ===\n");

  const aliceFundTxn = await sdk.fundAccount({
    accountAddress: alice.accountAddress,
    amount: ALICE_INITIAL_BALANCE,
  });
  console.log("Alice's fund transaction: ", aliceFundTxn);

  const bobFundTxn = await sdk.fundAccount({
    accountAddress: bob.accountAddress,
    amount: BOB_INITIAL_BALANCE,
  });
  console.log("Bob's fund transaction: ", bobFundTxn);

  // Show the balances
  console.log("\n=== Balances ===\n");
  let aliceBalance = await balance(sdk, "Alice", alice.accountAddress);
  let bobBalance = await balance(sdk, "Bob", bob.accountAddress);

  if (aliceBalance !== ALICE_INITIAL_BALANCE) throw new Error("Alice's balance is incorrect");
  if (bobBalance !== BOB_INITIAL_BALANCE) throw new Error("Bob's balance is incorrect");

  // Transfer between users
  const txn = await sdk.transaction.build.simple({
    sender: alice.accountAddress,
    data: {
      function: "0x1::coin::transfer",
      typeArguments: [parseTypeTag(CEDRA_COIN)],
      functionArguments: [AccountAddress.from(bob.accountAddress), new U64(TRANSFER_AMOUNT)],
    },
  });

  console.log("\n=== Transfer transaction ===\n");
  let committedTxn = await sdk.signAndSubmitTransaction({ signer: alice, transaction: txn });
  console.log(`Committed transaction: ${committedTxn.hash}`);
  await sdk.waitForTransaction({ transactionHash: committedTxn.hash });

  console.log("\n=== Balances after transfer ===\n");
  let newAliceBalance = await balance(sdk, "Alice", alice.accountAddress);
  let newBobBalance = await balance(sdk, "Bob", bob.accountAddress);

  // Bob should have the transfer amount
  if (newBobBalance !== TRANSFER_AMOUNT + BOB_INITIAL_BALANCE)
    throw new Error("Bob's balance after transfer is incorrect");

  // Alice should have the remainder minus gas
  if (newAliceBalance >= ALICE_INITIAL_BALANCE - TRANSFER_AMOUNT)
    throw new Error("Alice's balance after transfer is incorrect");
};

example();
