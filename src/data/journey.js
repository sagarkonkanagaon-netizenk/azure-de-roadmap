// The learn -> build -> get hired journey shown on the home page.
// Name chosen 2026-11-06 (Sagar asked for something meaningful; it echoes "On your highway to get hired"). Change it here only.
export const JOURNEY = {
  name: 'Learn. Build. Get hired.',
  tagline: 'Each step builds on the last, and you finish with projects you can put on GitHub and talk about in interviews.',
  steps: [
    { word: 'Learn', body: 'Short handbook chapters with examples you run on the page. Each one ends with a quiz and the interview angle.', to: '/learn', cta: 'Open the handbooks' },
    { word: 'Build', body: 'Solve real SQL and Python problems in the browser, then build portfolio projects with messy data, tests and a README.', to: '/practice', cta: 'Start practising' },
    { word: 'Get hired', body: 'Push your projects to GitHub, prepare with interview questions, and walk in able to explain every decision you made.', to: '/projects', cta: 'Pick a project' },
  ],
}
