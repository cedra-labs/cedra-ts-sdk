// Copyright © Cedra Foundation
// SPDX-License-Identifier: Apache-2.0

/**
 * This file contains the underlying implementations for exposed API surface in
 * the {@link api/fungible_asset}. By moving the methods out into a separate file,
 * other namespaces and processes can access these methods without depending on the entire
 * fungible_asset namespace and without having a dependency cycle error.
 * @group Implementation
 */

import { CedraConfig } from "../api/cedraConfig";
import {
  AnyNumber,
  GetCurrentFungibleAssetBalancesResponse,
  GetFungibleAssetActivitiesResponse,
  GetFungibleAssetMetadataResponse,
  PaginationArgs,
  WhereArg,
} from "../types";
import { queryIndexer } from "./general";
import {
  GetCurrentFungibleAssetBalances,
  GetFungibleAssetActivities,
  GetFungibleAssetMetadata,
} from "../types/generated/queries";
import {
  GetCurrentFungibleAssetBalancesQuery,
  GetFungibleAssetActivitiesQuery,
  GetFungibleAssetMetadataQuery,
} from "../types/generated/operations";
import {
  CurrentFungibleAssetBalancesBoolExp,
  FungibleAssetActivitiesBoolExp,
  FungibleAssetMetadataBoolExp,
} from "../types/generated/types";
import { AccountAddressInput } from "../core";
import { Account } from "../account";
import {
  EntryFunctionABI,
  InputGenerateTransactionOptions,
  parseTypeTag,
  TypeTagAddress,
  TypeTagU64,
} from "../transactions";
import { generateTransaction } from "./transactionSubmission";
import { SimpleTransaction } from "../transactions/instances/simpleTransaction";

/**
 * Retrieves metadata for fungible assets based on specified criteria.
 * This function allows you to filter and paginate through fungible asset metadata.
 *
 * @param args - The arguments for the function.
 * @param args.cedraConfig - The configuration for Cedra.
 * @param [args.options] - Optional parameters for pagination and filtering.
 * @param [args.options.limit] - The maximum number of results to return.
 * @param [args.options.offset] - The number of results to skip before starting to collect the result set.
 * @param [args.options.where] - Conditions to filter the results.
 * @group Implementation
 */
export async function getFungibleAssetMetadata(args: {
  cedraConfig: CedraConfig;
  options?: PaginationArgs & WhereArg<FungibleAssetMetadataBoolExp>;
}): Promise<GetFungibleAssetMetadataResponse> {
  const { cedraConfig, options } = args;

  const graphqlQuery = {
    query: GetFungibleAssetMetadata,
    variables: {
      where_condition: options?.where,
      limit: options?.limit,
      offset: options?.offset,
    },
  };

  const data = await queryIndexer<GetFungibleAssetMetadataQuery>({
    cedraConfig,
    query: graphqlQuery,
    originMethod: "getFungibleAssetMetadata",
  });

  return data.fungible_asset_metadata;
}

/**
 * Retrieves the activities associated with fungible assets.
 * This function allows you to filter and paginate through the activities based on specified conditions.
 *
 * @param args - The arguments for retrieving fungible asset activities.
 * @param args.cedraConfig - The configuration settings for Cedra.
 * @param [args.options] - Optional parameters for pagination and filtering.
 * @param [args.options.limit] - The maximum number of activities to retrieve.
 * @param [args.options.offset] - The number of activities to skip before starting to collect the result set.
 * @param [args.options.where] - Conditions to filter the activities.
 * @returns A promise that resolves to an array of fungible asset activities.
 * @group Implementation
 */
export async function getFungibleAssetActivities(args: {
  cedraConfig: CedraConfig;
  options?: PaginationArgs & WhereArg<FungibleAssetActivitiesBoolExp>;
}): Promise<GetFungibleAssetActivitiesResponse> {
  const { cedraConfig, options } = args;

  const graphqlQuery = {
    query: GetFungibleAssetActivities,
    variables: {
      where_condition: options?.where,
      limit: options?.limit,
      offset: options?.offset,
    },
  };

  const data = await queryIndexer<GetFungibleAssetActivitiesQuery>({
    cedraConfig,
    query: graphqlQuery,
    originMethod: "getFungibleAssetActivities",
  });

  return data.fungible_asset_activities;
}

