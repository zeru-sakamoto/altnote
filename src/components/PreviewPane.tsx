import { useEffect, useState } from 'react';
import MarkdownIt from 'markdown-it';
import styles from './PreviewPane.module.css';

interface Props {
  content: string;
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });
const RENDER_DELAY_MS = 150;

export default function PreviewPane({ content }: Props) {
  const [html, setHtml] = useState(() => md.render(content));

  // Debounced: re-parsing the whole document on every keystroke makes fast
  // typing lag once a doc gets long, same tradeoff as the autosave delay.
  useEffect(() => {
    const timer = setTimeout(
      () => setHtml(md.render(content)),
      RENDER_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [content]);

  return (
    <div
      className={styles.preview}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
