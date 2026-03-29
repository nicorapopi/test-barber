import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// Initialize SQLite database
let db: any;
const isPostgres = process.env.DB_CLIENT === 'postgres' || !!process.env.DATABASE_URL;

function toPostgresParams(sql: string) {
    let idx = 0;
    return sql.replace(/\?/g, () => `$${++idx}`);
}

function createPgDb(pool: any) {
    return {
        exec: async (sql: string) => {
            await pool.query(sql);
        },
        run: async (sql: string, params: any[] = []) => {
            const mappedSql = toPostgresParams(sql);
            const isInsert = /^\s*insert\s+/i.test(mappedSql);
            const hasReturning = /\sreturning\s+/i.test(mappedSql);
            const finalSql = isInsert && !hasReturning ? `${mappedSql} RETURNING id` : mappedSql;
            const result = await pool.query(finalSql, params);
            return { lastID: result.rows?.[0]?.id };
        },
        get: async (sql: string, params: any[] = []) => {
            const result = await pool.query(toPostgresParams(sql), params);
            return result.rows[0];
        },
        all: async (sql: string, params: any[] = []) => {
            const result = await pool.query(toPostgresParams(sql), params);
            return result.rows;
        }
    };
}

async function ensureColumn(tableName: string, columnName: string, columnDef: string) {
    if (isPostgres) {
        const result = await db.get(
            `SELECT 1 as found
             FROM information_schema.columns
             WHERE table_name = ? AND column_name = ?`,
            [tableName.toLowerCase(), columnName.toLowerCase()]
        );
        if (!result) {
            await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
        }
        return;
    }

    const columns = await db.all(`PRAGMA table_info(${tableName})`);
    const exists = columns.some((col: any) => col.name === columnName);
    if (!exists) {
        await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
    }
}

