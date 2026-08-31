import { Link } from 'react-router-dom'
import './ProgramsPage.css'

const groups = [
  {
    eyebrow: 'Boys · Torah · Shabbos',
    title: 'Growing through Torah',
    image: '/programs/learning-circle.jpg',
    programs: [
      { name: 'Binareinu Night Seder', audience: 'Boys · 4th–8th grade', time: 'Sunday–Thursday · 7:30–8:00 PM', text: 'The flagship Neileich program: warm Rabbeim lead tailored learning groups, with chavrusos, review, growth, and friendships built around Torah.', image: '/programs/learning-circle.jpg' },
      { name: 'Siyumim & Siyum Hashanah', audience: 'Night Seder participants', time: 'Throughout the year', text: 'Boys celebrate their accomplishments with regular Shas Mishnayos siyumim and an end-of-year siyum and seudah together with their fathers and Rebbeim.', image: '/programs/chavrusa.jpg' },
      { name: 'The Rav’s Boys’ Programs', audience: 'Boys · 6th–8th grade', time: 'Shabbos afternoon & Motzaei Shabbos', text: 'A Shabbos-afternoon address and shiur, Motzaei Shabbos farhers, and Mishnayos Ba’al Peh give boys a meaningful and uplifting Shabbos rhythm.', image: '/programs/rav-and-bochurim.jpg' },
      { name: '4th Grade & Leil Shavuos', audience: 'Boys · 4th–8th grade', time: 'Weekly and Yom Tov programming', text: 'Learning, chavrusos, and sports help fourth graders connect. On Leil Shavuos, every age has a thoughtfully structured night of learning.', image: '/programs/learning-circle.jpg' },
      { name: 'Binareinu Mesivta', audience: 'Bochurim · 8th grade and up', time: 'Year-round', text: 'Masechtos Ba’al Peh and Erev Shabbos learning give older bochurim the chance to own their learning and use precious pre-Shabbos time with purpose.', image: '/programs/chavrusa.jpg' },
      { name: 'Chaburas Shabbos', audience: 'Boys · 3rd grade and up', time: 'Shabbos morning and afternoon', text: 'Bochurim chaburos, Parsha chaburos, and Marbeh Chaim create a natural, happy path into Shabbos through learning, refreshments, and connection.', image: '/programs/rav-and-bochurim.jpg' },
    ],
  },
  {
    eyebrow: 'Yom Tov · Family · Community',
    title: 'Making every day count',
    image: '/programs/rav-and-bochurim.jpg',
    programs: [
      { name: 'Rabbi Fendel’s Programs', audience: 'Children and families', time: 'Yom Tov, winter, and summer', text: 'Learning and enrichment when school is out: Greater Adventure South, Chanukah and Purim events, Midwinter programming, and more.', image: '/programs/rav-and-bochurim.jpg' },
      { name: 'Avos U’bonim & Dor L’Dor', audience: 'Fathers and children', time: 'Seasonal', text: 'Dedicated father-and-child learning opportunities throughout the year, with shiurim, refreshments, raffles, and memorable finales.', image: '/programs/chavrusa.jpg' },
      { name: 'Neileich Libraries', audience: 'Children and families', time: 'Weekly at neighborhood locations', text: 'Comic, reading, family, and USB libraries bring the magic of books home and make meaningful enrichment easily accessible.', image: '/programs/library-brochure.jpg', imagePosition: 'center bottom' },
      { name: 'Chol Hamoed Trips', audience: '4th grade through high school', time: 'Chol Hamoed', text: 'Rotating outings with separate boys’ and girls’ shifts, bussing, and opportunities for parents to participate as chaperones.', image: '/programs/basketball.jpg' },
      { name: 'Chanoch L’naar', audience: 'Parents', time: 'Annual Tamuz lecture series', text: 'A high-level chinuch lecture series that alternates yearly between men’s and women’s programming, featuring carefully chosen speakers.', image: '/programs/chavrusa.jpg' },
      { name: 'Commons Comments', audience: 'The neighborhood', time: 'Weekly newsletter', text: 'A community update that keeps neighbors connected to Simchos, services, and other important local information.', image: '/programs/rav-and-bochurim.jpg' },
    ],
  },
  {
    eyebrow: 'Girls · Chessed · Connection',
    title: 'Building confidence and community',
    image: '/programs/basketball.jpg',
    programs: [
      { name: 'Hearts & Palms', audience: 'Girls · 6th–10th grade', time: 'Weekly chessed', text: 'Girls bring practical help and heartfelt warmth to new mothers and mothers with young children—gaining as much as they give.', image: '/programs/basketball.jpg' },
      { name: 'Girls’ Homework Clubs', audience: 'Girls · 1st–5th grade', time: 'Monday–Wednesday evenings', text: 'A fun social homework setting where high-school girls offer warmth and individual help to younger girls.', image: '/programs/learning-circle.jpg' },
      { name: 'Camp after Camp', audience: 'Neighborhood girls', time: 'End-of-summer days', text: 'A professionally run day camp turns the days before school into an exciting, wholesome experience of crafts, activities, trips, and friendship.', image: '/programs/basketball.jpg' },
      { name: 'Girls’ Production', audience: 'Girls of all ages', time: 'Chol Hamoed Succos', text: 'A professionally written and directed production with divisions for acting, dance, props, costumes, and choir—so every girl has her ideal spotlight.', image: '/programs/rav-and-bochurim.jpg' },
      { name: 'Bnos', audience: 'Girls · Succos–Shavuos', time: 'Every Shabbos · 2:30–3:30 PM', text: 'Stories, games, contests, and nosh in neighborhood homes give girls a structured, enjoyable Shabbos afternoon and a real sense of Achdus.', image: '/programs/basketball.jpg' },
      { name: 'Girls’ Basketball', audience: 'Girls · 7th–8th grade and high school', time: 'Weekly', text: 'A welcoming weekly basketball program that builds friendships, encourages fitness, and creates a positive social outlet.', image: '/programs/basketball.jpg' },
    ],
  },
]

function ProgramCard({ program }) {
  return (
    <article className="program-card">
      <img src={program.image} alt="" style={{ objectPosition: program.imagePosition }} />
      <div className="program-card-body">
        <p className="program-card-audience">{program.audience}</p>
        <h3>{program.name}</h3>
        <p className="program-card-time">{program.time}</p>
        <p>{program.text}</p>
      </div>
    </article>
  )
}

export default function ProgramsPage() {
  return (
    <div className="programs-page">
      <section className="programs-page-hero">
        <div className="container">
          <p>NEILEICH PROGRAMS</p>
          <h1>The heartbeat of our community.</h1>
          <span>Every evening. Every weekend. Every vacation.</span>
        </div>
      </section>
      {groups.map((group, index) => (
        <section className={`program-section ${index % 2 ? 'program-section-tint' : ''}`} key={group.title}>
          <div className="container">
            <header className="program-section-heading">
              <div>
                <p>{group.eyebrow}</p>
                <h2>{group.title}</h2>
              </div>
              <img src={group.image} alt="Neileich programs in action" />
            </header>
            <div className="program-card-grid">
              {group.programs.map((program) => <ProgramCard program={program} key={program.name} />)}
            </div>
          </div>
        </section>
      ))}
      <section className="programs-page-cta">
        <div className="container">
          <h2>There’s a place for every child.</h2>
          <p>For program questions, registration, and the most current details, please get in touch with Neileich.</p>
          <Link to="/contact" className="btn btn-primary">Contact Neileich</Link>
        </div>
      </section>
    </div>
  )
}
