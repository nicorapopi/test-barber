-- PostgreSQL schema for Barber Management System (ตาม SRS เวอร์ชันย่อที่สอดคล้องกับ backend ปัจจุบัน)

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    join_date DATE,
    points INTEGER DEFAULT 0,
    member_tier TEXT DEFAULT 'Bronze'
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT DEFAULT 'ทำงาน',
    experience TEXT
);

CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);

CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    duration TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    stock INTEGER NOT NULL,
    unit TEXT DEFAULT 'ชิ้น'
);

CREATE TABLE IF NOT EXISTS queues (
    id SERIAL PRIMARY KEY,
    queue_no TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    service TEXT NOT NULL,
    barber TEXT NOT NULL,
    status TEXT NOT NULL,
    wait_time TEXT,
    avatar_key TEXT,
    status_class TEXT
);

CREATE INDEX IF NOT EXISTS idx_queues_status ON queues(status);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    bill_no TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    payment_method TEXT NOT NULL,
    order_date TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);