async function setupDatabase() {
    if (isPostgres) {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        db = createPgDb(pool);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS queues (
                id SERIAL PRIMARY KEY,
                queueNo TEXT NOT NULL,
                customerName TEXT NOT NULL,
                service TEXT NOT NULL,
                barber TEXT NOT NULL,
                status TEXT NOT NULL,
                waitTime TEXT,
                avatarKey TEXT,
                statusClass TEXT
            );
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT,
                joinDate TEXT,
                points INTEGER DEFAULT 0,
                memberTier TEXT DEFAULT 'Bronze'
            );
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS staff (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                nickname TEXT NOT NULL,
                role TEXT NOT NULL,
                status TEXT DEFAULT 'ทำงาน',
                experience TEXT
            );
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                price NUMERIC(10,2) NOT NULL,
                duration TEXT NOT NULL
            );
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                price NUMERIC(10,2) NOT NULL,
                stock INTEGER NOT NULL,
                unit TEXT DEFAULT 'ชิ้น'
            );
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                billNo TEXT NOT NULL,
                customerName TEXT NOT NULL,
                totalAmount NUMERIC(10,2) NOT NULL,
                paymentMethod TEXT NOT NULL,
                orderDate TIMESTAMPTZ NOT NULL
            );
        `);
    } else {
    db = await open({
        filename: 'barber.db',
        driver: sqlite3.Database
    });

    // 1. Queues Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS queues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            queueNo TEXT NOT NULL,
            customerName TEXT NOT NULL,
            service TEXT NOT NULL,
            barber TEXT NOT NULL,
            status TEXT NOT NULL,
            waitTime TEXT,
            avatarKey TEXT,
            statusClass TEXT
        );
    `);

    // 2. Customers Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            joinDate TEXT,
            points INTEGER DEFAULT 0,
            memberTier TEXT DEFAULT 'Bronze'
        );
    `);

    // 3. Staff Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS staff (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            nickname TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT DEFAULT 'ทำงาน',
            experience TEXT
        );
    `);

    // 4. Services Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            duration TEXT NOT NULL
        );
    `);

    // 5. Products Table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            stock INTEGER NOT NULL,
            unit TEXT DEFAULT 'ชิ้น'
        );
    `);

    // 6. Orders Table (POS)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            billNo TEXT NOT NULL,
            customerName TEXT NOT NULL,
            totalAmount REAL NOT NULL,
            paymentMethod TEXT NOT NULL,
            orderDate TEXT NOT NULL
        );
    `);
    }

    // Incremental schema updates for richer business logic
    await ensureColumn('customers', 'birthDate', 'TEXT');
    await ensureColumn('orders', 'discountAmount', 'REAL DEFAULT 0');
    await ensureColumn('orders', 'netAmount', 'REAL DEFAULT 0');
    await ensureColumn('orders', 'pointsEarned', 'INTEGER DEFAULT 0');
    await ensureColumn('orders', 'pointsUsed', 'INTEGER DEFAULT 0');

    // Insert mock data if empty
    const queueCount = await db.get('SELECT COUNT(*) as count FROM queues');
    if (queueCount.count === 0) {
        await db.run(`
            INSERT INTO queues (queueNo, customerName, service, barber, status, waitTime, avatarKey, statusClass)
            VALUES 
            ('A012', 'คุณสมชาย ใจดี', 'ตัดผมชาย (Modern)', 'ช่างเอก (Senior)', 'กำลังให้บริการ', '-', 'สมชาย', 'status-serving'),
            ('B045', 'คุณวิภาวรรณ', 'ตัด+สระ+เซ็ท', 'ช่างนัท', 'รอคิว', '10 นาที', 'วิภาวรรณ', 'status-waiting'),
            ('A013', 'คุณปฐมพงษ์', 'โกนหนวด / ตกแต่ง', 'ช่างเอก (Senior)', 'รอคิว', '25 นาที', 'ปฐมพงษ์', 'status-waiting'),
            ('A011', 'คุณธนกฤต', 'ตัดผมชาย (Modern)', 'ช่างบอย', 'เสร็จสิ้น', '-', 'ธนกฤต', 'status-done')
        `);
    }

    const customerCount = await db.get('SELECT COUNT(*) as count FROM customers');
    if (customerCount.count === 0) {
        await db.run(`
            INSERT INTO customers (code, name, phone, email, joinDate, points, memberTier) VALUES
            ('C001', 'คุณสมชาย ใจดี', '081-234-5678', 'somchai@email.com', '2023-01-15', 1250, 'Gold'),
            ('C002', 'คุณวิภาวรรณ สุขสันต์', '089-876-5432', 'wipawan@email.com', '2023-03-22', 450, 'Silver'),
            ('C003', 'คุณปฐมพงษ์ รักดี', '085-555-4444', '', '2023-11-05', 120, 'Bronze')
        `);
    }

    const staffCount = await db.get('SELECT COUNT(*) as count FROM staff');
    if (staffCount.count === 0) {
        await db.run(`
            INSERT INTO staff (name, nickname, role, status, experience) VALUES
            ('ช่างเอกชัย รักผม', 'เอก', 'Senior Barber', 'ทำงาน', '12 ปี'),
            ('ช่างนัทธมน เส้นสวย', 'นัท', 'Barber / Colorist', 'ทำงาน', '5 ปี'),
            ('ช่างปิยะพงษ์ ทรงเท่', 'บอย', 'Junior Barber', 'พักเบรค', '2 ปี')
        `);
    }

    const serviceCount = await db.get('SELECT COUNT(*) as count FROM services');
    if (serviceCount.count === 0) {
        await db.run(`
            INSERT INTO services (name, category, price, duration) VALUES
            ('ตัดผมชาย (Modern)', 'ตัดผม', 350, '45 นาที'),
            ('ตัดผมหญิง (สระ+เซ็ท)', 'ตัดผม', 450, '60 นาที'),
            ('ตัด+สระ+เซ็ท (แพ็คเกจ)', 'แพ็คเกจ', 500, '60 นาที'),
            ('ทำสี Highlight', 'ทำสี', 1500, '120 นาที'),
            ('ดัดวอลลุ่มชาย', 'ดัดผม', 1200, '90 นาที'),
            ('โกนหนวด / ตกแต่ง', 'บริการเสริม', 200, '20 นาที')
        `);
    }

    const productCount = await db.get('SELECT COUNT(*) as count FROM products');
    if (productCount.count === 0) {
        await db.run(`
            INSERT INTO products (code, name, category, price, stock, unit) VALUES
            ('P001', 'แชมพูสูตรเย็น 500ml', 'แชมพู/ครีมนวด', 150, 20, 'ขวด'),
            ('P002', 'เยลแต่งผม (Hard Hold)', 'เครื่องแต่งผม', 120, 15, 'กระปุก'),
            ('P003', 'เซรั่มบำรุงเส้นผม', 'เซรั่มบำรุง', 250, 10, 'ขวด')
        `);
    }
}

setupDatabase().then(() => {
    console.log('Database initialized successfully.');
}).catch((err) => {
    console.error('Database initialization failed:', err);
});

// --- API ROUTES ---

// Queues
app.get('/api/queues', async (req, res) => {
    try {
        const queues = await db.all('SELECT * FROM queues ORDER BY id DESC');
        res.json(queues);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch queues' });
    }
});

app.post('/api/queues', async (req, res) => {
    const { customerName, service, barber } = req.body;
    const randomChar = String.fromCharCode(65 + Math.floor(Math.random() * 2));
    const randomNum = String(Math.floor(Math.random() * 100)).padStart(3, '0');
    const queueNo = `${randomChar}${randomNum}`;
    const status = 'รอคิว';
    const waitTime = '15 นาที';
    const avatarKey = customerName.split(' ')[0] || 'User';
    const statusClass = 'status-waiting';

    try {
        const result = await db.run(
            'INSERT INTO queues (queueNo, customerName, service, barber, status, waitTime, avatarKey, statusClass) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [queueNo, customerName, service, barber, status, waitTime, avatarKey, statusClass]
        );
        const newQueue = await db.get('SELECT * FROM queues WHERE id = ?', result.lastID);
        res.status(201).json(newQueue);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add queue' });
    }
});

app.put('/api/queues/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, statusClass } = req.body;
    const waitTime = status === 'กำลังให้บริการ' || status === 'เสร็จสิ้น' ? '-' : '15 นาที';

    try {
        await db.run(
            'UPDATE queues SET status = ?, statusClass = ?, waitTime = ? WHERE id = ?',
            [status, statusClass, waitTime, id]
        );
        res.json({ message: 'Queue updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update queue' });
    }
});

app.delete('/api/queues/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM queues WHERE id = ?', [req.params.id]);
        res.json({ message: 'Queue deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete queue' });
    }
});

// Customers
app.get('/api/customers', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const customers = q
            ? await db.all(
                'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY id DESC',
                [`%${q}%`, `%${q}%`]
            )
            : await db.all('SELECT * FROM customers ORDER BY id DESC');
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

app.post('/api/customers', async (req, res) => {
    const { name, phone, email, memberTier, birthDate } = req.body;
    const code = 'C' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const joinDate = new Date().toISOString().split('T')[0];
    
    try {
        const result = await db.run(
            'INSERT INTO customers (code, name, phone, email, joinDate, points, memberTier, birthDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [code, name, phone, email || '', joinDate, 0, memberTier || 'Bronze', birthDate || null]
        );
        const newCustomer = await db.get('SELECT * FROM customers WHERE id = ?', result.lastID);
        res.status(201).json(newCustomer);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add customer' });
    }
});

app.put('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    const { name, phone, email, memberTier, birthDate } = req.body;
    try {
        await db.run(
            'UPDATE customers SET name = ?, phone = ?, email = ?, memberTier = ?, birthDate = ? WHERE id = ?',
            [name, phone, email, memberTier, birthDate || null, id]
        );
        res.json({ message: 'Customer updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

app.delete('/api/customers/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM customers WHERE id = ?', [req.params.id]);
        res.json({ message: 'Customer deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

// Staff
app.get('/api/staff', async (req, res) => {
    try {
        const staff = await db.all('SELECT * FROM staff ORDER BY id ASC');
        res.json(staff);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch staff' });
    }
});

app.post('/api/staff', async (req, res) => {
    const { name, nickname, role, experience } = req.body;
    try {
        const result = await db.run(
            'INSERT INTO staff (name, nickname, role, experience) VALUES (?, ?, ?, ?)',
            [name, nickname, role, experience || '-']
        );
        const newStaff = await db.get('SELECT * FROM staff WHERE id = ?', result.lastID);
        res.status(201).json(newStaff);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add staff' });
    }
});

app.put('/api/staff/:id', async (req, res) => {
    const { id } = req.params;
    const { name, nickname, role, experience } = req.body;
    try {
        await db.run(
            'UPDATE staff SET name = ?, nickname = ?, role = ?, experience = ? WHERE id = ?',
            [name, nickname, role, experience, id]
        );
        res.json({ message: 'Staff updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update staff' });
    }
});

// Services
app.get('/api/services', async (req, res) => {
    try {
        const services = await db.all('SELECT * FROM services ORDER BY category, id');
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});

app.post('/api/services', async (req, res) => {
    const { name, category, price, duration } = req.body;
    try {
        const result = await db.run(
            'INSERT INTO services (name, category, price, duration) VALUES (?, ?, ?, ?)',
            [name, category, price, duration || '30 นาที']
        );
        const newService = await db.get('SELECT * FROM services WHERE id = ?', result.lastID);
        res.status(201).json(newService);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add service' });
    }
});

app.put('/api/services/:id', async (req, res) => {
    const { id } = req.params;
    const { name, category, price, duration } = req.body;
    try {
        await db.run(
            'UPDATE services SET name = ?, category = ?, price = ?, duration = ? WHERE id = ?',
            [name, category, price, duration, id]
        );
        res.json({ message: 'Service updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update service' });
    }
});

// Products
app.get('/api/products', async (req, res) => {
    try {
        const products = await db.all('SELECT * FROM products ORDER BY code');
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.post('/api/products', async (req, res) => {
    const { name, category, price, stock, unit } = req.body;
    const code = 'P' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    try {
        const result = await db.run(
            'INSERT INTO products (code, name, category, price, stock, unit) VALUES (?, ?, ?, ?, ?, ?)',
            [code, name, category, price, stock || 0, unit || 'ชิ้น']
        );
        const newProduct = await db.get('SELECT * FROM products WHERE id = ?', result.lastID);
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add product' });
    }
});

app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { name, category, price, stock, unit } = req.body;
    try {
        await db.run(
            'UPDATE products SET name = ?, category = ?, price = ?, stock = ?, unit = ? WHERE id = ?',
            [name, category, price, stock, unit, id]
        );
        res.json({ message: 'Product updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update product' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Orders (POS)
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await db.all('SELECT * FROM orders ORDER BY id DESC');
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

app.post('/api/orders', async (req, res) => {
    const { customerName, totalAmount, paymentMethod, pointsUsed = 0 } = req.body;
    const billNo = 'INV' + new Date().getTime().toString().slice(-6);
    const orderDate = new Date().toISOString();

    try {
        const rawTotal = Number(totalAmount || 0);
        const usePoints = Math.max(0, Number(pointsUsed || 0));
        let discountAmount = 0;
        let calculatedPointsEarned = Math.floor(rawTotal);
        let customer: any = null;

        if (customerName) {
            customer = await db.get('SELECT * FROM customers WHERE name = ?', [customerName]);
        }

        if (customer) {
            const tierDiscountRateMap: Record<string, number> = {
                Bronze: 0,
                Silver: 0.05,
                Gold: 0.1,
                Platinum: 0.2
            };
            const tierRate = tierDiscountRateMap[customer.memberTier] || 0;
            discountAmount += rawTotal * tierRate;

            // Birthday x2 points if same day/month
            if (customer.birthDate) {
                const birth = new Date(customer.birthDate);
                const now = new Date();
                const isBirthday = birth.getDate() === now.getDate() && birth.getMonth() === now.getMonth();
                if (isBirthday) calculatedPointsEarned *= 2;
            }
        }

        const maxPointsUsable = customer ? (customer.points || 0) : 0;
        const actualPointsUsed = Math.min(usePoints, maxPointsUsable);
        const netAmount = Math.max(0, rawTotal - discountAmount - actualPointsUsed);

        const result = await db.run(
            `INSERT INTO orders 
            (billNo, customerName, totalAmount, paymentMethod, orderDate, discountAmount, netAmount, pointsEarned, pointsUsed) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                billNo,
                customerName || 'ลูกค้าทั่วไป',
                rawTotal,
                paymentMethod || 'เงินสด',
                orderDate,
                discountAmount,
                netAmount,
                calculatedPointsEarned,
                actualPointsUsed
            ]
        );

        if (customer) {
            const currentPoints = customer.points || 0;
            const newPoints = Math.max(0, currentPoints - actualPointsUsed + calculatedPointsEarned);
            await db.run('UPDATE customers SET points = ? WHERE id = ?', [newPoints, customer.id]);
        }

        const newOrder = await db.get('SELECT * FROM orders WHERE id = ?', result.lastID);
        res.status(201).json(newOrder);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add order' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        // Customers today = จำนวนบิลวันนี้ (ประมาณจำนวนลูกค้าที่ใช้บริการ)
        const customersTodayResult = await db.get(
            isPostgres
                ? "SELECT COUNT(*)::int as count FROM orders WHERE CAST(orderDate AS date) = CURRENT_DATE"
                : "SELECT COUNT(*) as count FROM orders WHERE date(orderDate) = date('now')"
        );

        // Revenue today = ผลรวมยอดขายวันนี้
        const ordersResult = await db.get(
            isPostgres
                ? "SELECT SUM(COALESCE(netAmount, totalAmount)) as total FROM orders WHERE CAST(orderDate AS date) = CURRENT_DATE"
                : "SELECT SUM(COALESCE(netAmount, totalAmount)) as total FROM orders WHERE date(orderDate) = date('now')"
        );

        // Current waiting
        const waitingResult = await db.get(
            "SELECT COUNT(*) as count FROM queues WHERE status = 'รอคิว'"
        );

        // Staff working
        const staffWorkingResult = await db.get(
            "SELECT COUNT(*) as count FROM staff WHERE status = 'ทำงาน'"
        );
        const staffTotalResult = await db.get(
            "SELECT COUNT(*) as count FROM staff"
        );

        res.json({
            customersToday: customersTodayResult.count || 0,
            revenueToday: ordersResult.total || 0,
            queueWaiting: waitingResult.count || 0,
            staffWorking: staffWorkingResult.count || 0,
            staffTotal: staffTotalResult.count || 0
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/api/reports/revenue-week', async (req, res) => {
    try {
        const rows = await db.all(
            isPostgres
                ? `
                SELECT CAST(orderDate AS date) as d, SUM(COALESCE(netAmount, totalAmount)) as total
                FROM orders
                WHERE CAST(orderDate AS date) >= CURRENT_DATE - INTERVAL '6 day'
                GROUP BY CAST(orderDate AS date)
                ORDER BY CAST(orderDate AS date)
            `
                : `
                SELECT date(orderDate) as d, SUM(COALESCE(netAmount, totalAmount)) as total
                FROM orders
                WHERE date(orderDate) >= date('now', '-6 day')
                GROUP BY date(orderDate)
                ORDER BY date(orderDate)
            `
        );

        const dayMap = new Map<string, number>();
        rows.forEach((r: any) => dayMap.set(r.d, Number(r.total || 0)));

        const labels: string[] = [];
        const data: number[] = [];
        for (let i = 6; i >= 0; i -= 1) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const iso = d.toISOString().slice(0, 10);
            labels.push(d.toLocaleDateString('th-TH', { weekday: 'short' }));
            data.push(dayMap.get(iso) || 0);
        }

        res.json({ labels, data });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch weekly revenue report' });
    }
});

app.get('/api/reports/services', async (req, res) => {
    try {
        const rows = await db.all(`
            SELECT service as name, COUNT(*) as count
            FROM queues
            GROUP BY service
            ORDER BY count DESC
            LIMIT 6
        `);
        res.json({
            labels: rows.map((r: any) => r.name),
            data: rows.map((r: any) => Number(r.count || 0))
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch service report' });
    }
});

app.listen(port, () => {
    console.log(`Backend API running at http://localhost:${port}`);
});
