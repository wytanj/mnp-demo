/**
 * Written proposal deck for M&P decision-makers, rendered at /proposal.
 *
 * The deck is emailed as a link with no presenter, so every slide carries
 * enough plain sentences to be read alone. Copy lives here as data so it can
 * be edited without touching the page component.
 *
 * Copy rules (Felicia, 2026-09-16): never name the customer's current software.
 * Say "your current system" or "the software you use today". Never use the
 * words API, bidirectional, system of record, webhook, MCP, DBOS, or any other
 * engineering term. Prefer connect, copy across, daily helper, official file.
 * `scripts/check-proposal-copy.mjs` enforces the banned list.
 */

export type SlideBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: readonly string[] }
  | { kind: 'steps'; items: readonly string[] }
  | { kind: 'callout'; title?: string; text: string }
  | { kind: 'link'; href: string; label: string; note?: string }

export interface Slide {
  /** URL slug: /proposal?slide=<id>. Stable when slides are reordered. */
  id: string
  /** Small label above the title, e.g. "Reviews & rewards". */
  kicker?: string
  title: string
  /** One sentence under the title. */
  lead?: string
  blocks: readonly SlideBlock[]
  /** Charcoal background with white text. Only the title slide uses it. */
  tone?: 'dark' | 'light'
}

