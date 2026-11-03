export const BRAND = {
  name: 'Data Dhaba',
  tagline: 'On your highway to get hired',
  author: 'Sagar Konkanagaon',
  authorRole: 'Senior Data Engineer, Bengaluru',
  email: 'sagarkonkanagaon@gmail.com',
  portfolio: 'https://data-foundry-sand.vercel.app',
  github: 'https://github.com/sagarkonkanagaon-netizenk',
}

export const PLAYBOOK = `## 1. Tell me about yourself (about 2 minutes)

Learn six beats, not a script. Pause after each one.

| Beat | What to say |
|---|---|
| **Who I am** | Your title, years of experience, and the stack you use every day (for example PySpark, Spark SQL, Databricks, Delta Lake, Airflow). |
| **Current work** | The biggest thing you are doing now, in one or two sentences, with the business result. A migration, a new platform, a pipeline that others depend on. |
| **What I own** | Your day to day: building and enhancing pipelines, tuning slow jobs (skew, shuffles, small files), being on call and making sure failures don't repeat. |
| **Range** | The domains you have seen (e-commerce, finance, IoT, automotive...) and what each taught you. There is no single right pipeline design; you start from how the data will be used. |
| **How I work** | Your process: analyse the ticket, list impacted tables, write test cases first, review with the architect, build, test, code review, sign-off, deploy, monitor. This is your differentiator. Slow down here. |
| **Why this role** | What you want to own next, tied to the job description. End here so the conversation moves to fit, not doubt. |

> **Delivery.** Talk, don't recite. Add a number only if you can defend it (runtime, jobs migrated, incidents reduced). If a role was a contract through a vendor, say it plainly and move on.

## 2. How I work in a sprint

1. **Sprint planning and sizing.** As a team, size each story S, M, L or XL by tables involved, new vs existing pipeline, dependencies, data volume and testing effort.
2. **Analyse the ticket.** The business need, source tables, target tables, and every downstream table, job or report the change affects. Note the grain, the rules and the edge cases (nulls, duplicates, late records). Take open questions to the PO early.
3. **Write test cases first.** Row counts and reconciliation against the source, key uniqueness, null checks, one case per business rule, negative cases, and a before-and-after comparison on impacted tables.
4. **Review with the architect.** Walk through the design and the tests. Adjust before you start, not after.
5. **Develop.** Transformations, table changes and the DAG, following team standards: idempotent writes, parameterized dates, logging, quality checks in the pipeline.
6. **Test it yourself.** Run every case, reconcile with the source, regression-check impacted tables.
7. **Reviews.** Pull request, PO demo, QA hand-off with test cases and sample results.
8. **Deploy and watch.** CI/CD with release notes, then watch the first production runs (runtime, row counts, quality results) before closing the ticket.

> **Say it in about a minute:** "When a sprint starts, we size every story as a team. Before I write code, I analyse the ticket and every downstream table it affects, and write my test cases. I review the design with the architect, build it, test it against my own cases, then it goes through code review, a PO demo and QA. After sign-off I deploy through CI/CD and watch the first production runs before I close the ticket."

## 3. Day to day: six real scenarios

| Scenario | What happens | Say |
|---|---|---|
| **Sprint start day** | Review the backlog, clarify vague stories, split anything XL, start ticket analysis the same day. | "I'd rather spend an hour asking questions on day one than rework a pipeline on day eight." |
| **A normal development day** | Check pipeline health, stand-up, then focused building against tests you already wrote; review teammates' PRs. | "Because my test cases are ready before I start, development is mostly making those cases pass." |
| **A production failure in the morning** | Check impact, find the cause (source data, infrastructure or code), fix or rerun safely, update downstream teams, write the RCA. | "My first job is to get correct data back and keep people informed. Root cause and prevention come right after." |
| **Requirement changes mid-sprint** | Check what it affects, tell the PO the impact honestly, update tests first, then code. | "I don't absorb changes silently. I show the impact, let the PO decide, and update the tests before the code." |
| **Deployment day** | Release notes and rollback plan, deploy through CI/CD, watch the first runs, confirm with users. | "Deployment isn't done when the code is in production. It's done when the first runs are correct." |
| **"The numbers look wrong"** | Reproduce, trace the number layer by layer to the source, find where it changes (a join, a filter, a late file, a definition). | "I trace it layer by layer with evidence, so the conversation is about facts, not opinions." |

## 4. Adjust the story to the company

Same facts, different emphasis. Read the job description, find what it repeats, and lead with that part of your work.

| Company type | Emphasize | Add to your intro |
|---|---|---|
| **Product company** | Ownership, scale, design trade-offs, data quality as a product, measured impact. | "I like owning a pipeline end to end, and making it reliable at scale." |
| **Services / consulting** | Requirements, estimation, client communication, documentation, deadlines, many stakeholders. | "I turn business requirements into clear designs, estimate honestly and keep stakeholders updated." |
| **Banking / finance** | Accuracy, reconciliation, audit trails, controlled deployments, PII and access control. | "In finance data, being right matters more than being fast." |
| **E-commerce / retail** | Orders, inventory, pricing; daily freshness SLAs; dedup; peak sale days. | "Freshness matters every morning, and peak days can't fail." |
| **Manufacturing / IoT** | Time-series sensor data, late and out-of-order events, window aggregations. | "Late and out-of-order events are normal, not an exception." |

**Match the cloud in the JD.** Azure: lead with Databricks, Delta Lake, medallion, ADF, Azure DevOps. GCP: BigQuery (partitioning, clustering, cost) and Composer. AWS you haven't used: say the core (Spark, orchestration, lakehouse design) transfers and you pick up platform services quickly. Never claim a tool you can't explain two levels deeper.

## 5. Sound real, not scripted

| Don't say | Say instead |
|---|---|
| "I'm passionate about data." | Name the problem you like solving: "I like making pipelines people can trust." |
| "I'm a hardworking team player." | Show it: "I review my teammates' PRs and pair on their first on-call." |
| "I have worked on many technologies." | Name 5 or 6 that match the JD, and one place you used each. |
| "I did end-to-end development." | Say which ends: "from ticket analysis and test cases to deployment and monitoring." |
| Reading the resume line by line | Tell a story: who you are, what you own now, what you've seen, why this role. |
| Inventing numbers or tools | Only claim what you can explain two levels deeper. Interviewers always ask the next question. |

### What makes them pick you

1. You describe a **process**, not just tools.
2. You show **ownership**: you stay with the pipeline after it goes live.
3. You speak **their domain**.
4. Every claim **survives a follow-up** question.
5. You end with **why this role**.
`

