// Daily SQL challenge pool. Everyone gets the same challenge on the same day (by their local date).
// Each one runs on the big generated datasets (see bigdata.js). Answers are checked by value, ignoring
// row order and column names, with numbers compared to 2 decimals.

export const LAUNCH = '2026-11-03'

const D = (id, level, title, prompt, cols, hint, ref) => ({ id, level, title, prompt, cols, hint, ref })

export const DAILY = [
  D(1, 'Easy', 'Order status mix', 'How many orders are there in each status?', 'status, orders', 'GROUP BY the status column and COUNT(*).',
    `SELECT status, COUNT(*) AS orders FROM shop_orders GROUP BY status`),
  D(2, 'Medium', 'Monthly revenue, 2025', 'For each month of 2025, what was the delivered revenue? Revenue is quantity × unit_price × (1 − discount_pct / 100). Round to 2 decimals.', 'month (1 to 12), revenue', 'Filter on status and year(order_ts) = 2025, then GROUP BY month(order_ts).',
    `SELECT month(order_ts) AS month, ROUND(SUM(quantity * unit_price * (1 - discount_pct / 100.0)), 2) AS revenue
FROM shop_orders WHERE status = 'delivered' AND year(order_ts) = 2025 GROUP BY 1`),
  D(3, 'Hard', 'Busiest hour per zone', 'For each taxi pickup zone, which hour of the day has the most trips? If two hours tie, pick the earlier hour.', 'pickup_zone, hour, trips', 'Count trips per zone and hour, then ROW_NUMBER() OVER (PARTITION BY zone ORDER BY trips DESC, hour).',
    `SELECT pickup_zone, hour, trips FROM (
  SELECT pickup_zone, hour(pickup_ts) AS hour, COUNT(*) AS trips,
         ROW_NUMBER() OVER (PARTITION BY pickup_zone ORDER BY COUNT(*) DESC, hour(pickup_ts)) AS rn
  FROM taxi_trips GROUP BY 1, 2) WHERE rn = 1`),
  D(4, 'Easy', 'Premium by country', 'How many premium customers does each country have?', 'country, premium_customers', 'is_premium is a boolean, so WHERE is_premium works.',
    `SELECT country, COUNT(*) AS premium_customers FROM shop_customers WHERE is_premium GROUP BY country`),
  D(5, 'Medium', 'Top 10 loyal customers', 'Which 10 customers placed the most orders? Break ties by the lower customer_id.', 'customer_id, orders', 'ORDER BY orders DESC, customer_id LIMIT 10.',
    `SELECT customer_id, COUNT(*) AS orders FROM shop_orders GROUP BY customer_id ORDER BY orders DESC, customer_id LIMIT 10`),
  D(6, 'Medium', 'Duplicate events', 'How many event_ids appear more than once in web_events?', 'duplicate_ids', 'GROUP BY event_id HAVING COUNT(*) > 1, then count those groups.',
    `SELECT COUNT(*) AS duplicate_ids FROM (SELECT event_id FROM web_events GROUP BY event_id HAVING COUNT(*) > 1)`),
  D(7, 'Easy', 'Bad taxi rows', 'How many taxi trips have a negative fare or a zero distance?', 'bad_trips', 'Use OR in the WHERE clause.',
    `SELECT COUNT(*) AS bad_trips FROM taxi_trips WHERE fare < 0 OR distance_km = 0`),
  D(8, 'Hard', 'Second most expensive', 'In each product category, which product(s) have the second-highest list_price? If several share that price, return them all.', 'category, product_name, list_price', 'DENSE_RANK() keeps ties together, so rank 2 is the second-highest price.',
    `SELECT category, product_name, list_price FROM (
  SELECT category, product_name, list_price, DENSE_RANK() OVER (PARTITION BY category ORDER BY list_price DESC) AS r FROM shop_products) WHERE r = 2`),
  D(9, 'Medium', 'Cancellation rate by channel', 'What percentage of orders were cancelled in each channel? Round to 2 decimals.', 'channel, cancel_pct', 'AVG(CASE WHEN status = \'cancelled\' THEN 1 ELSE 0 END) * 100 is one neat trick.',
    `SELECT channel, ROUND(100.0 * AVG(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 2) AS cancel_pct FROM shop_orders GROUP BY channel`),
  D(10, 'Easy', 'Products per category', 'How many products are in each category?', 'category, products', 'A simple GROUP BY on shop_products.',
    `SELECT category, COUNT(*) AS products FROM shop_products GROUP BY category`),
  D(11, 'Medium', 'Signed up, never bought', 'How many customers signed up in 2024 but have never placed an order?', 'customers', 'NOT EXISTS or a LEFT JOIN with WHERE o.order_id IS NULL.',
    `SELECT COUNT(*) AS customers FROM shop_customers c WHERE year(c.signup_date) = 2024 AND NOT EXISTS (SELECT 1 FROM shop_orders o WHERE o.customer_id = c.customer_id)`),
  D(12, 'Hard', 'Month-over-month growth', 'For each month of 2025, how many orders were there, and what was the % change from the month before? January 2025 compares with December 2024. Round to 2 decimals.', 'month (1 to 12), orders, mom_pct', 'Count per month over ALL months first, then LAG(), then keep 2025.',
    `WITH m AS (SELECT date_trunc('month', order_ts) AS m, COUNT(*) AS orders FROM shop_orders GROUP BY 1),
g AS (SELECT m, orders, ROUND(100.0 * (orders - LAG(orders) OVER (ORDER BY m)) / LAG(orders) OVER (ORDER BY m), 2) AS mom_pct FROM m)
SELECT month(m) AS month, orders, mom_pct FROM g WHERE year(m) = 2025`),
  D(13, 'Easy', 'Events per device', 'How many events (duplicates included) came from each device?', 'device, events', 'GROUP BY device.',
    `SELECT device, COUNT(*) AS events FROM web_events GROUP BY device`),
  D(14, 'Medium', 'Orders by weekday', 'How many orders were placed on each day of the week?', 'weekday name, orders', 'dayname(order_ts) returns Monday, Tuesday and so on.',
    `SELECT dayname(order_ts) AS weekday, COUNT(*) AS orders FROM shop_orders GROUP BY 1`),
  D(15, 'Hard', 'Purchase conversion', 'What percentage of sessions that had a page_view also had a purchase? Round to 2 decimals.', 'conversion_pct', 'Aggregate per session with BOOL_OR or MAX(CASE ...), then average.',
    `WITH s AS (SELECT session_id, BOOL_OR(event_type = 'page_view') AS viewed, BOOL_OR(event_type = 'purchase') AS bought FROM web_events GROUP BY session_id)
SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE bought) / COUNT(*), 2) AS conversion_pct FROM s WHERE viewed`),
  D(16, 'Medium', 'Average fare by zone', 'What is the average taxi fare per pickup zone, ignoring trips with a non-positive fare or zero distance? Round to 2 decimals.', 'pickup_zone, avg_fare', 'Filter the bad rows first, then AVG(fare).',
    `SELECT pickup_zone, ROUND(AVG(fare), 2) AS avg_fare FROM taxi_trips WHERE fare > 0 AND distance_km > 0 GROUP BY pickup_zone`),
  D(17, 'Hard', 'Running taxi revenue', 'For 1 to 7 March 2025, give each day\'s taxi revenue (fare + tip, valid trips only: fare > 0 and distance > 0) and the running total. Round both to 2 decimals.', 'day, revenue, running_revenue', 'GROUP BY the date, then SUM(SUM(...)) OVER (ORDER BY day).',
    `SELECT CAST(pickup_ts AS DATE) AS day, ROUND(SUM(fare + tip), 2) AS revenue, ROUND(SUM(SUM(fare + tip)) OVER (ORDER BY CAST(pickup_ts AS DATE)), 2) AS running_revenue
FROM taxi_trips WHERE fare > 0 AND distance_km > 0 AND pickup_ts < TIMESTAMP '2025-03-08' GROUP BY 1`),
  D(18, 'Medium', 'City revenue share', 'Which 5 cities (ignore NULL cities) bring the most gross revenue (quantity × unit_price, all statuses), and what % of the non-NULL-city total is each? Round revenue and % to 2 decimals.', 'city, revenue, pct_of_total', 'Join orders to customers, GROUP BY city, then SUM(revenue) OVER () for the total.',
    `SELECT city, ROUND(rev, 2) AS revenue, ROUND(100.0 * rev / SUM(rev) OVER (), 2) AS pct_of_total FROM (
  SELECT c.city, SUM(o.quantity * o.unit_price) AS rev FROM shop_orders o JOIN shop_customers c USING (customer_id) WHERE c.city IS NOT NULL GROUP BY c.city)
QUALIFY ROW_NUMBER() OVER (ORDER BY rev DESC) <= 5`),
  D(19, 'Easy', 'December shoppers', 'How many distinct customers placed at least one order in December 2025?', 'customers', 'COUNT(DISTINCT customer_id) with a date filter.',
    `SELECT COUNT(DISTINCT customer_id) AS customers FROM shop_orders WHERE order_ts >= TIMESTAMP '2025-12-01' AND order_ts < TIMESTAMP '2026-01-01'`),
  D(20, 'Hard', 'First order cancelled', 'How many customers had their very first order (earliest order_ts) cancelled?', 'customers', 'ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_ts) = 1, or QUALIFY.',
    `SELECT COUNT(*) AS customers FROM (SELECT status FROM shop_orders QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_ts, order_id) = 1) WHERE status = 'cancelled'`),
  D(21, 'Medium', 'Items per order', 'What is the average quantity per order in each channel? Round to 3 decimals.', 'channel, avg_quantity', 'AVG(quantity) grouped by channel.',
    `SELECT channel, ROUND(AVG(quantity), 3) AS avg_quantity FROM shop_orders GROUP BY channel`),
  D(22, 'Medium', 'Cart abandonment', 'After removing duplicate events (same event_id), how many sessions added something to the cart but never purchased?', 'sessions', 'Dedup with QUALIFY ROW_NUMBER() OVER (PARTITION BY event_id ...) = 1, then BOOL_OR per session.',
    `WITH d AS (SELECT * FROM web_events QUALIFY ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY event_ts) = 1),
s AS (SELECT session_id, BOOL_OR(event_type = 'add_to_cart') AS carted, BOOL_OR(event_type = 'purchase') AS bought FROM d GROUP BY session_id)
SELECT COUNT(*) AS sessions FROM s WHERE carted AND NOT bought`),
  D(23, 'Hard', 'Best seller each month', 'For each month of 2025, which product sold the most units? Break ties by the lower product_id.', 'month (1 to 12), product_id, units', 'Sum units per month and product, then ROW_NUMBER() per month.',
    `SELECT month, product_id, units FROM (
  SELECT month(order_ts) AS month, product_id, SUM(quantity) AS units,
         ROW_NUMBER() OVER (PARTITION BY month(order_ts) ORDER BY SUM(quantity) DESC, product_id) AS rn
  FROM shop_orders WHERE year(order_ts) = 2025 GROUP BY 1, 2) WHERE rn = 1`),
  D(24, 'Easy', 'Payment methods', 'How many delivered orders used each payment method?', 'payment_method, orders', 'Filter status first, then GROUP BY payment_method.',
    `SELECT payment_method, COUNT(*) AS orders FROM shop_orders WHERE status = 'delivered' GROUP BY payment_method`),
  D(25, 'Medium', 'Anonymous traffic', 'What share of events (duplicates included) are anonymous (no user_id) versus logged in? Round % to 2 decimals.', "user_type ('anonymous' or 'logged_in'), events, pct", 'CASE WHEN user_id IS NULL, then COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ().',
    `SELECT CASE WHEN user_id IS NULL THEN 'anonymous' ELSE 'logged_in' END AS user_type, COUNT(*) AS events, ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct FROM web_events GROUP BY 1`),
  D(26, 'Hard', 'Jan and Feb regulars', 'How many customers placed orders in both January 2025 and February 2025?', 'customers', 'INTERSECT two sets of customer_ids, or use COUNT(DISTINCT month) = 2.',
    `SELECT COUNT(*) AS customers FROM (
  SELECT customer_id FROM shop_orders WHERE order_ts >= TIMESTAMP '2025-01-01' AND order_ts < TIMESTAMP '2025-02-01'
  INTERSECT
  SELECT customer_id FROM shop_orders WHERE order_ts >= TIMESTAMP '2025-02-01' AND order_ts < TIMESTAMP '2025-03-01')`),
  D(27, 'Medium', 'Longest ride per zone', 'What is the longest taxi trip, in minutes, for each pickup zone? Round to 1 decimal.', 'pickup_zone, max_minutes', 'epoch(dropoff_ts - pickup_ts) gives seconds.',
    `SELECT pickup_zone, ROUND(MAX(epoch(dropoff_ts - pickup_ts)) / 60, 1) AS max_minutes FROM taxi_trips GROUP BY pickup_zone`),
  D(28, 'Hard', 'Orders per customer by segment', 'For each customer segment, how many customers are there and how many orders per customer on average, counting customers with zero orders? Round to 2 decimals.', 'segment, customers, orders_per_customer', 'LEFT JOIN customers to per-customer order counts and COALESCE the NULLs to 0.',
    `WITH oc AS (SELECT customer_id, COUNT(*) AS n FROM shop_orders GROUP BY customer_id)
SELECT c.segment, COUNT(*) AS customers, ROUND(AVG(COALESCE(oc.n, 0)), 2) AS orders_per_customer FROM shop_customers c LEFT JOIN oc USING (customer_id) GROUP BY c.segment`),
  D(29, 'Easy', 'Missing emails', 'How many customers have no email, per country?', 'country, missing_emails', 'WHERE email IS NULL (not = NULL).',
    `SELECT country, COUNT(*) AS missing_emails FROM shop_customers WHERE email IS NULL GROUP BY country`),
  D(30, 'Medium', 'Tipping habits', 'For each taxi payment type, what share of trips had a tip greater than 0? Round to 2 decimals.', 'payment_type, tipped_pct', 'AVG of a boolean cast to INT, times 100.',
    `SELECT payment_type, ROUND(100.0 * AVG((tip > 0)::INT), 2) AS tipped_pct FROM taxi_trips GROUP BY payment_type`),
]

function pad(n) { return String(n).padStart(2, '0') }
export function dayKey(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function toUTC(key) { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d) }
export function dayNumber(key = dayKey()) { return Math.max(1, Math.round((toUTC(key) - toUTC(LAUNCH)) / 86400000) + 1) }
export function keyForNumber(n) { const t = new Date(toUTC(LAUNCH) + (n - 1) * 86400000); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}` }
export function challengeFor(n) { return DAILY[(n - 1) % DAILY.length] }
