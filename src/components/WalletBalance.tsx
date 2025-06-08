"use client";

import { useState, useEffect } from 'react';
import { suiClient } from '@/utils/wallet';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';
import axios from 'axios';

interface BalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
}

interface CryptoPrice {
  usd: number;
  ngn: number;
}

const DepositModal = ({ isOpen, onClose, address }: BalanceModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full mx-4"
          >
            <h3 className="text-xl font-bold mb-4">Deposit SUI</h3>
            <div className="flex justify-center mb-4">
              <QRCode value={address} size={200} />
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Your Wallet Address:</p>
              <div className="bg-gray-100 p-3 rounded-lg break-all text-sm">
                {address}
              </div>
            </div>
            <button
              onClick={onClose}
              className="mt-6 w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const WalletBalance = () => {
  const [balance, setBalance] = useState<string>('0');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [prices, setPrices] = useState<CryptoPrice>({ usd: 0, ngn: 0 });
  const [suiAmount, setSuiAmount] = useState<number>(0);

  const fetchPrices = async () => {
    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd,ngn'
      );
      setPrices({
        usd: response.data.sui.usd,
        ngn: response.data.sui.ngn
      });
    } catch (error) {
      console.error('Error fetching SUI price:', error);
    }
  };

  useEffect(() => {
    const fetchBalance = async () => {
      const walletAddress = localStorage.getItem('wallet_address');
      if (!walletAddress) return;

      setAddress(walletAddress);
      try {
        const balance = await suiClient.getBalance({
          owner: walletAddress,
          coinType: '0x2::sui::SUI'
        });

        // Convert from MIST to SUI
        const suiBalance = Number(balance.totalBalance) / 1_000_000_000;
        setSuiAmount(suiBalance);
        setBalance(suiBalance.toFixed(4));
        
        // Fetch latest prices when balance updates
        await fetchPrices();
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-sm text-gray-600">Balance</p>
            <p className="text-xl font-bold">{balance} SUI</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors block lg:hidden"
          >
            Deposit
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-gray-500">
            {formatCurrency(suiAmount * prices.usd, 'USD')}
          </p>
          <p className="text-sm text-gray-500">
            {formatCurrency(suiAmount * prices.ngn, 'NGN')}
          </p>
        </div>
      </div>

      <button
            onClick={() => setIsModalOpen(true)}
            className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors hidden lg:block border-2 border-gray-500 mt-3 cursor-pointer"
          >
            Deposit
          </button>

      <DepositModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        address={address}
      />
    </div>
  );
};

export default WalletBalance;