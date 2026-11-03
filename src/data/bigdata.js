// Big practice datasets, generated inside DuckDB from range() + a seeded hash, so nothing is downloaded
// and every learner sees exactly the same rows. A little mess is added on purpose (duplicates, NULLs,
// late events) because real pipelines are messy.

export const BIG = [
  {
    name: 'shop_customers', rows: 100_000, about: 'E-commerce customers across India and abroad. About 2% have no city and 3% no email.',
    cols: 'customer_id, full_name, email, city, country, segment, signup_date, is_premium',
  },
  {
    name: 'shop_products', rows: 5_000, about: 'Catalogue with category, brand and list price.',
    cols: 'product_id, product_name, category, brand, list_price, launched_on',
  },
  {
    name: 'shop_orders', rows: 1_000_000, about: 'Two years of orders (2024 to 2025). Joins to customers and products.',
    cols: 'order_id, customer_id, product_id, order_ts, quantity, unit_price, discount_pct, status, payment_method, channel',
  },
  {
    name: 'web_events', rows: 1_000_000, about: 'Clickstream. About 1% of events arrive twice (same event_id) and 20% are anonymous: practise dedup and funnels.',
    cols: 'event_id, user_id, session_id, event_ts, event_type, page, device, country',
  },
  {
    name: 'taxi_trips', rows: 500_000, about: 'City cab trips with zones, distance, fare and tip. Some trips have bad data (zero distance, negative fare).',
    cols: 'trip_id, pickup_ts, dropoff_ts, pickup_zone, dropoff_zone, distance_km, passengers, fare, tip, payment_type',
  },
]

export const BIG_TOTAL = BIG.reduce((a, b) => a + b.rows, 0)

const R = (salt) => `(hash(i * 7919 + ${salt}) % 1000000) / 1000000.0`
const pick = (arr, salt) => `[${arr.map((x) => `'${x}'`).join(',')}][1 + (hash(i * 104729 + ${salt}) % ${arr.length})::INT]`

const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Ananya', 'Diya', 'Isha', 'Kabir', 'Meera', 'Rohan', 'Saanvi', 'Arjun', 'Priya', 'Neha', 'Rahul', 'Zoya', 'Sam', 'Emma', 'Liam', 'Olivia', 'Noah', 'Mia', 'Lucas', 'Sofia', 'Omar', 'Yuki', 'Chen', 'Fatima', 'Leo']
const LAST = ['Sharma', 'Patel', 'Reddy', 'Iyer', 'Khan', 'Singh', 'Gupta', 'Nair', 'Das', 'Mehta', 'Rao', 'Joshi', 'Smith', 'Brown', 'Garcia', 'Müller', 'Silva', 'Tanaka', 'Wang', 'Ali']
const CITY = [['Bengaluru', 'India'], ['Mumbai', 'India'], ['Delhi', 'India'], ['Hyderabad', 'India'], ['Pune', 'India'], ['Chennai', 'India'], ['Kolkata', 'India'], ['Ahmedabad', 'India'], ['Jaipur', 'India'], ['Kochi', 'India'], ['London', 'UK'], ['Manchester', 'UK'], ['New York', 'USA'], ['Austin', 'USA'], ['Seattle', 'USA'], ['Toronto', 'Canada'], ['Berlin', 'Germany'], ['Dubai', 'UAE'], ['Singapore', 'Singapore'], ['Sydney', 'Australia']]
const CATS = ['Electronics', 'Fashion', 'Home', 'Beauty', 'Sports', 'Books', 'Grocery', 'Toys']
const BRANDS = ['Nova', 'Zenith', 'Orbit', 'Lumen', 'Kite', 'Atlas', 'Pulse', 'Ember', 'Vista', 'Crest', 'Halo', 'Drift']
const ITEMS = ['Headphones', 'Sneakers', 'Backpack', 'Desk Lamp', 'Water Bottle', 'Yoga Mat', 'Smartwatch', 'Notebook', 'Jacket', 'Blender', 'Face Serum', 'Board Game', 'Coffee Beans', 'Keyboard', 'Sunglasses', 'Cushion']
const ZONES = ['Airport', 'Central', 'Old Town', 'Tech Park', 'University', 'Harbour', 'Stadium', 'Station', 'Market', 'Riverside', 'Hills', 'Lakeside']

function cityCase(salt) {
  const k = `(hash(i * 15485863 + ${salt}) % ${CITY.length})::INT`
  return { k, city: `[${CITY.map(([c]) => `'${c}'`).join(',')}][1 + ${k}]`, country: `[${CITY.map(([, c]) => `'${c}'`).join(',')}][1 + ${k}]` }
}

