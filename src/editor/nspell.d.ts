// nspell ships no types and has no @types package — this is a minimal ambient
// declaration covering only the API `spellcheck.ts` actually uses.
declare module 'nspell' {
  interface NSpellDictionary {
    aff: string;
    dic: string;
  }
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): NSpell;
  }
  export default function nspell(dictionary: NSpellDictionary): NSpell;
}
