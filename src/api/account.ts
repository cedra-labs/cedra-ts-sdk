// Copyright © Cedra Foundation
// SPDX-License-Identifier: Apache-2.0

import { Account as AccountModule } from "../account";
import { AccountAddress, PrivateKey, AccountAddressInput, createObjectAddress } from "../core";
import {
  AccountData,
  AnyNumber,
  CursorPaginationArgs,
  GetAccountCoinsDataResponse,
  GetAccountCollectionsWithOwnedTokenResponse,
  GetAccountOwnedTokensFromCollectionResponse,
  GetAccountOwnedTokensQueryResponse,
  GetObjectDataQueryResponse,
  LedgerVersionArg,
  MoveModuleBytecode,
  MoveResource,
  MoveStructId,
  MoveValue,
  OrderByArg,
  PaginationArgs,
  TokenStandardArg,
  TransactionResponse,
  WhereArg,
} from "../types";
import {
  deriveAccountFromPrivateKey,
  getAccountCoinsCount,
  getAccountCoinsData,
  getAccountCollectionsWithOwnedTokens,
  getAccountOwnedObjects,
  getAccountOwnedTokens,
  getAccountOwnedTokensFromCollectionAddress,
  getAccountTokensCount,
  getAccountTransactionsCount,
  getInfo,
  getModule,
  getModules,
  getModulesPage,
  getResource,
  getResources,
  getResourcesPage,
  getTransactions,
  lookupOriginalAccountAddress,
} from "../internal/account";
import { CEDRA_COIN, CEDRA_FA, ProcessorType } from "../utils/const";
import { CedraConfig } from "./cedraConfig";
import { waitForIndexerOnVersion } from "./utils";
import { CurrentFungibleAssetBalancesBoolExp } from "../types/generated/types";
import { view } from "../internal/view";
import { isEncodedStruct, parseEncodedStruct } from "../utils";
import { memoizeAsync } from "../utils/memoize";
import { AccountAbstraction } from "./account/abstraction";

/**
 * A class to query all `Account` related queries on Cedra.
 * @group Account
 */
export class Account {
  abstraction: AccountAbstraction;

