/**
 * Curated daily financial quotes.
 * ----------------------------------------------------------------------------
 * The daily provision gives every member one financial line to think about
 * and one lesson to finish. The quote half is curated here rather than
 * generated, because a cooperative wants words it can stand behind: every
 * line is either a well-known saying with an established author, a proverb,
 * or an original line written for the cooperative's own situation.
 *
 * The list is long enough that the same line does not come round again for
 * weeks, and the selection is deterministic (see src/lib/daily-provision.ts),
 * so every member sees the same quote on the same day.
 */

export interface FinancialQuote {
  text: string;
  /** Present only where the attribution is well established. */
  author?: string;
}

export const FINANCIAL_QUOTES: FinancialQuote[] = [
  { text: 'A budget is telling your money where to go, instead of wondering where it went.', author: 'Robert Kiyosaki' },
  { text: 'Do not save what is left after spending, but spend what is left after saving.', author: 'Warren Buffett' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
  { text: 'A penny saved is a penny earned.', author: 'Bulletin of the Franklin Institute' },
  { text: 'Wealth consists not in having great possessions, but in having few wants.', author: 'Epictetus' },
  { text: 'If you want to lift yourself up, lift up someone else.', author: 'Booker T. Washington' },
  { text: 'Pole pole: small steps finish the journey.', author: 'Zambian proverb' },
  { text: 'Little by little, a bird builds its nest.', author: 'African proverb' },
  { text: 'One hand does not clap alone.', author: 'Zambian proverb' },
  { text: 'He who eats alone, chokes alone.', author: 'Zambian proverb' },
  { text: 'K100 saved today is a share of land tomorrow.' },
  { text: 'The month you skip your subscription is the month you start borrowing.' },
  { text: 'Money that is not budgeted is money that is not yours.' },
  { text: 'Every subscription you pay is a vote in the kitty you will one day share in.' },
  { text: 'A member who saves quietly today will not beg loudly tomorrow.' },
  { text: 'Discipline is paying the small amount on the day it falls due.' },
  { text: 'Borrowing to consume is spending tomorrow\u2019s money today.' },
  { text: 'Keep the K100 that is hard to explain; spend the K1,000 that is easy.' },
  { text: 'A budget you keep is worth more than a budget you admire.' },
  { text: 'A mobile money balance is not wealth until it has been put to work.' },
  { text: 'Save first, then buy. Never the other way round.' },
  { text: 'Interest is the price of time. Know what you are paying for it.' },
  { text: 'Do not lend what you cannot afford to lose.' },
  { text: 'The member who keeps a record is the member who keeps control.' },
  { text: 'The poor buy things with money. The rich buy money with things.' },
  { text: 'Land does not pay you while you sleep. It pays you while you are patient.' },
  { text: 'Set aside for the rainy day before the rainy day sets in.' },
  { text: 'A loan you cannot service is not capital. It is a confession.' },
  { text: 'The best time to start saving was yesterday. The second best time is today.' },
  { text: 'If you cannot explain where your money went, you cannot decide where it should go.' },
  { text: 'Small savings added monthly beat one large saving you never make.' },
  { text: 'Your salary is what you are paid. Your net pay is what you keep.' },
  { text: 'Trust the plan you can still follow in a bad month.' },
  { text: 'Cooperative money is not a favour. It is a fee for a service you actually use.' },
  { text: 'The first duty of a treasurer is to make the numbers boring.' },
  { text: 'Nothing wrecks a budget like an emergency. Nothing fixes it like a plan.' },
  { text: 'Money follows habit, and habit follows the first small decision.' },
  { text: 'Ask what one kwacha buys today and what it will buy in five years.' },
  { text: 'A member who finishes one lesson a month finishes the year ahead of the rest.' },
  { text: 'Wealth is what you never have to say no to.' },
];
