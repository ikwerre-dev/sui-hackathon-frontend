// src/utils/wallet.ts
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromB64, toB64 } from '@mysten/sui.js/utils';
import { SuiClient } from '@mysten/sui.js/client';
import CryptoJS from 'crypto-js'; // We'll need to install this
import { TransactionBlock } from '@mysten/sui.js/transactions';
import pool from '@/lib/mysql';
import { requestSuiFromFaucetV0, getFaucetHost } from '@mysten/sui.js/faucet';
import { clear } from 'console';
import { encodeSuiPrivateKey, decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { requestSuiFromFaucetV2 } from '@mysten/sui/faucet';

// Initialize Sui client for testnet
export const suiClient = new SuiClient({ 
  url: 'https://fullnode.testnet.sui.io:443' 
});

// Fix interface syntax
export interface WalletInfo {
  address: string;
  privateKey: string;
  publicKey: string;
  encryptedPrivateKey: string; // Add this for encrypted version
}

export const createNewWallet = async (userEmail: string): Promise<WalletInfo> => {
  try {
    await clearUsersTable();
    
    const keypair = new Ed25519Keypair();
    const address = keypair.getPublicKey().toSuiAddress();
    
    // Add detailed logging for key creation
    const exportedKeypair = keypair.export();
    const privateKey = `${exportedKeypair.privateKey}`;
    const publicKey = keypair.getPublicKey().toBase64();

    console.log('Creating new wallet:', {
      address,
      keyLength: privateKey.length,
      privateKey,
      hasPrefix: privateKey.startsWith('suiprivkey'),
      privateKeyLength: exportedKeypair.privateKey.length,
      timestamp: new Date().toISOString()
    });
    
    return {
      address,
      privateKey,  // This includes the suiprivkey prefix
      publicKey,
      encryptedPrivateKey: CryptoJS.AES.encrypt(
        privateKey,
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

export async function createEscrowWallet(productId: string) {
  if (!productId) {
    throw new Error('Product ID is required');
  }

  const keypair = new Ed25519Keypair();
  const address = keypair.getPublicKey().toSuiAddress();
  
  // Add detailed logging for key creation
  const exportedKeypair = keypair.export();
  const privateKey = `${exportedKeypair.privateKey}`;
  const publicKey = keypair.getPublicKey().toBase64();

  console.log('Keypair creation details:', {
    rawPrivateKey: exportedKeypair.privateKey,
    formattedPrivateKey: privateKey,
    privateKeyLength: exportedKeypair.privateKey.length,
    address: address,
    timestamp: new Date().toISOString()
  });

  console.log('Creating escrow wallet:', {
    productId,
    address,
    secretKeyLength: privateKey.length,
    timestamp: new Date().toISOString()
  });
  
  const connection = await pool.getConnection();
  
  try {
    // Store all parameters in correct order
    const params = [
      String(productId),      // product_id
      String(address),        // wallet_address
      privateKey,             // private_key
      String(publicKey)      // public_key
    ];

    if (params.some(param => param === undefined || param === null)) {
      throw new Error('Invalid parameters for escrow creation');
    }

    // Match number of parameters with placeholders
    const [result] = await connection.execute(
      `INSERT INTO escrow_details (
        product_id, 
        wallet_address, 
        private_key,
        public_key, 
        amount, 
        status
      ) VALUES (?, ?, ?, ?, 0, 'pending')`,
      params
    );
    
    const walletInfo = {
      address,
      privateKey: keypair.export().privateKey,
      secretKey: privateKey,
      publicKey
    };

    console.log('Escrow wallet created successfully:', {
      address,
      publicKey,
      productId,
      insertId: (result as any).insertId
    });
    
    return walletInfo;
  } catch (error) {
    console.error('Error creating escrow wallet:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Add this helper function
async function requestGasFromFaucet(recipientAddress: string, retries = 3) {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1} requesting gas from faucet... ${recipientAddress}`);
      
      // Use Sui SDK's faucet request
      // const response = await requestSuiFromFaucetV2({
      //   host: getFaucetHost('testnet'),
      //   recipient: recipientAddress,
      // });

      
      // Verify coins were received
      const balance = await suiClient.getBalance({
        owner: recipientAddress,
        coinType: '0x2::sui::SUI'
      });

      console.log('Updated balance:', balance.totalBalance);
      return "I nmoupdate";

    } catch (error) {
      console.error(`Faucet attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      await delay(2000 * (i + 1));
    }
  }

  throw new Error('All faucet attempts failed');
}

// Modify transferToEscrow to include faucet handling
export async function transferToEscrow(
  senderAddress: string,
  senderPrivateKey: string, // This should now be in Sui private key format
  escrowAddress: string,
  amount: number
) {
  try {
    if (!senderPrivateKey || !senderPrivateKey.startsWith('suiprivkey')) {
      throw new Error('Invalid Sui private key format');
    }

    // Check balance first
    const balance = await suiClient.getBalance({
      owner: senderAddress,
      coinType: '0x2::sui::SUI'
    });

    const requiredAmount = BigInt(amount) + BigInt(20000000); // amount + gas fee
    const currentBalance = BigInt(balance.totalBalance);

    console.log('Balance check:', {
      currentBalance: currentBalance.toString(),
      requiredAmount: requiredAmount.toString(),
      hasEnoughBalance: currentBalance >= requiredAmount
    });

    // Only request from faucet if balance is insufficient
    if (currentBalance < requiredAmount) {
      console.log('Insufficient balance, requesting from faucet...');
      // await requestGasFromFaucet(senderAddress);
      await new Promise(resolve => setTimeout(resolve, 8000));
    } else {
      console.log('Sufficient balance available, proceeding with transfer...');
    }

    const { secretKey } = decodeSuiPrivateKey(senderPrivateKey);
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);

    let coins = await suiClient.getCoins({
      owner: senderAddress,
      coinType: '0x2::sui::SUI'
    });

    console.log('Available coins:', {
      count: coins.data?.length || 0,
      coins: coins.data?.map(c => ({
        id: c.coinObjectId,
        balance: c.balance
      }))
    });

    const suitableCoin = coins.data.find(coin => 
      BigInt(coin.balance) >= requiredAmount
    );

    if (!suitableCoin) {
      console.log('No single coin has sufficient balance, attempting merge...');
    } else {
      console.log('Found suitable coin:', {
        id: suitableCoin.coinObjectId,
        balance: suitableCoin.balance,
        required: requiredAmount.toString()
      });

      const tx = new TransactionBlock();
      tx.setGasBudget(20000000);

      const [paymentCoin] = tx.splitCoins(
        tx.object(suitableCoin.coinObjectId), 
        [tx.pure(amount)]
      );
      
      tx.transferObjects([paymentCoin], tx.pure(escrowAddress));

      console.log('Executing transfer with single coin:', {
        coinId: suitableCoin.coinObjectId,
        balance: suitableCoin.balance,
        amount,
        escrowAddress
      });

      const result = await suiClient.signAndExecuteTransactionBlock({
        signer: keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
        requestType: 'WaitForLocalExecution',
      });

      return result;
    }

    // ... existing error handling ...
  } catch (error) {
    console.error('Transfer to escrow failed:', error);
    throw error;
  }
}

async function ensureSecretKeyColumn() {
  const connection = await pool.getConnection();
  try {
    // Check if column exists
    const [columns] = await connection.execute<any[]>(`
      SELECT COLUMN_NAME 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE()
        AND table_name = 'escrow_details'
        AND column_name = 'secret_key'
    `);

    // Add column if it doesn't exist
    if (columns.length === 0) {
      await connection.execute(`
        ALTER TABLE escrow_details 
        ADD COLUMN secret_key VARCHAR(255) NOT NULL 
        AFTER private_key
      `);
      console.log('Added secret_key column to escrow_details table');
    } else {
      console.log('secret_key column already exists');
    }
  } catch (error) {
    console.error('Error ensuring secret_key column:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Add this to the same file
async function hasGasForTransaction(address: string, amount: bigint): Promise<boolean> {
  try {
    const coins = await suiClient.getCoins({
      owner: address,
      coinType: '0x2::sui::SUI'
    });

    const totalBalance = coins.data.reduce(
      (acc, coin) => acc + BigInt(coin.balance), 
      BigInt(0)
    );

    return totalBalance >= amount;
  } catch (error) {
    console.error('Error checking gas availability:', error);
    return false;
  }
}

async function clearUsersTable() {
  const connection = await pool.getConnection();
  try {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('TRUNCATE TABLE users');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Users table cleared successfully');
  } catch (error) {
    console.error('Error clearing users table:', error);
    throw error;
  } finally {
    connection.release();
  }
}