export function bigSetupSql() {
  const c = cityCase(3)
  return [
    `CREATE TABLE IF NOT EXISTS main.shop_products AS
SELECT i AS product_id,
  ${pick(BRANDS, 1)} || ' ' || ${pick(ITEMS, 2)} || ' ' || (1 + i % 9)::VARCHAR AS product_name,
  ${pick(CATS, 3)} AS category,
  ${pick(BRANDS, 1)} AS brand,
  ROUND(99 + pow(${R(4)}, 2) * 49900, 0)::DECIMAL(10,2) AS list_price,
  (DATE '2019-01-01' + (${R(5)} * 2400)::INT) AS launched_on
FROM range(1, 5001) t(i)`,
    `CREATE TABLE IF NOT EXISTS main.shop_customers AS
SELECT i AS customer_id,
  ${pick(FIRST, 1)} || ' ' || ${pick(LAST, 2)} AS full_name,
  CASE WHEN ${R(9)} < 0.03 THEN NULL ELSE lower(${pick(FIRST, 1)}) || '.' || i::VARCHAR || '@example.com' END AS email,
  CASE WHEN ${R(4)} < 0.02 THEN NULL ELSE ${c.city} END AS city,
  ${c.country} AS country,
  ${pick(['Consumer', 'Consumer', 'Consumer', 'Small Business', 'Corporate'], 5)} AS segment,
  (DATE '2021-01-01' + (${R(6)} * 1460)::INT) AS signup_date,
  ${R(7)} < 0.18 AS is_premium
FROM range(1, 100001) t(i)`,
    `CREATE TABLE IF NOT EXISTS main.shop_orders AS
SELECT i AS order_id,
  1 + (pow(${R(1)}, 1.6) * 99999)::INT AS customer_id,
  1 + (pow(${R(2)}, 2) * 4999)::INT AS product_id,
  TIMESTAMP '2024-01-01' + to_seconds((${R(3)} * 63158400)::BIGINT) AS order_ts,
  1 + (pow(${R(4)}, 3) * 5)::INT AS quantity,
  ROUND(99 + pow(${R(12)}, 2) * 49900, 0)::DECIMAL(10,2) AS unit_price,
  ${pick(['0', '0', '0', '5', '10', '15', '20', '30'], 6)}::INT AS discount_pct,
  ${pick(['delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'shipped', 'cancelled', 'returned'], 7)} AS status,
  ${pick(['UPI', 'UPI', 'UPI', 'Card', 'Card', 'Net banking', 'Cash on delivery', 'Wallet'], 8)} AS payment_method,
  ${pick(['app', 'app', 'web', 'web', 'marketplace'], 9)} AS channel
FROM range(1, 1000001) t(i)`,
    `CREATE TABLE IF NOT EXISTS main.web_events AS
WITH base AS (
  SELECT i,
    CASE WHEN ${R(1)} < 0.2 THEN NULL ELSE 1 + (pow(${R(2)}, 1.4) * 99999)::INT END AS user_id,
    'S' || (1 + i // 6)::VARCHAR AS session_id,
    TIMESTAMP '2025-01-01' + to_seconds((i // 6 * 31.5 + (i % 6) * 40 + ${R(3)} * 30)::BIGINT) AS event_ts,
    CASE (i % 6) WHEN 0 THEN 'page_view' WHEN 1 THEN 'page_view' WHEN 2 THEN (CASE WHEN ${R(4)} < 0.45 THEN 'add_to_cart' ELSE 'page_view' END)
      WHEN 3 THEN (CASE WHEN ${R(4)} < 0.25 THEN 'checkout' ELSE 'page_view' END) WHEN 4 THEN (CASE WHEN ${R(4)} < 0.18 THEN 'purchase' ELSE 'scroll' END) ELSE 'scroll' END AS event_type,
    ${pick(['/home', '/search', '/product', '/product', '/product', '/cart', '/checkout', '/offers'], 5)} AS page,
    ${pick(['mobile', 'mobile', 'mobile', 'desktop', 'desktop', 'tablet'], 6)} AS device,
    ${pick(['IN', 'IN', 'IN', 'IN', 'US', 'UK', 'AE', 'SG', 'DE'], 7)} AS country
  FROM range(1, 990001) t(i)
)
SELECT i AS event_id, user_id, session_id, event_ts, event_type, page, device, country FROM base
UNION ALL
SELECT i AS event_id, user_id, session_id, event_ts + INTERVAL 2 SECOND, event_type, page, device, country FROM base WHERE i % 99 = 0`,
    `CREATE TABLE IF NOT EXISTS main.taxi_trips AS
WITH b AS (
  SELECT i,
    TIMESTAMP '2025-03-01' + to_seconds((${R(1)} * 2678400)::BIGINT) AS pickup_ts,
    CASE WHEN ${R(2)} < 0.004 THEN 0 ELSE ROUND(0.4 + pow(${R(3)}, 2.2) * 38, 2) END AS distance_km
  FROM range(1, 500001) t(i)
)
SELECT i AS trip_id, pickup_ts,
  pickup_ts + to_seconds((120 + distance_km * (100 + ${R(4)} * 140))::BIGINT) AS dropoff_ts,
  ${pick(ZONES, 5)} AS pickup_zone, ${pick(ZONES, 6)} AS dropoff_zone,
  distance_km,
  1 + (pow(${R(7)}, 3) * 4)::INT AS passengers,
  CASE WHEN ${R(8)} < 0.002 THEN -ROUND(40 + distance_km * 18, 2) ELSE ROUND(40 + distance_km * 18 + ${R(9)} * 30, 2) END AS fare,
  CASE WHEN ${R(10)} < 0.6 THEN 0 ELSE ROUND(${R(11)} * 80, 2) END AS tip,
  ${pick(['UPI', 'UPI', 'Card', 'Cash', 'Cash'], 12)} AS payment_type
FROM b`,
  ]
}

