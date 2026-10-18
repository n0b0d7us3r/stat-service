import { parseTaskDescriptionBlocks } from '../utils/taskDescription';
import { TaskDescriptionImage } from './TaskDescriptionImage';

interface TaskDescriptionContentProps {
  value: string;
  className?: string;
  emptyPlaceholder?: string;
}

export function TaskDescriptionContent({
  value,
  className = '',
  emptyPlaceholder = 'Описание не добавлено.',
}: TaskDescriptionContentProps) {
  const trimmed = value.trim();

  if (!trimmed) {
    return <p className={`task-description-empty ${className}`.trim()}>{emptyPlaceholder}</p>;
  }

  const blocks = parseTaskDescriptionBlocks(value);

  return (
    <div className={`task-description-content ${className}`.trim()}>
      {blocks.map((block, index) => {
        if (block.type === 'image') {
          return (
            <figure key={`img-${index}-${block.url}`} className="task-description-figure">
              <TaskDescriptionImage
                url={block.url}
                alt={block.alt || 'Изображение в описании задачи'}
              />
            </figure>
          );
        }

        return (
          <span key={`text-${index}`} className="task-description-text">
            {block.value}
          </span>
        );
      })}
    </div>
  );
}
