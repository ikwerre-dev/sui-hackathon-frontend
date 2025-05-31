// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { getFaucetHost, requestSuiFromFaucetV2 } from '@mysten/sui/faucet';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { coinWithBalance, Transaction } from '@mysten/sui/transactions';
import { MIST_PER_SUI, parseStructTag } from '@mysten/sui/utils';

interface WalrusPackageConfig {
	/** The system object ID of the Walrus package */
	systemObjectId: string;
	/** The staking pool ID of the Walrus package */
	stakingPoolId: string;
	subsidiesObjectId?: string;
	exchangeIds?: string[];
}

const WALRUS_PACKAGE_CONFIG = {
    systemObjectId: '0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af',
    stakingPoolId: '0xbe46180321c30aab2f8b3501e24048377287fa708018a5b7c2792b35fe339ee3',
    subsidiesObjectId: '0xda799d85db0429765c8291c594d334349ef5bc09220e79ad397b30106161a0af',
    exchangeIds: [
        '0xf4d164ea2def5fe07dc573992a029e010dba09b1a8dcbc44c5c2e79567f39073',
        '0x19825121c52080bb1073662231cfea5c0e4d905fd13e95f21e9a018f2ef41862',
        '0x83b454e524c71f30803f4d6c302a86fb6a39e96cdfb873c2d1e93bc1c26a3bc5',
        '0x8d63209cf8589ce7aef8f262437163c67577ed09f3e636a9d8e0813843fb8bf1'
    ]
} satisfies WalrusPackageConfig;

export async function getFundedKeypair() {
    const suiClient = new SuiClient({
        url: getFullnodeUrl('testnet'),
    });

    const keypair = Ed25519Keypair.fromSecretKey(
        'suiprivkey1qzmcxscyglnl9hnq82crqsuns0q33frkseks5jw0fye3tuh83l7e6ajfhxx',
    );
    
    // Get address from public key properly
    const publicKey = keypair.getPublicKey();
    const address = publicKey.toSuiAddress();
    console.log('Wallet address:', address);

    const balance = await suiClient.getBalance({
        owner: address,
    });

    // if (BigInt(balance.totalBalance) < MIST_PER_SUI) {
    //     await requestSuiFromFaucetV2({
    //         host: getFaucetHost('testnet'),
    //         recipient: address,
    //     });
    // }

    const walBalance = await suiClient.getBalance({
        owner: address,
        coinType: `0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL`,
    });
    console.log('WAL balance:', walBalance.totalBalance);

    if (Number(walBalance.totalBalance) < Number(MIST_PER_SUI) / 2) {
        const tx = new Transaction();

        const exchange = await suiClient.getObject({
            id: WALRUS_PACKAGE_CONFIG.exchangeIds[0],
            options: {
                showType: true,
            },
        });

        const exchangePackageId = parseStructTag(exchange.data?.type!).address;

        const wal = tx.moveCall({
            package: exchangePackageId,
            module: 'wal_exchange',
            function: 'exchange_all_for_wal',
            arguments: [
                tx.object(WALRUS_PACKAGE_CONFIG.exchangeIds[0]),
                coinWithBalance({
                    balance: MIST_PER_SUI / 2n,
                }),
            ],
        });

        tx.transferObjects([wal], address);

        const { digest } = await suiClient.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
        });

        const { effects } = await suiClient.waitForTransaction({
            digest,
            options: {
                showEffects: true,
            },
        });

        console.log(effects);
    }

    return keypair;
}