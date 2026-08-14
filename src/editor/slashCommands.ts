import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';

interface SlashCommand {
  label: string;
  detail: string;
  insert: string;
  /** Where to place the cursor after inserting, relative to the start of `insert`. Defaults to the end. */
  cursorOffset?: number;
}

const COMMANDS: SlashCommand[] = [
  { label: 'Heading 1', detail: '# ', insert: '# ' },
  { label: 'Heading 2', detail: '## ', insert: '## ' },
  { label: 'Heading 3', detail: '### ', insert: '### ' },
  { label: 'Bold', detail: '**text**', insert: '****', cursorOffset: 2 },
  { label: 'Italic', detail: '*text*', insert: '**', cursorOffset: 1 },
  { label: 'Bulleted List', detail: '- ', insert: '- ' },
  { label: 'Numbered List', detail: '1. ', insert: '1. ' },
  { label: 'Quote', detail: '> ', insert: '> ' },
  { label: 'Code Block', detail: '```', insert: '```\n\n```', cursorOffset: 4 },
  {
    label: 'Table',
    detail: '| | |',
    insert: '| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n',
  },
  { label: 'Link', detail: '[text](url)', insert: '[]()', cursorOffset: 1 },
  { label: 'Image', detail: '![alt](url)', insert: '![]()', cursorOffset: 2 },
  { label: 'Horizontal Rule', detail: '---', insert: '---\n' },
];

function applyCommand(
  view: EditorView,
  cmd: SlashCommand,
  from: number,
  to: number,
) {
  const offset = cmd.cursorOffset ?? cmd.insert.length;
  view.dispatch({
    changes: { from, to, insert: cmd.insert },
    selection: { anchor: from + offset },
  });
}

/** Triggers when `/` is the only non-whitespace content typed so far on the current line. */
function slashCommandSource(
  context: CompletionContext,
): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);
  const match = /^(\s*)\/(\w*)$/.exec(textBefore);
  if (!match) return null;

  const from = line.from + match[1].length;
  return {
    from,
    to: context.pos,
    options: COMMANDS.map((cmd) => ({
      label: cmd.label,
      detail: cmd.detail,
      apply: (
        view: EditorView,
        _completion,
        applyFrom: number,
        applyTo: number,
      ) => applyCommand(view, cmd, applyFrom, applyTo),
    })),
    validFor: /^\/\w*$/,
  };
}

export const slashCommands = autocompletion({ override: [slashCommandSource] });
