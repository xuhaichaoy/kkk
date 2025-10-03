import { createFileRoute } from '@tanstack/react-router';
import Layout from '../../components/Layout';
import TodoPage from '../../pages/TodoPage';

export const Route = createFileRoute('/todo/')({
  component: () => (
    <Layout>
      <TodoPage />
    </Layout>
  ),
});
