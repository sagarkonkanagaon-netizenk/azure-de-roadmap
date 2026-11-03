// The site in four sections. Menus, footer, breadcrumbs and page colours all come from this list.
export const SECTIONS = [
  {
    id: 'learn', label: 'Learn', icon: '🎓', blurb: 'Understand it',
    lead: 'A 12-week path, four handbooks and animated SQL. Read a little every day.',
    items: [
      { to: '/path', icon: '🗺️', label: '12-week path', desc: 'Week by week, SQL to lakehouse' },
      { to: '/learn', icon: '📚', label: 'Handbooks', desc: '98 chapters from real production work' },
      { to: '/visual', icon: '✨', label: 'Visual SQL', desc: 'Joins and window functions, animated' },
      { to: '/notes', icon: '📝', label: 'Notes & PDFs', desc: 'Download the handbooks to keep' },
      { to: '/projects', icon: '🏗️', label: 'Projects', desc: 'Portfolio builds you can show' },
      { to: '/resources', icon: '🔗', label: 'Resources', desc: 'Certifications and free platforms' },
    ],
  },
  {
    id: 'practice', label: 'Practice', icon: '🛠️', blurb: 'Do it',
    lead: 'Real SQL and Python running in your browser, plus broken pipelines to fix.',
    items: [
      { to: '/practice/sql', icon: '🗄️', label: 'SQL Lab', desc: '78 questions, checked instantly' },
      { to: '/playground', icon: '🧪', label: 'SQL Playground', desc: 'Any query on 2.6M rows' },
      { to: '/practice/python', icon: '🐍', label: 'Python Lab', desc: 'Coding problems with auto-checks' },
      { to: '/drills', icon: '🚨', label: 'Incident drills', desc: 'Fix a pipeline that broke at 3 AM' },
    ],
  },
  {
    id: 'interview', label: 'Interview', icon: '🎤', blurb: 'Get hired',
    lead: 'Quizzes, flashcards and model answers for the rounds that decide offers.',
    items: [
      { to: '/interview', icon: '🎯', label: 'Interview hub', desc: 'Everything for interview day' },
      { to: '/interview/quiz', icon: '🧠', label: 'Quiz', desc: '102 questions on Azure, AWS and GCP' },
      { to: '/interview/flashcards', icon: '🃏', label: 'Flashcards', desc: 'Five minutes of spaced repetition' },
      { to: '/interview/scenarios', icon: '🔥', label: 'Scenario questions', desc: 'Model answers and push-backs' },
      { to: '/interview/pyspark', icon: '⚡', label: 'PySpark questions', desc: 'Think first, then compare' },
      { to: '/interview/playbook', icon: '🎙️', label: 'Tell me about yourself', desc: 'The six-beat intro' },
    ],
  },
  {
    id: 'daily', label: 'Daily', icon: '🔥', blurb: 'Keep the streak',
    lead: 'One SQL challenge a day, the same for everyone.',
    items: [{ to: '/daily', icon: '🔥', label: 'Daily SQL challenge', desc: 'A new question every midnight' }],
  },
]

const PREFIX = [
  ['/daily', 'daily'], ['/interview', 'interview'], ['/quiz', 'interview'],
  ['/practice', 'practice'], ['/playground', 'practice'], ['/drills', 'practice'],
  ['/path', 'learn'], ['/learn', 'learn'], ['/visual', 'learn'], ['/notes', 'learn'], ['/projects', 'learn'], ['/resources', 'learn'],
]

export function sectionOf(pathname) {
  const hit = PREFIX.find(([p]) => pathname === p || pathname.startsWith(p + '/'))
  return hit ? SECTIONS.find((s) => s.id === hit[1]) : null
}

// The most specific menu item for a path, used for the breadcrumb.
export function itemOf(pathname, sec) {
  if (!sec) return null
  return [...sec.items].sort((a, b) => b.to.length - a.to.length).find((i) => pathname === i.to || pathname.startsWith(i.to + '/')) || null
}
