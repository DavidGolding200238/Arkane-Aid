// Greetings, thanks, reactions and casual chat ("hello", "thanks", "damn", "wow", "how are you").
// These are not rules questions, so the SRD is not searched for them: a fuzzy search would only
// find noise (it once turned "Hello" into "hells"). The persona answers them as a companion at
// the table would, carrying on the conversation (the short memory still rides along).

import { normalize } from "./retrieval.ts";

/** What kind of chat a message is. Picks the note the model gets (see message.ts). */
export type ChatKind = "greeting" | "thanks" | "farewell" | "chat";

const NAMES = "(?: (?:there|all|everyone|friend|friends|folks|sage|scribe|bard|wizard|arbiter|mate|man|bro|dude))?";

// Longest first, so "fair enough" is not cut short at "fair".
const REACTIONS = [
  "ok", "okay", "k", "kk", "cool", "great", "nice", "awesome", "perfect", "sweet", "neat", "got it", "lol",
  "lmao", "haha", "hahaha", "hehe", "ha", "damn", "dang", "darn", "dammit", "damnit", "god damn", "goddamn",
  "shit", "crap", "fuck", "fucking hell", "bloody hell", "hell", "hell yeah", "heck", "wow", "whoa", "woah",
  "omg", "oh my god", "wtf", "what the hell", "what the heck", "jeez", "geez", "yikes", "oof", "ouch", "ugh",
  "meh", "rip", "hmm", "hmmm", "huh", "eh", "ah", "aha", "oh no", "oh well", "no way", "really", "seriously",
  "for real", "fair", "fair enough", "true", "right", "alright", "all right", "yes", "yeah", "yep", "yup",
  "ya", "no", "nah", "nope", "sure", "i see", "makes sense", "interesting", "brutal", "harsh", "rough",
  "unlucky", "bummer", "sad", "good", "bad", "amazing", "epic", "love it", "i love it", "lets go", "let go",
  "lets gooo",
].sort((x, y) => y.length - x.length).join("|");

// Each group is tried at the start of what is left of the message, so "damn ok thanks" is
// a reaction followed by thanks. The strongest kind in the message wins (see KIND_ORDER).
const GROUPS: [ChatKind, string][] = [
  ["greeting", `(?:hello|hallo|hullo|hi|hiya|hey|heya|howdy|greetings|salutations|yo|hail|ahoy|well met|good (?:morning|afternoon|evening|day)|morning|evening)${NAMES}`],
  ["greeting", "nice to meet you|pleased to meet you"],
  ["thanks", `(?:thanks|thank you|thank ye|thankyou|thx|ty|cheers|much obliged|ta|appreciate it|i appreciate it)(?: (?:so|very) much| a lot| again)?${NAMES}`],
  ["farewell", `(?:good ?bye|bye|farewell|good night|see you(?: later)?|later|cya)${NAMES}`],
  ["chat", "(?:who|what) are (?:you|ye|thou)"],
  ["chat", "who is this"],
  ["chat", "what is your name|whats your name|what your name"],
  ["chat", "what can you do|what do you do|how can you help(?: me)?|can you help(?: me)?"],
  ["chat", "how are (?:you|ye|thou)(?: doing| today)?|how you doing|hows it going|how it going|whats up|what up|sup"],
  ["chat", "(?:i m|im|i am) (?:good|fine|ok|okay|great|alright|tired|bored|nervous|excited)(?: thanks)?"],
  // Short reactions, agreement and swearing. Never greetings.
  ["chat", `(?:${REACTIONS})`],
  ["chat", "(?:and|oh|well|so|um|uh|man|bro|dude|mate)"],
];
const PATTERNS = GROUPS.map(([kind, phrase]) => ({ kind, re: new RegExp(`^(?:${phrase})(?: |$)`) }));
const KIND_ORDER: ChatKind[] = ["greeting", "farewell", "thanks", "chat"];

/** The kind of chat when the whole message is greetings, thanks, reactions or small talk and
 *  nothing else; null for anything with a real question in it. "Hail!" and "Damn" are chat;
 *  "hail of thorns" and "hi, how does grappling work?" are not. */
export function chatKind(question: string): ChatKind | null {
  let rest = normalize(question);
  if (!rest || rest.length > 80) return null;
  const seen = new Set<ChatKind>();
  for (let guard = 0; guard < 12 && rest; guard++) {
    // Longest match first, so "hell yeah" is not read as "hell" then "yeah" and "good morning" beats "good".
    let best: { kind: ChatKind; length: number } | null = null;
    for (const { kind, re } of PATTERNS) {
      const match = re.exec(rest);
      if (match && (!best || match[0].length > best.length)) best = { kind, length: match[0].length };
    }
    if (!best) return null;
    seen.add(best.kind);
    rest = rest.slice(best.length).trim();
  }
  if (rest.length) return null;
  return KIND_ORDER.find((kind) => seen.has(kind)) ?? "chat";
}

/** True when the whole message is chat and nothing else (no SRD search for it). */
export function isSmallTalk(question: string): boolean {
  return chatKind(question) !== null;
}
