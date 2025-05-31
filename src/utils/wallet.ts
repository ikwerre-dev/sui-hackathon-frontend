import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromB64, toB64 } from '@mysten/sui.js/utils';
import { SuiClient } from '@mysten/sui.js/client';
import CryptoJS from 'crypto-js';  

// Initialize Sui client for devnet
export const suiClient = new SuiClient({ 
  url: 'https://fullnode.devnet.sui.io:443' 
});

export interface WalletInfo {
  address: string;
  privateKey: string;
  publicKey: string;
  encryptedPrivateKey: string; // Add this for encrypted version
}

export const createNewWallet = async (userEmail: string): Promise<WalletInfo> => {
  try {
    const keypair = new Ed25519Keypair();
    const publicKey = keypair.getPublicKey();
    const address = publicKey.toSuiAddress();
    
    // Store the keypair export
    const exportedKeypair = keypair.export();
    localStorage.setItem('keypairExport', JSON.stringify(exportedKeypair));
    
    return {
      address,
      privateKey: exportedKeypair.privateKey,
      publicKey: publicKey.toBase64(),
      encryptedPrivateKey: CryptoJS.AES.encrypt(
        exportedKeypair.privateKey,
        `${userEmail}-${process.env.NEXT_PUBLIC_ENCRYPTION_SALT}`
      ).toString(),
    };
  } catch (error) {
    console.error('Error creating wallet:', error);
    throw new Error('Failed to create wallet');
  }
};

// Update the keypair reconstruction utility
export const getStoredKeypair = (): Ed25519Keypair => {
  const keypairExport = localStorage.getItem('keypairExport');
  if (!keypairExport) {
    throw new Error('No keypair found in storage');
  }
  
  const parsed = JSON.parse(keypairExport);
  return Ed25519Keypair.fromSecretKey(fromB64(parsed.privateKey));
};

// Optional: Function to check wallet balance
export const getWalletBalance = async (address: string): Promise<string> => {
  try {
    const balance = await suiClient.getBalance({
      owner: address,
      coinType: '0x2::sui::SUI'
    });
    return balance.totalBalance;
  } catch (error) {
    console.error('Error getting balance:', error);
    throw new Error('Failed to get wallet balance');
  }
};