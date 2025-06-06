import express, { Request, Response } from 'express';
import {
    Account, AccountAuthenticator,
    Cedra,
    CedraConfig,
    Deserializer,
    Network,
    NetworkToNetworkName,
    SimpleTransaction,
} from '@cedra-labs/ts-sdk';

const app = express();
app.use(express.json());

const PORT = 3000;

const CEDRA_NETWORK = NetworkToNetworkName[process.env.CEDRA_NETWORK || ''] || Network.DEVNET;

const config = new CedraConfig({network: CEDRA_NETWORK});
const cedra = new Cedra(config);

const feePayerAccount = Account.generate();
console.log(`feePayerAccount's address is: ${feePayerAccount.accountAddress}`);

// Fund the feePayerAccount account
const fundFeePayerAccount = async () => {
    console.log('\n=== Funding feePayerAccount ===\n');
    await cedra.fundAccount({
        accountAddress: feePayerAccount.accountAddress,
        amount: 100_000_000,
    });
    console.log('feePayerAccount funded.');
};

app.post('/signAndSubmit', async (req: Request, res: Response) => {
    try {
        const {transactionBytes, senderAuthenticator} = req.body;

        if (!transactionBytes) {
            return res.status(400).json({error: 'transactionBytes is required'});
        }
        if (!senderAuthenticator) {
            return res.status(400).json({error: 'senderAuthenticator is required'});
        }

        console.log('\n=== Received Transaction Bytes ===\n');

        // Deserialize the raw transaction
        const deserializer = new Deserializer(Uint8Array.from(transactionBytes));
        const transaction = SimpleTransaction.deserialize(deserializer);

        console.log('\n=== Signing Transaction as Sponsor ===\n');

        // Sponsor signs the transaction
        const feePayerAuthenticator = cedra.transaction.signAsFeePayer({
            signer: feePayerAccount,
            transaction,
        });

        const deserializedSenderAuth = AccountAuthenticator.deserialize(new Deserializer(Uint8Array.from(senderAuthenticator)));

        console.log('\n=== Signed with Fee Payer ===\n');
        const signedTxnInput = {
            transaction,
            senderAuthenticator: deserializedSenderAuth,
            feePayerAuthenticator,
        };
        let response = await cedra.transaction.submit.simple(signedTxnInput);
        await cedra.waitForTransaction({transactionHash: response.hash});
        console.log('\n=== Transaction Signed by Sponsor ===\n');

        return res.status(200).json({transactionHash: response.hash});
    } catch (error) {
        console.error('Error processing transaction:', error);
        return res.status(500).json({error: error});
    }
});

app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    await fundFeePayerAccount();
});
