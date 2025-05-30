import {
  Account,
  CedraApiType,
  cedraRequest,
  generateSignedTransaction,
  GraphqlQuery,
  NetworkToIndexerAPI,
  NetworkToNodeAPI,
  U64,
} from "../../../src";
import { CedraApiError } from "../../../src/errors";
import { VERSION } from "../../../src/version";
import { longTestTimeout } from "../../unit/helper";
import { getCedraClient } from "../helper";
import { singleSignerScriptBytecode } from "../transaction/helper";

const { cedra, config } = getCedraClient();

const fullnodeUrl = config.fullnode ?? NetworkToNodeAPI[config.network];
const indexerUrl = config.indexer ?? NetworkToIndexerAPI[config.network];

const dummyKey = "cedralabs_secret1";

describe("cedra request", () => {
  describe("headers", () => {
    test(
      "call should include all expected headers",
      async () => {
        const sender = Account.generate();
        const receiverAccounts = Account.generate();
        await cedra.fundAccount({ accountAddress: sender.accountAddress, amount: 100_000_000 });
        const transaction = await cedra.transaction.build.simple({
          sender: sender.accountAddress,
          data: {
            bytecode: singleSignerScriptBytecode,
            functionArguments: [new U64(1), receiverAccounts.accountAddress],
          },
        });
        const authenticator = cedra.transaction.sign({
          signer: sender,
          transaction,
        });
        const signedTransaction = generateSignedTransaction({ transaction, senderAuthenticator: authenticator });
        try {
          const response = await cedraRequest(
            {
              url: fullnodeUrl,
              method: "POST",
              path: "transactions",
              body: signedTransaction,
              originMethod: "test request includes all headers",
              contentType: "application/x.cedra.signed_transaction+bcs",
              overrides: { HEADERS: { my: "header" } },
            },
            config,
            CedraApiType.FULLNODE,
          );
          expect(response.config.headers).toHaveProperty("x-cedra-client", `cedra-typescript-sdk/${VERSION}`);
          expect(response.config.headers).toHaveProperty("my", "header");
          expect(response.config.headers).toHaveProperty("content-type", "application/x.cedra.signed_transaction+bcs");
          expect(response.config.headers).toHaveProperty(
            "x-cedra-typescript-sdk-origin-method",
            "test request includes all headers",
          );
        } catch (error: any) {
          // should not get here
          // eslint-disable-next-line no-console
          console.log("Error in 'headers'", error);
          expect(true).toBe(false);
        }
      },
      longTestTimeout,
    );
  });

  describe("api key", () => {
    test(
      "should set api_token for full node requests",
      async () => {
        try {
          const response = await cedraRequest(
            {
              url: fullnodeUrl,
              method: "GET",
              path: "",
              overrides: { API_KEY: dummyKey },
              originMethod: "test when token is set",
            },
            config,
            CedraApiType.FULLNODE,
          );
          expect(response.config.headers).toHaveProperty("authorization", `Bearer ${dummyKey}`);
        } catch (error: any) {
          // should not get here
          // eslint-disable-next-line no-console
          console.log("Error in 'api_token for full node requests'", error);
          expect(true).toBe(false);
        }
      },
      longTestTimeout,
    );
  });

  describe("full node", () => {
    describe("200 response", () => {
      test(
        "when fullnode server returns 200 status code",
        async () => {
          try {
            const response = await cedraRequest(
              {
                url: fullnodeUrl,
                method: "GET",
                path: "accounts/0x1",
                originMethod: "test fullnode 200 status",
              },
              config,
              CedraApiType.FULLNODE,
            );
            expect(response).toHaveProperty("data", {
              sequence_number: "0",
              authentication_key: "0x0000000000000000000000000000000000000000000000000000000000000001",
            });
          } catch (error: any) {
            // should not get here
            // eslint-disable-next-line no-console
            console.log("Error in 'fullnode server returns 200 status code'", error);
            expect(true).toBe(false);
          }
        },
        longTestTimeout,
      );
    });

    describe("400 error", () => {
      test(
        "when server returns 400 status code",
        async () => {
          try {
            await cedraRequest(
              {
                url: fullnodeUrl,
                method: "GET",
                path: "transactions/by_hash/0x123",
                originMethod: "test 400 status",
              },
              config,
              CedraApiType.FULLNODE,
            );
          } catch (error: any) {
            expect(error).toBeInstanceOf(CedraApiError);
            expect(error.url).toBe(`${fullnodeUrl}/transactions/by_hash/0x123`);
            expect(error.status).toBe(400);
            expect(error.statusText).toBe("Bad Request");
            expect(error.data).toEqual({
              message:
                // eslint-disable-next-line quotes
                'failed to parse path `txn_hash`: failed to parse "string(HashValue)": unable to parse HashValue',
              error_code: "web_framework_error",
              vm_error_code: null,
            });
            expect(error.request).toEqual({
              url: `${fullnodeUrl}`,
              method: "GET",
              originMethod: "test 400 status",
              path: "transactions/by_hash/0x123",
            });
          }
        },
        longTestTimeout,
      );
      test(
        "when server returns 404 status code",
        async () => {
          try {
            await cedraRequest(
              {
                url: `${fullnodeUrl}`,
                method: "GET",
                path: "transactions/by_hash/0x23851af73879128b541bafad4b49d0b6f1ac0d49ed2400632d247135fbca7bea",
                originMethod: "test 404 status",
              },
              config,
              CedraApiType.FULLNODE,
            );
          } catch (error: any) {
            expect(error).toBeInstanceOf(CedraApiError);
            expect(error.url).toBe(
              `${fullnodeUrl}/transactions/by_hash/0x23851af73879128b541bafad4b49d0b6f1ac0d49ed2400632d247135fbca7bea`,
            );
            expect(error.status).toBe(404);
            expect(error.statusText).toBe("Not Found");
            expect(error.data).toEqual({
              message:
                "Transaction not found by Transaction hash(0x23851af73879128b541bafad4b49d0b6f1ac0d49ed2400632d247135fbca7bea)",
              error_code: "transaction_not_found",
              vm_error_code: null,
            });
            expect(error.request).toEqual({
              url: `${fullnodeUrl}`,
              method: "GET",
              originMethod: "test 404 status",
              path: "transactions/by_hash/0x23851af73879128b541bafad4b49d0b6f1ac0d49ed2400632d247135fbca7bea",
            });
          }
        },
        longTestTimeout,
      );

      test(
        "when server returns transaction submission error",
        async () => {
          try {
            await cedraRequest(
              {
                url: `${fullnodeUrl}`,
                method: "POST",
                path: "transactions",
                body: new Uint8Array([1, 2, 3]),
                originMethod: "test transaction submission error",
                contentType: "application/x.cedra.signed_transaction+bcs",
              },
              config,
              CedraApiType.FULLNODE,
            );
          } catch (error: any) {
            expect(error).toBeInstanceOf(CedraApiError);
            expect(error.url).toBe(`${fullnodeUrl}/transactions`);
            expect(error.status).toBe(400);
            expect(error.statusText).toBe("Bad Request");
            expect(error.data).toEqual({
              message: "Failed to deserialize input into SignedTransaction: unexpected end of input",
              error_code: "invalid_input",
              vm_error_code: null,
            });
            expect(error.request).toEqual({
              url: `${fullnodeUrl}`,
              method: "POST",
              originMethod: "test transaction submission error",
              path: "transactions",
              body: new Uint8Array([1, 2, 3]),
              contentType: "application/x.cedra.signed_transaction+bcs",
            });
          }
        },
        longTestTimeout,
      );
    });
  });

  describe("indexer", () => {
    describe("200 response", () => {
      test(
        "when indexer server returns 200 status code",
        async () => {
          try {
            const query: GraphqlQuery = {
              query: `query MyQuery {
                ledger_infos {
                  chain_id
                }
              }`,
            };
            const response = await cedraRequest(
              {
                url: `${indexerUrl}`,
                method: "POST",
                body: query,
                originMethod: "test indexer 200 status",
              },
              config,
              CedraApiType.INDEXER,
            );
            expect(response).toHaveProperty("data", {
              ledger_infos: [
                {
                  chain_id: 4,
                },
              ],
            });
          } catch (error: any) {
            // should not get here
            expect(true).toBe(false);
          }
        },
        longTestTimeout,
      );
    });
    describe("errors", () => {
      test(
        "test indexer 400 status",
        async () => {
          try {
            const query: GraphqlQuery = {
              query: `query MyQuery {
                ledger_inos {
                  chain_id
                }
              }`,
            };
            await cedraRequest(
              {
                url: `${indexerUrl}`,
                method: "POST",
                body: query,
                originMethod: "test indexer 400 status",
              },
              config,
              CedraApiType.INDEXER,
            );
          } catch (error: any) {
            expect(error).toBeInstanceOf(CedraApiError);
            expect(error.url).toBe(`${indexerUrl}`);
            expect(error.status).toBe(200);
            expect(error.statusText).toBe("OK");
            expect(error.data).toHaveProperty("errors");
            expect(error.data.errors).toEqual([
              {
                message: "field 'ledger_inos' not found in type: 'query_root'",
                extensions: { path: "$.selectionSet.ledger_inos", code: "validation-failed" },
              },
            ]);
            expect(error.request).toEqual({
              url: `${indexerUrl}`,
              method: "POST",
              originMethod: "test indexer 400 status",
              body: {
                query: `query MyQuery {
                ledger_inos {
                  chain_id
                }
              }`,
              },
            });
          }
        },
        longTestTimeout,
      );
    });
  });
});