export const BIG_EXAMPLES = [
  ['Revenue by month', `SELECT date_trunc('month', order_ts) AS month,
       COUNT(*) AS orders,
       ROUND(SUM(quantity * unit_price * (1 - discount_pct / 100.0))) AS revenue
FROM shop_orders
WHERE status = 'delivered'
GROUP BY ALL
ORDER BY month;`],
  ['Top cities', `SELECT c.city, COUNT(*) AS orders, ROUND(SUM(o.quantity * o.unit_price)) AS gross
FROM shop_orders o
JOIN shop_customers c USING (customer_id)
WHERE c.city IS NOT NULL
GROUP BY c.city
ORDER BY gross DESC
LIMIT 10;`],
  ['Best seller per category', `SELECT category, product_name, units
FROM (
  SELECT p.category, p.product_name, SUM(o.quantity) AS units,
         ROW_NUMBER() OVER (PARTITION BY p.category ORDER BY SUM(o.quantity) DESC) AS rn
  FROM shop_orders o
  JOIN shop_products p USING (product_id)
  GROUP BY p.category, p.product_name
)
WHERE rn = 1
ORDER BY units DESC;`],
  ['Repeat customers', `WITH per_customer AS (
  SELECT customer_id, COUNT(*) AS orders
  FROM shop_orders
  GROUP BY customer_id
)
SELECT CASE WHEN orders = 1 THEN '1 order' WHEN orders <= 5 THEN '2-5 orders'
            WHEN orders <= 20 THEN '6-20 orders' ELSE '20+ orders' END AS bucket,
       COUNT(*) AS customers
FROM per_customer
GROUP BY bucket
ORDER BY MIN(orders);`],
  ['Find duplicate events', `SELECT event_id, COUNT(*) AS copies
FROM web_events
GROUP BY event_id
HAVING COUNT(*) > 1
ORDER BY event_id
LIMIT 20;`],
  ['Funnel', `WITH dedup AS (
  SELECT * FROM web_events
  QUALIFY ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY event_ts) = 1
)
SELECT event_type, COUNT(DISTINCT session_id) AS sessions
FROM dedup
WHERE event_type IN ('page_view', 'add_to_cart', 'checkout', 'purchase')
GROUP BY event_type
ORDER BY sessions DESC;`],
  ['Busiest hours (taxi)', `SELECT hour(pickup_ts) AS hour,
       COUNT(*) AS trips,
       ROUND(AVG(fare), 1) AS avg_fare,
       ROUND(AVG(tip) FILTER (WHERE tip > 0), 1) AS avg_tip_when_tipped
FROM taxi_trips
WHERE fare > 0 AND distance_km > 0
GROUP BY hour
ORDER BY hour;`],
  ['Data quality check', `SELECT 'taxi: zero distance' AS rule, COUNT(*) AS bad_rows FROM taxi_trips WHERE distance_km = 0
UNION ALL SELECT 'taxi: negative fare', COUNT(*) FROM taxi_trips WHERE fare < 0
UNION ALL SELECT 'customers: missing city', COUNT(*) FROM shop_customers WHERE city IS NULL
UNION ALL SELECT 'customers: missing email', COUNT(*) FROM shop_customers WHERE email IS NULL
UNION ALL SELECT 'events: duplicate ids', COUNT(*) - COUNT(DISTINCT event_id) FROM web_events;`],
]
