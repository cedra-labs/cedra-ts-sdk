/* eslint-disable no-console */

/**
 * This example demonstrates how a client can utilize the TransactionWorker class.
 *
 * The TransactionWorker provides a simple framework for receiving payloads to be processed. It
 * acquires an account new sequence number, produces a signed transaction and
 * then submits the transaction. In other tasks, it waits for resolution of the submission
 * process or get pre-execution validation error and waits for the resolution of the execution process
 * or get an execution validation error.
 *
 * The TransactionWorker constructor accepts
 * @param cedraConfig - a config object
 * @param sender - the sender account
 * @param maxWaitTime - the max wait time to wait before restarting the local sequence number to the current on-chain state
 * @param maximumInFlight - submit up to `maximumInFlight` transactions per account
 * @param sleepTime - If `maximumInFlight` are in flight, wait `sleepTime` seconds before re-evaluating
 *
 * Read more about it here {@link https://cedra.dev/guides/transaction-management}
 */
import {
  Account,
  AccountData,
  Cedra,
  CedraConfig,
  InputGenerateTransactionPayloadData,
  Network,
  NetworkToNetworkName,
  TransactionWorkerEventsEnum,
  UserTransactionResponse,
} from "@cedra-labs/ts-sdk";

const CEDRA_NETWORK: Network = NetworkToNetworkName[process.env.CEDRA_NETWORK ?? Network.DEVNET];

const config = new CedraConfig({ network: CEDRA_NETWORK });
const cedra = new Cedra(config);

async function main() {
  const accountsCount = 2;
  const transactionsCount = 10;
  const totalTransactions = accountsCount * transactionsCount;

  const start = Date.now() / 1000; // current time in seconds

  console.log("starting...");
  // create senders and recipients accounts
  const senders: Account[] = [];
  const recipients: Account[] = [];
  for (let i = 0; i < accountsCount; i += 1) {
    senders.push(Account.generate());
    recipients.push(Account.generate());
  }
  for (const sender of senders) {
    console.log(sender.accountAddress.toString());
  }
  let last = Date.now() / 1000;
  console.log(
    `${senders.length} sender accounts and ${recipients.length} recipient accounts created in ${last - start} seconds`,
  );

  // fund sender accounts
  const funds: Array<Promise<UserTransactionResponse>> = [];

  for (let i = 0; i < senders.length; i += 1) {
    funds.push(
      cedra.fundAccount({ accountAddress: senders[i].accountAddress.toStringWithoutPrefix(), amount: 10000000000 }),
    );
  }

  await Promise.all(funds);

  console.log(`${funds.length} sender accounts funded in ${Date.now() / 1000 - last} seconds`);
  last = Date.now() / 1000;

  // read sender accounts
  const balances: Array<Promise<AccountData>> = [];
  for (let i = 0; i < senders.length; i += 1) {
    balances.push(cedra.getAccountInfo({ accountAddress: senders[i].accountAddress }));
  }
  await Promise.all(balances);

  console.log(`${balances.length} sender account balances checked in ${Date.now() / 1000 - last} seconds`);
  last = Date.now() / 1000;

  // create transactions
  const payloads: InputGenerateTransactionPayloadData[] = [];
  // 100 transactions
  for (let j = 0; j < transactionsCount; j += 1) {
    // 5 recipients
    for (let i = 0; i < recipients.length; i += 1) {
      const txn: InputGenerateTransactionPayloadData = {
        function: "0x1::cedra_account::transfer",
        functionArguments: [recipients[i].accountAddress, 1],
      };
      payloads.push(txn);
    }
  }

  console.log(`sends ${totalTransactions * senders.length} transactions to ${cedra.config.network}....`);
  // emit batch transactions
  senders.map((sender) => cedra.transaction.batch.forSingleAccount({ sender, data: payloads }));

  cedra.transaction.batch.on(TransactionWorkerEventsEnum.TransactionSent, async (data) => {
    console.log("message:", data.message);
    console.log("transaction hash:", data.transactionHash);
  });

  cedra.transaction.batch.on(TransactionWorkerEventsEnum.ExecutionFinish, async (data) => {
    // log event output
    console.log(data.message);

    // verify accounts sequence number
    const accounts = senders.map((sender) => cedra.getAccountInfo({ accountAddress: sender.accountAddress }));
    const accountsData = await Promise.all(accounts);
    accountsData.forEach((accountData) => {
      console.log(
        `account sequence number is ${(totalTransactions * senders.length) / 2}: ${
          accountData.sequence_number === "20"
        }`,
      );
    });
    // worker finished execution, we can now unsubscribe from event listeners
    cedra.transaction.batch.removeAllListeners();
    process.exit(0);
  });
}

main();
