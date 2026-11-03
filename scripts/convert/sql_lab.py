"""Build runnable SQL-lab specs (setup data + reference query) for the 78 interview questions,
and validate every reference answer against DuckDB."""
import json, re, sys
import duckdb

EMP = """
CREATE TABLE dept(id INT, name VARCHAR);
INSERT INTO dept VALUES (1,'Engineering'),(2,'Sales'),(3,'Finance'),(4,'Research');
CREATE TABLE emp(id INT, name VARCHAR, dept_id INT, salary INT, manager_id INT, hire_date DATE);
INSERT INTO emp VALUES
 (1,'Asha',1,250000,NULL, DATE '2015-04-01'),
 (2,'Ravi',1,180000,1, DATE '2018-06-15'),
 (3,'Meera',1,190000,2, DATE '2019-01-10'),
 (4,'Karan',1,120000,2, DATE '2021-03-22'),
 (5,'Divya',1,120000,2, DATE '2022-07-01'),
 (6,'Arjun',1,95000,2, DATE '2023-02-14'),
 (7,'Sneha',1,88000,2, CURRENT_DATE - INTERVAL 30 DAY),
 (8,'Vikram',2,140000,1, DATE '2017-09-09'),
 (9,'Pooja',2,150000,8, DATE '2020-11-30'),
 (10,'Rahul',2,90000,8, CURRENT_DATE - INTERVAL 75 DAY),
 (11,'Neha',2,90000,8, DATE '2024-05-05'),
 (12,'Imran',3,130000,1, DATE '2016-02-01'),
 (13,'Lakshmi',3,110000,12, DATE '2021-08-18'),
 (14,'Farhan',3,70000,12, CURRENT_DATE - INTERVAL 200 DAY);
"""

ORDERS = """
CREATE TABLE customers(customer_id INT, name VARCHAR);
INSERT INTO customers VALUES (1,'Anil'),(2,'Bhavna'),(3,'Chetan'),(4,'Deepa'),(5,'Esha'),(6,'Faisal'),(7,'Gauri'),(8,'Hari'),(9,'Isha'),(10,'Jai');
CREATE TABLE orders(order_id INT, customer_id INT, order_date DATE, amount DECIMAL(10,2), status VARCHAR);
INSERT INTO orders VALUES
 (101,1,DATE '2026-01-03',1200.00,'DELIVERED'),
 (102,1,DATE '2026-01-20',450.50,'DELIVERED'),
 (103,2,DATE '2026-01-25',3000.00,'CANCELLED'),
 (104,3,DATE '2026-02-02',800.00,'DELIVERED'),
 (105,1,DATE '2026-02-14',2200.00,'RETURNED'),
 (106,4,DATE '2026-02-14',150.00,'DELIVERED'),
 (107,2,DATE '2026-02-28',990.00,'DELIVERED'),
 (108,5,DATE '2026-03-05',5400.00,'DELIVERED'),
 (109,3,DATE '2026-03-09',620.00,'CANCELLED'),
 (110,6,DATE '2026-03-15',75.00,'DELIVERED'),
 (111,5,DATE '2026-03-21',1300.00,'DELIVERED'),
 (112,7,DATE '2026-04-01',2600.00,'DELIVERED'),
 (113,2,DATE '2026-04-11',410.00,'RETURNED'),
 (114,8,DATE '2026-04-18',3300.00,'DELIVERED'),
 (115,4,DATE '2026-04-30',260.00,'DELIVERED'),
 (116,9,DATE '2026-05-02',1800.00,'DELIVERED'),
 (117,1,DATE '2026-05-09',700.00,'DELIVERED'),
 (118,7,DATE '2026-05-19',95.00,'CANCELLED'),
 (119,3,DATE '2026-05-27',1500.00,'DELIVERED'),
 (120,5,DATE '2026-05-30',640.00,'DELIVERED');
"""

DAILY = """
CREATE TABLE daily_sales(sale_date DATE, amount DECIMAL(10,2));
INSERT INTO daily_sales
SELECT d::DATE, round(1000 + 400*sin(i) + 37*i, 2)
FROM (SELECT DATE '2026-01-25' + INTERVAL (i) DAY AS d, i FROM range(0, 14) t(i))
WHERE i NOT IN (4, 9);
"""

