"use client";

import { useEffect, useState, useCallback } from 'react';
import { FaBox, FaUser, FaClipboardList, FaMapMarkerAlt } from 'react-icons/fa';
import { BiTrendingUp, BiTrendingDown } from 'react-icons/bi';
import { TbTemperature, TbDroplet, TbGauge, TbAccessPoint } from 'react-icons/tb';

interface Record {
    id: number;
    logistics_id: number | null;
    product_id: number;
    customer_id: number;
    status: string;
    live: number;
    created_at: string;
    updated_at: string;
}

interface Customer {
    id: number;
    name: string;
    email: string;
    account_type: string;
}
interface StatusCardProps {
    icon: React.ReactNode;
    title: string;
    items: Array<{ label: string; value: string }>;
    className?: string;
}
interface Product {
    id: number;
    product_code: string;
    product_name: string;
    status: string;
}

interface Log {
    id: number;
    product_id: number;
    temperature: number;
    humidity: number;
    pressure: number;
    shock: number;
    tilt: number;
    created_at: string;
}

interface ScanStatus {
    record: Record;
    customer: Customer;
    product: Product;
    logs: Log[];
}

interface Location {
    latitude: number;
    longitude: number;
    accuracy: number;
}

export default function Preview() {
    const [status, setStatus] = useState<ScanStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [isData, setisData] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [location, setLocation] = useState<Location>({ 
        latitude: 4.891119299589522,
        longitude: 6.919050071332949,
        accuracy: 0
    });
    const fetchStatus = async () => {
        try {
            const response = await fetch('/api/scan/current');
            if (!response.ok) throw new Error('Failed to fetch status');
            const data = await response.json();
            setisData(true);
            setStatus(data);
            setLoading(false);
        } catch (err) {
            setisData(false);
            setError(err instanceof Error ? err.message : 'An error occurred');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-32 w-32 border-t-8 border-b-8 border-[#00FFD1] mx-auto"></div>
                    <p className="text-4xl font-bold text-gray-800">Fetching Status...</p>
                </div>
            </div>
        );
    }

    if (!status || !isData) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="text-center space-y-8 max-w-2xl mx-auto">
                    <h1 className="text-6xl font-bold text-gray-900">No Active Scan</h1>
                    <p className="text-2xl text-gray-600">Please scan a product to continue tracking</p>
                    <div className="mt-8 animate-bounce">
                        <svg className="w-16 h-16 mx-auto text-[#00FFD1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z" />
                        </svg>
                    </div>
                    <p className="text-xl text-gray-500 mt-4">Use your device to scan the QR code or NFC tag</p>
                </div>
            </div>
        );
    }

    const calculateTrend = (current: number, previous: number) => {
        const percentage = ((current - previous) / previous) * 100;
        return {
            value: Math.abs(percentage).toFixed(1),
            isIncrease: percentage > 0,
            color: percentage > 0 ? 'text-red-500' : 'text-green-500'
        };
    };

    const getLatestMetrics = () => {
        if (!status.logs || status.logs.length < 2) return null;
        const latest = status.logs[0];
        const previous = status.logs[1];

        return {
            temperature: calculateTrend(latest.temperature, previous.temperature),
            humidity: calculateTrend(latest.humidity, previous.humidity),
            pressure: calculateTrend(latest.pressure, previous.pressure),
            shock: calculateTrend(latest.shock, previous.shock),
            tilt: calculateTrend(latest.tilt, previous.tilt)
        };
    };

    const metrics = getLatestMetrics();

    return (
        <div className="min-h-screen bg-white p-4 lg:p-8">
            <div className="max-w-8xl mx-auto space-y-8">
                <div className="text-center space-y-4 mb-12">
                    <h1 className="text-4xl md:text-6xl font-bold text-gray-900">
                        Current Status: <span className="text-[#00FFD1]">{status.record.status.toUpperCase()}</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-600">
                        {status.record.live === 1 ? 'LIVE' : 'INACTIVE'}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <StatusCard
                                icon={<FaBox className="w-6 h-6 text-[#00FFD1]" />}
                                title="Product Details"
                                items={[
                                    { label: 'Product Name', value: status.product.product_name },
                                    { label: 'Product Code', value: status.product.product_code },
                                    { label: 'Product Status', value: status.product.status }
                                ]}
                                className="transform hover:scale-105 transition-transform duration-300"
                            />
                            <StatusCard
                                icon={<FaUser className="w-6 h-6 text-[#00FFD1]" />}
                                title="Customer Details"
                                items={[
                                    { label: 'Name', value: status.customer.name },
                                    { label: 'Email', value: status.customer.email },
                                    { label: 'Account Type', value: status.customer.account_type }
                                ]}
                                className="transform hover:scale-105 transition-transform duration-300"
                            />
                            <StatusCard
                                icon={<FaClipboardList className="w-6 h-6 text-[#00FFD1]" />}
                                title="Record Details"
                                items={[
                                    { label: 'Record ID', value: status.record.id.toString() },
                                    { label: 'Created', value: new Date(status.record.created_at).toLocaleString() },
                                    { label: 'Updated', value: new Date(status.record.updated_at).toLocaleString() }
                                ]}
                                className="md:col-span-2 lg:col-span-1 transform hover:scale-105 transition-transform duration-300"
                            />
                        </div>

                        {metrics && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <MetricCard
                                    icon={<TbTemperature className="w-6 h-6" />}
                                    title="Temperature"
                                    value={metrics.temperature}
                                />
                                <MetricCard
                                    icon={<TbDroplet className="w-6 h-6" />}
                                    title="Humidity"
                                    value={metrics.humidity}
                                />
                                <MetricCard
                                    icon={<TbGauge className="w-6 h-6" />}
                                    title="Pressure"
                                    value={metrics.pressure}
                                />
                                <MetricCard
                                    icon={<TbAccessPoint className="w-6 h-6" />}
                                    title="Shock"
                                    value={metrics.shock}
                                />
                                <MetricCard
                                    icon={<TbAccessPoint className="w-6 h-6" />}
                                    title="Tilt"
                                    value={metrics.tilt}
                                    className="md:col-span-2 lg:col-span-1"
                                />
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:border-[#00FFD1] transition-colors duration-300">
                            <div className="flex items-center space-x-3 mb-4">
                                <FaMapMarkerAlt className="w-6 h-6 text-[#00FFD1]" />
                                <h3 className="text-xl font-bold text-gray-800">Current Location</h3>
                            </div>
                            {location ? (
                                <div className="space-y-3">
                                    <div className="aspect-video rounded-lg overflow-hidden">
                                        <iframe
                                            title="Current Location"
                                            width="100%"
                                            height="100%"
                                            frameBorder="0"
                                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.01},${location.latitude - 0.01},${location.longitude + 0.01},${location.latitude + 0.01}&layer=mapnik&marker=${location.latitude},${location.longitude}`}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <MetricItem label="Latitude" value={Number(location.latitude).toFixed(6)} />
                                        <MetricItem label="Longitude" value={Number(location.longitude).toFixed(6)} />
                                        <MetricItem label="Accuracy" value={`±${Number(location.accuracy).toFixed(0)}m`} />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <p>Fetching location...</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:border-[#00FFD1] transition-colors duration-300">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">Log History</h3>
                            <div className="max-h-[calc(100vh-24rem)] overflow-y-auto pr-2 space-y-4">
                                {status.logs && status.logs.length > 0 ? (
                                    status.logs.map((log, index) => (
                                        <div key={log.id} className={`${log.id % 2 ? 'bg-gray-300' : 'bg-gray-100'} p-4 rounded-lg hover:bg-gray-100 transition-colors duration-200`}>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div className="flex justify-between items-center col-span-2 pb-2 mb-2 border-b border-gray-200">
                                                    <span className="font-medium text-gray-900">{new Date(log.created_at).toLocaleTimeString()}</span>
                                                </div>
                                                <MetricItem label="Temperature" value={`${log.temperature}°C`} />
                                                <MetricItem label="Humidity" value={`${log.humidity}%`} />
                                                <MetricItem label="Pressure" value={`${log.pressure} hPa`} />
                                                <MetricItem label="Shock" value={`${log.shock.toFixed(2)} g`} />
                                                <MetricItem label="Tilt" value={`${log.tilt.toFixed(2)}°`} />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-center py-4">No logs available</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-center text-gray-500 text-sm md:text-base mt-8">
                    Last updated: {new Date().toLocaleString()}
                </div>
            </div>
        </div>
    );
}

interface StatusCardProps {
    title: string;
    items: Array<{ label: string; value: string }>;
    className?: string;
}

function StatusCard({ title, items, className = '' }: StatusCardProps) {
    return (
        <div className={`bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:border-[#00FFD1] transition-colors duration-300 ${className}`}>
            <h3 className="text-xl font-bold text-gray-800 mb-4">{title}</h3>
            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={index} className="flex flex-col">
                        <span className="text-sm font-medium text-gray-500">{item.label}</span>
                        <span className="text-base font-semibold text-gray-900">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MetricItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-gray-500">{label}:</span>
            <span className="font-medium text-gray-900">{value}</span>
        </div>
    );
}

interface MetricCardProps {
    icon: React.ReactNode;
    title: string;
    value: {
        value: string;
        isIncrease: boolean;
        color: string;
    };
    className?: string;
}

const MetricCard = ({ icon, title, value, className = '' }: MetricCardProps) => (
    <div className={`bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:border-[#00FFD1] transition-all duration-300 transform hover:scale-105 ${className}`}>
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
                <span className="text-[#00FFD1]">{icon}</span>
                <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            </div>
            <div className="flex items-center space-x-2">
                <span className={`text-2xl font-bold ${value.color}`}>
                    {value.value}%
                </span>
                {value.isIncrease ?
                    <BiTrendingUp className={`w-6 h-6 ${value.color}`} /> :
                    <BiTrendingDown className={`w-6 h-6 ${value.color}`} />
                }
            </div>
        </div>
    </div>
);