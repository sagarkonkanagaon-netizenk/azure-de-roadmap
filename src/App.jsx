import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Path, { Week } from './pages/Path.jsx'
import Library, { Book, Chapter, GuidePhase } from './pages/Learn.jsx'
import SqlLab from './pages/SqlLab.jsx'
import Playground from './pages/Playground.jsx'
import Daily from './pages/Daily.jsx'
import PyLab from './pages/PyLab.jsx'
import Practice from './pages/Practice.jsx'
import Drills, { Drill } from './pages/Drills.jsx'
import Interview, { Scenarios, PySparkQs, Playbook } from './pages/Interview.jsx'
import Flashcards from './pages/Flashcards.jsx'
import Quiz from './pages/Quiz.jsx'
import Visual from './pages/Visual.jsx'
import Notes, { Note } from './pages/Notes.jsx'
import { Projects, Resources, About, Pro, NotFound } from './pages/Misc.jsx'
import ProgressPage from './pages/Progress.jsx'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
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
          <Route path="daily" element={<Daily />} />
          <Route path="daily/:n" element={<Daily />} />
          <Route path="notes" element={<Notes />} />
          <Route path="notes/:slug" element={<Note />} />
          <Route path="projects" element={<Projects />} />
          <Route path="resources" element={<Resources />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="pro" element={<Pro />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
