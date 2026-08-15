import MarkdownIt from 'markdown-it';
import styles from './PreviewPane.module.css';

interface Props {
  content: string;
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

export default function PreviewPane({ content }: Props) {
  const html = md.render(content);
  return (
    <div
      className={styles.preview}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
