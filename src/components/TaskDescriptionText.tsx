import {
  parseTaskDescriptionInline,
  type TaskDescriptionInlineSegment,
} from '../utils/taskDescription';

interface TaskDescriptionTextProps {
  value: string;
}

function renderSegment(segment: TaskDescriptionInlineSegment, index: number) {
  switch (segment.type) {
    case 'strong':
      return (
        <strong key={index} className="task-description-strong">
          {segment.value}
        </strong>
      );
    case 'em':
      return (
        <em key={index} className="task-description-em">
          {segment.value}
        </em>
      );
    case 'upper':
      return (
        <span key={index} className="task-description-upper">
          {segment.value}
        </span>
      );
    default:
      return segment.value;
  }
}

export function TaskDescriptionText({ value }: TaskDescriptionTextProps) {
  const segments = parseTaskDescriptionInline(value);

  return (
    <span className="task-description-text">
      {segments.map((segment, index) => renderSegment(segment, index))}
    </span>
  );
}