export const CERTS = [
  { code: 'DP-900', name: 'Azure Data Fundamentals', when: 'Week 4', why: 'Quick win: data concepts and Azure data services. A few days of prep.', tier: 'Start' },
  { code: 'DP-700', name: 'Fabric Data Engineer Associate', when: 'Weeks 8–10', why: 'Microsoft\'s current data engineer exam. It replaced DP-203, which retired in March 2025. Covers lakehouses, pipelines and real-time data in Microsoft Fabric.', tier: 'Core' },
  { code: 'Databricks', name: 'Databricks Certified Data Engineer Associate', when: 'Weeks 10–12', why: 'PySpark, Delta Lake, medallion, Lakeflow and Unity Catalog. Very respected in data engineering interviews.', tier: 'Core' },
  { code: 'AZ-900', name: 'Azure Fundamentals', when: 'Optional', why: 'Cloud basics. Useful if you are new to Azure; skip it if DP-900 covers what you need.', tier: 'Optional' },
  { code: 'Snowflake', name: 'SnowPro Core', when: 'After the core', why: 'Valued at finance and retail firms that run Snowflake next to Azure.', tier: 'Bonus' },
  { code: 'GCP', name: 'Google Cloud Professional Data Engineer', when: 'After the core', why: 'For multi-cloud roles with BigQuery and Composer.', tier: 'Bonus' },
]

export const FREE_PLATFORMS = [
  { title: 'Databricks Free Edition', href: 'https://www.databricks.com/learn/free-edition', desc: 'A free Databricks workspace for learning: notebooks, PySpark, Delta Lake, SQL. It replaced Community Edition.' },
  { title: 'Databricks Academy', href: 'https://www.databricks.com/learn/training', desc: 'Free self-paced learning paths for Spark, Delta Lake and the certification exams.' },
  { title: 'Microsoft Learn', href: 'https://learn.microsoft.com/en-us/training/', desc: 'Official, free learning paths with sandboxed exercises for Azure data services and Fabric.' },
  { title: 'Azure free account', href: 'https://azure.microsoft.com/free', desc: 'Free credit for your first month plus always-free services. Enough to try ADF and ADLS.' },
  { title: 'DataTalksClub DE Zoomcamp', href: 'https://github.com/DataTalksClub/data-engineering-zoomcamp', desc: 'A free, community-run 9 to 10 week course with a graded capstone. Great companion for orchestration and Kafka.' },
  { title: 'StrataScratch and LeetCode SQL', href: 'https://www.stratascratch.com', desc: 'More real interview SQL once you finish the 78 questions here.' },
]

export const MANTRAS = [
  'Don\'t live in imposter syndrome, at work or anywhere else. You belong in the room. Own it.',
  'Be compact and precise. Know your priority and leave behind what is good to leave behind. Clarity beats complexity.',
  'Learn the roots of a problem before you reach for the fruits of success. Deep understanding outlasts surface knowledge.',
  'Learn to talk. Your ideas don\'t count if they stay in your head. Speak up, write, share, teach.',
  'Everybody has their own perspective. Don\'t try to be unique in someone else\'s way. Build your own standout.',
  'Winners don\'t daydream about winning. They give their best. Focus on the work, not the outcome.',
  'Upgrade your versions: fix your bugs and ship a feature for yourself. You are software. Keep shipping.',
  'Don\'t isolate yourself. The best engineers learn from others and build together. Community is strength.',
]

export const FINAL_WORD = 'The best time to start was yesterday. The second best time is now. Open the SQL lab, write one query, and begin. Every expert was once a beginner who refused to quit.'