export const PROPOSAL_SLIDES: readonly Slide[] = [
  {
    id: 'title',
    kicker: 'A written proposal for M&P',
    title: 'M&P Flow — a simpler way to run jobs, reviews, and customer messages',
    lead: 'A short trial with a few customers first.',
    tone: 'dark',
    blocks: [
      {
        kind: 'paragraph',
        text: 'This is a written proposal, not slides for a meeting. Nothing here asks you to change everything at once. Read it at your own pace, stop where you like, and pass it on to anyone at M&P who should see it. We have kept it in plain language so it makes sense without someone sitting beside you to explain it.'
      },
      {
        kind: 'paragraph',
        text: 'About 12 short pages. Use the Next button or the arrow keys on your keyboard to move through them.'
      }
    ]
  },
  {
    id: 'today',
    kicker: 'Where the day goes',
    title: 'What is hard today',
    lead: 'Nothing here is broken. It is simply spread out.',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Your team already knows how to move freight. The difficulty is that the pieces of one job sit in different places: the booking in one place, the customer’s WhatsApp messages on somebody’s phone, the email trail in a mailbox, and what the customer thought of the job somewhere else again.'
      },
      {
        kind: 'bullets',
        items: [
          'A message or a review slips past on a busy day, because nobody holds the whole picture of that job.',
          'The same facts get typed more than once, and the second copy is the one that quietly goes out of date.',
          'When a colleague is away, finding out where a job stands means asking around.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'This is not a fault of the tools you use today. It is what happens when one job is spread across several of them.'
      }
    ]
  },
  {
    id: 'proposal',
    kicker: 'The proposal',
    title: 'What we are proposing',
    lead: 'One place for each job, with everything about that job kept together.',
    blocks: [
      {
        kind: 'bullets',
        items: [
          'One job card for each shipment, so there is a single place to look.',
          'The customer’s WhatsApp messages and emails sitting under that same job.',
          'Reviews and rewards tied to the same job, so praise and problems trace back to real work.',
          'A clear trial plan, so you do not have to switch everything at once.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'We are not proposing a change to how M&P works as a whole. We are proposing a small, careful lane for a few customers, running alongside everything you do today, so you can judge it on real jobs rather than on a demonstration. The rest of this proposal explains what that lane looks like and how the trial protects you while it runs.'
      }
    ]
  },
  {
    id: 'reviews-rewards',
    kicker: 'In detail',
    title: 'Reviews and rewards',
    lead: 'Ask the happy customers, and catch the unhappy ones before they go public.',
    blocks: [
      {
        kind: 'paragraph',
        text: 'When a job finishes cleanly, M&P Flow asks that customer for a review. If they come back happy, that can lead to a small thank-you such as a voucher, so good service is rewarded rather than expected.'
      },
      {
        kind: 'paragraph',
        text: 'When something went wrong, the ask is held back. A damage claim or a dispute over a charge goes to your claims staff as a follow-up, rather than out as a public review. You settle the problem first, and ask later, if at all.'
      },
      {
        kind: 'bullets',
        items: [
          'Staff see on one screen who has been asked, who has replied, and who has received a reward.',
          'Nobody has to remember to chase a review, and nobody asks the wrong customer at the wrong moment.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'Over time this builds public feedback that matches the work you actually do, and saves your team the guesswork about who to ask.'
      }
    ]
  },
  {
    id: 'jobs',
    kicker: 'In detail',
    title: 'Jobs at the centre',
    lead: 'Every shipment is one job card.',
    blocks: [
      {
        kind: 'paragraph',
        text: 'A job card holds the whole story of one shipment in one screen, so nobody has to piece it together from memory.'
      },
      {
        kind: 'bullets',
        items: [
          'Status: what has happened so far, and what happens next.',
          'Documents: what has been received, and what is still outstanding.',
          'Messages: every conversation about that shipment, in one list.'
        ]
      },
      {
        kind: 'paragraph',
        text: '“Which job was this about?” stops being a hunt through inboxes and folders. Anyone covering for a colleague opens the card and sees the same picture, which matters most on the days someone is on leave or out at a warehouse. It also means a customer’s question can be answered while they are still on the phone.'
      }
    ]
  },
  {
    id: 'messages',
    kicker: 'In detail',
    title: 'WhatsApp and email under the job',
    lead: 'The conversations about a shipment sit with the shipment.',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Customers write where it suits them. One sends a WhatsApp at night, another replies to an email the next morning, and some do both about the same shipment. M&P Flow gathers those conversations into one list under the job, in the order they arrived.'
      },
      {
        kind: 'bullets',
        items: [
          'Staff read and reply from the job screen, so the reply is filed where it belongs.',
          'A thread still waiting on M&P is visible, so it is far less likely to sit unanswered.',
          'Handing over to a colleague means pointing at the job, not forwarding messages.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'Nothing changes for your customers. They keep writing to you the way they always have.'
      }
    ]
  },
  {
    id: 'two-systems',
    kicker: 'Your concern',
    title: 'Your concern: two systems',
    lead: 'You told us you do not want your team typing the same facts twice.',
    blocks: [
      {
        kind: 'callout',
        title: 'We heard you',
        text: 'Customers in the trial must still appear in the software you use today. We treat that as a condition of the trial, not as something to sort out afterwards.'
      },
      {
        kind: 'paragraph',
        text: 'This is the worry we have designed around. A trial that quietly doubles your staff’s typing is not worth running, however good the new screens look.'
      },
      {
        kind: 'paragraph',
        text: 'So the trial stays small, and the first thing we agree together is which facts must remain visible in the software you use today. There is no sudden cutover, no day when the old way stops working, and no request to move all your customers across.'
      }
    ]
  },
  {
    id: 'trial',
    kicker: 'The trial',
    title: 'How the trial works',
    lead: 'Five steps, in this order.',
    blocks: [
      {
        kind: 'steps',
        items: [
          'Choose a small number of customers for the trial — enough to be real, few enough to keep an eye on.',
          'For those customers’ jobs, your trial team works day to day in M&P Flow: jobs, messages, reviews and rewards.',
          'Those customers’ important records still show up in the software you use today, so nothing disappears from the place your colleagues check.',
          'A daily helper can copy the important updates across, once we have confirmed together what the software you use today allows.',
          'Everyone else at M&P keeps working exactly as they do now.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'If the trial does not earn its place, you stop it and nothing has been lost.'
      }
    ]
  },
  {
    id: 'before-daily-copy',
    kicker: 'Before we promise anything',
    title: 'What we do before promising a daily copy',
    lead: 'We look at the software you use today before we promise to copy anything across.',
    blocks: [
      {
        kind: 'paragraph',
        text: 'We will not claim that M&P Flow already talks to the software you use today, because we have not seen it yet. The honest next step is a short session where we sit with the person who uses it most and go through it together.'
      },
      {
        kind: 'bullets',
        items: [
          'What can be connected directly, so updates travel across on their own.',
          'What can be sent across as an official file, prepared once a day.',
          'What is better left as a simple checklist for now, done by a person.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'We only copy across daily where it is clear and safe. Anything uncertain stays with a person, in plain sight, until we are sure. No surprise switch-over, and no promise we cannot keep.'
      }
    ]
  },
  {
    id: 'familiar',
    kicker: 'What stays the same',
    title: 'What stays familiar',
    lead: 'The rest of M&P carries on exactly as it does now.',
    blocks: [
      {
        kind: 'bullets',
        items: [
          'The tools you use today keep running for the whole company.',
          'Nobody is asked to throw anything away on day one.',
          'Staff outside the trial team do not have to learn anything new.',
          'Your customers keep the same contacts, phone numbers and email addresses.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'This is a small lane beside the main road, not a new road. After a few weeks of real jobs you will have your own view: keep it, widen it, or close it. That decision stays with you, and it is made on what you saw in your own work rather than on anything we say here.'
      }
    ]
  },
  {
    id: 'live-demo',
    kicker: 'Optional',
    title: 'What you can try in the live demo',
    lead: 'If you would like to see it working, you can click through a demo on your own.',
    blocks: [
      {
        kind: 'link',
        href: 'https://mnp-flow.vercel.app',
        label: 'mnp-flow.vercel.app',
        note: 'Made-up example data. Nothing of yours is in it, and you cannot break it.'
      },
      {
        kind: 'steps',
        items: [
          'Open the front page and look for the three doors: Internal ops, Client portal and Driver. Choose Internal ops.',
          'Open Jobs and look for the card MP-3318-MC. On that one card sit the documents collected, the timeline of what has happened, and the messages about the shipment.',
          'Open Inbox and look for email and WhatsApp in one list, each message already sitting on its job.',
          'Open Reviews and look for who has been asked and which asks are held because a claim is open. Review programme shows the rewards that have gone out.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'This page is entirely optional. Nothing in the proposal depends on you trying it.'
      }
    ]
  },
  {
    id: 'asking',
    kicker: 'Next steps',
    title: 'What we are asking',
    lead: 'Four small things, and the trial can start.',
    blocks: [
      {
        kind: 'steps',
        items: [
          'Agree a short list of customers for the trial.',
          'Agree which facts must stay visible in the software you use today while the trial runs.',
          'Book a short session with us to look at that software together and see what it can connect or send out as a file.',
          'Start the trial once that list is clear.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'None of this commits you beyond the trial itself. The first two are conversations you can have internally; the third takes about an hour of one person’s time.'
      },
      {
        kind: 'paragraph',
        text: 'Thank you for the time you have already given us. We would rather start small, prove it on your own jobs, and let the work speak for itself.'
      }
    ]
  }
]

export function slideIndexById(id: unknown): number {
  const i = PROPOSAL_SLIDES.findIndex((s) => s.id === id)
  return i === -1 ? 0 : i
}