  /**
   * Creates an instance of the Cedra client with the provided configuration.
   *
   * @param config - The configuration settings for the Cedra client.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * async function runExample() {
   *     // Initialize the Cedra client with testnet configuration
   *     const config = new CedraConfig({ network: Network.TESTNET }); // specify your own network if needed
   *     const cedra = new Cedra(config);
   *
   *     console.log("Cedra client initialized:", cedra);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  constructor(readonly config: CedraConfig) {
    this.abstraction = new AccountAbstraction(config);
  }

  /**
   * Queries the current state for an Cedra account given its account address.
   *
   * @param args - The arguments for retrieving account information.
   * @param args.accountAddress - The Cedra account address to query.
   * @returns The account data.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *     // Retrieve account information for a specific address
   *     const accountInfo = await cedra.getAccountInfo({ accountAddress: "0x1" }); // replace with a real account address
   *     console.log(accountInfo);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountInfo(args: { accountAddress: AccountAddressInput }): Promise<AccountData> {
    return getInfo({ cedraConfig: this.config, ...args });
  }

  /**
   * Queries for all modules in an account given an account address.
   * This function may call the API multiple times to auto paginate through results.
   *
   * @param args.accountAddress - The Cedra account address to query modules for.
   * @param args.options.limit - The maximum number of results to return.
   * @param args.options.ledgerVersion - The ledger version to query; if not provided, it retrieves the latest version.
   *
   * @returns - The account modules associated with the specified address.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Fetching account modules for a specific account
   *   const accountModules = await cedra.getAccountModules({
   *     accountAddress: "0x1", // replace with a real account address
   *     options: {
   *       limit: 10, // limiting to 10 modules
   *     },
   *   });
   *
   *   console.log(accountModules);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountModules(args: {
    accountAddress: AccountAddressInput;
    options?: { limit?: number } & LedgerVersionArg;
  }): Promise<MoveModuleBytecode[]> {
    return getModules({ cedraConfig: this.config, ...args });
  }

  /**
   * Queries for a page of modules in an account given an account address.
   *
   * @param args.accountAddress - The Cedra account address to query modules for.
   * @param args.options.cursor - The cursor to start returning results from.  Note, this is obfuscated and is not an index.
   * @param args.options.limit - The maximum number of results to return.
   * @param args.options.ledgerVersion - The ledger version to query; if not provided, it retrieves the latest version.
   *
   * @returns - The account modules associated with the specified address. Along with a cursor for future pagination. If the cursor is undefined, it means there are no more modules to fetch.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Fetching account modules for a specific account
   *   const {modules, cursor} = await cedra.getAccountModulesPage({
   *     accountAddress: "0x1", // replace with a real account address
   *     options: {
   *       cursor: undefined, // starting from the first module
   *       limit: 10, // limiting to 10 modules
   *     },
   *   });
   *
   *   console.log(modules);
   *   console.log(`More to fetch: ${cursor !== undefined}`);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountModulesPage(args: {
    accountAddress: AccountAddressInput;
    options?: CursorPaginationArgs & LedgerVersionArg;
  }): Promise<{ modules: MoveModuleBytecode[]; cursor: string | undefined }> {
    return getModulesPage({ cedraConfig: this.config, ...args });
  }

  /**
   * Queries for a specific account module given an account address and module name.
   *
   * @param args.accountAddress - The Cedra account address.
   * @param args.moduleName - The name of the module.
   * @param args.options.ledgerVersion - The ledger version to query; if not provided, it will get the latest version.
   *
   * @returns The account module associated with the specified account address and module name.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Get the account module for a specific account address and module name
   *   const module = await cedra.getAccountModule({
   *     accountAddress: "0x1", // replace with a real account address
   *     moduleName: "MyModule" // specify the module name
   *   });
   *
   *   console.log(module);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountModule(args: {
    accountAddress: AccountAddressInput;
    moduleName: string;
    options?: LedgerVersionArg;
  }): Promise<MoveModuleBytecode> {
    return getModule({ cedraConfig: this.config, ...args });
  }

  /**
   * Queries account transactions given an account address.
   * This function may call the API multiple times to auto paginate and retrieve all account transactions.
   *
   * @param args.accountAddress - The Cedra account address to query transactions for.
   * @param args.options - Optional pagination arguments.
   * @param args.options.offset - The number of transactions to start returning results from.
   * @param args.options.limit - The maximum number of results to return.
   *
   * @returns The account transactions.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Fetch transactions for a specific account
   *   const transactions = await cedra.getAccountTransactions({
   *     accountAddress: "0x1", // replace with a real account address
   *     options: {
   *       offset: 0, // starting from the first transaction
   *       limit: 10, // limiting to 10 transactions
   *     },
   *   });
   *
   *   console.log(transactions);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountTransactions(args: {
    accountAddress: AccountAddressInput;
    options?: PaginationArgs;
  }): Promise<TransactionResponse[]> {
    return getTransactions({
      cedraConfig: this.config,
      ...args,
    });
  }

  /**
   * Queries all account resources given an account address.
   * This function may call the API multiple times to auto paginate through results.
   *
   * @param args.accountAddress - The Cedra account address to query resources for.
   * @param args.options.limit - The maximum number of results to return.
   * @param args.options.ledgerVersion - The ledger version to query; if not provided, it will get the latest version.
   * @returns Account resources.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Fetching account resources for a specific account address
   *   const resources = await cedra.getAccountResources({ accountAddress: "0x1" }); // replace with a real account address
   *   console.log(resources);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountResources(args: {
    accountAddress: AccountAddressInput;
    options?: PaginationArgs & LedgerVersionArg;
  }): Promise<MoveResource[]> {
    return getResources({ cedraConfig: this.config, ...args });
  }

  /**
   * Queries a page of account resources given an account address.
   *
   * @param args.accountAddress - The Cedra account address to query resources for.
   * @param args.options.cursor - The cursor to start returning results from.  Note, this is obfuscated and is not an index.
   * @param args.options.limit - The maximum number of results to return.
   * @param args.options.ledgerVersion - The ledger version to query; if not provided, it will get the latest version.
   * @returns Account resources.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Fetching account resources for a specific account address
   *   const resources = await cedra.getAccountResourcesPage({
   *     accountAddress: "0x1", // replace with a real account address
   *     options: {
   *       cursor: undefined, // starting from the first resource
   *       limit: 10, // limiting to 10 resources
   *     },
   *   });
   *   console.log(resources);
   *   console.log(`More to fetch: ${resources.cursor !== undefined}`);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountResourcesPage(args: {
    accountAddress: AccountAddressInput;
    options?: CursorPaginationArgs & LedgerVersionArg;
  }): Promise<{ resources: MoveResource[]; cursor: string | undefined }> {
    return getResourcesPage({ cedraConfig: this.config, ...args });
  }

  /**
   * Queries a specific account resource given an account address and resource type.
   *
   * @template T - The typed output of the resource.
   * @param args.accountAddress - The Cedra account address to query.
   * @param args.resourceType - The string representation of an on-chain Move struct type, e.g., "0x1::cedra_coin::CedraCoin".
   * @param args.options.ledgerVersion - The ledger version to query; if not provided, it will get the latest version.
   * @returns The account resource of the specified type.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Get the account resource for a specific account address and resource type
   *   const resource = await cedra.getAccountResource({
   *     accountAddress: "0x1", // replace with a real account address
   *     resourceType: "0x1::cedra_coin::CedraCoin"
   *   });
   *
   *   console.log(resource);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountResource<T extends {} = any>(args: {
    accountAddress: AccountAddressInput;
    resourceType: MoveStructId;
    options?: LedgerVersionArg;
  }): Promise<T> {
    return getResource<T>({ cedraConfig: this.config, ...args });
  }

  /**
   * Looks up the account address for a given authentication key, handling both rotated and non-rotated keys.
   *
   * @param args.authenticationKey - The authentication key for which to look up the account address.
   * @param args.minimumLedgerVersion - Optional ledger version to sync up to before querying.
   * @param args.options.ledgerVersion - The ledger version to query; if not provided, it will get the latest version.
   * @returns Promise<AccountAddress> - The account address associated with the authentication key.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Look up the original account address for a given authentication key
   *   const accountAddress = await cedra.lookupOriginalAccountAddress({
   *     authenticationKey: "0x1", // replace with a real authentication key
   *   });
   *
   *   console.log("Original Account Address:", accountAddress);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async lookupOriginalAccountAddress(args: {
    authenticationKey: AccountAddressInput;
    minimumLedgerVersion?: AnyNumber;
    options?: LedgerVersionArg;
  }): Promise<AccountAddress> {
    return lookupOriginalAccountAddress({ cedraConfig: this.config, ...args });
  }

  /**
   * Queries the current count of tokens owned by a specified account.
   *
   * @param args - The parameters for the query.
   * @param args.accountAddress - The account address to query the token count for.
   * @param args.minimumLedgerVersion - Optional ledger version to sync up to before querying.
   * @returns The current count of tokens owned by the account.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Get the count of tokens owned by the account
   *   const tokensCount = await cedra.getAccountTokensCount({ accountAddress: "0x1" }); // replace with a real account address
   *   console.log(`Tokens Count: ${tokensCount}`);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountTokensCount(args: {
    accountAddress: AccountAddressInput;
    minimumLedgerVersion?: AnyNumber;
  }): Promise<number> {
    await waitForIndexerOnVersion({
      config: this.config,
      minimumLedgerVersion: args.minimumLedgerVersion,
      processorType: ProcessorType.ACCOUNT_TRANSACTION_PROCESSOR,
    });
    return getAccountTokensCount({
      cedraConfig: this.config,
      ...args,
    });
  }

  /**
   * Queries the tokens currently owned by a specified account, including NFTs and fungible tokens.
   * If desired, you can filter the results by a specific token standard.
   *
   * @param args.accountAddress The account address for which to retrieve owned tokens.
   * @param args.minimumLedgerVersion Optional ledger version to sync up to before querying.
   * @param args.options.tokenStandard Optional filter for the NFT standard to query for.
   * @param args.options.offset Optional number to start returning results from.
   * @param args.options.limit Optional number of results to return.
   * @param args.options.orderBy Optional order to sort the tokens by.
   * @returns An array of tokens with their respective data.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Get the tokens owned by a specific account
   *   const accountOwnedTokens = await cedra.getAccountOwnedTokens({
   *     accountAddress: "0x1", // replace with a real account address
   *     options: {
   *       limit: 10, // specify how many tokens to return
   *       orderBy: "created_at", // specify the order of the results
   *     },
   *   });
   *
   *   console.log(accountOwnedTokens);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountOwnedTokens(args: {
    accountAddress: AccountAddressInput;
    minimumLedgerVersion?: AnyNumber;
    options?: TokenStandardArg & PaginationArgs & OrderByArg<GetAccountOwnedTokensQueryResponse[0]>;
  }): Promise<GetAccountOwnedTokensQueryResponse> {
    await waitForIndexerOnVersion({
      config: this.config,
      minimumLedgerVersion: args.minimumLedgerVersion,
      processorType: ProcessorType.TOKEN_V2_PROCESSOR,
    });
    return getAccountOwnedTokens({
      cedraConfig: this.config,
      ...args,
    });
  }

  /**
   * Queries all current tokens of a specific collection that an account owns by the collection address.
   * This query returns all tokens (v1 and v2 standards) an account owns, including NFTs, fungible, soulbound, etc.
   * If you want to get only the token from a specific standard, you can pass an optional tokenStandard parameter.
   *
   * @param args.accountAddress - The account address we want to get the tokens for.
   * @param args.collectionAddress - The address of the collection being queried.
   * @param args.minimumLedgerVersion - Optional ledger version to sync up to, before querying.
   * @param args.options.tokenStandard - The NFT standard to query for.
   * @param args.options.offset - The number token to start returning results from.
   * @param args.options.limit - The number of results to return.
   * @param args.options.orderBy - The order to sort the tokens by.
   * @returns Tokens array with the token data.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Get tokens owned by a specific account in a specific collection
   *   const accountOwnedTokens = await cedra.getAccountOwnedTokensFromCollectionAddress({
   *     accountAddress: "0x1", // replace with a real account address
   *     collectionAddress: "0x2", // replace with a real collection address
   *   });
   *
   *   console.log(accountOwnedTokens);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountOwnedTokensFromCollectionAddress(args: {
    accountAddress: AccountAddressInput;
    collectionAddress: AccountAddressInput;
    minimumLedgerVersion?: AnyNumber;
    options?: TokenStandardArg & PaginationArgs & OrderByArg<GetAccountOwnedTokensFromCollectionResponse[0]>;
  }): Promise<GetAccountOwnedTokensFromCollectionResponse> {
    await waitForIndexerOnVersion({
      config: this.config,
      minimumLedgerVersion: args.minimumLedgerVersion,
      processorType: ProcessorType.TOKEN_V2_PROCESSOR,
    });
    return getAccountOwnedTokensFromCollectionAddress({
      cedraConfig: this.config,
      ...args,
    });
  }

  /**
   * Queries for all collections that an account currently has tokens for, including NFTs, fungible tokens, and soulbound tokens.
   * If you want to filter by a specific token standard, you can pass an optional tokenStandard parameter.
   *
   * @param args.accountAddress - The account address we want to get the collections for.
   * @param args.minimumLedgerVersion - Optional ledger version to sync up to before querying.
   * @param args.options.tokenStandard - The NFT standard to query for.
   * @param args.options.offset - The number of the collection to start returning results from.
   * @param args.options.limit - The number of results to return.
   * @param args.options.orderBy - The order to sort the tokens by.
   * @returns Collections array with the collections data.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Get account collections with owned tokens for a specific account
   *   const accountCollectionsWithOwnedTokens = await cedra.getAccountCollectionsWithOwnedTokens({
   *     accountAddress: "0x1", // replace with a real account address
   *     options: {
   *       tokenStandard: "NFT", // specify the token standard if needed
   *       limit: 10, // specify the number of results to return
   *     },
   *   });
   *
   *   console.log(accountCollectionsWithOwnedTokens);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountCollectionsWithOwnedTokens(args: {
    accountAddress: AccountAddressInput;
    minimumLedgerVersion?: AnyNumber;
    options?: TokenStandardArg & PaginationArgs & OrderByArg<GetAccountCollectionsWithOwnedTokenResponse[0]>;
  }): Promise<GetAccountCollectionsWithOwnedTokenResponse> {
    await waitForIndexerOnVersion({
      config: this.config,
      minimumLedgerVersion: args.minimumLedgerVersion,
      processorType: ProcessorType.TOKEN_V2_PROCESSOR,
    });
    return getAccountCollectionsWithOwnedTokens({
      cedraConfig: this.config,
      ...args,
    });
  }

  /**
   * Queries the current count of transactions submitted by an account.
   *
   * @param args - The parameters for the query.
   * @param args.accountAddress - The account address we want to get the total count for.
   * @param args.minimumLedgerVersion - Optional ledger version to sync up to before querying.
   * @returns Current count of transactions made by an account.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Get the count of transactions for a specific account
   *   const accountTransactionsCount = await cedra.getAccountTransactionsCount({
   *     accountAddress: "0x1", // replace with a real account address
   *     minimumLedgerVersion: 1, // specify your own minimum ledger version if needed
   *   });
   *
   *   console.log(accountTransactionsCount);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountTransactionsCount(args: {
    accountAddress: AccountAddressInput;
    minimumLedgerVersion?: AnyNumber;
  }): Promise<number> {
    await waitForIndexerOnVersion({
      config: this.config,
      minimumLedgerVersion: args.minimumLedgerVersion,
      processorType: ProcessorType.ACCOUNT_TRANSACTION_PROCESSOR,
    });
    return getAccountTransactionsCount({
      cedraConfig: this.config,
      ...args,
    });
  }

  /**
   * Retrieves the coins data for a specified account.
   *
   * @param args.accountAddress - The account address for which to retrieve the coin's data.
   * @param args.minimumLedgerVersion - Optional ledger version to sync up to before querying.
   * @param args.options.offset - Optional. The number of coins to start returning results from.
   * @param args.options.limit - Optional. The number of results to return.
   * @param args.options.orderBy - Optional. The order to sort the coins by.
   * @param args.options.where - Optional. Filter the results by specific criteria.
   * @returns An array containing the coins data for the specified account.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Fetching coins data for a specific account
   *   const accountCoinsData = await cedra.getAccountCoinsData({
   *     accountAddress: "0x1", // replace with a real account address
   *     options: {
   *       limit: 10, // specify the number of results to return
   *       orderBy: { asset_type: "asc" }, // specify the order of results
   *     },
   *   });
   *
   *   console.log(accountCoinsData);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountCoinsData(args: {
    accountAddress: AccountAddressInput;
    minimumLedgerVersion?: AnyNumber;
    options?: PaginationArgs &
      OrderByArg<GetAccountCoinsDataResponse[0]> &
      WhereArg<CurrentFungibleAssetBalancesBoolExp>;
  }): Promise<GetAccountCoinsDataResponse> {
    await waitForIndexerOnVersion({
      config: this.config,
      minimumLedgerVersion: args.minimumLedgerVersion,
      processorType: ProcessorType.FUNGIBLE_ASSET_PROCESSOR,
    });
    return getAccountCoinsData({
      cedraConfig: this.config,
      ...args,
    });
  }

  /**
   * Retrieves the current count of an account's coins aggregated across all types.
   *
   * @param args The parameters for the account coins count query.
   * @param args.accountAddress The account address we want to get the total count for.
   * @param args.minimumLedgerVersion Optional ledger version to sync up to before querying.
   * @returns The current count of the aggregated coins for the specified account.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Getting the account coins count for a specific account
   *   const accountCoinsCount = await cedra.getAccountCoinsCount({ accountAddress: "0x1" }); // replace with a real account address
   *   console.log("Account Coins Count:", accountCoinsCount);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountCoinsCount(args: {
    accountAddress: AccountAddressInput;
    minimumLedgerVersion?: AnyNumber;
  }): Promise<number> {
    await waitForIndexerOnVersion({
      config: this.config,
      minimumLedgerVersion: args.minimumLedgerVersion,
      processorType: ProcessorType.FUNGIBLE_ASSET_PROCESSOR,
    });
    return getAccountCoinsCount({ cedraConfig: this.config, ...args });
  }

  /**
   * Retrieves the current amount of APT for a specified account. If the account does not exist, it will return 0.
   *
   * @param args The arguments for the account query.
   * @param args.accountAddress The account address for which to retrieve the APT amount.
   * @param args.minimumLedgerVersion Optional ledger version to sync up to before querying.
   * @returns The current amount of APT for the specified account.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Get the APT amount for a specific account
   *   const accountAPTAmount = await cedra.getAccountCEDRAAmount({ accountAddress: "0x1" }); // replace with a real account address
   *   console.log("Account APT Amount:", accountAPTAmount);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountCEDRAAmount(args: {
    accountAddress: AccountAddressInput;
    minimumLedgerVersion?: AnyNumber;
  }): Promise<number> {
    return this.getAccountCoinAmount({ coinType: CEDRA_COIN, faMetadataAddress: CEDRA_FA, ...args });
  }

  /**
   * Queries the current amount of a specified coin held by an account.
   *
   * @param args The parameters for querying the account's coin amount.
   * @param args.accountAddress The account address to query for the coin amount.
   * @param args.coinType The coin type to query. Note: If not provided, it may be automatically populated if `faMetadataAddress`
   * is specified.
   * @param args.faMetadataAddress The fungible asset metadata address to query. Note: If not provided, it may be automatically
   * populated if `coinType` is specified.
   * @param args.minimumLedgerVersion Not used anymore, here for backward compatibility
   * see https://github.com/cedra-labs/cedra-ts-sdk/pull/519, will be removed in the near future.
   * Optional ledger version to sync up to before querying.
   * @returns The current amount of the specified coin held by the account.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Query the account's coin amount for a specific coin type
   *   const accountCoinAmount = await cedra.getAccountCoinAmount({
   *     accountAddress: "0x1", // replace with a real account address
   *     coinType: "0x1::cedra_coin::CedraCoin" // specify the coin type
   *   });
   *
   *   console.log(`Account coin amount: ${accountCoinAmount}`);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountCoinAmount(args: {
    accountAddress: AccountAddressInput;
    coinType?: MoveStructId;
    faMetadataAddress?: AccountAddressInput;
    minimumLedgerVersion?: AnyNumber;
  }): Promise<number> {
    const { accountAddress, coinType, faMetadataAddress, minimumLedgerVersion } = args;

    if (minimumLedgerVersion) {
      // eslint-disable-next-line no-console
      console.warn(
        `minimumLedgerVersion is not used anymore, here for backward 
        compatibility see https://github.com/cedra-labs/cedra-ts-sdk/pull/519, 
        will be removed in the near future`,
      );
    }
    // Attempt to populate the CoinType field if the FA address is provided.
    // We cannot do this internally due to dependency cycles issue.
    let coinAssetType: MoveStructId | undefined = coinType;
    if (coinType === undefined && faMetadataAddress !== undefined) {
      coinAssetType = await memoizeAsync(
        async () => {
          try {
            const pairedCoinTypeStruct = (
              await view({
                cedraConfig: this.config,
                payload: { function: "0x1::coin::paired_coin", functionArguments: [faMetadataAddress] },
              })
            ).at(0) as { vec: MoveValue[] };

            // Check if the Option has a value, and if so, parse the struct
            if (pairedCoinTypeStruct.vec.length > 0 && isEncodedStruct(pairedCoinTypeStruct.vec[0])) {
              return parseEncodedStruct(pairedCoinTypeStruct.vec[0]) as MoveStructId;
            }
          } catch (error) {
            /* No paired coin type found */
          }
          return undefined;
        },
        `coin-mapping-${faMetadataAddress.toString()}`,
        1000 * 60 * 5, // 5 minutes
      )();
    }

    let faAddress: string;

    if (coinType !== undefined && faMetadataAddress !== undefined) {
      faAddress = AccountAddress.from(faMetadataAddress).toStringLong();
    } else if (coinType !== undefined && faMetadataAddress === undefined) {
      // TODO Move to a separate function as defined in the AIP for coin migration
      if (coinType === CEDRA_COIN) {
        faAddress = AccountAddress.A.toStringLong();
      } else {
        faAddress = createObjectAddress(AccountAddress.A, coinType).toStringLong();
      }
    } else if (coinType === undefined && faMetadataAddress !== undefined) {
      const addr = AccountAddress.from(faMetadataAddress);
      faAddress = addr.toStringLong();
      if (addr === AccountAddress.A) {
        coinAssetType = CEDRA_COIN;
      }
      // The paired CoinType should be populated outside of this function in another
      // async call. We cannot do this internally due to dependency cycles issue.
    } else {
      throw new Error("Either coinType, faMetadataAddress, or both must be provided");
    }

    // When there is a coin mapping, use that first, otherwise use the fungible asset address
    // TODO: This function's signature at the top, returns number, but it could be greater than can be represented
    if (coinAssetType !== undefined) {
      const [balanceStr] = await view<[string]>({
        cedraConfig: this.config,
        payload: {
          function: "0x1::coin::balance",
          typeArguments: [coinAssetType],
          functionArguments: [accountAddress],
        },
      });
      return parseInt(balanceStr, 10);
    }
    const [balanceStr] = await view<[string]>({
      cedraConfig: this.config,
      payload: {
        function: "0x1::primary_fungible_store::balance",
        typeArguments: ["0x1::object::ObjectCore"],
        functionArguments: [accountAddress, faAddress],
      },
    });
    return parseInt(balanceStr, 10);
  }

  /**
   * Queries an account's owned objects.
   *
   * @param args.accountAddress The account address we want to get the objects for.
   * @param args.minimumLedgerVersion Optional ledger version to sync up to before querying.
   * @param args.options.offset The starting position to start returning results from.
   * @param args.options.limit The number of results to return.
   * @param args.options.orderBy The order to sort the objects by.
   * @returns Objects array with the object data.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Get the objects owned by the specified account
   *   const accountOwnedObjects = await cedra.getAccountOwnedObjects({
   *     accountAddress: "0x1", // replace with a real account address
   *     minimumLedgerVersion: 1, // optional, specify if needed
   *     options: {
   *       offset: 0, // optional, specify if needed
   *       limit: 10, // optional, specify if needed
   *       orderBy: "created_at", // optional, specify if needed
   *     },
   *   });
   *
   *   console.log(accountOwnedObjects);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   */
  async getAccountOwnedObjects(args: {
    accountAddress: AccountAddressInput;
    minimumLedgerVersion?: AnyNumber;
    options?: PaginationArgs & OrderByArg<GetObjectDataQueryResponse[0]>;
  }): Promise<GetObjectDataQueryResponse> {
    await waitForIndexerOnVersion({
      config: this.config,
      minimumLedgerVersion: args.minimumLedgerVersion,
      processorType: ProcessorType.DEFAULT,
    });
    return getAccountOwnedObjects({
      cedraConfig: this.config,
      ...args,
    });
  }

  /**
   * Derives an account by providing a private key. This function resolves the provided private key type and derives the public
   * key from it.
   *
   * If the privateKey is a Secp256k1 type, it derives the account using the derived public key and auth key using the SingleKey
   * scheme locally.
   * If the privateKey is an ED25519 type, it looks up the authentication key on chain to determine whether it is a Legacy ED25519
   * key or a Unified ED25519 key, and then derives the account based on that.
   *
   * @param args - The arguments for deriving the account.
   * @param args.privateKey - An account private key.
   * @returns The derived Account type.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network, Ed25519PrivateKey } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *     // Deriving an account from a private key
   *     const account = await cedra.deriveAccountFromPrivateKey({
   *         privateKey: new Ed25519PrivateKey("0x123") // replace with a real private key
   *     });
   *
   *     console.log(account);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Account
   * @deprecated Note that more inspection is needed by the user to determine which account exists on-chain
   */
  async deriveAccountFromPrivateKey(args: { privateKey: PrivateKey }): Promise<AccountModule> {
    return deriveAccountFromPrivateKey({ cedraConfig: this.config, ...args });
  }
}
