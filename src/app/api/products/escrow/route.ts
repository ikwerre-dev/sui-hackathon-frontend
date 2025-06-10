import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import pool from '@/lib/mysql';
import { createEscrowWallet, transferToEscrow } from '@/utils/wallet';
import { RowDataPacket } from 'mysql2';

// Define interfaces for our database rows
interface UserWallet extends RowDataPacket {
  address: string;
  private_key: string;
}

async function ensureEscrowTable() {
  const connection = await pool.getConnection();
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS escrow_details (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_id VARCHAR(255) NOT NULL,
        wallet_address VARCHAR(255) NOT NULL,
        private_key VARCHAR(255) NOT NULL,
        public_key VARCHAR(255) NOT NULL,
        amount DECIMAL(20, 8) NOT NULL,
        status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Escrow details table created or verified');
  } finally {
    connection.release();
  }
}

async function ensureColumns() {
  const connection = await pool.getConnection();
  try {
    // Check existing columns in products table
    const [columns] = await connection.execute<RowDataPacket[]>(
      'SHOW COLUMNS FROM products'
    );
    
    const columnNames = (columns as RowDataPacket[]).map(col => col.Field);
    
    // Add missing columns with proper error handling
    const requiredColumns = [
      {
        name: 'recipient_email',
        definition: 'VARCHAR(255) NOT NULL DEFAULT ""'
      },
      {
        name: 'escrow_status',
        definition: 'ENUM("pending", "completed", "failed") DEFAULT "pending"'
      }
    ];

    for (const column of requiredColumns) {
      if (!columnNames.includes(column.name)) {
        try {
          await connection.execute(
            `ALTER TABLE products ADD COLUMN ${column.name} ${column.definition}`
          );
          console.log(`Added ${column.name} column to products table`);
        } catch (error) {
          console.error(`Failed to add ${column.name} column:`, error);
          throw new Error(`Failed to add required column: ${column.name}`);
        }
      }
    }

    // Verify columns were added successfully
    const [updatedColumns] = await connection.execute<RowDataPacket[]>(
      'SHOW COLUMNS FROM products'
    );
    const updatedColumnNames = updatedColumns.map(col => col.Field);
    
    const missingColumns = requiredColumns
      .filter(col => !updatedColumnNames.includes(col.name))
      .map(col => col.name);

    if (missingColumns.length > 0) {
      throw new Error(`Failed to verify columns: ${missingColumns.join(', ')}`);
    }

  } finally {
    connection.release();
  }
}



export async function POST(request: NextRequest) {
  try {
    await ensureEscrowTable();
    await ensureColumns();

    const body = await request.json();
    const { product_id, amount, sender_email, logistics_email } = body;

    // Validate required fields
    if (!product_id || !amount || !sender_email || !logistics_email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();
    
    try {
      // Type the query results
      const [sender] = await connection.execute<UserWallet[]>(
        'SELECT address, private_key FROM users WHERE email = ?',
        [sender_email]
      );

      const [logistics] = await connection.execute<UserWallet[]>(
        'SELECT address FROM users WHERE email = ?',
        [logistics_email]
      );

      if (!sender[0] || !logistics[0]) {
        return NextResponse.json(
          { error: 'User wallet not found' },
          { status: 404 }
        );
      }

      // Create escrow wallet
      const escrowWallet = await createEscrowWallet(String(product_id));

      if (!escrowWallet?.address || !escrowWallet?.secretKey || !escrowWallet?.publicKey) {
        throw new Error('Invalid escrow wallet created');
      }
      console.log("Sender issues: ", sender[0])

      // Transfer funds to escrow
      await transferToEscrow(
        sender[0].address,
        sender[0].private_key,
        escrowWallet.address,
        amount
      );
      await setTimeout(() => {
        console.log("BBB")
      }, 3000)
      // Prepare parameters with explicit type conversion
      const escrowParams = [
        Number(product_id),
        String(escrowWallet.address),
        String(escrowWallet.secretKey),
        String(escrowWallet.publicKey),
        Number(amount),
        'pending'
      ];

      // Validate all parameters are defined
      if (escrowParams.some(param => param === undefined || param === null)) {
        throw new Error('Invalid escrow parameters');
      }

      // Save escrow details
      await connection.execute(
        'INSERT INTO escrow_details (product_id, wallet_address, private_key, public_key, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
        [
          String(product_id),
          String(escrowWallet.address),
          String(escrowWallet.secretKey),
          String(escrowWallet.publicKey),
          Number(amount),
          'pending'
        ]
      );

      return NextResponse.json({ 
        message: 'Escrow details created successfully',
        wallet: {
          address: escrowWallet.address,
          publicKey: escrowWallet.publicKey,
          privateKey: escrowWallet.privateKey
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Escrow creation error:', error);
    return NextResponse.json(
      { 
        error: `Failed to create escrow: ${error instanceof Error ? error.message : String(error)}` 
      },
      { status: 500 }
    );
  }
}