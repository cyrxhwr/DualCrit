/**
 * The four persona/scenario pairs a team votes on.
 *
 * Carried over unchanged from the previous system. The `tag` values A–D are
 * the stable identifiers: they are what a vote records, what gets written to
 * activities.selected_scenario_tag, and what selects the persona prompt on
 * the backend. Editing the prose is safe; changing a tag is not.
 */
export interface Scenario {
  tag: 'A' | 'B' | 'C' | 'D';
  scenario: string;
  description: string;
  persona: {
    name: string;
    role: string;
    image: string;
    description: string;
  };
  context: string;
}

export const SCENARIOS: Scenario[] = [
  {
    tag: 'A',
    scenario:
      'Sofia frantically switches between Canvas and Google Classroom on her phone while her toddler clings to her leg, only to discover she missed the 11:59 PM deadline for her group project submission.',
    description:
      'How can we make managing tasks across multiple platforms easier and less overwhelming?',
    persona: {
      name: 'Sofia Nguyen',
      role: 'Single Parent & Part-Time Evening Student',
      image: '👩‍🎓',
      description:
        'Holds a high-school diploma; returned to school for career advancement while raising two children alone.',
    },
    context:
      'Sofia lives in a small apartment with her two children (ages 3 and 7). She works 30 hours per week at a retail store, attends evening classes three times a week, and manages all household responsibilities alone. Her limited free time is often interrupted by childcare needs, making it difficult to maintain consistent study schedules or participate fully in group projects.',
  },
  {
    tag: 'B',
    scenario:
      "Roberto sits at his kitchen table at 11 PM, surrounded by crumpled receipts and sticky notes, manually entering yesterday's sales data into three different spreadsheets while his wife asks when he'll come to bed.",
    description:
      'How can we make tracking daily sales and inventory less time-consuming and frustrating?',
    persona: {
      name: 'Roberto Alvarez',
      role: 'Independent Coffee Shop Owner',
      image: '👨‍💼',
      description:
        'Family-owned café operator for 15 years; just introduced a small catering service.',
    },
    context:
      "Roberto operates a small neighborhood coffee shop that has been in his family for two generations. Recently, he expanded into catering services to increase revenue, but this has doubled his administrative workload. He manages inventory, staff scheduling, customer orders, and financial tracking using a mix of paper records, basic spreadsheets, and a simple POS system that don't communicate with each other.",
  },
  {
    tag: 'C',
    scenario:
      "Fatima stands in a dusty schoolyard, holding a stack of handwritten health forms that she photographed with her phone, knowing that half the images are too blurry to read and she won't have internet access for another three days.",
    description:
      'How can we help health workers in rural areas feel confident about their data collection when internet is unreliable?',
    persona: {
      name: 'Fatima Hassan',
      role: 'Community Health Outreach Worker',
      image: '👵',
      description:
        'Public-health graduate; drives between rural clinics to educate about nutrition and vaccinations.',
    },
    context:
      'Fatima works for a regional health department, traveling to remote villages and rural schools to provide health screenings and education. She covers a territory of 200+ square miles with limited cellular coverage and unreliable internet access. Her work requires accurate record-keeping for patient follow-ups and health trend analysis, but she often must rely on paper forms and manual data entry when she returns to areas with connectivity.',
  },
  {
    tag: 'D',
    scenario:
      "Ethan stares at his screen, having just lost 20 minutes of debugging progress after being pulled into three different Slack channels, two urgent emails, and a failed deployment notification—now he can't remember where he left off in the code.",
    description:
      'How can we help software developers stay focused and organized when juggling multiple tools and notifications?',
    persona: {
      name: 'Ethan Walker',
      role: 'Junior Remote Software Developer',
      image: '👦',
      description:
        'Computer-science grad working from home for a distributed startup team.',
    },
    context:
      'Ethan works remotely for a fast-growing tech startup with a distributed team across four time zones. His work involves frequent context-switching between coding, code reviews, team meetings, customer support tickets, and deployment monitoring. The company uses multiple communication tools (Slack, email, GitHub, Jira, Zoom) and has a culture of rapid iteration, which means constant interruptions and shifting priorities throughout his workday.',
  },
];

export const scenarioByTag = (tag: string): Scenario | undefined =>
  SCENARIOS.find((s) => s.tag === tag);
