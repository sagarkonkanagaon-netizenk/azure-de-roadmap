import { lazy } from 'react'
import { HashRouter, Outlet, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Gate from './components/Gate.jsx'
import Home from './pages/Home.jsx'

// Every page except Home loads on demand, so the first visit downloads only what it shows.
// After a new deploy the old chunk files are gone, so a stale tab reloads once to pick up the new ones.
const page = (load, name = 'default') => lazy(() => load().then(
  (m) => { try { sessionStorage.removeItem('dd:reloaded') } catch (e) { /* ignore */ } return { default: m[name] } },
  (err) => {
    let again = false
    try { again = !sessionStorage.getItem('dd:reloaded'); if (again) sessionStorage.setItem('dd:reloaded', '1') } catch (e) { /* ignore */ }
    if (again) { window.location.reload(); return new Promise(() => {}) }
    throw err
  },
))

const Path = page(() => import('./pages/Path.jsx'))
const Week = page(() => import('./pages/Path.jsx'), 'Week')
const Library = page(() => import('./pages/Learn.jsx'))
const Book = page(() => import('./pages/Learn.jsx'), 'Book')
const Chapter = page(() => import('./pages/Learn.jsx'), 'Chapter')
const GuidePhase = page(() => import('./pages/Learn.jsx'), 'GuidePhase')
const SqlLab = page(() => import('./pages/SqlLab.jsx'))
const Playground = page(() => import('./pages/Playground.jsx'))
const Daily = page(() => import('./pages/Daily.jsx'))
const PyLab = page(() => import('./pages/PyLab.jsx'))
const Practice = page(() => import('./pages/Practice.jsx'))
const Datasets = page(() => import('./pages/Datasets.jsx'))
const Drills = page(() => import('./pages/Drills.jsx'))
const Drill = page(() => import('./pages/Drills.jsx'), 'Drill')
const Interview = page(() => import('./pages/Interview.jsx'))
const Scenarios = page(() => import('./pages/Interview.jsx'), 'Scenarios')
const PySparkQs = page(() => import('./pages/Interview.jsx'), 'PySparkQs')
const Playbook = page(() => import('./pages/Interview.jsx'), 'Playbook')
const Flashcards = page(() => import('./pages/Flashcards.jsx'))
const Quiz = page(() => import('./pages/Quiz.jsx'))
const Visual = page(() => import('./pages/Visual.jsx'))
const Notes = page(() => import('./pages/Notes.jsx'))
const Note = page(() => import('./pages/Notes.jsx'), 'Note')
const Projects = page(() => import('./pages/Misc.jsx'), 'Projects')
const Resources = page(() => import('./pages/Misc.jsx'), 'Resources')
const About = page(() => import('./pages/Misc.jsx'), 'About')
const Pro = page(() => import('./pages/Misc.jsx'), 'Pro')
const NotFound = page(() => import('./pages/Misc.jsx'), 'NotFound')
const Privacy = page(() => import('./pages/Misc.jsx'), 'Privacy')
const Terms = page(() => import('./pages/Misc.jsx'), 'Terms')
const ProProject = page(() => import('./pages/ProProject.jsx'))
const SheetIndex = page(() => import('./pages/ProSheets.jsx'), 'SheetIndex')
const Sheet = page(() => import('./pages/ProSheets.jsx'), 'Sheet')
const ProgressPage = page(() => import('./pages/Progress.jsx'))
const Account = page(() => import('./pages/Account.jsx'))

// Known pages sit behind the sign-in gate; an unknown address skips it and shows the 404 page.
const Gated = () => <Gate><Outlet /></Gate>

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route element={<Gated />}>
            <Route index element={<Home />} />
            <Route path="path" element={<Path />} />
            <Route path="path/:week" element={<Week />} />
            <Route path="learn" element={<Library />} />
            <Route path="learn/azure/:phase" element={<GuidePhase />} />
            <Route path="learn/:book" element={<Book />} />
            <Route path="learn/:book/:chapter" element={<Chapter />} />
            <Route path="practice" element={<Practice />} />
            <Route path="practice/sql" element={<SqlLab />} />
            <Route path="practice/sql/:n" element={<SqlLab />} />
            <Route path="practice/python" element={<PyLab />} />
            <Route path="practice/python/:n" element={<PyLab />} />
            <Route path="drills" element={<Drills />} />
            <Route path="drills/:id" element={<Drill />} />
            <Route path="interview" element={<Interview />} />
            <Route path="interview/scenarios" element={<Scenarios />} />
            <Route path="interview/pyspark" element={<PySparkQs />} />
            <Route path="interview/playbook" element={<Playbook />} />
            <Route path="interview/flashcards" element={<Flashcards />} />
            <Route path="interview/quiz" element={<Quiz />} />
            <Route path="quiz" element={<Quiz />} />
            <Route path="visual" element={<Visual />} />
            <Route path="playground" element={<Playground />} />
            <Route path="practice/tables" element={<Datasets />} />
            <Route path="datasets" element={<Datasets />} />
            <Route path="daily" element={<Daily />} />
            <Route path="daily/:n" element={<Daily />} />
            <Route path="notes" element={<Notes />} />
            <Route path="notes/:slug" element={<Note />} />
            <Route path="projects" element={<Projects />} />
            <Route path="resources" element={<Resources />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="account" element={<Account />} />
            <Route path="pro" element={<Pro />} />
            <Route path="pro/projects/food-delivery-lakehouse" element={<ProProject />} />
            <Route path="pro/cheatsheets" element={<SheetIndex />} />
            <Route path="pro/cheatsheets/:slug" element={<Sheet />} />
            <Route path="about" element={<About />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms" element={<Terms />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
