import styles from './WelcomeScreen.module.css';

interface Props {
  recentFiles: string[];
  onOpenRecent: (path: string) => void;
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export default function WelcomeScreen({ recentFiles, onOpenRecent }: Props) {
  if (recentFiles.length === 0) return null;

  return (
    <div className={styles.welcome}>
      <p className={styles.hint}>Recent files</p>
      <ul className={styles.list}>
        {recentFiles.map((path) => (
          <li key={path}>
            <button onClick={() => onOpenRecent(path)}>
              <span className={styles.name}>{baseName(path)}</span>
              <span className={styles.path}>{path}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
