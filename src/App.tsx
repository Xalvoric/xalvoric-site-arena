import { Nav } from './components/Nav'
import { ScrollScene } from './components/ScrollScene'
import { Faq, Process } from './components/Sections'
import { Services } from './components/Services'
import { Contact } from './components/Contact'
import { Footer } from './components/Footer'

export default function App() {
  return (
    <>
      <Nav />
      <main id="main" tabIndex={-1}>
        <ScrollScene />
        <Services />
        <Process />
        <Faq />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
