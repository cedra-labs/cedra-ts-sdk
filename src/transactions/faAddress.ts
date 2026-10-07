// Copyright © Cedra Foundation
// SPDX-License-Identifier: Apache-2.0

import { AccountAddress } from "../core";
import { Identifier } from "./instances/identifier";
import { StructTag, TypeTag, TypeTagBool, TypeTagStruct } from "./typeTag";

const NATIVE_CEDRA_SYMBOL = "Cedra";
const NATIVE_CEDRA_COIN_MODULE = "cedra_coin";
const NATIVE_CEDRA_COIN_NAME = "CedraCoin";

/**
 * Fee-asset identity used when building a transaction: creator address + symbol.
 *
 * Signed `RawTransaction` BCS stores a Move TypeTag, not this struct:
 * - empty → `bool`
 * - native Cedra (`0x1`, `"Cedra"`) → `0x1::cedra_coin::CedraCoin`
 * - FA coin → `address::<lowercase(symbol)>::<symbol>` (e.g. `0xc745…::usdct::USDCT`)
 *
 * Transaction GET responses already return `{ address, symbol }`. Encode/submit JSON
 * still takes the TypeTag string. Convert with {@link FaAddress.toTypeTag} before signing.
 * @group Implementation
 * @category Transactions
 */
export class FaAddress {
  readonly address: AccountAddress;

  readonly symbol: string;

  constructor(address: AccountAddress, symbol: string) {
    this.address = address;
    this.symbol = symbol;
  }

  /**
   * Native Cedra fee identity (`0x1`, `"Cedra"`).
   * @group Implementation
   * @category Transactions
   */
  static nativeCedra(): FaAddress {
    return new FaAddress(AccountAddress.ONE, NATIVE_CEDRA_SYMBOL);
  }

  /**
   * Empty fee identity. Encodes as `TypeTag::Bool` and must not be rewritten to native Cedra.
   * @group Implementation
   * @category Transactions
   */
  static empty(): FaAddress {
    return new FaAddress(AccountAddress.ZERO, "");
  }

  /**
   * Parse `"address::symbol"` or legacy `"address::module::name"`.
   * The module is ignored, except `0x1::cedra_coin::CedraCoin` which becomes native Cedra.
   * @group Implementation
   * @category Transactions
   */
  static fromString(tag: string): FaAddress {
    const trimmed = tag.trim();
    if (trimmed.length === 0) {
      return FaAddress.empty();
    }
    const parts = trimmed.split("::");
    if (parts.length !== 2 && parts.length !== 3) {
      throw new Error(`invalid fa address '${tag}': expected address::symbol or address::module::name`);
    }
    const address = AccountAddress.from(parts[0]);
    const symbol = parts[parts.length - 1];
    if (symbol.length === 0) {
      throw new Error("invalid fa address: empty symbol");
    }
    if (
      address.equals(AccountAddress.ONE) &&
      parts.length === 3 &&
      parts[1] === NATIVE_CEDRA_COIN_MODULE &&
      symbol === NATIVE_CEDRA_COIN_NAME
    ) {
      return FaAddress.nativeCedra();
    }
    if (address.equals(AccountAddress.ONE) && symbol === NATIVE_CEDRA_COIN_NAME) {
      return FaAddress.nativeCedra();
    }
    return new FaAddress(address, symbol);
  }

  /**
   * Read a signed TypeTag back into address + symbol.
   * Non-struct tags (including empty `bool`) are empty.
   * @group Implementation
   * @category Transactions
   */
  static fromTypeTag(tag: TypeTag): FaAddress {
    if (!tag.isStruct()) {
      return FaAddress.empty();
    }
    const { address, moduleName, name } = tag.value;
    if (moduleName.identifier === NATIVE_CEDRA_COIN_MODULE && name.identifier === NATIVE_CEDRA_COIN_NAME) {
      return FaAddress.nativeCedra();
    }
    return new FaAddress(address, name.identifier);
  }

  isEmpty(): boolean {
    return this.symbol.length === 0;
  }

  isNativeCedra(): boolean {
    return this.address.equals(AccountAddress.ONE) && this.symbol === NATIVE_CEDRA_SYMBOL;
  }

  /**
   * Fee v2 applies only to a non-empty, non-native FA coin.
   * @group Implementation
   * @category Transactions
   */
  useFeeV2(): boolean {
    return !this.isEmpty() && !this.isNativeCedra();
  }

  /**
   * TypeTag stored on the signed transaction.
   * @group Implementation
   * @category Transactions
   */
  toTypeTag(): TypeTag {
    if (this.isEmpty()) {
      return new TypeTagBool();
    }
    if (this.isNativeCedra()) {
      return new TypeTagStruct(
        new StructTag(
          AccountAddress.ONE,
          new Identifier(NATIVE_CEDRA_COIN_MODULE),
          new Identifier(NATIVE_CEDRA_COIN_NAME),
          [],
        ),
      );
    }
    const moduleName = this.symbol.toLowerCase();
    if (!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(moduleName) || !/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(this.symbol)) {
      throw new Error(`fa address symbol '${this.symbol}' is not a valid Move identifier`);
    }
    return new TypeTagStruct(
      new StructTag(this.address, new Identifier(moduleName), new Identifier(this.symbol), []),
    );
  }
}

/**
 * Resolve a generate-transaction `faAddress` option into the signed TypeTag.
 * `TypeTag` is used as-is. `FaAddress` and `address::symbol` strings are converted.
 * Omitted means native Cedra (`0x1::cedra_coin::CedraCoin`).
 * @group Implementation
 * @category Transactions
 */
export function faAddressToTypeTag(input?: FaAddress | TypeTag | string): TypeTag {
  if (input === undefined) {
    return FaAddress.nativeCedra().toTypeTag();
  }
  if (input instanceof TypeTag) {
    return input;
  }
  if (input instanceof FaAddress) {
    return input.toTypeTag();
  }
  return FaAddress.fromString(input).toTypeTag();
}
