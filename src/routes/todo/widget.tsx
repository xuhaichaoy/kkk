import { createFileRoute } from '@tanstack/react-router';
import TodoWidgetPage from '../../pages/TodoWidgetPage';

export const Route = createFileRoute('/todo/widget')({
  component: () => <TodoWidgetPage />,
});
