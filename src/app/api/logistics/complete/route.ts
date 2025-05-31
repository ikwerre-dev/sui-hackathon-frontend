import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import pool from '@/lib/mysql';
import type { RowDataPacket } from 'mysql2';
import { saveLogsAsBlob, saveProductBlob } from '@/app/user/seller/products/utils/walrustools';

interface LogisticsUser extends RowDataPacket {
    id: number;
    name: string;
    email: string;
    balance: number;
    address: string;
    account_type: string;
}

interface Product extends RowDataPacket {
    id: number;
    product_code: string;
    product_name: string;
    status: string;
    logistics_wallet_address: string;
    logistics_location: string;
    created_at: Date;
    user_id: number;
    delivery_fee: number;
}

interface Log extends RowDataPacket {
    id: number;
    product_id: number;
    longitude: number;
    latitude: number;
    temperature: number;
    humidity: number;
    pressure: number;
    accel_x: number;
    accel_y: number;
    accel_z: number;
    gyro_x: number;
    gyro_y: number;
    gyro_z: number;
    created_at: Date;
}

export async function POST(request: NextRequest) {
    try {
        const { customer_id, product_id } = await request.json();

        if (!customer_id || !product_id) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const connection = await pool.getConnection();

        try {
            const [users] = await connection.execute<LogisticsUser[]>(
                'SELECT id, name, email, balance, address, account_type FROM users WHERE id = ?',
                [customer_id]
            );

            if (!users.length) {
                return NextResponse.json(
                    { error: 'Customer not found' },
                    { status: 404 }
                );
            }

            const customer = users[0];

            if (customer.account_type !== 'customer') {
                return NextResponse.json(
                    { error: 'User is not a customer' },
                    { status: 403 }
                );
            }

            const [products] = await connection.execute<Product[]>(
                'SELECT id, product_code, product_name, status, delivery_fee FROM products WHERE id = ?',
                [product_id]
            );

            if (!products.length) {
                return NextResponse.json(
                    { error: 'Product not found' },
                    { status: 404 }
                );
            }

            const product = products[0];



            const [scanRecord] = await connection.execute<RowDataPacket[]>(
                'SELECT id FROM scannedrecord WHERE product_id = ? AND live = true',
                [product_id]
            );

            if (!scanRecord.length) {
                return NextResponse.json(
                    { error: 'No active scan record found' },
                    { status: 400 }
                );
            }

            await connection.execute(
                'UPDATE scannedrecord SET status = ?, customer_id = ?, live = ? WHERE id = ?',
                ['delivered', customer_id, false, scanRecord[0].id]
            );
            if (product.status === 'delivered') {
                await connection.execute(
                    'DELETE FROM logs WHERE product_id = ?',
                    [product_id]
                );

                return NextResponse.json({
                    message: 'Already completed',
                    customer: {
                        name: customer.name,
                        email: customer.email,
                        balance: customer.balance,
                        address: customer.address
                    },
                    product: product
                });
            }
            const logisticsAmount = product.delivery_fee * 0.95;

            await connection.execute(
                'UPDATE users SET balance = balance + ? WHERE id = ?',
                [logisticsAmount, customer_id]
            );

            await connection.execute(
                'INSERT INTO transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
                [customer_id, logisticsAmount, 'credit', `Payment received for delivery of product ${product.product_code}`]
            );

            await connection.execute(
                `UPDATE products 
                SET status = 'delivered'
                WHERE id = ?`,
                [product_id]
            );

            const [updatedProducts] = await connection.execute<Product[]>(
                'SELECT id, product_code, product_name, status, logistics_wallet_address, blob_id, logistics_location, created_at FROM products WHERE id = ?',
                [product_id]
            );

            // Fetch all logs for this product
            const [logs] = await connection.execute<Log[]>(
                'SELECT * FROM logs WHERE product_id = ? ORDER BY created_at DESC',
                [product_id]
            );

            const processedLogs = logs.slice(0, 5).map(log => ({
                timestamp: log.created_at.toISOString(),
                action: "delivery_tracking",
                details: {
                    longitude: log.longitude,
                    latitude: log.latitude,
                    temperature: log.temperature,
                    humidity: log.humidity,
                    pressure: log.pressure,
                    acceleration: {
                        x: log.accel_x,
                        y: log.accel_y,
                        z: log.accel_z
                    },
                    gyroscope: {
                        x: log.gyro_x,
                        y: log.gyro_y,
                        z: log.gyro_z
                    }
                },
                productId: log.product_id.toString(),
                userId: customer_id.toString()
            }));

            // Save logs to Walrus
            const blobId = await saveLogsAsBlob(processedLogs);

            // Delete logs after successful blob storage
            await connection.execute(
                'DELETE FROM logs WHERE product_id = ?',
                [product_id]
            );

            // Update scannedrecord
            await connection.execute(
                'UPDATE scannedrecord SET status = ?, customer_id = ?, live = ? WHERE id = ?',
                ['delivered', customer_id, false, scanRecord[0].id]
            );
            return NextResponse.json({
                message: 'Logistics Completed',
                customer: {
                    name: customer.name,
                    email: customer.email,
                    balance: customer.balance,
                    address: customer.address
                },
                product: updatedProducts[0],
                blob_id: blobId
            });
        } finally {
            connection.release();
        }
    } catch (error: any) {
        console.error('Logistics completion error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}