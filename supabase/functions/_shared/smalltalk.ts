// Greetings and small talk ("hello", "hi there", "thanks", "who are you"). These are not rules
// questions, so the SRD is not searched for them: a fuzzy search would only find noise (it once
// turned "Hello" into "hells"). The persona just greets the player back in its own voice.

import { normalize } from "./retrieval.ts";

const NAMES = "(?: (?:there|all|everyone|friend|friends|folks|sage|scribe|bard|wizard|arbiter|mate))?";
const PHRASES = [
  `(?:hello|hallo|hullo|hi|hiya|hey|heya|howdy|greetings|salutations|yo|hail|ahoy|well met|good (?:morning|afternoon|evening|day)|morning|evening)${NAMES}`,
  `(?:thanks|thank you|thank ye|thankyou|thx|ty|cheers|much obliged|ta)(?: (?:so|very) much| a lot| again)?${NAMES}`,
  "(?:who|what) are (?:you|ye|thou)",
  "who is this",
  "what is your name|whats your name|what your name",
  "what can you do|what do you do|how can you help(?: me)?|can you help(?: me)?",
  "how are (?:you|ye|thou)(?: doing| today)?|how you doing|hows it going|how it going|whats up|what up|sup",
  "(?:good ?bye|bye|farewell|good night|see you(?: later)?)" + NAMES,
  "nice to meet you|pleased to meet you",
  "(?:ok|okay|cool|great|nice|awesome|perfect|got it|lol|haha)",
  "(?:and|oh|well|so|um|uh)",
];
const LEAD = new RegExp(`^(?:${PHRASES.join("|")})(?: |$)`);

/** True when the whole message is greetings, thanks or small talk and nothing else.
 *  "Hail!" is small talk; "hail of thorns" and "hi, how does grappling work?" are not. */
export function isSmallTalk(question: string): boolean {
  let rest = normalize(question);
  if (!rest || rest.length > 80) return false;
  for (let guard = 0; guard < 12 && rest; guard++) {
    const match = LEAD.exec(rest);
    if (!match) return false;
    rest = rest.slice(match[0].length).trim();
  }
  return rest.length === 0;
}
