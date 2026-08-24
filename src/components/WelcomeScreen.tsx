import { IconHistory } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  recentFiles: string[];
  onOpenRecent: (path: string) => void;
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export default function WelcomeScreen({ recentFiles, onOpenRecent }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-8">
      {recentFiles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <IconHistory size={28} stroke={1.5} />
          <p className="text-sm">No recent files yet</p>
        </div>
      ) : (
        <div className="pointer-events-auto w-full max-w-[340px]">
          <p className="mb-2 px-2.5 text-xs text-muted-foreground">
            Recent files
          </p>
          <ScrollArea className="max-h-80">
            <ul className="flex flex-col gap-1">
              {recentFiles.map((path) => (
                <li key={path}>
                  <Button
                    variant="outline"
                    onClick={() => onOpenRecent(path)}
                    className="h-auto w-full flex-col items-start gap-0.5 px-2.5 py-2 text-left"
                  >
                    <span className="w-full truncate text-sm font-medium text-foreground">
                      {baseName(path)}
                    </span>
                    <span className="w-full truncate text-xs text-muted-foreground">
                      {path}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
