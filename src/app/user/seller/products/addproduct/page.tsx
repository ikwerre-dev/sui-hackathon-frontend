"use client";
import { useState } from "react";
import { API_ROUTES } from "@/utils/config";
import { useRouter } from "next/navigation";
import { saveProductBlob } from "../utils/walrustools";

interface ProductFormData {
  product_name: string;
  sender_location: string;
  receiver_location: string;
  sender_wallet_address: string;
  logistics_wallet_address: string;
  logistics_location: string;
  description: string;
  estimated_delivery_date: string;
  product_weight: number;
  product_value: number;
  delivery_fee: number;
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
    sender_wallet_address: "",
    logistics_wallet_address: "",
    logistics_location: "",
    description: "",
    estimated_delivery_date: "",
    product_weight: 0,
    product_value: 0,
    delivery_fee: 300,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const userDataString = localStorage.getItem("userData");
      if (!userDataString) {
        throw new Error("User data not found");
      }

      const userData = JSON.parse(userDataString) as UserData;
      if (!userData.email) {
        throw new Error("User email not found");
      }

      const blobId = await saveProductBlob(formData);
      if (!blobId) {
        throw new Error("Failed to save product blob");
      }

      const response = await fetch(API_ROUTES.SELLER.PRODUCTS, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          blob_id: blobId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create product");
      }

      const data = await response.json();
      console.log("Product created:", data);

      router.push("/user/seller/products/activeproducts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name.includes("weight") || name.includes("value")
          ? parseFloat(value)
          : value,
    }));
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

              {/* Sender Wallet Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sender Wallet Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="sender_wallet_address"
                  value={formData.sender_wallet_address}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FFD1] focus:border-[#00FFD1] transition"
                  required
                />
              </div>

              {/* Logistics Wallet Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logistics Wallet Address{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="logistics_wallet_address"
                  value={formData.logistics_wallet_address}
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
