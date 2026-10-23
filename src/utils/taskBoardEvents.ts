export const TASK_BOARD_CHANGED = 'stat:task-board-changed';

export function notifyTaskBoardChanged(): void {
  window.dispatchEvent(new Event(TASK_BOARD_CHANGED));
}
