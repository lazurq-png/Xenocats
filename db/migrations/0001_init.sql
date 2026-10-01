-- The schema the deleted app/seed/route.ts created, unchanged except that ids
-- come from the built-in gen_random_uuid() rather than the uuid-ossp extension.
-- Tables are created in the schema named by the URL's search_path
-- (scripts/db.mjs creates it first).

CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  image_url VARCHAR(255) NOT NULL
);

CREATE TABLE invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  amount INT NOT NULL,
  status VARCHAR(255) NOT NULL,
  date DATE NOT NULL
);

CREATE TABLE revenue (
  month VARCHAR(4) NOT NULL UNIQUE,
  revenue INT NOT NULL
);
