import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { WalrusClient } from '@mysten/walrus';
import { getFundedKeypair } from '@/utils/funded-keypair';

const NETWORK = 'testnet';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const suiClient = new SuiClient({
    url: getFullnodeUrl(NETWORK)
});

const walrusClient = new WalrusClient({
    network: NETWORK,
    suiClient,
    systemStateId: '0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af',
    wasmUrl: 'https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm',
    storageNodeClientOptions: {
        timeout: 120_000,
        retries: 5,
        onError: (error) => console.error('Storage node error:', error),
    },
});

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function saveProductBlob(data: unknown): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const jsonString = JSON.stringify(data);
            const blob = new TextEncoder().encode(jsonString);
            const keypair = await getFundedKeypair();

            console.log(`Attempt ${attempt + 1}/${MAX_RETRIES} to save blob...`);

            // Write blob directly - it handles registration internally
            const { blobId } = await walrusClient.writeBlob({
                blob,
                deletable: false,
                epochs: 5, // Increased for better persistence
                signer: keypair,
            });

            console.log('Blob saved successfully with ID:', blobId);
            return blobId;
        } catch (error) {
            lastError = error as Error;
            console.error(`Attempt ${attempt + 1} failed and i dont knnow why:`, error);

            if (attempt < MAX_RETRIES - 1) {
                const delay = RETRY_DELAY * Math.pow(2, attempt);
                console.log(`Retrying in ${delay}ms...`);
                await wait(delay);
            }
        }
    }

    throw new Error(`Failed to save blob after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}
