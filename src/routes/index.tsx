import { createFileRoute } from '@tanstack/react-router';
import Layout from '../components/Layout';
import ExcelPage from '../pages/ExcelPage';

export const Route = createFileRoute('/')({
  component: () => (
    <Layout>
      <ExcelPage />
    </Layout>
  ),
});