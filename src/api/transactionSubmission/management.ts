import EventEmitter from "eventemitter3";
import { TransactionWorkerEvents, TransactionWorker, TransactionWorkerEventsEnum } from "../../transactions/management";
import { InputGenerateTransactionPayloadData, InputGenerateTransactionOptions } from "../../transactions";
import { CedraConfig } from "../cedraConfig";
import { Account } from "../../account";

export class TransactionManagement extends EventEmitter<TransactionWorkerEvents> {
  account!: Account;

  transactionWorker!: TransactionWorker;

  readonly config: CedraConfig;

  /**
   * Initializes a new instance of the Cedra client with the provided configuration settings.
   * This allows you to interact with the Cedra blockchain using the specified network and options.
   *
   * @param config - The configuration settings for the Cedra client.
   * @param config.network - The network to connect to (e.g., TESTNET, MAINNET).
   * @param config.nodeUrl - The URL of the Cedra node to connect to.
   * @param config.account - Optional account settings for authentication.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * async function runExample() {
   *     // Create a configuration for the Cedra client
   *     const config = new CedraConfig({
   *         network: Network.TESTNET, // specify the network to use
   *         nodeUrl: "https://testnet.cedra.dev" // replace with your node URL
   *     });
   *
   *     // Initialize the Cedra client with the configuration
   *     const cedra = new Cedra(config);
   *
   *     console.log("Cedra client initialized successfully.");
   * }
   * runExample().catch(console.error);
   * ```
   * @group Implementation
   */
  constructor(config: CedraConfig) {
    super();
    this.config = config;
  }

  /**
   * Initializes the transaction worker using the provided sender account and begins listening for events.
   * This function is essential for setting up the transaction processing environment.
   *
   * @param args - The arguments for starting the transaction worker.
   * @param args.sender - The sender account to sign and submit the transaction.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network, Account } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *     const sender = Account.generate(); // Generate a new account for sending transactions
   *
   *     // Start the transaction worker with the sender account
   *     cedra.start({ sender });
   *
   *     console.log("Transaction worker started with sender:", sender.accountAddress);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Implementation
   */
  private start(args: { sender: Account }): void {
    const { sender } = args;
    this.account = sender;
    this.transactionWorker = new TransactionWorker(this.config, sender);

    this.transactionWorker.start();
    this.registerToEvents();
  }

  /**
   * Pushes transaction data to the transaction worker for processing.
   *
   * @param args.data An array of transaction payloads to be processed.
   * @param args.options Optional. Transaction generation configurations (excluding accountSequenceNumber).
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Prepare transaction payloads
   *   const payloads = [
   *      {}, // Build your first transaction payload
   *      {}, // Build your second transaction payload
   *   ];
   *
   *   // Push transaction data to the worker
   *   cedra.push({
   *     data: payloads,
   *     {}, // Specify options as needed
   *   });
   *
   *   console.log("Transaction data pushed successfully.");
   * }
   * runExample().catch(console.error);
   * ```
   * @group Implementation
   */
  private push(args: {
    data: InputGenerateTransactionPayloadData[];
    options?: Omit<InputGenerateTransactionOptions, "accountSequenceNumber">;
  }): void {
    const { data, options } = args;

    for (const d of data) {
      this.transactionWorker.push(d, options);
    }
  }

  /**
   * Starts listening to transaction worker events, allowing the application to respond to transaction status changes.
   * This function enables the application to handle events such as transaction sent, execution success, or failure.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Register to listen for transaction events
   *   cedra.registerToEvents();
   *
   *   // You can send a transaction here to see the events in action
   *   const sender = Account.generate(); // replace with a real account
   *   const destination = Account.generate(); // replace with a real account
   *
   *   const transaction = await cedra.transaction.build.simple({
   *     sender: sender.accountAddress,
   *     data: {
   *       function: "0x1::cedra_account::transfer",
   *       functionArguments: [destination.accountAddress, 100],
   *     },
   *   });
   *
   *   await cedra.transaction.send(transaction);
   *
   *   console.log("Transaction sent and events registered.");
   * }
   * runExample().catch(console.error);
   * ```
   * @group Implementation
   */
  private registerToEvents() {
    // TODO - Should we ask events to listen to this as an input?
    this.transactionWorker.on(TransactionWorkerEventsEnum.TransactionSent, async (data) => {
      this.emit(TransactionWorkerEventsEnum.TransactionSent, data);
    });
    this.transactionWorker.on(TransactionWorkerEventsEnum.TransactionSendFailed, async (data) => {
      this.emit(TransactionWorkerEventsEnum.TransactionSendFailed, data);
    });
    this.transactionWorker.on(TransactionWorkerEventsEnum.TransactionExecuted, async (data) => {
      this.emit(TransactionWorkerEventsEnum.TransactionExecuted, data);
    });
    this.transactionWorker.on(TransactionWorkerEventsEnum.TransactionExecutionFailed, async (data) => {
      this.emit(TransactionWorkerEventsEnum.TransactionExecutionFailed, data);
    });
    this.transactionWorker.on(TransactionWorkerEventsEnum.ExecutionFinish, async (data) => {
      this.emit(TransactionWorkerEventsEnum.ExecutionFinish, data);
    });
  }

  /**
   * Send batch transactions for a single account.
   *
   * This function uses a transaction worker that receives payloads to be processed
   * and submitted to chain.
   * Note that this process is best for submitting multiple transactions that
   * don't rely on each other, i.e. batch funds, batch token mints, etc.
   *
   * If any worker failure, the functions throws an error.
   *
   * @param args.sender The sender account to sign and submit the transaction
   * @param args.data An array of transaction payloads
   * @param args.options optional. Transaction generation configurations (excluding accountSequenceNumber)
   *
   * @return void. Throws if any error
   * @group Implementation
   */
  forSingleAccount(args: {
    sender: Account;
    data: InputGenerateTransactionPayloadData[];
    options?: Omit<InputGenerateTransactionOptions, "accountSequenceNumber">;
  }): void {
    try {
      const { sender, data, options } = args;
      this.start({ sender });

      this.push({ data, options });
    } catch (error: any) {
      throw new Error(`failed to submit transactions with error: ${error}`);
    }
  }
}