SETUPS = {
    1: EMP, 2: EMP, 3: EMP, 4: EMP, 9: EMP, 10: EMP, 11: EMP, 13: EMP, 14: EMP, 24: EMP, 28: EMP, 39: EMP, 59: EMP, 71: EMP,
    5: """CREATE TABLE person(id INT, email VARCHAR);
INSERT INTO person VALUES (1,'a@x.com'),(2,'b@x.com'),(3,'a@x.com'),(4,'c@x.com'),(5,'b@x.com'),(6,'a@x.com');""",
    7: """CREATE TABLE A(x INT); INSERT INTO A VALUES (1),(1),(2),(NULL);
CREATE TABLE B(x INT); INSERT INTO B VALUES (1),(1),(NULL);""",
    8: ORDERS, 15: ORDERS, 16: ORDERS, 23: ORDERS, 30: ORDERS, 31: ORDERS, 32: ORDERS, 33: ORDERS, 36: ORDERS, 37: ORDERS,
    12: """CREATE TABLE people(id INT, gender VARCHAR);
INSERT INTO people VALUES (1,'M'),(2,'F'),(3,'F'),(4,'M'),(5,'F');""",
    17: """CREATE TABLE sales(category VARCHAR, amount DECIMAL(10,2));
INSERT INTO sales VALUES ('Electronics',5000),('Electronics',2500),('Books',800),('Books',450),('Grocery',3100),('Fashion',1900),('Fashion',650);""",
    18: """CREATE TABLE products(product_id INT); INSERT INTO products VALUES (1),(2),(3);
CREATE TABLE purchases(customer_id INT, product_id INT);
INSERT INTO purchases VALUES (1,1),(1,2),(1,3),(2,1),(2,1),(2,2),(3,1),(3,2),(3,3),(3,3),(4,3);""",
    19: """CREATE TABLE purchases(customer_id INT, product VARCHAR);
INSERT INTO purchases VALUES (1,'A'),(1,'B'),(2,'A'),(2,'B'),(2,'C'),(3,'A'),(4,'B'),(4,'A'),(4,'D'),(5,'C');""",
    20: """CREATE TABLE sales(sale_date DATE, amount DECIMAL(10,2));
INSERT INTO sales VALUES (DATE '2025-02-10',1200),(DATE '2025-05-03',800),(DATE '2025-08-19',950),(DATE '2025-11-25',2100),(DATE '2025-12-30',400),
(DATE '2026-01-15',1500),(DATE '2026-03-31',700),(DATE '2026-04-02',1100),(DATE '2026-07-07',1350);""",
    21: """CREATE TABLE quarterly(yr INT, q1 INT, q2 INT, q3 INT, q4 INT);
INSERT INTO quarterly VALUES (2025,1200,800,950,2500),(2026,2200,1100,1350,0);""",
    22: """CREATE TABLE customers(customer_id INT, city VARCHAR);
INSERT INTO customers VALUES (1,'Bengaluru'),(2,'Pune'),(3,'Bengaluru'),(4,'Delhi'),(5,'Bengaluru'),(6,'Pune'),(7,'Bengaluru'),(8,'Hyderabad'),(9,'Pune'),(10,'Pune'),(11,'Pune');""",
    25: DAILY, 26: DAILY, 29: DAILY, 38: DAILY, 43: DAILY,
    34: """CREATE TABLE customer_updates(customer_id INT, city VARCHAR, updated_at TIMESTAMP);
INSERT INTO customer_updates VALUES (1,'Pune',TIMESTAMP '2026-01-01 10:00'),(1,'Mumbai',TIMESTAMP '2026-02-11 09:30'),(2,'Delhi',TIMESTAMP '2026-01-05 12:00'),
(3,'Chennai',TIMESTAMP '2026-01-07 08:00'),(3,'Kochi',TIMESTAMP '2026-03-01 18:45'),(3,'Chennai',TIMESTAMP '2026-03-20 07:15');""",
    35: """CREATE TABLE salary_history(emp_id INT, yr INT, salary INT);
INSERT INTO salary_history VALUES (1,2023,50000),(1,2024,55000),(1,2025,61000),(2,2023,70000),(2,2024,70000),(2,2025,75000),
(3,2023,40000),(3,2024,45000),(3,2025,43000),(4,2024,90000),(4,2025,99000);""",
    40: """CREATE TABLE order_events(order_id INT, event_time TIMESTAMP, status VARCHAR);
INSERT INTO order_events VALUES (1,TIMESTAMP '2026-03-01 09:00','PLACED'),(1,TIMESTAMP '2026-03-01 09:05','PLACED'),(1,TIMESTAMP '2026-03-01 11:00','SHIPPED'),
(1,TIMESTAMP '2026-03-02 10:00','SHIPPED'),(1,TIMESTAMP '2026-03-03 14:00','DELIVERED'),(2,TIMESTAMP '2026-03-01 10:00','PLACED'),(2,TIMESTAMP '2026-03-01 12:00','CANCELLED');""",
    41: """CREATE TABLE logins(user_id INT, login_date DATE);
INSERT INTO logins VALUES (1,DATE '2026-03-01'),(1,DATE '2026-03-02'),(1,DATE '2026-03-02'),(1,DATE '2026-03-03'),(1,DATE '2026-03-07'),
(2,DATE '2026-03-01'),(2,DATE '2026-03-03'),(2,DATE '2026-03-04'),(3,DATE '2026-03-10'),(3,DATE '2026-03-11'),(3,DATE '2026-03-12'),(3,DATE '2026-03-13'),(3,DATE '2026-03-20');""",
    44: """CREATE TABLE activity(user_id INT, activity_date DATE);
INSERT INTO activity VALUES
 (1, DATE_TRUNC('month', CURRENT_DATE) - INTERVAL 10 DAY),(1, DATE_TRUNC('month', CURRENT_DATE) + INTERVAL 1 DAY),
 (2, DATE_TRUNC('month', CURRENT_DATE) - INTERVAL 5 DAY),
 (3, DATE_TRUNC('month', CURRENT_DATE) - INTERVAL 20 DAY),(3, DATE_TRUNC('month', CURRENT_DATE) - INTERVAL 3 DAY),
 (4, DATE_TRUNC('month', CURRENT_DATE) + INTERVAL 2 DAY),
 (5, DATE_TRUNC('month', CURRENT_DATE) - INTERVAL 70 DAY);""",
    45: """CREATE TABLE activity(user_id INT, activity_date DATE);
INSERT INTO activity VALUES (1,DATE '2026-01-05'),(1,DATE '2026-02-07'),(1,DATE '2026-03-02'),(2,DATE '2026-01-11'),(2,DATE '2026-01-19'),
(3,DATE '2026-01-20'),(3,DATE '2026-02-21'),(4,DATE '2026-02-02'),(4,DATE '2026-03-15'),(5,DATE '2026-02-25'),(6,DATE '2026-03-30');""",
    46: """CREATE TABLE activity(player_id INT, event_date DATE);
INSERT INTO activity VALUES (1,DATE '2026-03-01'),(1,DATE '2026-03-02'),(2,DATE '2026-03-05'),(2,DATE '2026-03-08'),(3,DATE '2026-03-10'),(3,DATE '2026-03-11'),(3,DATE '2026-03-12'),(4,DATE '2026-03-15');""",
    47: """CREATE TABLE clicks(user_id INT, ts TIMESTAMP);
INSERT INTO clicks VALUES (1,TIMESTAMP '2026-03-01 09:00'),(1,TIMESTAMP '2026-03-01 09:10'),(1,TIMESTAMP '2026-03-01 09:55'),(1,TIMESTAMP '2026-03-01 10:05'),
(1,TIMESTAMP '2026-03-01 14:00'),(2,TIMESTAMP '2026-03-01 11:00'),(2,TIMESTAMP '2026-03-01 11:29'),(2,TIMESTAMP '2026-03-01 12:30');""",
    48: """CREATE TABLE bookings(id INT, room_id INT, start_ts TIMESTAMP, end_ts TIMESTAMP);
INSERT INTO bookings VALUES (1,101,TIMESTAMP '2026-03-01 09:00',TIMESTAMP '2026-03-01 11:00'),(2,101,TIMESTAMP '2026-03-01 10:30',TIMESTAMP '2026-03-01 12:00'),
(3,101,TIMESTAMP '2026-03-01 12:00',TIMESTAMP '2026-03-01 13:00'),(4,102,TIMESTAMP '2026-03-01 09:00',TIMESTAMP '2026-03-01 17:00'),
(5,102,TIMESTAMP '2026-03-01 13:00',TIMESTAMP '2026-03-01 14:00'),(6,103,TIMESTAMP '2026-03-01 09:00',TIMESTAMP '2026-03-01 10:00');""",
    49: """CREATE TABLE nums(n INT); INSERT INTO nums VALUES (1),(2),(3),(5),(6),(9);""",
    50: """CREATE TABLE subs(user_id INT, start_date DATE, end_date DATE);
INSERT INTO subs VALUES (1,DATE '2026-03-01',DATE '2026-03-04'),(2,DATE '2026-03-03',NULL),(3,DATE '2026-03-02',DATE '2026-03-02'),(4,DATE '2026-03-05',DATE '2026-03-07');
CREATE TABLE calendar(d DATE);
INSERT INTO calendar SELECT (DATE '2026-03-01' + INTERVAL (i) DAY)::DATE FROM range(0,7) t(i);""",
    51: """CREATE TABLE logs(id INT, num INT);
INSERT INTO logs VALUES (1,1),(2,1),(3,1),(4,2),(5,1),(6,2),(7,2),(8,2),(9,2),(10,3);""",
    52: """CREATE TABLE weather(id INT, record_date DATE, temp INT);
INSERT INTO weather VALUES (1,DATE '2026-04-01',31),(2,DATE '2026-04-02',33),(3,DATE '2026-04-03',30),(4,DATE '2026-04-04',34),(5,DATE '2026-04-06',36),(6,DATE '2026-04-07',35);""",
    53: """CREATE TABLE users(user_id INT, banned VARCHAR, role VARCHAR);
INSERT INTO users VALUES (1,'No','client'),(2,'Yes','client'),(3,'No','client'),(10,'No','driver'),(11,'No','driver'),(12,'Yes','driver');
CREATE TABLE trips(id INT, client_id INT, driver_id INT, status VARCHAR, request_at DATE);
INSERT INTO trips VALUES (1,1,10,'completed',DATE '2026-03-01'),(2,2,11,'cancelled_by_driver',DATE '2026-03-01'),(3,3,12,'completed',DATE '2026-03-01'),
(4,1,10,'cancelled_by_client',DATE '2026-03-02'),(5,3,11,'completed',DATE '2026-03-02'),(6,1,11,'completed',DATE '2026-03-03'),(7,3,10,'cancelled_by_driver',DATE '2026-03-03');""",
    54: """CREATE TABLE friends(requester_id INT, accepter_id INT);
INSERT INTO friends VALUES (1,2),(1,3),(2,3),(3,4),(4,5),(3,5),(6,3);""",
    55: """CREATE TABLE seat(id INT, student VARCHAR);
INSERT INTO seat VALUES (1,'Abhi'),(2,'Bina'),(3,'Chirag'),(4,'Dev'),(5,'Ekta');""",
    56: """CREATE TABLE tree(id INT, parent_id INT);
INSERT INTO tree VALUES (1,NULL),(2,1),(3,1),(4,2),(5,2),(6,3);""",
    57: """CREATE TABLE ad_events(ad_id INT, action VARCHAR);
INSERT INTO ad_events VALUES (1,'click'),(1,'view'),(1,'view'),(1,'ignore'),(2,'view'),(2,'view'),(3,'ignore'),(3,'ignore'),(4,'click'),(4,'click'),(4,'view');""",
    58: """CREATE TABLE order_items(order_id INT, product_id INT);
INSERT INTO order_items VALUES (1,10),(1,20),(1,30),(2,10),(2,20),(3,20),(3,30),(4,10),(4,20),(4,40),(5,30),(5,40);""",
    60: """CREATE TABLE target(id INT, name VARCHAR, city VARCHAR);
INSERT INTO target VALUES (1,'Asha','Pune'),(2,'Ravi','Delhi'),(3,'Meera','Chennai');
CREATE TABLE staging(id INT, name VARCHAR, city VARCHAR);
INSERT INTO staging VALUES (2,'Ravi','Mumbai'),(3,'Meera','Chennai'),(4,'Karan','Jaipur');""",
    61: """CREATE TABLE dim_customer(id INT, city VARCHAR, start_date DATE, end_date DATE, is_current BOOLEAN);
INSERT INTO dim_customer VALUES (1,'Pune',DATE '2024-01-01',NULL,TRUE),(2,'Delhi',DATE '2024-03-15',NULL,TRUE),(3,'Goa',DATE '2023-05-01',DATE '2024-06-30',FALSE),(3,'Chennai',DATE '2024-07-01',NULL,TRUE);
CREATE TABLE staging(id INT, city VARCHAR);
INSERT INTO staging VALUES (1,'Pune'),(2,'Mumbai'),(4,'Kochi');""",
    62: """CREATE TABLE source(id INT, name VARCHAR, updated_at TIMESTAMP);
INSERT INTO source VALUES (1,'a',TIMESTAMP '2026-03-01 08:00'),(2,'b',TIMESTAMP '2026-03-02 09:00'),(3,'c',TIMESTAMP '2026-03-03 10:00'),(4,'d',TIMESTAMP '2026-03-03 23:59');
CREATE TABLE staging(id INT, name VARCHAR, updated_at TIMESTAMP);
CREATE TABLE etl_watermark(table_name VARCHAR, last_loaded TIMESTAMP);
INSERT INTO etl_watermark VALUES ('source', TIMESTAMP '2026-03-02 00:00');""",
    63: """CREATE TABLE src(id INT, name VARCHAR, city VARCHAR);
INSERT INTO src VALUES (1,'Asha','Pune'),(2,'Ravi','Mumbai'),(3,'Meera','Chennai'),(4,'Karan','Jaipur');
CREATE TABLE tgt(id INT, name VARCHAR, city VARCHAR);
INSERT INTO tgt VALUES (1,'Asha','Pune'),(2,'Ravi','Delhi'),(3,'Meera','Chennai');""",
    64: """CREATE TABLE src(load_date DATE, id INT);
INSERT INTO src VALUES (DATE '2026-03-01',1),(DATE '2026-03-01',2),(DATE '2026-03-02',3),(DATE '2026-03-02',4),(DATE '2026-03-02',5),(DATE '2026-03-03',6);
CREATE TABLE tgt(load_date DATE, id INT);
INSERT INTO tgt VALUES (DATE '2026-03-01',1),(DATE '2026-03-01',2),(DATE '2026-03-02',3),(DATE '2026-03-02',4),(DATE '2026-03-04',7);""",
    65: """CREATE TABLE staging(order_id INT, amount DECIMAL(10,2));
INSERT INTO staging VALUES (1,100),(2,250),(2,250),(3,80),(4,60),(4,61),(4,60),(5,10);""",
    66: """CREATE TABLE customers(customer_id INT, email VARCHAR, phone VARCHAR, city VARCHAR);
INSERT INTO customers VALUES (1,'a@x.com',NULL,'Pune'),(2,NULL,NULL,'Delhi'),(3,'c@x.com','555-0103',NULL),(4,'d@x.com','555-0104','Goa'),(5,NULL,'555-0105',NULL);""",
    67: """CREATE TABLE events(id INT, payload VARCHAR, updated_at TIMESTAMP);
INSERT INTO events VALUES (1,'v1',TIMESTAMP '2026-03-01 08:00'),(1,'v2',TIMESTAMP '2026-03-02 08:00'),(2,'v1',TIMESTAMP '2026-03-01 09:00'),(3,'v1',TIMESTAMP '2026-03-01 10:00'),(3,'v3',TIMESTAMP '2026-03-05 10:00'),(3,'v2',TIMESTAMP '2026-03-03 10:00');""",
    68: """CREATE TABLE orders(order_id INT, items VARCHAR[]);
INSERT INTO orders VALUES (1,['pen','book']),(2,['laptop']),(3,['mug','tea','biscuits']);""",
    69: """CREATE TABLE events(event_id INT, event_date DATE);
INSERT INTO events SELECT i, (DATE '2025-10-01' + INTERVAL (i*3) DAY)::DATE FROM range(0,200) t(i);""",
    72: """CREATE TABLE t(col INT); INSERT INTO t VALUES (1),(1),(NULL),(2);""",
    74: """CREATE TABLE customers(customer_id INT, city VARCHAR);
INSERT INTO customers VALUES (1,'Delhi'),(2,'Pune'),(3,NULL),(4,'Goa'),(5,NULL);""",
    75: """CREATE TABLE a(id INT); INSERT INTO a VALUES (1),(2),(3);
CREATE TABLE b(id INT); INSERT INTO b VALUES (2),(NULL);""",
    27: """CREATE TABLE emp(name VARCHAR, salary INT); INSERT INTO emp VALUES ('A',100),('B',100),('C',90);""",
}
SETUPS[42] = SETUPS[41]
SETUPS[6] = SETUPS[5]

