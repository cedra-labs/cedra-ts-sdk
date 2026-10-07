/* eslint-disable no-console */

/**
 * Transfer Cedra coin while paying the fee in a custom fungible asset.
 *
 * The sender is loaded from a private key. The fee asset is address + symbol;
 * the SDK signs it as `address::<lowercase(symbol)>::<symbol>`.
 *
 * Usage:
 *   SENDER_PRIVATE_KEY=0x... RECIPIENT=0x... pnpm transfer_custom_fa_address
 *   pnpm transfer_custom_fa_address 0x<private_key> 0x<recipient> [amount]
 */

import {
  Account,
  AccountAddress,
  Cedra,
  CedraConfig,
  Ed25519PrivateKey,
  FaAddress,
  Network,
  NetworkToNetworkName,
} from "@cedra-labs/ts-sdk";
import dotenv from "dotenv";

dotenv.config();

const FEE_ASSET = {
  addr: "0xc745ffa4f97fa9739fae0cb173996f70bb8e4b0310fa781ccca2f7dc13f7db06",
  symbol: "USDCT",
};

const CEDRA_NETWORK: Network = NetworkToNetworkName[process.env.CEDRA_NETWORK ?? Network.DEVNET];
const TRANSFER_AMOUNT = BigInt(process.argv[4] ?? process.env.TRANSFER_AMOUNT ?? 1_000_000);

const example = async () => {
  const privateKeyHex = process.argv[2] ?? process.env.SENDER_PRIVATE_KEY;
  const recipientHex = process.argv[3] ?? process.env.RECIPIENT;
  if (!privateKeyHex || !recipientHex) {
    console.log(
      "Required: SENDER_PRIVATE_KEY and RECIPIENT, or\n" +
        "pnpm transfer_custom_fa_address 0x<private_key> 0x<recipient> [amount]",
    );
    process.exit(1);
  }

  const config = new CedraConfig({ network: CEDRA_NETWORK });
  const cedra = new Cedra(config);

  const sender = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKeyHex),
  });
  const recipient = AccountAddress.from(recipientHex);
  const faAddress = new FaAddress(AccountAddress.from(FEE_ASSET.addr), FEE_ASSET.symbol);

  console.log("=== Transfer with custom fee asset ===\n");
  console.log(`Sender:    ${sender.accountAddress}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Amount:    ${TRANSFER_AMOUNT}`);
  console.log(`Fee asset: ${faAddress.address}::${faAddress.symbol}`);
  console.log(`Signed as: ${faAddress.toTypeTag().toString()}`);

  const transaction = await cedra.transferCoinTransaction({
    sender: sender.accountAddress,
    recipient,
    amount: TRANSFER_AMOUNT,
    options: {
      faAddress,
    },
  });

  const pendingTxn = await cedra.signAndSubmitTransaction({ signer: sender, transaction });
  const response = await cedra.waitForTransaction({ transactionHash: pendingTxn.hash });
  console.log(`\nCommitted transaction: ${response.hash}`);
  if ("fa_address" in response && response.fa_address) {
    console.log(`On-chain fa_address: ${JSON.stringify(response.fa_address)}`);
  }
};

example();
