// All visitor-facing copy lives here. Edit text freely; the animation code
// only reads from these objects and never hard-codes copy.

/**
 * Where the contact form sends enquiries. Leave empty until you have a real
 * inbox: the form then states clearly that it is not connected.
 * When set, the form opens the visitor's email app with a pre-filled draft
 * (mailto:). Nothing is sent from the browser to any server.
 */
export const CONTACT_EMAIL = ''

export const brand = {
  name: 'Xalvoric',
  tagline: 'Websites, AI agents and product ads, built by one studio.',
}

export const nav = [
  { label: 'Services', href: '#services' },
  { label: 'Process', href: '#process' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' },
]

/** Copy for the three beats of the cinematic hero. */
export const hero = {
  /** Small labels pinned to the top corners of the hero on wide screens. */
  corners: {
    left: 'Websites / AI agents / Product ads',
    right: 'One studio for the site, the systems behind it and the ads that bring people in.',
  },
  establish: {
    eyebrow: 'Xalvoric / Digital studio',
    title: 'We build what moves your business.',
    body: 'Websites, AI agents and product ad creative, designed and built by one team that cares how it all fits together.',
    primary: { label: 'Start a project', href: '#contact' },
    secondary: { label: 'See services', href: '#services' },
  },
  detail: {
    eyebrow: 'What we do',
    title: 'One studio. Three ways in.',
    /** Names only: the Services section below carries the detail, so nothing is said twice. */
    items: [
      { label: 'Website development', href: '#web' },
      { label: 'AI agency', href: '#ai' },
      { label: 'Ad generation', href: '#ads' },
    ],
  },
  resolve: {
    eyebrow: 'Next step',
    title: 'Bring us the problem. We will shape the build.',
    body: 'Tell us what you sell, who buys it and where things stall. We start every project with a scoping conversation.',
    primary: { label: 'Start a project', href: '#contact' },
  },
}

/** Intro block of the Services section ("Three ways we help a business grow."). */
export const servicesIntro = {
  eyebrow: 'Services',
  title: 'Three ways we help a business grow.',
  lede: 'Take one service or combine them. Each is led by the same team, so your site, your tools and your ads speak with one voice.',
  railLabel: 'Jump to a service',
}

export type Service = {
  id: string
  index: string
  /** Mono tag shown above the name, e.g. in the pinned stage. */
  kicker: string
  name: string
  /** One plain sentence on what changes for the client. Restates `fit`; claims nothing new. */
  outcome: string
  lede: string
  includes: string[]
  fit: string
}

export const services: Service[] = [
  {
    id: 'web',
    index: '01',
    kicker: 'Build',
    name: 'Website development',
    outcome: 'A site that explains what you sell.',
    lede: 'Marketing sites and web apps that load quickly, read clearly and are easy for your team to keep up to date.',
    includes: [
      'Positioning, page structure and copy direction',
      'Visual design, motion and responsive layouts',
      'Front-end build with accessible, semantic markup',
      'CMS or content setup, analytics and launch support',
    ],
    fit: 'You are launching, rebranding, or your current site no longer explains what you do.',
  },
  {
    id: 'ai',
    index: '02',
    kicker: 'Automate',
    name: 'AI agency',
    outcome: 'Less repeat work for your team.',
    lede: 'We design and build AI agents and automations around the work your team already does, from first draft to daily use.',
    includes: [
      'Workflow mapping to find where AI actually helps',
      'Custom agents, assistants and internal tools',
      'Integrations with the apps and data you already use',
      'Guardrails, human review steps and hand-over docs',
    ],
    fit: 'Your team repeats the same research, writing, support or admin tasks every week.',
  },
  {
    id: 'ads',
    index: '03',
    kicker: 'Create',
    name: 'Ad generation',
    outcome: 'More on-brand creative to test.',
    lede: 'AI-assisted product imagery and short video ads, art-directed so they look like your brand and not like a template.',
    includes: [
      'Creative concepts and hooks for each channel',
      'Product stills, lifestyle scenes and motion ads',
      'Variations sized for feeds, stories and reels',
      'Organised asset delivery ready for your ad accounts',
    ],
    fit: 'You need more creative to test than a traditional shoot can produce.',
  },
]

export const process = [
  {
    step: '01',
    name: 'Scope',
    body: 'A conversation about the business, the audience and the outcome. We agree what success looks like before anything is designed.',
  },
  {
    step: '02',
    name: 'Shape',
    body: 'Structure, direction and prototypes. You see real screens, flows or ad concepts early and steer them.',
  },
  {
    step: '03',
    name: 'Build',
    body: 'Production work in short, visible cycles, with review points instead of a single big reveal.',
  },
  {
    step: '04',
    name: 'Launch and refine',
    body: 'We ship, check it works with real use, and hand over everything your team needs to run it.',
  },
]

export const faq = [
  {
    q: 'Can I hire you for just one service?',
    a: 'Yes. Each service stands on its own. Some clients start with a website or an ad batch and add AI work later.',
  },
  {
    q: 'What does “AI agency” mean in practice?',
    a: 'We build AI-powered tools for your business: agents that research, draft, sort or answer, and automations that connect them to the software you already use. We start by finding the tasks where it is worth doing.',
  },
  {
    q: 'Do I need product photos for ad generation?',
    a: 'Clear photos of your real product give the most accurate results, so we ask for them when they exist. If you do not have any yet, we will talk through the options during scoping.',
  },
  {
    q: 'How is pricing set?',
    a: 'Every project is quoted after the scoping conversation, based on what you need built. We do not publish fixed packages.',
  },
  {
    q: 'Can you work on an existing website?',
    a: 'Often, yes. We review what you have first and tell you plainly whether a refresh or a rebuild makes more sense.',
  },
  {
    q: 'How do you handle our data in AI projects?',
    a: 'Data access, storage and which AI providers are used are agreed with you before any build starts, and kept to what the project needs.',
  },
]

export const contact = {
  title: 'Start a project',
  body: 'Share a few details and what you want to achieve. The more context, the better the first conversation.',
  serviceOptions: ['Website development', 'AI agency', 'Ad generation', 'Not sure yet'],
}