CHECKS = {  # DML questions: compare table state after running
    6: 'SELECT * FROM person ORDER BY id',
    12: 'SELECT * FROM people ORDER BY id',
    60: 'SELECT * FROM target ORDER BY id',
    61: 'SELECT id, city, end_date IS NULL AS open_row, is_current FROM dim_customer ORDER BY id, start_date',
    62: "SELECT * FROM staging ORDER BY id",
}

PARAMS = {2: (':n', '3', 'Use N = 3.'), 59: (':mgr', '2', 'List everyone under manager id 2 (Ravi).')}

CONCEPT = {7, 70, 73, 76, 77, 78}  # no single runnable answer
EXPLORE_REF = {
    27: "SELECT name, salary, ROW_NUMBER() OVER (ORDER BY salary DESC) AS row_number, RANK() OVER (ORDER BY salary DESC) AS rank, DENSE_RANK() OVER (ORDER BY salary DESC) AS dense_rank FROM emp ORDER BY salary DESC, name",
    72: "SELECT COUNT(*), COUNT(col), COUNT(DISTINCT col) FROM t",
    7: None,
}
REF_OVERRIDE = {
    63: "SELECT * FROM src EXCEPT SELECT * FROM tgt",
    68: "SELECT order_id, item FROM orders, UNNEST(items) AS t(item)",
    69: "SELECT * FROM events WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2027-01-01'",
}
STARTER = {
    69: "-- Slow: wraps the partition column in a function\nSELECT *\nFROM events\nWHERE YEAR(event_date) = 2026;",
    74: "SELECT * FROM customers\nWHERE city <> 'Delhi';",
    75: "SELECT * FROM a\nWHERE id NOT IN (SELECT id FROM b);",
}