/**
 * Retrieves the current balances of fungible assets for a specified configuration.
 *
 * @param args - The arguments for retrieving fungible asset balances.
 * @param args.cedraConfig - The configuration settings for Cedra.
 * @param args.options - Optional parameters for pagination and filtering.
 * @param args.options.limit - The maximum number of results to return.
 * @param args.options.offset - The number of results to skip before starting to collect the results.
 * @param args.options.where - Conditions to filter the results based on specific criteria.
 * @returns The current balances of fungible assets.
 * @group Implementation
 */
export async function getCurrentFungibleAssetBalances(args: {
  cedraConfig: CedraConfig;
  options?: PaginationArgs & WhereArg<CurrentFungibleAssetBalancesBoolExp>;
}): Promise<GetCurrentFungibleAssetBalancesResponse> {
  const { cedraConfig, options } = args;

  const graphqlQuery = {
    query: GetCurrentFungibleAssetBalances,
    variables: {
      where_condition: options?.where,
      limit: options?.limit,
      offset: options?.offset,
    },
  };

  const data = await queryIndexer<GetCurrentFungibleAssetBalancesQuery>({
    cedraConfig,
    query: graphqlQuery,
    originMethod: "getCurrentFungibleAssetBalances",
  });

  return data.current_fungible_asset_balances_new;
}

const faTransferAbi: EntryFunctionABI = {
  typeParameters: [{ constraints: [] }],
  parameters: [parseTypeTag("0x1::object::Object"), new TypeTagAddress(), new TypeTagU64()],
};

/**
 * Transfers a specified amount of a fungible asset from the sender to the recipient.
 * This function helps facilitate the transfer of digital assets between accounts on the Cedra blockchain.
 *
 * @param args - The parameters for the transfer operation.
 * @param args.cedraConfig - The configuration settings for the Cedra network.
 * @param args.sender - The account initiating the transfer.
 * @param args.fungibleAssetMetadataAddress - The address of the fungible asset's metadata.
 * @param args.recipient - The address of the account receiving the asset.
 * @param args.amount - The amount of the fungible asset to transfer.
 * @param args.options - Optional settings for generating the transaction.
 * @group Implementation
 */
export async function transferFungibleAsset(args: {
  cedraConfig: CedraConfig;
  sender: Account;
  fungibleAssetMetadataAddress: AccountAddressInput;
  recipient: AccountAddressInput;
  amount: AnyNumber;
  options?: InputGenerateTransactionOptions;
}): Promise<SimpleTransaction> {
  const { cedraConfig, sender, fungibleAssetMetadataAddress, recipient, amount, options } = args;
  return generateTransaction({
    cedraConfig,
    sender: sender.accountAddress,
    data: {
      function: "0x1::primary_fungible_store::transfer",
      typeArguments: ["0x1::fungible_asset::Metadata"],
      functionArguments: [fungibleAssetMetadataAddress, recipient, amount],
      abi: faTransferAbi,
    },
    options,
  });
}

/**
 * Transfers a specified amount of a fungible asset from any (primary or secondary) fungible store to any (primary or secondary) fungible store.
 * This function helps facilitate the transfer of digital assets between fungible stores on the Cedra blockchain.
 *
 * @param args - The parameters for the transfer operation.
 * @param args.cedraConfig - The configuration settings for the Cedra network.
 * @param args.sender - The account initiating the transfer.
 * @param args.fromStore - The address of the fungible store initiating the transfer.
 * @param args.toStore - The address of the fungible store receiving the asset.
 * @param args.amount - The amount of the fungible asset to transfer. Must be a positive number.
 * @param args.options - Optional settings for generating the transaction.
 * @returns A SimpleTransaction that can be submitted to the blockchain.
 * @throws Error if the transaction generation fails or if the input parameters are invalid.
 * @group Implementation
 */
export async function transferFungibleAssetBetweenStores(args: {
  cedraConfig: CedraConfig;
  sender: Account;
  fromStore: AccountAddressInput;
  toStore: AccountAddressInput;
  amount: AnyNumber;
  options?: InputGenerateTransactionOptions;
}): Promise<SimpleTransaction> {
  const { cedraConfig, sender, fromStore, toStore, amount, options } = args;
  return generateTransaction({
    cedraConfig,
    sender: sender.accountAddress,
    data: {
      function: "0x1::dispatchable_fungible_asset::transfer",
      typeArguments: ["0x1::fungible_asset::FungibleStore"],
      functionArguments: [fromStore, toStore, amount],
      abi: faTransferAbi,
    },
    options,
  });
}
