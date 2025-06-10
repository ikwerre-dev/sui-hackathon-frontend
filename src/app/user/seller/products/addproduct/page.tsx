"use client";
import { useState } from "react";
import { API_ROUTES } from "@/utils/config";
import { useRouter } from "next/navigation";
import { saveProductBlob } from "../utils/walrustools";
import { Signer } from "@mysten/sui/cryptography";
import { convertUSDToSUI } from "@/utils/price";
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { getFaucetHost, requestSuiFromFaucetV2 } from '@mysten/sui/faucet';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { coinWithBalance, Transaction } from '@mysten/sui/transactions';
import { MIST_PER_SUI, parseStructTag } from '@mysten/sui/utils';
import { log } from "console";

interface ProductFormData {
  product_name: string;
  sender_location: string;
  receiver_location: string;
  sender_email: string;         // Changed from sender_wallet_address
  logistics_email: string;      // Changed from logistics_wallet_address
  logistics_location: string;
  description: string;
  estimated_delivery_date: string;
  product_weight: number;
  product_value: number;
  delivery_fee: number;
  escrow_amount: number;        // Added for escrow handling
  recipient_email: string;
}

interface UserData {
  email: string;
  // add other user data properties if needed
}


const AddProductPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    product_name: "",
    sender_location: "",
    receiver_location: "",
    sender_email: "",           // Changed
    logistics_email: "",        // Changed
    logistics_location: "",
    description: "",
    estimated_delivery_date: "",
    product_weight: 0,
    product_value: 0,
    delivery_fee: 0,  // Changed from 300 to 0, will be calculated
    escrow_amount: 0,          // Will be calculated based on product_value + delivery_fee
    recipient_email: ""
  });

  const calculateEscrowAmount = async (productValue: number, deliveryFee: number) => {
    try {
      // Convert product value and delivery fee to SUI
      const productValueInSUI = await convertUSDToSUI(productValue);
      const deliveryFeeInSUI = await convertUSDToSUI(deliveryFee);
      
      // Calculate platform fee (5%) in SUI
      const platformFee = (productValueInSUI + deliveryFeeInSUI) * 0.05;
      
      // Convert to MIST (1 SUI = 1_000_000_000 MIST)
      const totalInMIST = BigInt(
        Math.ceil((productValueInSUI + deliveryFeeInSUI + platformFee) * 1_000_000_000)
      );
      
      console.log('Escrow calculation:', {
        productValueUSD: productValue,
        productValueSUI: productValueInSUI,
        deliveryFeeUSD: deliveryFee,
        deliveryFeeSUI: deliveryFeeInSUI,
        platformFeeSUI: platformFee,
        totalInMIST: totalInMIST.toString(),
        approximateSUI: Number(totalInMIST) / 1_000_000_000
      });
  
      return totalInMIST;
    } catch (error) {
      console.error('Error calculating escrow amount:', error);
      throw new Error('Failed to calculate escrow amount');
    }
  };

  // Add function to calculate delivery fee
  const calculateDeliveryFee = (productValue: number): number => {
    return productValue * 0.2; // 20% of product value
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
  
    try {
      // Calculate escrow amount first
      const escrowAmount = await calculateEscrowAmount(
        formData.product_value,
        formData.delivery_fee
      );
  
      // Check recipient's wallet balance first
      const recipientWalletResponse = await fetch('/api/wallet/check-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.recipient_email
        })
      });
  
      const walletData = await recipientWalletResponse.json();
  
      if (!recipientWalletResponse.ok) {
        throw new Error(walletData.error || 'Failed to check recipient wallet');
      }
  
      // Convert balance to number for comparison
      const balance = parseFloat(walletData.balance);
      
      // Convert balance to BigInt for comparison
      const currentBalance = BigInt(balance);
      const requiredAmount = BigInt(escrowAmount);

      console.log('Balance check:', {
        walletAddress: walletData,
        currentBalance: currentBalance.toString(),
        requiredAmount: requiredAmount.toString(),
        hasEnoughBalance: currentBalance >= requiredAmount
      });

      if (currentBalance < requiredAmount) {
        console.log('Insufficient balance details:', {
          balanceInSUI: Number(currentBalance) / 1_000_000_000,
          requiredInSUI: Number(requiredAmount) / 1_000_000_000,
          difference: Number(requiredAmount - currentBalance) / 1_000_000_000
        });
        
        // Try to fund the wallet first
        try {
          console.log('Insufficient balance, requesting from faucet...');
          console.log("Balance and faucet: ", balance, escrowAmount);

          
          const faucetResponse = await fetch('/api/wallet/request-funds', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: formData.recipient_email
            })
          });
  
          if (!faucetResponse.ok) {
            throw new Error('Failed to request funds from faucet');
          }
  
          // Wait for faucet transaction to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
  
          // Check balance again
          const newBalanceResponse = await fetch('/api/wallet/check-balance', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: formData.recipient_email
            })
          });
  
          const newBalanceData = await newBalanceResponse.json();
          const newBalance = parseFloat(newBalanceData.balance);
  
          if (newBalance < escrowAmount) {
            const usdAmount = formData.product_value + formData.delivery_fee;
            setError(
              `Even after faucet funding, insufficient balance. Please ask ${formData.recipient_email} ` +
              `to fund their wallet with at least ${escrowAmount} SUI (~${usdAmount} USD)`
            );
            return;
          }
        } catch (faucetError) {
          console.error('Faucet request failed:', faucetError);
          const usdAmount = formData.product_value + formData.delivery_fee;
          setError(
            `Insufficient funds in recipient's wallet and faucet request failed. Please ask ${formData.recipient_email} ` +
            `to fund their wallet with at least ${escrowAmount} SUI (~${usdAmount} USD)`
          );
          return;
        }
      }
  
      // If we have sufficient balance, proceed with product creation
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Authentication token not found");
      }
  
      const escrowResponse = await fetch('/api/products/escrow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient_email: formData.recipient_email,
          amount: escrowAmount.toString(), // Convert BigInt to string
          product_id: formData.recipient_email,
          sender_email: formData.sender_email,
          logistics_email: formData.logistics_email
        })
      });
  
      if (!escrowResponse.ok) {
        const escrowData = await escrowResponse.json();
        throw new Error(escrowData.error || 'Failed to create escrow');
      }

      const escrowData = await escrowResponse.json();

    // Get funded escrow keypair with WAL tokens
    console.log('Funded escrow keypair created for blob storage');

    // Use keypair with saveProductBlob
    const blobId = await saveProductBlob(
      {
        ...formData,
        escrow_amount: escrowAmount,
        created_at: new Date().toISOString()
      },
      escrowData.wallet.privateKey  // Pass the funded keypair directly
    );

    if (!blobId) {
      throw new Error("Failed to save product blob");
    }
    console.log('Product blob saved with ID:', blobId);

    // Create the product with blob reference
    const response = await fetch(API_ROUTES.SELLER.PRODUCTS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_name: formData.product_name,
        sender_location: formData.sender_location,
        receiver_location: formData.receiver_location,
        sender_email: formData.sender_email,
        logistics_email: formData.logistics_email,
        logistics_location: formData.logistics_location,
        description: formData.description,
        estimated_delivery_date: formData.estimated_delivery_date,
        product_weight: formData.product_weight,
        product_value: formData.product_value,
        delivery_fee: formData.delivery_fee,
        recipient_email: formData.recipient_email,
        blob_id: blobId,
        escrow_amount: escrowAmount.toString(),
        escrow_wallet: walletData.address
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to create product");
    }

    const data = await response.json();
    console.log("Product created successfully:", data);

    router.push("/user/seller/products/activeproducts");
  } catch (err) {
    console.error('Product creation failed:', err);
    setError(err instanceof Error ? err.message : "Failed to create product");
  } finally {
    setLoading(false);
  }
};

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: name.includes("weight") || name.includes("value")
          ? parseFloat(value)
          : value,
      };

      // Automatically update delivery fee when product value changes
      if (name === 'product_value') {
        newData.delivery_fee = calculateDeliveryFee(parseFloat(value));
      }

      return newData;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Create New Product
            </h1>
            <p className="mt-2 text-gray-600">
              Fill in the details below to add a new product
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FFD1] focus:border-[#00FFD1] transition"
                  required
                />
              </div>

              {/* Sender Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sender Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="sender_location"
                  value={formData.sender_location}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FFD1] focus:border-[#00FFD1] transition"
                  required
                />
              </div>

              {/* Receiver Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Receiver Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="receiver_location"
                  value={formData.receiver_location}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FFD1] focus:border-[#00FFD1] transition"
                  required
                />
              </div>

              {/* Sender Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sender Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="sender_email"
                  value={formData.sender_email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FFD1] focus:border-[#00FFD1] transition"
                  required
                />
              </div>

              {/* Recipient Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="recipient_email"
                  value={formData.recipient_email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FFD1] focus:border-[#00FFD1] transition"
                  required
                  placeholder="Email of the person paying"
                />
              </div>

              {/* Logistics Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logistics Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="logistics_email"
                  value={formData.logistics_email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FFD1] focus:border-[#00FFD1] transition"
                  required
                />
              </div>

              {/* Logistics Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logistics Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="logistics_location"
                  value={formData.logistics_location}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FFD1] focus:border-[#00FFD1] transition"
                  required
                />
              </div>

              {/* Description - spans both columns */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FFD1] focus:border-[#00FFD1] transition resize-none"
                  rows={3}
                  required
                />
              </div>

              {/* Estimated Delivery Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Delivery Date{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="estimated_delivery_date"
                  value={formData.estimated_delivery_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FFD1] focus:border-[#00FFD1] transition"
                  required
                />
              </div>

              {/* Product Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Weight (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="product_weight"
                  value={formData.product_weight}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FFD1] focus:border-[#00FFD1] transition"
                  required
                />
              </div>

              {/* Product Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Value ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="product_value"
                  value={formData.product_value}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FFD1] focus:border-[#00FFD1] transition"
                  required
                />
              </div>

              {/* Delivery Fee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Fee ($) <span className="text-gray-500">(20% of product value)</span>
                </label>
                <input
                  type="number"
                  name="delivery_fee"
                  value={formData.delivery_fee.toFixed(2)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                  readOnly
                />
              </div>
            </div>

            <div className="flex justify-end pt-6">
              <button
                type="submit"
                disabled={loading}
                className={`px-6 cursor-pointer py-3 bg-[#00FFD1] text-gray-900 font-medium rounded-lg shadow-md hover:bg-[#00FFD1]/90 transition ${
                  loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  "Create Product"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddProductPage;