def tables_of(setup):
    return re.findall(r'CREATE TABLE (\w+)', setup)


def main(src, dst):
    qs = json.load(open(src))['questions']
    out = []
    ok = 0
    for q in qs:
        n = q['n']
        spec = dict(n=n, setup=SETUPS.get(n, '').strip(), mode='check')
        if n in CONCEPT:
            spec['mode'] = 'concept'
        ref = REF_OVERRIDE.get(n, q['answer'])
        if n in EXPLORE_REF:
            ref = EXPLORE_REF[n]
            spec['mode'] = 'check' if ref else 'concept'
        if n in PARAMS:
            k, v, hint = PARAMS[n]
            ref = ref.replace(k, v)
            spec['hint'] = hint
        if n in CHECKS:
            spec['check'] = CHECKS[n]
        if n in STARTER:
            spec['starter'] = STARTER[n]
        spec['tables'] = tables_of(spec['setup'])
        if spec['mode'] == 'check' and ref:
            # keep only SQL (strip comment-only lines at the start) and validate
            spec['ref'] = ref
            con = duckdb.connect()
            try:
                con.execute(spec['setup'])
                stmts = [s for s in split_sql(ref) if s.strip()]
                res = None
                for s in stmts:
                    r = con.execute(s)
                    try:
                        res = r.fetchall()
                    except Exception:
                        res = None
                if 'check' in spec:
                    res = con.execute(spec['check']).fetchall()
                spec['_rows'] = len(res) if res is not None else None
                ok += 1
            except Exception as e:
                print('FAIL', n, q['title'], '->', str(e).splitlines()[0])
        out.append(spec)
    json.dump([{k: v for k, v in s.items() if not k.startswith('_')} for s in out], open(dst, 'w'), indent=1)
    print('validated', ok, 'of', sum(1 for s in out if s['mode'] == 'check'))
    for s in out:
        if s.get('_rows') == 0:
            print('EMPTY RESULT', s['n'])


def split_sql(sql):
    parts, cur, q = [], '', False
    for line in sql.split('\n'):
        if line.strip().startswith('--') and not cur.strip():
            continue
        cur += line + '\n'
    for ch in cur:
        pass
    return [p for p in re.split(r';\s*(?:--[^\n]*)?\n|;\s*$', cur) if p.strip() and not all(l.strip().startswith('--') or not l.strip() for l in p.split('\n'))]


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
