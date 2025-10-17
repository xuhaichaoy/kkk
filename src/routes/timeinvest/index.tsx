import { createFileRoute } from '@tanstack/react-router';
import Layout from '../../components/Layout';
import TimeInvestPage from '../../pages/TimeInvestPage';

export const Route = createFileRoute('/timeinvest/')({
  component: () => (
    <Layout>
      <TimeInvestPage />
    </Layout>
  ),
});

