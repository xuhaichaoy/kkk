import { createFileRoute } from '@tanstack/react-router';
import Layout from '../../components/Layout';
import ExcelPage from '../../pages/ExcelPage';

export const Route = createFileRoute('/excel/')({
  component: () => (
    <Layout>
      <ExcelPage />
    </Layout>
  ),
});
