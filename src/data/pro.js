// Data Dhaba Pro: announced, not built yet. Shown on the Pro page, the home page and the README.
export const PRO_PRICE = { amount: '₹1,999', note: 'for 6 months', status: 'Coming soon' }
// Two subscriptions. The yearly plan costs ₹2,999 instead of ₹3,998 for two half-year plans.
export const PRO_PLANS = [
  { id: '6m', name: '6 months', amount: '₹1,999', per: 'for 6 months', sub: 'About ₹333 a month' },
  { id: '1y', name: '1 year', amount: '₹2,999', per: 'for 12 months', sub: 'About ₹250 a month · save 25%', best: true },
]

export const PRO_PILLARS = [
  { k: '34', t: 'End-to-end projects', d: 'Real business problems built start to finish: ingestion, lakehouse, quality, orchestration, Docker, CI/CD and a dashboard. Each ships with messy data, a brief from a made-up lead, a solution walkthrough and a README you can put on your resume.' },
  { k: '60+', t: 'Cheat sheets', d: 'One-page, print-ready sheets for every tool and pattern a data engineer touches, from window functions to Spark tuning to Kafka offsets.' },
  { k: '500+', t: 'Interview questions with model answers', d: 'SQL, PySpark, data modelling, cloud and behavioural, each with the follow-up an interviewer asks next and what a strong answer sounds like.' },
  { k: '20', t: 'Data system design case studies', d: 'Whiteboard-style walk-throughs: requirements, numbers, architecture, trade-offs and the questions to ask, for the round that decides senior offers.' },
  { k: 'AI', t: 'Mock interviewer', d: 'Speaks like a real panel: asks, listens, pushes back, then scores you with notes on what to fix before the real thing.' },
  { k: '15', t: 'Production templates', d: 'Copy-paste starter repos with tests and CI already wired: a Docker Compose data stack, Airflow, dbt, Databricks Asset Bundles, Terraform, data contracts and more.' },
  { k: '4', t: 'Certification prep tracks', d: 'Practice exams and study plans for Databricks Data Engineer Associate and Professional, Microsoft Fabric Data Engineer (DP-700) and AWS Data Engineer Associate.' },
  { k: '1', t: 'Resume and LinkedIn kit', d: 'ATS-friendly templates, a bank of measurable project bullets, and a LinkedIn headline and About section that recruiters actually search for.' },
]

export const PRO_PROJECTS = [
  { group: 'Batch and lakehouse', items: [
    'Food-delivery lakehouse: orders to bronze, silver and gold on Delta',
    'E-commerce sales mart with a star schema and SCD Type 2',
    'Metadata-driven ingestion framework for 50 source tables',
    'Incremental CDC pipeline from Postgres to the lake',
    'Data vault 2.0 warehouse for an insurance company',
    'Cost-optimised migration from on-prem SQL Server to the cloud',
    'Reconciliation engine that proves source and target match',
    'Slowly changing product catalogue with history and time travel',
  ] },
  { group: 'Streaming and real time', items: [
    'Live ride-hailing dashboard with Kafka and Structured Streaming',
    'Real-time fraud scoring on card transactions',
    'IoT sensor pipeline with late data and watermarks',
    'Clickstream sessionisation and a live funnel',
    'Stock tick aggregation with exactly-once sinks',
    'Delivery ETA tracker with stateful streaming',
  ] },
  { group: 'Cloud platforms', items: [
    'Azure end to end: ADF, ADLS Gen2, Databricks and Power BI',
    'AWS end to end: S3, Glue, Athena and Redshift',
    'GCP end to end: Pub/Sub, Dataflow and BigQuery',
    'Snowflake pipeline with Snowpipe, streams and tasks',
    'Microsoft Fabric lakehouse with pipelines and notebooks',
    'Multi-cloud infrastructure as code with Terraform',
  ] },
  { group: 'Orchestration, quality and DevOps', items: [
    'Airflow platform with retries, SLAs and alerting',
    'dbt project with tests, docs, snapshots and CI',
    'Data quality firewall with expectations and quarantine tables',
    'CI/CD for Databricks with Asset Bundles and GitHub Actions',
    'Data contracts between producer and consumer teams',
    'Pipeline observability: freshness, volume and lineage alerts',
    'Your own data platform on a laptop: Spark, Airflow, Postgres and MinIO in Docker Compose',
    'Containerised PySpark jobs: Docker images, a registry and Kubernetes',
  ] },
  { group: 'Domain capstones', items: [
    'Banking regulatory report with full number lineage',
    'Healthcare claims pipeline with PII masking',
    'Ad-tech attribution model on billions of events',
    'Telecom churn feature store for machine learning',
    'Retail demand forecasting data platform',
    'Open data pipeline on Indian public datasets',
  ] },
]

export const PRO_CHEATSHEETS = ['SQL window functions', 'SQL joins and traps', 'PySpark DataFrame API', 'Spark performance tuning', 'Reading the Spark UI', 'Delta Lake commands', 'Databricks and Unity Catalog', 'Azure Data Factory patterns', 'Airflow DAG patterns', 'dbt commands and Jinja', 'Kafka for data engineers', 'Structured Streaming', 'Data modelling: star, snowflake, vault', 'SCD types 1 to 6', 'Snowflake essentials', 'BigQuery essentials', 'AWS Glue and Athena', 'Python for data engineers', 'pandas to PySpark', 'Git for data teams', 'Linux and bash for pipelines', 'Docker for data engineers', 'Docker Compose for data stacks', 'Kubernetes for data engineers', 'Terraform for data platforms', 'Data quality checks', 'File formats: Parquet, Avro, ORC', 'Partitioning and Z-ordering', 'System design numbers to know', 'Interview day checklist']

export const PRO_PROJECT_COUNT = PRO_PROJECTS.reduce((a, g) => a + g.items.length, 0)

export const PRO_FAQ = [
  { q: 'When does Pro open?', a: 'Soon. Join the waitlist and you get an email the day it opens.' },
  { q: 'Do I pay anything now?', a: 'No. The waitlist asks for no card or UPI details.' },
  { q: 'What do I get without Pro?', a: 'The 24-week path, the handbooks, the SQL and Python labs, the drills and the interview prep. Pro adds the portfolio projects, cheat sheets, model answers and mock interviews on top.' },
  { q: 'Is it a subscription that renews by itself?', a: 'No. You pay once for 6 months (₹1,999) or 1 year (₹2,999), and it does not renew automatically. If it is not right for you, you get a full refund within 7 days. See the refund policy at datadhaba.in/#/refund.' },
  { q: 'Who is Pro for?', a: 'People who want a data engineering job: students, people switching careers, and working engineers aiming for a better offer. If you can write basic SQL, you can start.' },
  { q: 'Do I need a powerful laptop?', a: 'No. Practice runs in your browser. The bigger projects use free tiers (Databricks Free Edition, cloud free accounts) or Docker on a normal laptop.' },
  { q: 'I am a student and can\'t afford it.', a: 'Email for a free student pass. Nobody should be priced out of learning.' },
]
