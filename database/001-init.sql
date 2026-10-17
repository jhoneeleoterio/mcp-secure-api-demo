BEGIN;
CREATE TABLE customers (id integer PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE);
CREATE TABLE products (
    sku text PRIMARY KEY, name text NOT NULL,
    available_quantity integer NOT NULL CHECK (available_quantity >= 0)
);
CREATE TABLE orders (
    id integer PRIMARY KEY, customer_id integer NOT NULL REFERENCES customers(id),
    status text NOT NULL, currency char(3) NOT NULL,
    created_at timestamptz NOT NULL
);
CREATE INDEX ON orders (customer_id, created_at DESC, id DESC);
CREATE TABLE order_items (
    order_id integer NOT NULL REFERENCES orders(id), sku text NOT NULL REFERENCES products(sku),
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
    PRIMARY KEY(order_id, sku)
);
INSERT INTO customers VALUES
    (1, 'Alice Demo', 'alice@example.test'), (2, 'Bruno Demo', 'bruno@example.test');
INSERT INTO products VALUES ('ABC-123', 'Demo Keyboard', 12), ('XYZ-999', 'Demo Mouse', 0);
INSERT INTO orders VALUES
    (1001, 1, 'shipped', 'BRL', '2026-10-01T12:00:00Z'),
    (1002, 1, 'processing', 'BRL', '2026-10-02T12:00:00Z');
INSERT INTO order_items VALUES (1001, 'XYZ-999', 1, 80.00), (1002, 'ABC-123', 2, 150.00);
COMMIT;
