import { TwistedEd25519PrivateKey } from "../../../src";
import {
  addNewContentLineToFile,
  cedra,
  confidentialAsset,
  getBalances,
  getTestAccount,
  getTestConfidentialAccount,
  longTestTimeout,
  TOKEN_ADDRESS,
} from "../../helpers";
import { preloadTables } from "../../helpers/wasmPollardKangaroo";

describe("Safely rotate Alice's confidential balance key", () => {
  const alice = getTestAccount();
  const aliceConfidential = getTestConfidentialAccount(alice);

  it(
    "Pre load wasm table map",
    async () => {
      await preloadTables();
    },
    longTestTimeout,
  );

  const ALICE_NEW_CONFIDENTIAL_PRIVATE_KEY = TwistedEd25519PrivateKey.generate();
  test("it should safely rotate Alice's confidential balance key", async () => {
    const balances = await getBalances(aliceConfidential, alice.accountAddress);

    const keyRotationAndUnfreezeTxResponse = await confidentialAsset.safeRotateCBKey(cedra, alice, {
      sender: alice.accountAddress,

      currDecryptionKey: aliceConfidential,
      newDecryptionKey: ALICE_NEW_CONFIDENTIAL_PRIVATE_KEY,

      currEncryptedBalance: balances.actual.getAmountEncrypted(aliceConfidential.publicKey()),

      withUnfreezeBalance: true,
      tokenAddress: TOKEN_ADDRESS,
    });

    console.log("gas used:", keyRotationAndUnfreezeTxResponse.gas_used);

    /* eslint-disable no-console */
    console.log("\n\n\n");
    console.log("SAVE NEW ALICE'S CONFIDENTIAL PRIVATE KEY");
    console.log(ALICE_NEW_CONFIDENTIAL_PRIVATE_KEY.toString());
    console.log("\n\n\n");
    /* eslint-enable */

    addNewContentLineToFile(".env.development", ALICE_NEW_CONFIDENTIAL_PRIVATE_KEY.toString());

    expect(keyRotationAndUnfreezeTxResponse.success).toBeTruthy();
  });
});
