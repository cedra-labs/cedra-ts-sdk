// Copyright © Cedra Foundation
// SPDX-License-Identifier: Apache-2.0

import {
  getAccountEventsByCreationNumber,
  getAccountEventsByEventType,
  getModuleEventsByEventType,
  getEvents,
} from "../internal/event";
import { AnyNumber, GetEventsResponse, MoveStructId, OrderByArg, PaginationArgs, WhereArg } from "../types";
import { EventsBoolExp } from "../types/generated/types";
import { AccountAddressInput } from "../core";
import { ProcessorType } from "../utils/const";
import { CedraConfig } from "./cedraConfig";
import { waitForIndexerOnVersion } from "./utils";

/**
 * A class to query all `Event` Cedra related queries.
 * @group Event
 */
export class Event {
  /**
   * Initializes a new instance of the Cedra client with the provided configuration.
   *
   * @param config - The configuration settings for the Cedra client.
   * @param config.network - The network to connect to (e.g., Testnet, Mainnet).
   * @param config.nodeUrl - The URL of the Cedra node to connect to.
   * @param config.faucetUrl - The URL of the faucet to use for funding accounts.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * async function runExample() {
   *     // Create a new Cedra client with Testnet configuration
   *     const config = new CedraConfig({ network: Network.TESTNET }); // Specify your own network if needed
   *     const cedra = new Cedra(config);
   *
   *     console.log("Cedra client initialized:", cedra);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Event
   */
  constructor(readonly config: CedraConfig) {}

  /**
   * Retrieve module events based on a specified event type.
   * This function allows you to query for events that are associated with a particular module event type in the Cedra blockchain.
   *
   * @param args - The arguments for retrieving module events.
   * @param args.eventType - The event type to filter the results.
   * @param args.minimumLedgerVersion - Optional ledger version to sync up to before querying.
   * @param args.options - Optional pagination and ordering parameters for the event results.
   *
   * @returns Promise<GetEventsResponse> - A promise that resolves to the retrieved events.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Retrieve module events for a specific event type
   *   const events = await cedra.getModuleEventsByEventType({
   *     eventType: "0x1::transaction_fee::FeeStatement", // specify the event type
   *     minimumLedgerVersion: 1, // optional: specify minimum ledger version if needed
   *   });
   *
   *   console.log(events); // log the retrieved events
   * }
   * runExample().catch(console.error);
   * ```
   * @group Event
   */
  async getModuleEventsByEventType(args: {
    eventType: MoveStructId;
    minimumLedgerVersion?: AnyNumber;
    options?: PaginationArgs & OrderByArg<GetEventsResponse[0]>;
  }): Promise<GetEventsResponse> {
    await waitForIndexerOnVersion({
      config: this.config,
      minimumLedgerVersion: args.minimumLedgerVersion,
      processorType: ProcessorType.EVENTS_PROCESSOR,
    });
    return getModuleEventsByEventType({ cedraConfig: this.config, ...args });
  }

  /**
   * Retrieve events associated with a specific account address and creation number.
   *
   * @param args - The parameters for retrieving account events.
   * @param args.accountAddress - The account address to query events for.
   * @param args.creationNumber - The event creation number to filter the events.
   * @param args.minimumLedgerVersion - Optional minimum ledger version to sync up to before querying.
   *
   * @returns Promise<GetEventsResponse>
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Get events for the account at creation number 0
   *   const events = await cedra.getAccountEventsByCreationNumber({
   *     accountAddress: "0x1", // replace with a real account address
   *     creationNumber: 0,
   *   });
   *
   *   console.log(events);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Event
   */
  async getAccountEventsByCreationNumber(args: {
    accountAddress: AccountAddressInput;
    creationNumber: AnyNumber;
    minimumLedgerVersion?: AnyNumber;
  }): Promise<GetEventsResponse> {
    await waitForIndexerOnVersion({
      config: this.config,
      minimumLedgerVersion: args.minimumLedgerVersion,
      processorType: ProcessorType.EVENTS_PROCESSOR,
    });
    return getAccountEventsByCreationNumber({ cedraConfig: this.config, ...args });
  }

  /**
   * Retrieve events associated with a specific account address and event type.
   *
   * @param args.accountAddress - The account address to query events for.
   * @param args.eventType - The type of event to filter by.
   * @param args.minimumLedgerVersion - Optional ledger version to sync up to before querying.
   * @param args.options - Optional pagination and ordering parameters for the event query.
   *
   * @returns Promise<GetEventsResponse>
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Get events for a specific account and event type
   *   const events = await cedra.getAccountEventsByEventType({
   *     accountAddress: "0x1", // replace with a real account address
   *     eventType: "0x1::transaction_fee::FeeStatement", // replace with a real event type
   *     minimumLedgerVersion: 1, // optional, specify if needed
   *   });
   *
   *   console.log(events);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Event
   */
  async getAccountEventsByEventType(args: {
    accountAddress: AccountAddressInput;
    eventType: MoveStructId;
    minimumLedgerVersion?: AnyNumber;
    options?: PaginationArgs & OrderByArg<GetEventsResponse[0]>;
  }): Promise<GetEventsResponse> {
    await waitForIndexerOnVersion({
      config: this.config,
      minimumLedgerVersion: args.minimumLedgerVersion,
      processorType: ProcessorType.EVENTS_PROCESSOR,
    });
    return getAccountEventsByEventType({ cedraConfig: this.config, ...args });
  }

  /**
   * Retrieve all events from the Cedra blockchain.
   * An optional `where` clause can be provided to filter the results based on specific criteria.
   *
   * @param args Optional parameters for the query.
   * @param args.minimumLedgerVersion Optional ledger version to sync up to before querying.
   * @param args.options Optional pagination and filtering options.
   * @param args.options.where Optional condition to filter events.
   * @param args.options.offset Optional pagination offset.
   * @param args.options.limit Optional maximum number of events to return.
   * @param args.options.orderBy Optional ordering of the results.
   *
   * @returns GetEventsQuery response type containing the events.
   *
   * @example
   * ```typescript
   * import { Cedra, CedraConfig, Network } from "@cedra-labs/ts-sdk";
   *
   * const config = new CedraConfig({ network: Network.TESTNET });
   * const cedra = new Cedra(config);
   *
   * async function runExample() {
   *   // Retrieve all events
   *   const events = await cedra.getEvents();
   *
   *   // Retrieve events with filtering by account address
   *   const whereCondition = {
   *     account_address: { _eq: "0x123" }, // replace with a real account address
   *   };
   *   const filteredEvents = await cedra.getEvents({
   *     options: { where: whereCondition },
   *   });
   *
   *   console.log(events);
   *   console.log(filteredEvents);
   * }
   * runExample().catch(console.error);
   * ```
   * @group Event
   */
  async getEvents(args?: {
    minimumLedgerVersion?: AnyNumber;
    options?: PaginationArgs & OrderByArg<GetEventsResponse[0]> & WhereArg<EventsBoolExp>;
  }): Promise<GetEventsResponse> {
    await waitForIndexerOnVersion({
      config: this.config,
      minimumLedgerVersion: args?.minimumLedgerVersion,
      processorType: ProcessorType.EVENTS_PROCESSOR,
    });
    return getEvents({ cedraConfig: this.config, ...args });
  }
}
