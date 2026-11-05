// The learn -> practise -> build journey shown on the home page.
// Name chosen 2026-11-05 (pending Sagar's final pick). Change it here only.
export const JOURNEY = {
  name: 'Seekho. Karo. Dikhao.',
  tagline: 'Learn it, do it, show it. Each step builds on the last, and you finish with projects you can put on GitHub.',
  steps: [
    { word: 'Seekho', gloss: 'Learn', body: 'Short handbook chapters with examples you run on the page. Each one ends with a quiz and the interview angle.', to: '/learn', cta: 'Open the handbooks' },
    { word: 'Karo', gloss: 'Do', body: 'Solve real SQL and Python problems in the browser. Most answers are checked automatically against real data.', to: '/practice', cta: 'Start practising' },
    { word: 'Dikhao', gloss: 'Show', body: 'Build portfolio projects with messy data, tests and a README, then push them to GitHub and talk about them in interviews.', to: '/projects', cta: 'Pick a project' },
  ],
}
